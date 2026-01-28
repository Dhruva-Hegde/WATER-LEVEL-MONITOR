/************************************************************
 * SMART TANK NODE - FINAL FIXED VERSION
 * ----------------------------------------------------------
 * ✔ ESP8266 / ESP32
 * ✔ Works on WiFi + Mobile Hotspot
 * ✔ Socket.IO v4
 * ✔ mDNS optional
 * ✔ FIXED String& sendTXT issue
 ************************************************************/

/* ================= BOARD INCLUDES ================= */

#if defined(ESP8266)
#include <EEPROM.h>
#include <ESP8266WebServer.h>
#include <ESP8266WiFi.h>
#include <ESP8266mDNS.h>

#elif defined(ESP32)
#include <ESPmDNS.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

#else
#error "Only ESP8266 / ESP32 supported"
#endif

#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <Hash.h>
#include <WebSocketsClient.h>
#include <WiFiManager.h>

/* ================= USER CONFIG ================= */

#define TRIG_PIN D7
#define ECHO_PIN D6
#define RESET_PIN 0 // FLASH Button (GPIO 0 / D3)

#define SENSOR_INTERVAL 2000
#define DISCOVERY_INTERVAL 10000
#define HEARTBEAT_INTERVAL 10000

/* ================= GLOBALS ================= */

float tankHeightCM = 100.0;
WiFiManager wm;

#if defined(ESP32)
Preferences prefs;
#endif

#if defined(ESP8266)
ESP8266WebServer server(80);
#else
WebServer server(80);
#endif

WebSocketsClient webSocket;

// Stored config
String secret;
String tankId;
String serverUrl;

// Runtime state
String socketHost;
int socketPort = 3000;

bool isPaired = false;
bool wsInitialized = false;
bool isConnected = false;
bool isSocketIOHandshaked = false;

unsigned long lastDiscoveryAttempt = 0;

// Runtime state for delta reporting
int lastSentLevel = -1;
String lastSentStatus = "";
unsigned long lastSendTimestamp = 0;
bool shouldRestart = false;
unsigned long restartTimer = 0;

/* ================= LOG ================= */

void log(const String &tag, const String &msg) {
#if defined(ESP8266)
  uint32_t freeHeap = ESP.getFreeHeap();
  Serial.printf("[%s] %s (heap: %u)\n", tag.c_str(), msg.c_str(), freeHeap);
  if (freeHeap < 8000) {
    Serial.println("!!! LOW HEAP WARNING !!!");
  }
#else
  Serial.printf("[%s] %s\n", tag.c_str(), msg.c_str());
#endif
}

/* ================= CRYPTO ================= */

String calculateSignature(int level, String status, int rssi, String secret) {
  // 🔧 FIXED: Heap-safe construction
  String data;
  data.reserve(status.length() + secret.length() + 30);
  data = String(level);
  data += "|";
  data += status;
  data += "|";
  data += String(rssi);
  data += "|";
  data += secret;
  return sha1(data);
}

/* ================= WIFI ================= */

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    // WiFiManager typically handles persistence, but we'll monitor
    // and potentially trigger a reconnect or AP mode if desired.
    // For now, simple logging.
  }
}

/* ================= EEPROM (ESP8266) ================= */

#if defined(ESP8266)
void saveStringEEPROM(int addr, const String &value) {
  for (int i = 0; i < value.length(); i++) {
    EEPROM.write(addr + i, value[i]);
  }
  EEPROM.write(addr + value.length(), '\0');
  EEPROM.commit();
}

String loadStringEEPROM(int addr) {
  String out;
  char c;
  int i = 0;
  while ((c = EEPROM.read(addr + i)) != '\0' && i < 100) {
    // 🔧 FIXED: Validate character is printable ASCII
    if (c >= 32 && c <= 126) {
      out += c;
    } else if (c != '\0') {
      // Invalid character, stop reading
      break;
    }
    i++;
  }
  return out;
}
#endif

/* ================= SETTINGS ================= */

void parseServerUrl() {
  if (!serverUrl.startsWith("http://"))
    return;

  String host = serverUrl.substring(7);
  int idx = host.indexOf(":");

  if (idx > 0) {
    socketHost = host.substring(0, idx);
    socketPort = host.substring(idx + 1).toInt();
  } else {
    socketHost = host;
    socketPort = 80;
  }

  log("CONFIG", "Server " + socketHost + ":" + String(socketPort));
}

void loadSettings() {
#if defined(ESP32)
  prefs.begin("tank", false);
  secret = prefs.getString("secret", "");
  tankId = prefs.getString("tankId", "");
  serverUrl = prefs.getString("serverUrl", "");
  prefs.end();
#else
  EEPROM.begin(512);
  yield(); // Prevent watchdog
  secret = loadStringEEPROM(0);
  yield();
  tankId = loadStringEEPROM(100);
  yield();
  serverUrl = loadStringEEPROM(200);
  yield();
#endif

  isPaired = secret.length() > 0;
  if (isPaired)
    parseServerUrl();
}

