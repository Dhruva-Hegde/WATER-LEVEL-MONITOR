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
  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  #include <ESP8266mDNS.h>
  #include <EEPROM.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <WebServer.h>
  #include <ESPmDNS.h>
  #include <Preferences.h>
#else
  #error "Only ESP8266 / ESP32 supported"
#endif

#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <Hash.h>
#include <WiFiManager.h>

/* ================= USER CONFIG ================= */

#define TRIG_PIN D7
#define ECHO_PIN D6

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

/* ================= LOG ================= */

void log(const String &tag, const String &msg) {
  Serial.printf("[%s] %s\n", tag.c_str(), msg.c_str());
}

/* ================= CRYPTO ================= */

String calculateSignature(int level, String status, int rssi, String secret) {
  // Stable format: level|status|rssi|secret
  String data = String(level) + "|" + status + "|" + String(rssi) + "|" + secret;
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
    out += c;
    i++;
  }
  return out;
}
#endif

/* ================= SETTINGS ================= */

void parseServerUrl() {
  if (!serverUrl.startsWith("http://")) return;

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
  secret = loadStringEEPROM(0);
  tankId = loadStringEEPROM(100);
  serverUrl = loadStringEEPROM(200);
#endif

  isPaired = secret.length() > 0;
  if (isPaired) parseServerUrl();
}

/* ================= SENSOR ================= */

int getWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;

  float dist = (duration * 0.0343) / 2.0;
  if (dist > tankHeightCM) dist = tankHeightCM;

  return round(((tankHeightCM - dist) / tankHeightCM) * 100.0);
}

/* ================= MDNS ================= */

bool findServerMDNS() {
  int n = MDNS.queryService("smart-tank-srv", "tcp");
  if (n <= 0) return false;

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

  else if (type == WStype_TEXT) {

    // Engine.IO ping
    if (length == 1 && payload[0] == '2') {
      webSocket.sendTXT("3");
      return;
    }

    char buf[length + 1];
memcpy(buf, payload, length);
buf[length] = '\0';

String msg = String(buf);


    // Engine.IO open
    if (msg.startsWith("0")) {
      webSocket.sendTXT("40");
    }

    // Socket.IO connected
    else if (msg.startsWith("40")) {
      isConnected = true;
      isSocketIOHandshaked = true;

      // 🔧 FIXED: use variable (not temporary String)
      String identifyMsg = "42[\"tank-identify\",\"" + secret + "\"]";
      webSocket.sendTXT(identifyMsg);

      log("SOCKET", "Authenticated");
    }

    // Tank config
    else if (msg.indexOf("\"tank-config\"") > 0) {
      StaticJsonDocument<256> doc;
      int s = msg.indexOf(",") + 1;
      deserializeJson(doc, msg.substring(s, msg.length() - 1));
      if (doc["height"]) tankHeightCM = doc["height"];
    }
  }
}

/* ================= WS INIT ================= */

void initWebSocket() {
  if (!isPaired || wsInitialized) return;

  // Proactively try to find server via mDNS if we don't have a working host
  if (socketHost.length() == 0 || !isConnected) {
    log("MDNS", "Refreshing server location...");
    if (findServerMDNS()) {
       log("MDNS", "Found server at " + socketHost + ":" + String(socketPort));
    }
  }

  if (socketHost.length() == 0) return;

  String path = "/api/socket/io/?EIO=4&transport=websocket";
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

  // WiFiManager: Auto-portal if connection fails
  log("WiFi", "Initializing WiFiManager...");
  if (!wm.autoConnect("Smart-Tank-Setup", "setup123")) {
    log("WiFi", "Failed to connect and hit timeout. Restarting...");
    delay(3000);
    ESP.restart();
  }
  log("WiFi", "Connected! IP: " + WiFi.localIP().toString());

  loadSettings();

  MDNS.begin("smart-tank");
  MDNS.addService("smart-tank-node", "tcp", 80);
#if defined(ESP8266)
  MDNS.addServiceTxt("smart-tank-node", "tcp", "id", String(ESP.getChipId(), HEX));
#else
  MDNS.addServiceTxt("smart-tank-node", "tcp", "id", String((uint32_t)ESP.getEfuseMac(), HEX));
#endif

  ArduinoOTA.setHostname(("tank-" + tankId).c_str());
  ArduinoOTA.setPassword("admin123"); // 🔒 PIN Protect OTA uploads
  ArduinoOTA.begin();

  server.on("/config", HTTP_POST, []() {
    if (millis() > 180000) { // 3 Minute Security Window
      server.send(403, "application/json", "{\"error\":\"Pairing Window Closed. Restart Node.\"}");
      return;
    }

    StaticJsonDocument<256> doc;
    deserializeJson(doc, server.arg("plain"));

#if defined(ESP8266)
    saveStringEEPROM(0, doc["secret"]);
    saveStringEEPROM(100, doc["tankId"]);
    saveStringEEPROM(200, doc["serverUrl"]);
#else
    prefs.begin("tank", false);
    prefs.putString("secret", doc["secret"]);
    prefs.putString("tankId", doc["tankId"]);
    prefs.putString("serverUrl", doc["serverUrl"]);
    prefs.end();
#endif

    server.send(200, "application/json", "{\"ok\":true}");
    ESP.restart();
  });

  server.begin();
}

/* ================= LOOP ================= */

void loop() {
#if defined(ESP8266)
  MDNS.update();
#endif

  server.handleClient();
  checkWiFi();
  ArduinoOTA.handle();

  if (!wsInitialized && millis() - lastDiscoveryAttempt > DISCOVERY_INTERVAL) {
    initWebSocket();
    lastDiscoveryAttempt = millis();
  }

  webSocket.loop();

  static unsigned long lastSensorRead = 0;
  if (millis() - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = millis();

    if (isConnected && isSocketIOHandshaked) {
      int currentLevel = getWaterLevel();
      String currentStatus = (currentLevel >= 0) ? "online" : "error";
      int sendLevel = (currentLevel >= 0) ? currentLevel : 0;
      int rssi = WiFi.RSSI();

      bool shouldSend = false;

      // Rule 1: Send if level changed
      if (sendLevel != lastSentLevel) shouldSend = true;

      // Rule 2: Send if status changed
      if (currentStatus != lastSentStatus) shouldSend = true;

      // Rule 3: Heartbeat - Ensure at least one packet every 10s
      if (millis() - lastSendTimestamp > HEARTBEAT_INTERVAL) shouldSend = true;

      if (shouldSend) {
        lastSentLevel = sendLevel;
        lastSentStatus = currentStatus;
        lastSendTimestamp = millis();

        StaticJsonDocument<256> doc;
        doc["secret"] = secret;
        doc["level"] = sendLevel;
        doc["status"] = currentStatus;
        doc["rssi"] = rssi;
        doc["signature"] = calculateSignature(sendLevel, currentStatus, rssi, secret);

        String payload;
        serializeJson(doc, payload);
        String updateMsg = "42[\"tank-update\"," + payload + "]";
        webSocket.sendTXT(updateMsg);

        log("TELEMETRY", "Sent Sync: " + String(sendLevel) + "% (" + currentStatus + ")");
      }
    }
  }
}
