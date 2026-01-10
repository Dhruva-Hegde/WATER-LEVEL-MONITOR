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
  #error "This code only works on ESP8266 or ESP32 boards"
#endif

#include <WebSocketsClient.h>
#include <ArduinoJson.h>

/**
 * SMART TANK MONITOR - PRODUCTION FIRMWARE
 * ---------------------------------------
 * Features:
 * - mDNS Server & Node Discovery
 * - Socket.IO v4 Handshake Support
 * - Direct Sensor Reading (No Smoothing)
 * - RSSI Signal Strength Reporting
 * - WiFi Auto-Reconnect & Persistence
 * - Hardware Watchdog (ESP8266)
 */

// --- Network Configuration ---
#define WIFI_SSID "Malnad boys"
#define WIFI_PASS "malnad_boys_xd69"

// --- Ultrasonic Sensor Configuration ---
#define TRIG_PIN D7
#define ECHO_PIN D6
float tankHeightCM = 100.0;  // Default value, will be updated from server

#define SENSOR_INTERVAL 2000 
#define HEARTBEAT_INTERVAL 30000 

#if defined(ESP32)
Preferences prefs;
#endif

#if defined(ESP8266)
ESP8266WebServer server(80);
#else
WebServer server(80);
#endif

WebSocketsClient webSocket;

// Persistent Identifiers
String deviceId;
String secret;
String tankId;
String serverUrl;

// Discovery State
String socketHost;
int socketPort = 3000;
bool isPaired = false;
bool isConnected = false;
bool isSocketIOHandshaked = false;
bool wsInitialized = false;
unsigned long lastDiscoveryAttempt = 0;
const unsigned long discoveryInterval = 10000; 

// --- Helper: Serial Logger ---
void log(const String &tag, const String &msg) {
  Serial.printf("[%s] %s\n", tag.c_str(), msg.c_str());
}

// --- Helper: WiFi Health Check ---
void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastConnectAttempt = 0;
    if (millis() - lastConnectAttempt > 10000) {
      log("WiFi", "Connection lost, reconnecting...");
      WiFi.begin(WIFI_SSID, WIFI_PASS);
      lastConnectAttempt = millis();
    }
  }
}

// --- Helper: Direct Sensor Reading ---
int getWaterLevel() {
  // Ensure clean signal
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  
  // Trigger ultrasonic pulse
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  // Read echo pulse duration (timeout after 30ms = ~5m max range)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  
  // Check for valid reading
  if (duration == 0) {
    log("SENSOR", "No echo received - check sensor connection");
    return -1;  // Invalid reading
  }
  
  // Calculate distance from sensor to water surface
  // Speed of sound = 343 m/s = 0.0343 cm/µs
  // Distance = (duration / 2) * 0.0343
  float distanceCM = (duration * 0.0343) / 2.0;
  
  // Validate reading range
  if (distanceCM > tankHeightCM) {
    distanceCM = tankHeightCM;  // Tank is empty
  }
  if (distanceCM < 0) {
    distanceCM = 0;  // Invalid negative reading
  }
  
  // Convert to water level percentage
  // If sensor is at top: distance = 0 means full, distance = tankHeight means empty
  float waterLevel = tankHeightCM - distanceCM;
  float waterPercent = (waterLevel / tankHeightCM) * 100.0;
  
  // Clamp percentage to valid range
  if (waterPercent < 0) waterPercent = 0;
  if (waterPercent > 100) waterPercent = 100;
  
  return (int)round(waterPercent);
}

#if defined(ESP8266)
// --- EEPROM Logic (ESP8266) ---
void saveStringEEPROM(int addr, const String &value) {
  for (int i = 0; i < (int)value.length(); i++) EEPROM.write(addr + i, value[i]);
  EEPROM.write(addr + value.length(), '\0'); 
  EEPROM.commit();
}

String loadStringEEPROM(int addr) {
  String result = "";
  char c;
  int offset = 0;
  while ((c = (char)EEPROM.read(addr + offset)) != '\0') {
    result += c;
    offset++;
    if (offset > 99) break;
  }
  return result;
}
#endif

// --- Configuration Parsing ---
void parseServerUrl() {
  if (serverUrl.startsWith("http://")) {
    String hostPart = serverUrl.substring(7);
    int portIdx = hostPart.indexOf(":");
    if (portIdx != -1) {
      socketHost = hostPart.substring(0, portIdx);
      socketPort = hostPart.substring(portIdx + 1).toInt();
    } else {
      socketHost = hostPart;
      socketPort = 80;
    }
    log("CONFIG", "Target Server: " + socketHost + ":" + String(socketPort));
  }
}

void loadSettings() {
#if defined(ESP32)
  prefs.begin("tank-config", false);
  secret = prefs.getString("secret", "");
  tankId = prefs.getString("tankId", "");
  serverUrl = prefs.getString("serverUrl", "");
  prefs.end();
#elif defined(ESP8266)
  EEPROM.begin(512);
  secret = loadStringEEPROM(0);
  tankId = loadStringEEPROM(100);
  serverUrl = loadStringEEPROM(200);
#endif
  isPaired = (secret.length() > 0);
  if (isPaired) {
    log("SETTINGS", "Paired System Found. Node ID: " + tankId);
    parseServerUrl();
  } else {
    log("SETTINGS", "Node Unpaired. Listening for discovery...");
  }
}

