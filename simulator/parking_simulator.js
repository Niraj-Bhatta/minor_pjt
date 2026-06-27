/**
 * IoT Smart Parking System - ESP32 & Hardware Simulator
 * 
 * This Node.js script simulates the physical hardware (ESP32, IR sensors, Ultrasonic sensors)
 * by connecting to Adafruit IO via MQTT, subscribing to bookings, and publishing slot updates.
 * 
 * Usage:
 * 1. Make sure you have installed dependencies in the dashboard folder (this script uses the same 'mqtt' package).
 * 2. Set your Adafruit IO credentials below.
 * 3. Run: node parking_simulator.js
 */

const mqtt = require('mqtt');

// ==========================================
// CONFIGURATION (Set your credentials here)
// ==========================================
const AIO_USERNAME = "YOUR_ADAFRUIT_USERNAME";
const AIO_KEY = "YOUR_ADAFRUIT_IO_KEY";

if (AIO_USERNAME === "YOUR_ADAFRUIT_USERNAME" || AIO_KEY === "YOUR_ADAFRUIT_IO_KEY") {
  console.log("\n[Simulator] WARNING: Please edit this file to configure your Adafruit IO credentials.");
  console.log("[Simulator] Otherwise, the simulator cannot connect to your cloud feeds.\n");
}

const AIO_SERVER = "io.adafruit.com";
const AIO_PORT = 1883;

// Feeds
const slotsTopic = `${AIO_USERNAME}/feeds/parking-slots`;
const bookingTopic = `${AIO_USERNAME}/feeds/parking-booking`;

// Initial simulated slot states: 0 = Vacant, 1 = Occupied, 2 = Reserved
let simulatedSlots = {
  s1: 0,
  s2: 0,
  s3: 0,
  s4: 0
};

// Tracks active reservation timers locally
let reservationTimers = {};

console.log("[Simulator] Connecting to Adafruit IO MQTT Broker...");
const client = mqtt.connect(`mqtt://${AIO_SERVER}:${AIO_PORT}`, {
  username: AIO_USERNAME,
  password: AIO_KEY,
  clientId: `sim_esp32_${Math.random().toString(16).substr(2, 6)}`
});

client.on('connect', () => {
  console.log("[Simulator] Connected to Adafruit IO successfully!");
  
  // Subscribe to bookings
  client.subscribe(bookingTopic, (err) => {
    if (err) {
      console.error("[Simulator] Subscription failed for bookings:", err);
    } else {
      console.log(`[Simulator] Subscribed to feed: ${bookingTopic}`);
      console.log("[Simulator] Ready to receive commands from the React Dashboard.\n");
    }
  });

  // Publish initial slots state
  publishState();

  // Start periodic slot occupancy change simulation (simulates cars driving in/out of slot 1 & 4)
  // Runs every 30 seconds to show dynamic movement on the dashboard
  setInterval(simulateRandomCarMovement, 30000);
});

client.on('message', (topic, message) => {
  const payloadString = message.toString();
  console.log(`[Simulator] Received command [${topic}]:`, payloadString);

  try {
    const data = JSON.parse(payloadString);
    
    // Handle slot reservation command
    if (data.action === 'reserve' && data.slot) {
      const slotIndex = `s${data.slot}`;
      if (simulatedSlots[slotIndex] === 0) {
        simulatedSlots[slotIndex] = 2; // Mark as Reserved
        console.log(`[Simulator] Reserved Slot ${data.slot} digitally.`);
        
        // Start simulated timer: After 15 seconds (accelerated for testing),
        // simulate the car arriving and occupying the slot!
        if (reservationTimers[data.slot]) clearTimeout(reservationTimers[data.slot]);
        
        reservationTimers[data.slot] = setTimeout(() => {
          if (simulatedSlots[slotIndex] === 2) {
            simulatedSlots[slotIndex] = 1; // Mark as Occupied
            console.log(`[Simulator] Car arrived! Slot ${data.slot} is now PHYSICALLY OCCUPIED.`);
            publishState();
          }
        }, 15000); // 15 seconds for simulation demonstration (normally 15 minutes)

        publishState();
      } else {
        console.log(`[Simulator] Denied Reservation for Slot ${data.slot}: Slot state is ${simulatedSlots[slotIndex]}`);
      }
    }
    
    // Handle cancel reservation command
    else if (data.action === 'cancel' && data.slot) {
      const slotIndex = `s${data.slot}`;
      if (simulatedSlots[slotIndex] === 2) {
        simulatedSlots[slotIndex] = 0; // Back to vacant
        console.log(`[Simulator] Cancelled reservation for Slot ${data.slot}.`);
        if (reservationTimers[data.slot]) {
          clearTimeout(reservationTimers[data.slot]);
          delete reservationTimers[data.slot];
        }
        publishState();
      }
    }
    
    // Handle manual gate open trigger
    else if (data.action === 'open_gate') {
      console.log("\n==============================================");
      console.log("[Simulator] GATE OVERRIDE RECEIVED!");
      console.log("[Simulator] Sweeping Entry Servo Motor to 90 degrees...");
      console.log("[Simulator] Gate is OPEN.");
      console.log("[Simulator] Waiting 3 seconds for vehicle to pass...");
      setTimeout(() => {
        console.log("[Simulator] Sweeping Entry Servo Motor to 0 degrees...");
        console.log("[Simulator] Gate is CLOSED.");
        console.log("==============================================\n");
      }, 3000);
    }
  } catch (err) {
    console.error("[Simulator] Error parsing JSON command payload:", payloadString, err.message);
  }
});

client.on('error', (err) => {
  console.error("[Simulator] MQTT error:", err);
});

client.on('close', () => {
  console.log("[Simulator] Connection closed.");
});

// Publishes current slots state to Adafruit IO
function publishState() {
  const payload = JSON.stringify(simulatedSlots);
  console.log(`[Simulator] Publishing updated slots status: ${payload}`);
  
  client.publish(slotsTopic, payload, { qos: 0 }, (err) => {
    if (err) {
      console.error("[Simulator] Publish failed:", err);
    }
  });
}

// Randomly toggles occupancy of slots to test UI reaction
function simulateRandomCarMovement() {
  // Let's toggle Slot 4 (s4) between Vacant (0) and Occupied (1) if it's not reserved
  if (simulatedSlots.s4 === 0) {
    simulatedSlots.s4 = 1;
    console.log("[Simulator] [Sensor Event] A car parked in Slot 4.");
    publishState();
  } else if (simulatedSlots.s4 === 1) {
    simulatedSlots.s4 = 0;
    console.log("[Simulator] [Sensor Event] The car in Slot 4 departed.");
    publishState();
  }
}
