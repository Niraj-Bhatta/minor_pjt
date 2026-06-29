/**
 * Adafruit IO MQTT & REST Service
 * 
 * Integrates WebSockets MQTT for real-time bi-directional messaging,
 * with a fallback REST API polling system for robust data loading.
 */

import mqtt from 'mqtt';

// Active MQTT client instance
let mqttClient = null;

/**
 * Fetch the latest value from Adafruit IO REST API (Initial load or polling fallback)
 * @param {string} username - Adafruit IO username
 * @param {string} aioKey - Adafruit IO active AIO Key
 * @param {string} feedKey - Feed identifier key (e.g. 'parking-slots')
 * @returns {Promise<any>} Parsed feed data
 */
export const fetchLastFeedValue = async (username, aioKey, feedKey) => {
  if (!username || !aioKey) {
    throw new Error("Credentials missing");
  }
  
  const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feedKey}/data/last`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-AIO-Key': aioKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.value); // Values are stored as strings in Adafruit IO
};

/**
 * Connect to Adafruit IO via MQTT WebSockets
 * @param {Object} config - Configuration object
 * @param {string} config.username - Adafruit Username
 * @param {string} config.aioKey - Adafruit Key
 * @param {Function} config.onSlotsUpdate - Callback for slots feed updates
 * @param {Function} config.onConnectionChange - Callback when connection status changes (connected/disconnected)
 * @returns {Object} The MQTT client instance
 */
export const connectAdafruitIoMqtt = ({ username, aioKey, onSlotsUpdate, onConnectionChange }) => {
  // If there's an existing client, disconnect it first
  if (mqttClient) {
    try {
      mqttClient.end(true);
    } catch (e) {
      console.error("Error ending previous MQTT client:", e);
    }
  }

  if (!username || !aioKey) {
    onConnectionChange(false, "Credentials not configured");
    return null;
  }

  onConnectionChange(false, "Connecting...");

  // Adafruit IO Secure WebSockets URL
  const wsUrl = `wss://io.adafruit.com:443/mqtt`;
  const options = {
    username: username,
    password: aioKey,
    clientId: `web_parking_${Math.random().toString(16).substr(2, 8)}`,
    keepalive: 60,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  };

  try {
    mqttClient = mqtt.connect(wsUrl, options);

    // Feed Topic Paths
    const slotsTopic = `${username}/feeds/parking-slots`;
    const bookingTopic = `${username}/feeds/parking-booking`;

    mqttClient.on('connect', () => {
      console.log('Connected to Adafruit IO MQTT successfully!');
      onConnectionChange(true, "Connected");
      
      // Subscribe to both feeds
      mqttClient.subscribe(slotsTopic, (err) => {
        if (err) console.error("Subscribed failed for slots:", err);
      });
      mqttClient.subscribe(bookingTopic, (err) => {
        if (err) console.error("Subscribed failed for bookings:", err);
      });
    });

    mqttClient.on('message', (topic, message) => {
      const payloadString = message.toString();
      console.log(`MQTT Received [${topic}]:`, payloadString);

      if (topic === slotsTopic) {
        try {
          const slotStates = JSON.parse(payloadString);
          onSlotsUpdate(slotStates);
        } catch (e) {
          console.error("Failed to parse slots update payload:", payloadString, e);
        }
      }
    });

    mqttClient.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
      onConnectionChange(false, `Error: ${err.message}`);
    });

    mqttClient.on('close', () => {
      console.log('MQTT Connection closed.');
      onConnectionChange(false, "Disconnected");
    });

    return mqttClient;

  } catch (err) {
    console.error("MQTT Setup Exception:", err);
    onConnectionChange(false, `Setup Fail: ${err.message}`);
    return null;
  }
};

/**
 * Disconnect current MQTT Client connection
 */
export const disconnectAdafruitIoMqtt = () => {
  if (mqttClient) {
    try {
      mqttClient.end(true);
      mqttClient = null;
      console.log("MQTT Client disconnected manually.");
    } catch (e) {
      console.error("Error disconnecting MQTT:", e);
    }
  }
};

/**
 * Publish a booking action or command to Adafruit IO
 * @param {string} username - Adafruit IO username
 * @param {string} aioKey - Adafruit IO Key
 * @param {Object} payload - Command payload (e.g. {slot: 2, action: 'reserve'})
 * @returns {Promise<boolean>} Success status
 */
export const publishBookingCommand = async (username, aioKey, payload) => {
  // If MQTT is connected, publish via MQTT
  const bookingTopic = `${username}/feeds/parking-booking`;
  const payloadString = JSON.stringify(payload);

  if (mqttClient && mqttClient.connected) {
    return new Promise((resolve) => {
      mqttClient.publish(bookingTopic, payloadString, { qos: 0 }, (err) => {
        if (err) {
          console.error("MQTT Publish failed, trying REST:", err);
          resolve(publishBookingCommandRest(username, aioKey, payload));
        } else {
          console.log("MQTT Published successfully:", payload);
          resolve(true);
        }
      });
    });
  }

  // Fallback to HTTP REST API if MQTT client is not ready/connected
  return publishBookingCommandRest(username, aioKey, payload);
};

/**
 * Publish booking command via HTTP POST REST API
 */
const publishBookingCommandRest = async (username, aioKey, payload) => {
  const url = `https://io.adafruit.com/api/v2/${username}/feeds/parking-booking/data`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-AIO-Key': aioKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: JSON.stringify(payload) })
    });

    if (response.ok) {
      console.log("REST API Command sent successfully:", payload);
      return true;
    } else {
      console.error("REST API Command failed. Status:", response.status);
      return false;
    }
  } catch (error) {
    console.error("REST API Command Exception:", error);
    return false;
  }
};
