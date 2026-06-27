/**
 * IoT-Based Smart Parking System (ESP32 Firmware)
 * 
 * Hardware Checklist:
 * - ESP32 microcontroller
 * - 2x HC-SR04 Ultrasonic Sensors (Entry and Exit)
 * - 4x IR Obstacle Sensors (Parking Slots 1 to 4)
 * - 2x SG90 Servo Motors (Entry and Exit Gates)
 * - 1x 16x2 LCD Display with I2C module (Address typically 0x27 or 0x3F)
 * 
 * Libraries Required:
 * - ESP32Servo (by Kevin Harrington) - library for servo control on ESP32
 * - LiquidCrystal_I2C (by Frank de Brabander) - library for I2C LCD displays
 * - Adafruit MQTT Library (by Adafruit) - library for MQTT client setup
 * - ArduinoJson (by Benoit Blanchon) - library for parsing/generating JSON (V6 or V7)
 */

#include <WiFi.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include "Adafruit_MQTT.h"
#include "Adafruit_MQTT_Client.h"

// ==========================================
// 1. CONFIGURATION: WI-FI & ADAFRUIT IO
// ==========================================
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASS       "YOUR_WIFI_PASSWORD"

#define AIO_SERVER      "io.adafruit.com"
#define AIO_SERVERPORT  1883
#define AIO_USERNAME    "YOUR_ADAFRUIT_USERNAME"
#define AIO_KEY         "YOUR_ADAFRUIT_IO_KEY"

// ==========================================
// 2. PIN ASSIGNMENTS
// ==========================================
// Ultrasonic Sensors (HC-SR04)
#define ENTRY_TRIG_PIN  12
#define ENTRY_ECHO_PIN  13
#define EXIT_TRIG_PIN   14
#define EXIT_ECHO_PIN   27

// IR Sensors for individual slots
#define NUM_SLOTS       4
const int irPins[NUM_SLOTS] = {34, 35, 32, 33};

// Servo Motors
#define ENTRY_SERVO_PIN 18
#define EXIT_SERVO_PIN  19

// LCD Configuration (SDA -> GPIO 21, SCL -> GPIO 22 on ESP32)
#define LCD_ADDR        0x27  // Change to 0x3F if 0x27 doesn't work
#define LCD_COLS        16
#define LCD_ROWS        2

// IR Sensor Active State Config
// Most IR sensors return LOW when detecting an object (car) and HIGH when vacant.
// If your IR sensors return HIGH when occupied, change this to false.
#define IR_ACTIVE_LOW   true 

// Distance threshold (cm) for ultrasonic sensor to trigger gate
#define GATE_TRIGGER_DIST 10.0 

// Reservation timeout duration (15 minutes in milliseconds)
#define RESERVE_TIMEOUT_MS (15 * 60 * 1000)

// ==========================================
// 3. GLOBAL VARIABLES & INSTANCES
// ==========================================
// Slot state representation: 0 = Vacant (Green), 1 = Occupied (Red), 2 = Reserved (Orange)
int slotStates[NUM_SLOTS] = {0, 0, 0, 0};
unsigned long reservationTimers[NUM_SLOTS] = {0, 0, 0, 0}; // Stores millis() when reserved

// Hardware Interfaces
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);
Servo entryServo;
Servo exitServo;

// Wi-Fi and MQTT Clients
WiFiClient client;
Adafruit_MQTT_Client mqtt(&client, AIO_SERVER, AIO_SERVERPORT, AIO_USERNAME, AIO_KEY);

// MQTT Feeds (Construct paths dynamically using Adafruit username)
// 1. parking-slots: Publishes JSON of current state: e.g. {"s1":0,"s2":1,"s3":2,"s4":0}
Adafruit_MQTT_Publish slotsPub = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/parking-slots");
// 2. parking-booking: Subscribes to booking events: e.g. {"slot":1,"action":"reserve"} or {"action":"open_gate"}
Adafruit_MQTT_Subscribe bookingSub = Adafruit_MQTT_Subscribe(&mqtt, AIO_USERNAME "/feeds/parking-booking");