/* ================= SENSOR ================= */

int getWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0)
    return -1;

  float dist = (duration * 0.0343) / 2.0;
  if (dist > tankHeightCM)
    dist = tankHeightCM;

  return round(((tankHeightCM - dist) / tankHeightCM) * 100.0);
}

/* ================= MDNS ================= */

bool findServerMDNS() {
  int n = MDNS.queryService("smart-tank-srv", "tcp");
  if (n <= 0)
    return false;

  socketHost = MDNS.IP(0).toString();
  socketPort = MDNS.port(0);
  return true;
}

/* ================= SOCKET EVENTS ================= */

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {

  if (type == WStype_DISCONNECTED) {
    log("SOCKET", "Disconnected");
    wsInitialized = false;
    isConnected = false;
    isSocketIOHandshaked = false;
  }

  else if (type == WStype_CONNECTED) {
    log("SOCKET", "Connected at transport level (waiting for handshake)");
  }

  else if (type == WStype_ERROR) {
    log("SOCKET", "Error occurred");
  }

  else if (type == WStype_TEXT) {

    // Engine.IO ping
    if (length == 1 && payload[0] == '2') {
      webSocket.sendTXT("3");
      return;
    }

    // 🔧 CRITICAL: Reject oversized messages
    if (length > 512) {
      log("SOCKET", "Message too large: " + String(length));
      return;
    }

    // 🔧 FIXED: Heap-safe string construction with yield()
    String msg;
    msg.reserve(length + 1);
    for (size_t i = 0; i < length; i++) {
      msg += (char)payload[i];
      if (i % 50 == 0)
        yield(); // Prevent watchdog
    }

    // Engine.IO open
    if (msg.startsWith("0")) {
      webSocket.sendTXT("40");
    }

    // Socket.IO connected
    else if (msg.startsWith("40")) {
      isConnected = true;
      isSocketIOHandshaked = true;

      // 🔧 FIXED: Heap-safe construction with reserve
      String identifyMsg;
      identifyMsg.reserve(secret.length() + 25);
      identifyMsg = "42[\"tank-identify\",\"";
      identifyMsg += secret;
      identifyMsg += "\"]";
      webSocket.sendTXT(identifyMsg);

      log("SOCKET", "Authenticated");
    }

    // Tank config
    else if (msg.indexOf("\"tank-config\"") > 0) {
      StaticJsonDocument<192> doc;
      int s = msg.indexOf(",") + 1;
      DeserializationError err =
          deserializeJson(doc, msg.substring(s, msg.length() - 1));
      if (!err && doc["height"]) {
        tankHeightCM = doc["height"];
        log("CONFIG", "Tank height updated: " + String(tankHeightCM));
      } else if (err) {
        log("ERROR", "JSON parse failed: " + String(err.c_str()));
      }
    }
  }
}

/* ================= WS INIT ================= */

void initWebSocket() {
  if (!isPaired) {
    log("WS", "Not paired, skipping init");
    return;
  }
  if (wsInitialized)
    return;

  // Proactively try to find server via mDNS if we don't have a working host
  if (socketHost.length() == 0 || !isConnected) {
    log("MDNS", "Refreshing server location...");
    if (findServerMDNS()) {
      log("MDNS", "Found server at " + socketHost + ":" + String(socketPort));
    }
  }

  if (socketHost.length() == 0) {
    log("WS", "No server host, waiting for discovery...");
    return;
  }

  log("WS", "Starting connection to " + socketHost + ":" + String(socketPort));
  String path = "/api/socket/io?EIO=4&transport=websocket";
  log("WS", "Path: " + path);
  webSocket.begin(socketHost, socketPort, path);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);

  wsInitialized = true;
}

/* ================= SETUP ================= */