// --- WebSocket Event Handler ---
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      log("SOCKET", "Disconnected!");
      isConnected = false;
      isSocketIOHandshaked = false;
      break;
      
    case WStype_CONNECTED:
      log("SOCKET", "Connected! Initializing Handshake...");
      break;
      
    case WStype_TEXT:
      {
        String text = String((char*)payload);
        
        // Protocol: Engine.IO HANDSHAKE
        if (text.startsWith("0")) {
          log("SOCKET", "Engine.IO Active. Scaling to Socket.IO...");
          webSocket.sendTXT("40");
        } 
        
        // Protocol: Socket.IO CONNECT ACK
        else if (text.startsWith("40")) {
          log("SOCKET", "Connection Established!");
          isSocketIOHandshaked = true;
          isConnected = true;
          
          // Identify Node to Server
          String msg = "42[\"tank-identify\",\"" + secret + "\"]";
          webSocket.sendTXT(msg);
          log("SOCKET", "Node Identified.");
        } 
        
        // Protocol: Tank Configuration from Server
        else if (text.indexOf("\"tank-config\"") > 0) {
          StaticJsonDocument<512> doc;
          int startIdx = text.indexOf("[\"tank-config\",") + 15;
          int endIdx = text.lastIndexOf("]");
          String jsonStr = text.substring(startIdx, endIdx);
          
          DeserializationError error = deserializeJson(doc, jsonStr);
          if (!error && doc.containsKey("height")) {
            tankHeightCM = doc["height"].as<float>();
            log("CONFIG", "Tank height updated: " + String(tankHeightCM) + " cm");
          }
        }
        
        // Protocol: Heartbeat Ping (2) -> Respond Pong (3)
        else if (text == "2") {
          webSocket.sendTXT("3");
        }
      }
      break;
  }
}

// --- mDNS Discovery ---
bool findServerMDNS() {
  log("mDNS", "Scanning for _smart-tank-srv._tcp...");
  int n = MDNS.queryService("smart-tank-srv", "tcp"); 
  if (n <= 0) {
    log("mDNS", "No servers found.");
    return false;
  }
  
  socketHost = MDNS.IP(0).toString();
  socketPort = MDNS.port(0);
  log("mDNS", "Discovered Server: " + socketHost + ":" + String(socketPort));
  return true;
}

void initWebSocket() {
  if (!isPaired || wsInitialized) return;
  
  if (findServerMDNS()) {
    String path = "/api/socket/io/?EIO=4&transport=websocket";
    webSocket.begin(socketHost, socketPort, path);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    wsInitialized = true;
    log("SYSTEM", "WebSocket Bridge Online");
  } else {
    lastDiscoveryAttempt = millis();
  }
}

// --- Setup ---
void setup() {
  Serial.begin(115200);
  delay(500);
  log("SYSTEM", "Smart Tank Node Booting...");
  
  // Initialize ultrasonic sensor pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    log("WiFi", "Connected. IP: " + WiFi.localIP().toString());
  } else {
    log("WiFi", "Connection timed out. Retrying in background.");
  }
  
  deviceId = WiFi.macAddress();
  deviceId.replace(":", "");
  loadSettings();
  
  // Start mDNS Responder
  if (MDNS.begin("smart-tank-" + deviceId)) {
    MDNS.addService("smart-tank-node", "tcp", 80);
    MDNS.addServiceTxt("smart-tank-node", "tcp", "id", deviceId);
    MDNS.addServiceTxt("smart-tank-node", "tcp", "paired", isPaired ? "true" : "false");
    log("mDNS", "Responder started: smart-tank-" + deviceId + " (Paired: " + (isPaired ? "Yes" : "No") + ")");
  } else {
    log("mDNS", "Failed to start responder!");
  }

  // HTTP Configuration Route
  server.on("/config", HTTP_POST, [](){
    String body = server.arg("plain");
    StaticJsonDocument<512> doc;
    deserializeJson(doc, body);
    
    String newSecret = doc["secret"];
    String newTankId = doc["tankId"];
    String newUrl = doc["serverUrl"];
    
#if defined(ESP8266)
    saveStringEEPROM(0, newSecret);
    saveStringEEPROM(100, newTankId);
    saveStringEEPROM(200, newUrl);
#else
    prefs.begin("tank-config", false);
    prefs.putString("secret", newSecret);
    prefs.putString("tankId", newTankId);
    prefs.putString("serverUrl", newUrl);
    prefs.end();
#endif
    
    server.send(200, "application/json", "{\"status\":\"ok\"}");
    log("HTTP", "Paired Successful. Rebooting...");
    delay(500);
    ESP.restart();
  });
  
  server.begin();
  log("HTTP", "Setup Interface Online");

#if defined(ESP8266)
  ESP.wdtEnable(WDTO_8S);
#endif
}

// --- Loop ---
void loop() {
#if defined(ESP8266)
  MDNS.update();
  ESP.wdtFeed();
#endif

  server.handleClient();
  checkWiFi();

  // Manage Connection
  if (isPaired) {
    if (!wsInitialized) {
      if (millis() - lastDiscoveryAttempt > discoveryInterval) {
        initWebSocket();
      }
    } else {
      webSocket.loop();
    }
  }

  // Telemetry Loop - Direct Sensor Reading
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck > SENSOR_INTERVAL) {
    lastCheck = millis();
    
    if (isConnected && isSocketIOHandshaked) {
      int currentLevel = getWaterLevel();
      
      // Only send if reading is valid
      if (currentLevel >= 0) {
        long rssi = WiFi.RSSI();
        
        StaticJsonDocument<256> doc;
        doc["secret"] = secret;
        doc["level"] = currentLevel;
        doc["status"] = "online";
        doc["rssi"] = rssi;
        
        String payload;
        serializeJson(doc, payload);
        
        String socketMessage = "42[\"tank-update\"," + payload + "]";
        webSocket.sendTXT(socketMessage);
        log("SENSOR", "Telemetry Sent: " + String(currentLevel) + "% (" + String(rssi) + "dBm)");
      } else {
        log("SENSOR", "Skipped invalid reading");
      }
    }
  }
}