// Keep track of last published state to avoid flooding MQTT
String lastJsonPayload = "";
unsigned long lastSensorReadTime = 0;
unsigned long lastMqttRetryTime = 0;

// ==========================================
// 4. FUNCTION DECLARATIONS
// ==========================================
void setupWiFi();
void connectMQTT();
float getDistance(int trigPin, int echoPin);
void updateSlotStates();
void handleGateLogic();
void processBookingMessage(char *message);
void checkReservationTimeouts();
void updateLCD();
void publishSlotStatus(bool forcePublish);
void openGate(Servo &gateServo, const char *gateName);

// ==========================================
// 5. SETUP & LOOP
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(10);
  Serial.println("\n--- Smart Parking System Initializing ---");

  // Initialize LCD Screen
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Parking");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");

  // Setup pin modes
  pinMode(ENTRY_TRIG_PIN, OUTPUT);
  pinMode(ENTRY_ECHO_PIN, INPUT);
  pinMode(EXIT_TRIG_PIN, OUTPUT);
  pinMode(EXIT_ECHO_PIN, INPUT);

  for (int i = 0; i < NUM_SLOTS; i++) {
    pinMode(irPins[i], INPUT);
  }

  // Attach Servo Motors
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  entryServo.setPeriodHertz(50);
  exitServo.setPeriodHertz(50);
  
  entryServo.attach(ENTRY_SERVO_PIN, 500, 2400);
  exitServo.attach(EXIT_SERVO_PIN, 500, 2400);

  // Set gates to closed position (0 degrees)
  entryServo.write(0);
  exitServo.write(0);

  // Setup WiFi
  setupWiFi();

  // Setup MQTT Subscriptions
  mqtt.subscribe(&bookingSub);

  // Read initial states
  updateSlotStates();
  publishSlotStatus(true);
  updateLCD();
}

void loop() {
  // Ensure WiFi and MQTT are connected
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }
  
  if (!mqtt.connected()) {
    connectMQTT();
  }

  // Maintain MQTT subscription handling
  mqtt.processPackets(10); // Check for incoming messages (wait 10ms max)
  
  // Read incoming commands on parking-booking feed
  Adafruit_MQTT_Subscribe *subscription;
  while ((subscription = mqtt.readSubscription(10))) {
    if (subscription == &bookingSub) {
      Serial.print("New Booking MQTT Signal Received: ");
      char* message = (char *)bookingSub.lastread;
      Serial.println(message);
      processBookingMessage(message);
    }
  }

  // Periodic Tasks (Every 1 second)
  unsigned long currentMillis = millis();
  if (currentMillis - lastSensorReadTime >= 1000) {
    lastSensorReadTime = currentMillis;

    updateSlotStates();
    checkReservationTimeouts();
    handleGateLogic();
    updateLCD();
    publishSlotStatus(false);
  }
}

// ==========================================
// 6. CORE LOGIC FUNCTIONS
// ==========================================

// Connects to Local Wi-Fi Router
void setupWiFi() {
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  
  lcd.clear();
  lcd.print("Connecting WiFi...");
  
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    lcd.clear();
    lcd.print("WiFi Connected!");
  } else {
    Serial.println("\nWiFi Connection Failed! Running in Offline Mode.");
    lcd.clear();
    lcd.print("WiFi Fail! Offline");
    delay(2000);
  }
}

// Connects to Adafruit IO MQTT Broker
void connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  unsigned long currentMillis = millis();
  // Prevent flooding connection attempts
  if (currentMillis - lastMqttRetryTime < 5000) return;
  lastMqttRetryTime = currentMillis;

  Serial.print("Connecting to Adafruit IO MQTT... ");
  int8_t ret = mqtt.connect();
  if (ret == 0) {
    Serial.println("Connected!");
    lcd.clear();
    lcd.print("MQTT Connected!");
    delay(1000);
  } else {
    Serial.print("Failed. Error code: ");
    Serial.println(mqtt.connectErrorString(ret));
    mqtt.disconnect();
  }
}

// Measures distance using Ultrasonic Sensor (HC-SR04)
float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH, 30000); // 30ms timeout (approx. 5 meters)
  if (duration == 0) return 999.0; // Return out-of-range value if timeout
  
  float distance = duration * 0.0343 / 2.0; // Calculate distance in cm
  return distance;
}