void setup() {
  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(RESET_PIN, INPUT_PULLUP);

  // WiFiManager: Auto-portal if connection fails
  log("WiFi", "Initializing WiFiManager...");
  if (!wm.autoConnect("Smart-Tank-Setup", "setup123")) {
    log("WiFi", "Failed to connect and hit timeout. Restarting...");
    delay(3000);
    ESP.restart();
  }
  // 🔧 FIXED: Disable portal to free heap
  wm.setConfigPortalTimeout(0);
  log("WiFi", "Connected! IP: " + WiFi.localIP().toString());

  yield(); // Prevent watchdog
  loadSettings();
  yield();

  yield();

  // 🔧 FIXED: Safe mDNS initialization
  log("MDNS", "Starting mDNS...");
  if (MDNS.begin("smart-tank")) {
    MDNS.addService("smart-tank-node", "tcp", 80);
#if defined(ESP8266)
    MDNS.addServiceTxt("smart-tank-node", "tcp", "id",
                       String(ESP.getChipId(), HEX));
#else
    MDNS.addServiceTxt("smart-tank-node", "tcp", "id",
                       String((uint32_t)ESP.getEfuseMac(), HEX));
#endif
    log("MDNS", "Started successfully");
  } else {
    log("MDNS", "Failed to start (non-fatal)");
  }

  yield();

  log("OTA", "Starting OTA...");
  ArduinoOTA.setHostname(("tank-" + tankId).c_str());
  ArduinoOTA.setPassword("admin123"); // 🔒 PIN Protect OTA uploads
  ArduinoOTA.begin();
  log("OTA", "Started successfully");

  yield();

  server.on("/config", HTTP_POST, []() {
    if (millis() > 180000) { // 3 Minute Security Window
      server.send(403, "application/json",
                  "{\"error\":\"Pairing Window Closed. Restart Node.\"}");
      return;
    }

    StaticJsonDocument<192> doc;
    deserializeJson(doc, server.arg("plain"));

    String newSecret = doc["secret"];
    // 🔧 FIXED: Truncate to prevent EEPROM overlap
    if (newSecret.length() > 90)
      newSecret = newSecret.substring(0, 90);

#if defined(ESP8266)
    saveStringEEPROM(0, newSecret); // doc["secret"] via variable
    saveStringEEPROM(100, doc["tankId"]);
    saveStringEEPROM(200, doc["serverUrl"]);
#else
    prefs.begin("tank", false);
    prefs.putString("secret", newSecret);
    prefs.putString("tankId", doc["tankId"]);
    prefs.putString("serverUrl", doc["serverUrl"]);
    prefs.end();
#endif

    server.send(200, "application/json", "{\"ok\":true}");

    // 🔧 FIXED: Delayed restart to allow HTTP response to finish
    shouldRestart = true;
    restartTimer = millis();
    log("SYSTEM", "Config updated, rebooting in 1s...");
  });

  log("HTTP", "Starting web server...");
  server.begin();
  log("HTTP", "Server started on port 80");

  yield();
  log("SYSTEM", "Setup complete!");
}

/* ================= LOOP ================= */

void loop() {
#if defined(ESP8266)
  MDNS.update();
#endif

  server.handleClient();
  checkWiFi();
  ArduinoOTA.handle();

  // --- WiFi Reset Button Logic ---
  static unsigned long resetPressStart = 0;
  if (digitalRead(RESET_PIN) == LOW) { // Button Pressed (Active Low)
    if (resetPressStart == 0)
      resetPressStart = millis();
    if (millis() - resetPressStart > 5000) { // 5 Second Hold
      log("SYSTEM", "!!! WiFi Settings Reset !!!");
      wm.resetSettings();
      delay(1000);
      ESP.restart();
    }
  } else {
    resetPressStart = 0;
  }

  if (!wsInitialized && millis() - lastDiscoveryAttempt > DISCOVERY_INTERVAL) {
    initWebSocket();
    lastDiscoveryAttempt = millis();
  }

  // 🔧 FIXED: Guard loop to prevent spam/crashes
  if (wsInitialized)
    webSocket.loop();

  // Handle delayed restart
  if (shouldRestart && millis() - restartTimer > 1000) {
    ESP.restart();
  }

  static unsigned long lastSensorRead = 0;
  if (millis() - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = millis();

    if (isConnected && isSocketIOHandshaked) {
      int currentLevel = getWaterLevel();
      // Treat -1 (timeout) as 0% online to satisfy user requirement (0 is not
      // an error)
      String currentStatus = "online";
      int sendLevel = (currentLevel >= 0) ? currentLevel : 0;
      int rssi = WiFi.RSSI();

      bool shouldSend = false;

      // Rule 1: Send if level changed
      if (sendLevel != lastSentLevel)
        shouldSend = true;

      // Rule 2: Send if status changed
      if (currentStatus != lastSentStatus)
        shouldSend = true;

      // Rule 3: Heartbeat - Ensure at least one packet every 10s
      if (millis() - lastSendTimestamp > HEARTBEAT_INTERVAL)
        shouldSend = true;

      if (shouldSend) {
        lastSentLevel = sendLevel;
        lastSentStatus = currentStatus;
        lastSendTimestamp = millis();

        StaticJsonDocument<192> doc;
        doc["secret"] = secret;
        doc["level"] = sendLevel;
        doc["status"] = currentStatus;
        doc["rssi"] = rssi;
        doc["signature"] =
            calculateSignature(sendLevel, currentStatus, rssi, secret);

        String payload;
        serializeJson(doc, payload);

        // 🔧 FIXED: Safe blocked string construction
        String updateMsg;
        updateMsg.reserve(payload.length() + 20);
        updateMsg = "42[\"tank-update\",";
        updateMsg += payload;
        updateMsg += "]";

        webSocket.sendTXT(updateMsg);

        log("TELEMETRY",
            "Sent Sync: " + String(sendLevel) + "% (" + currentStatus + ")");
      }
    }
  }
}