// Reads IR slot sensors and updates local state
void updateSlotStates() {
  for (int i = 0; i < NUM_SLOTS; i++) {
    bool irDetection = digitalRead(irPins[i]);
    
    // Convert IR reading to logical occupied state
    // For Active Low IR sensors, LOW means a car is detected (occupied)
    bool isPhysicallyOccupied = (IR_ACTIVE_LOW) ? (irDetection == LOW) : (irDetection == HIGH);
    
    if (isPhysicallyOccupied) {
      slotStates[i] = 1; // Mark as Occupied (1)
      reservationTimers[i] = 0; // Clear reservation timer if slot is filled
    } else {
      // If it's not physically occupied, check if it was previously occupied
      if (slotStates[i] == 1) {
        slotStates[i] = 0; // If slot becomes empty physically, mark as Vacant (0)
      }
      // Note: If slot state is 2 (Reserved), we keep it as 2 until the reservation timer expires
    }
  }
}

// Checks if slot reservation timers have exceeded the 15-minute threshold
void checkReservationTimeouts() {
  unsigned long currentMillis = millis();
  for (int i = 0; i < NUM_SLOTS; i++) {
    if (slotStates[i] == 2 && reservationTimers[i] > 0) {
      if (currentMillis - reservationTimers[i] >= RESERVE_TIMEOUT_MS) {
        Serial.print("Reservation for slot ");
        Serial.print(i + 1);
        Serial.println(" has expired.");
        slotStates[i] = 0; // Reset slot to vacant
        reservationTimers[i] = 0; // Clear timer
        publishSlotStatus(true); // Force publish the update immediately
      }
    }
  }
}

// Controls entry and exit servo gates based on ultrasonic readings and parking availability
void handleGateLogic() {
  float entryDist = getDistance(ENTRY_TRIG_PIN, ENTRY_ECHO_PIN);
  float exitDist = getDistance(EXIT_TRIG_PIN, EXIT_ECHO_PIN);

  // Count available slots
  int vacantSlots = 0;
  for (int i = 0; i < NUM_SLOTS; i++) {
    if (slotStates[i] == 0) {
      vacantSlots++;
    }
  }

  // ENTRY GATE LOGIC
  // Vehicle detected at entry gate
  if (entryDist > 0 && entryDist < GATE_TRIGGER_DIST) {
    Serial.print("Vehicle detected at entry gate. Distance: ");
    Serial.print(entryDist);
    Serial.println(" cm");

    if (vacantSlots > 0) {
      // If free slots are available, open gate
      openGate(entryServo, "Entry");
    } else {
      // No free slots
      Serial.println("Entry denied: Parking is full!");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print(" PARKING FULL! ");
      lcd.setCursor(0, 1);
      lcd.print(" No Slots Free ");
      delay(2000);
    }
  }

  // EXIT GATE LOGIC
  // Vehicle detected at exit gate
  if (exitDist > 0 && exitDist < GATE_TRIGGER_DIST) {
    Serial.print("Vehicle detected at exit gate. Distance: ");
    Serial.print(exitDist);
    Serial.println(" cm");
    
    // Exit is always allowed, open gate
    openGate(exitServo, "Exit");
  }
}

// Helper function to handle smooth servo sweeps to prevent hardware wear and tear
void openGate(Servo &gateServo, const char *gateName) {
  Serial.print("Opening ");
  Serial.print(gateName);
  Serial.println(" Gate.");
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(gateName);
  lcd.setCursor(0, 1);
  lcd.print("Gate Opening...");
  
  // Sweep servo to 90 degrees (open)
  for (int pos = 0; pos <= 90; pos += 5) {
    gateServo.write(pos);
    delay(15);
  }
  
  lcd.setCursor(0, 1);
  lcd.print("Gate Opened!   ");
  
  // Keep gate open for 3 seconds for vehicle to pass
  delay(3000);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(gateName);
  lcd.setCursor(0, 1);
  lcd.print("Gate Closing...");
  
  // Sweep servo back to 0 degrees (closed)
  for (int pos = 90; pos >= 0; pos -= 5) {
    gateServo.write(pos);
    delay(15);
  }
  
  lcd.clear();
}

// Processes incoming JSON message from the booking feed
void processBookingMessage(char *message) {
  // Parse payload (using StaticJsonDocument for compatibility/simplicity)
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("JSON Deserialization failed: ");
    Serial.println(error.f_str());
    return;
  }

  // Handle reserve action
  if (doc.containsKey("action") && doc.containsKey("slot")) {
    const char* action = doc["action"];
    int slotNum = doc["slot"]; // User input slot numbers are typically 1-indexed (1 to 4)
    int slotIndex = slotNum - 1; // Convert to 0-indexed array (0 to 3)

    if (slotIndex >= 0 && slotIndex < NUM_SLOTS) {
      if (strcmp(action, "reserve") == 0) {
        // Can only reserve if the slot is currently vacant
        if (slotStates[slotIndex] == 0) {
          slotStates[slotIndex] = 2; // Set state to Reserved
          reservationTimers[slotIndex] = millis(); // Set local timeout start timer
          Serial.print("Slot ");
          Serial.print(slotNum);
          Serial.println(" successfully reserved via MQTT.");
          publishSlotStatus(true); // Push new state immediately
        } else {
          Serial.print("Cannot reserve slot ");
          Serial.print(slotNum);
          Serial.println(": Slot not vacant.");
        }
      } 
      else if (strcmp(action, "cancel") == 0) {
        // Can only cancel if it is currently reserved
        if (slotStates[slotIndex] == 2) {
          slotStates[slotIndex] = 0; // Reset to vacant
          reservationTimers[slotIndex] = 0;
          Serial.print("Reservation cancelled for slot ");
          Serial.println(slotNum);
          publishSlotStatus(true);
        }
      }
    }
  } 
  
  // Handle open_gate action (triggered when a user with a reservation arrives)
  if (doc.containsKey("action")) {
    const char* action = doc["action"];
    if (strcmp(action, "open_gate") == 0) {
      Serial.println("Gate override triggered by booking check-in.");
      openGate(entryServo, "Reserved Entry");
    }
  }
}

// Publishes slot status JSON object to Adafruit IO
void publishSlotStatus(bool forcePublish) {
  if (!mqtt.connected()) return;

  // Format payload as {"s1":X,"s2":X,"s3":X,"s4":X}
  StaticJsonDocument<128> doc;
  doc["s1"] = slotStates[0];
  doc["s2"] = slotStates[1];
  doc["s3"] = slotStates[2];
  doc["s4"] = slotStates[3];

  String payload;
  serializeJson(doc, payload);

  // Only publish if state changes OR if forcePublish is requested
  if (payload != lastJsonPayload || forcePublish) {
    lastJsonPayload = payload;
    Serial.print("Publishing state to Adafruit IO: ");
    Serial.println(payload);
    
    if (slotsPub.publish(payload.c_str())) {
      Serial.println("State published successfully.");
    } else {
      Serial.println("Publish failed.");
    }
  }
}

// Updates the local 16x2 LCD screen with slot counts
void updateLCD() {
  int vacantSlots = 0;
  int reservedSlots = 0;
  int occupiedSlots = 0;

  for (int i = 0; i < NUM_SLOTS; i++) {
    if (slotStates[i] == 0) vacantSlots++;
    else if (slotStates[i] == 1) occupiedSlots++;
    else if (slotStates[i] == 2) reservedSlots++;
  }

  lcd.clear();
  if (vacantSlots == 0) {
    lcd.setCursor(0, 0);
    lcd.print("  PARKING FULL  ");
    lcd.setCursor(0, 1);
    lcd.print("Rsvd:");
    lcd.print(reservedSlots);
    lcd.print("   Occ:");
    lcd.print(occupiedSlots);
  } else {
    lcd.setCursor(0, 0);
    lcd.print("Available: ");
    lcd.print(vacantSlots);
    lcd.print("/");
    lcd.print(NUM_SLOTS);
    
    lcd.setCursor(0, 1);
    lcd.print("Occ:");
    lcd.print(occupiedSlots);
    lcd.print("  Rsvd:");
    lcd.print(reservedSlots);
  }
}
