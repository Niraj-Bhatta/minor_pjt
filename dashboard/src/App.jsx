import React, { useState, useEffect, useRef } from 'react';
import {
  Car,
  Settings,
  Unlock,
  Wifi,
  RefreshCw,
  AlertTriangle,
  Info,
  ShieldCheck
} from 'lucide-react';
import {
  connectAdafruitIoMqtt,
  disconnectAdafruitIoMqtt,
  fetchLastFeedValue,
  publishBookingCommand
} from './services/adafruitIo';
import ParkingGrid from './components/ParkingGrid';
import BookingForm from './components/BookingForm';

export default function App() {
  // --- 0. SPLASH SCREEN WELCOME LOGIC ---
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);
  const [welcomeText, setWelcomeText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const fullText = " Parking Spot Reservation System";

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setWelcomeText((prev) => prev + fullText.charAt(index));
        index++;
      }
      if (index >= fullText.length) {
        clearInterval(interval);
        setTypingComplete(true);
        // Smoothly fade out 1.2s after completion
        setTimeout(() => {
          setFadeSplash(true);
          setTimeout(() => {
            setShowSplash(false);
          }, 800);
        }, 1200);
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // --- 1. CREDENTIALS STATE ---
  const [username, setUsername] = useState(() => localStorage.getItem('aio_username') || '');
  const [aioKey, setAioKey] = useState(() => localStorage.getItem('aio_key') || '');
  const [showSettings, setShowSettings] = useState(!username || !aioKey);
  const [tempUsername, setTempUsername] = useState(username);
  const [tempAioKey, setTempAioKey] = useState(aioKey);

  // --- 2. CONNECTION STATE ---
  const [isConnected, setIsConnected] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('Disconnected');
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // --- 3. PARKING LOT STATE ---
  // Default structure of slots
  const [slots, setSlots] = useState({ s1: 0, s2: 0, s3: 0, s4: 0 });

  // Bookings structure: { [slotId]: { name, plate, expiryTime } }
  const [activeBookings, setActiveBookings] = useState(() => {
    try {
      const saved = localStorage.getItem('active_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Filter out expired bookings on load
        const now = Date.now();
        const filtered = {};
        Object.keys(parsed).forEach((slotId) => {
          if (parsed[slotId].expiryTime > now) {
            filtered[slotId] = parsed[slotId];
          }
        });
        return filtered;
      }
    } catch (e) {
      console.error("Error loading active bookings:", e);
    }
    return {};
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Track if this user has already booked a slot from this browser
  const [userBookedSlot, setUserBookedSlot] = useState(() => {
    return parseInt(localStorage.getItem('user_booked_slot') || '0', 10);
  });

  // Reference for MQTT client connection
  const mqttClientRef = useRef(null);

  // --- 4. PERSIST BOOKINGS ON STATE CHANGE ---
  useEffect(() => {
    localStorage.setItem('active_bookings', JSON.stringify(activeBookings));

    // Check if the current browser's reservation is still valid
    if (userBookedSlot && !activeBookings[userBookedSlot]) {
      localStorage.removeItem('user_booked_slot');
      setUserBookedSlot(0);
    }
  }, [activeBookings, userBookedSlot]);

  // --- 5. INITIAL REST SYNC AND MQTT CONNECTION SETUP ---
  useEffect(() => {
    if (!username || !aioKey) {
      setIsConnected(false);
      setConnectionMessage('Credentials missing');
      return;
    }

    // A. Perform initial REST pull to load immediate state
    const fetchInitialData = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const initialSlots = await fetchLastFeedValue(username, aioKey, 'parking-slots');
        setSlots(initialSlots);
        setLastSyncTime(new Date().toLocaleTimeString());
        setErrorMsg('');
      } catch (err) {
        console.error("REST feed fetching failed:", err);
        setErrorMsg('Initial fetch failed. Connecting to MQTT for updates...');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // B. Establish MQTT subscription
    const client = connectAdafruitIoMqtt({
      username,
      aioKey,
      onSlotsUpdate: (newSlots) => {
        setSlots(newSlots);
        setLastSyncTime(new Date().toLocaleTimeString());

        // Sync check: If a slot is marked as Occupied (1) or Vacant (0) on the ESP32,
        // but React still thinks it is Reserved (2), we clear the booking.
        setActiveBookings((prevBookings) => {
          const updated = { ...prevBookings };
          let changed = false;

          Object.keys(newSlots).forEach((key) => {
            const slotId = parseInt(key.replace('s', ''), 10);
            const state = newSlots[key];
            if (state !== 2 && updated[slotId]) {
              delete updated[slotId];
              changed = true;
            }
          });

          return changed ? updated : prevBookings;
        });
      },
      onConnectionChange: (connected, message) => {
        setIsConnected(connected);
        setConnectionMessage(message);
      }
    });

    mqttClientRef.current = client;

    // C. Setup REST Polling fallback (runs every 10 seconds)
    // This handles any network drops where WebSocket might fail but HTTP works.
    const pollInterval = setInterval(async () => {
      if (!connected && username && aioKey) {
        try {
          const polledSlots = await fetchLastFeedValue(username, aioKey, 'parking-slots');
          setSlots(polledSlots);
          setLastSyncTime(new Date().toLocaleTimeString());
        } catch (e) {
          console.warn("HTTP Fallback poll failed:", e.message);
        }
      }
    }, 10000);

    return () => {
      disconnectAdafruitIoMqtt();
      clearInterval(pollInterval);
    };
  }, [username, aioKey]);

  // --- 6. HANDLERS ---

  // Handle Credentials Save
  const handleSaveSettings = (e) => {
    e.preventDefault();
    if (!tempUsername.trim() || !tempAioKey.trim()) {
      setErrorMsg('Please enter both Adafruit Username and active AIO Key.');
      return;
    }

    localStorage.setItem('aio_username', tempUsername.trim());
    localStorage.setItem('aio_key', tempAioKey.trim());

    setUsername(tempUsername.trim());
    setAioKey(tempAioKey.trim());
    setShowSettings(false);
    setActionSuccess('Credentials updated successfully!');

    setTimeout(() => setActionSuccess(''), 3000);
  };

  // Triggers slot reservation
  const handleReserveSlot = async (slotId, name, plate) => {
    setLoading(true);
    setErrorMsg('');

    const command = { slot: slotId, action: 'reserve' };
    const success = await publishBookingCommand(username, aioKey, command);

    if (success) {
      // Local tracking for reservation timer (15 minutes from now)
      const expiryTime = Date.now() + 15 * 60 * 1000;

      setActiveBookings((prev) => ({
        ...prev,
        [slotId]: { name, plate, expiryTime }
      }));

      setUserBookedSlot(slotId);
      localStorage.setItem('user_booked_slot', slotId.toString());

      // Pre-emptively update slots state locally to show orange (Reserved = 2)
      setSlots((prev) => ({
        ...prev,
        [`s${slotId}`]: 2
      }));

      setActionSuccess(`Slot ${slotId} reserved successfully for 15 minutes!`);
      setTimeout(() => setActionSuccess(''), 4000);
    } else {
      setErrorMsg('Failed to reserve slot. Check feed connectivity.');
    }
    setLoading(false);
  };

  // Triggers booking cancellation (or timeout)
  const handleCancelBooking = async (slotId, isTimeout = false) => {
    setLoading(true);
    setErrorMsg('');

    const command = { slot: slotId, action: 'cancel' };
    const success = await publishBookingCommand(username, aioKey, command);

    if (success) {
      setActiveBookings((prev) => {
        const updated = { ...prev };
        delete updated[slotId];
        return updated;
      });

      if (userBookedSlot === slotId) {
        setUserBookedSlot(0);
        localStorage.removeItem('user_booked_slot');
      }

      // Pre-emptively update slots state locally to show vacant (Vacant = 0)
      setSlots((prev) => ({
        ...prev,
        [`s${slotId}`]: 0
      }));

      setActionSuccess(
        isTimeout
          ? `Reservation for Slot ${slotId} has expired.`
          : `Reservation for Slot ${slotId} cancelled.`
      );
      setTimeout(() => setActionSuccess(''), 4000);
    } else {
      setErrorMsg('Failed to cancel booking. Check feed connectivity.');
    }
    setLoading(false);
  };

  // Direct Command: Triggers Servo Gate Opening
  const handleOpenGate = async () => {
    setLoading(true);
    setErrorMsg('');
    const command = { action: 'open_gate' };
    const success = await publishBookingCommand(username, aioKey, command);

    if (success) {
      setActionSuccess('Gate opened! Welcome to the smart park.');
      setTimeout(() => setActionSuccess(''), 4000);
    } else {
      setErrorMsg('Failed to send gate open command.');
    }
    setLoading(false);
  };

  // Manual Trigger to refresh values
  const handleManualRefresh = async () => {
    if (!username || !aioKey) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const refreshedSlots = await fetchLastFeedValue(username, aioKey, 'parking-slots');
      setSlots(refreshedSlots);
      setLastSyncTime(new Date().toLocaleTimeString());
      setActionSuccess('Slots updated!');
      setTimeout(() => setActionSuccess(''), 2000);
    } catch (err) {
      setErrorMsg('Failed to pull latest feeds.');
    } finally {
      setLoading(false);
    }
  };

  // --- 7. COMPUTED STATISTICS ---
  const totalSlotsCount = Object.keys(slots).length;
  const occupiedSlotsCount = Object.values(slots).filter(s => s === 1).length;
  const reservedSlotsCount = Object.values(slots).filter(s => s === 2).length;
  const vacantSlotsCount = Object.values(slots).filter(s => s === 0).length;
  const isParkingFull = vacantSlotsCount === 0;

  return (
    <div className="app-container">
      {/* Splash Welcome Screen */}
      {showSplash && (
        <div className={`splash-container ${fadeSplash ? 'fade-out' : ''}`}>
          <Car className="splash-logo" size={80} />
          <div className="splash-text">
            {welcomeText}
            {!typingComplete && <span className="splash-cursor"></span>}
          </div>
          <div className={`splash-button-container ${typingComplete ? 'show' : ''}`}>
            <button
              className="btn-primary"
              onClick={() => {
                setFadeSplash(true);
                setTimeout(() => setShowSplash(false), 800);
              }}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            >
              Enter Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <header className="app-header">
        <div className="brand-section">
          <Car className="brand-icon" size={32} />
          <div>
            <h1 className="brand-title">ParkNet IoT</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
              <span className="brand-badge">Smart Parking Dashboard</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase', background: 'rgba(6, 182, 212, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                ⚠ Drive slow and be safe
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className="btn-action"
            onClick={handleManualRefresh}
            disabled={loading}
            title="Force REST Sync"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            className="btn-action"
            onClick={() => setShowSettings(!showSettings)}
            title="Configure Credentials"
          >
            <Settings size={18} />
          </button>

          <div className="conn-status">
            <span className={`status-dot ${connectionMessage === 'Connected' ? 'connected' :
                connectionMessage === 'Connecting...' ? 'connecting' : 'disconnected'
              }`}></span>
            <span>{connectionMessage}</span>
          </div>
        </div>
      </header>

      {/* Global Status messages */}
      {actionSuccess && <div className="alert success">{actionSuccess}</div>}
      {errorMsg && <div className="alert success" style={{ color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)' }}>{errorMsg}</div>}

      {/* Booking full Banner */}
      {isParkingFull && (
        <div className="full-banner">
          <AlertTriangle size={24} />
          <span>PARKING FULL - ALL PHYSICAL AND RESERVED SLOTS ARE TAKEN</span>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
          <h3 className="sidebar-title" style={{ margin: 0, paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <Settings size={18} className="brand-icon" />
            Adafruit IO Integration Settings
          </h3>
          <p className="settings-description" style={{ marginTop: '0.5rem' }}>
            Configure your Adafruit IO username and AIO key. This dashboard subscribes to your <code>parking-slots</code> feed (JSON format) and publishes to <code>parking-booking</code>.
          </p>
          <form onSubmit={handleSaveSettings} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Adafruit Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. adafruit_user_123"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Active AIO Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="aio_key_XXXXXXXXXXXXXXXXXXXXXXXX"
                value={tempAioKey}
                onChange={(e) => setTempAioKey(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" style={{ height: '42px', padding: '0 1.5rem' }}>
              Save & Connect
            </button>
          </form>
        </div>
      )}

      {/* Quick Setup Instructions if credentials are brand new */}
      {!username && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Info size={48} className="brand-icon" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>Quick Setup Instructions</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
              To get started, click the <strong>Gear icon</strong> at the top right, enter your <strong>Adafruit IO Username</strong> and <strong>AIO Key</strong>, and create two feeds on Adafruit IO: <code>parking-slots</code> and <code>parking-booking</code>. The dashboard will automatically handle syncing of slots and reservations!
            </p>
          </div>
        </div>
      )}

      {/* Statistics Panels */}
      <section className="stats-container">
        <div className="glass-panel stat-card">
          <span className="stat-label">Total Space Capacity</span>
          <span className="stat-value total">{totalSlotsCount} Slots</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Vacant Spots (Free)</span>
          <span className="stat-value vacant">{vacantSlotsCount} Slots</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Occupied Spots (Sensor Active)</span>
          <span className="stat-value occupied">{occupiedSlotsCount} Slots</span>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-label">Reserved Spots (Held)</span>
          <span className="stat-value reserved">{reservedSlotsCount} Slots</span>
        </div>
      </section>

      {/* Dashboard Main Visual Layout */}
      <main className="dashboard-grid">
        {/* Left Side: Parking Grid Map */}
        <ParkingGrid
          slots={slots}
          activeBookings={activeBookings}
          onCancelBooking={handleCancelBooking}
        />

        {/* Right Side: Sidebar */}
        <aside className="sidebar">
          {/* Booking Panel */}
          <BookingForm
            slots={slots}
            activeBookings={activeBookings}
            onReserveSlot={handleReserveSlot}
            userHasBooking={!!userBookedSlot}
          />

          {/* Quick Actions Panel */}
          <div className="glass-panel sidebar-panel">
            <h3 className="sidebar-title">
              <Unlock size={18} className="brand-icon" />
              Quick Check-In Override
            </h3>
            <p className="settings-description">
              Arriving for your booking? Press the button below to publish a check-in command. The ESP32 entry servo gate will sweep open.
            </p>
            <div className="gate-actions">
              <button
                className="btn-primary"
                onClick={handleOpenGate}
                disabled={loading || !username || !aioKey}
              >
                <Unlock size={16} />
                Open Entry Servo Gate
              </button>
            </div>
          </div>

          {/* System Health / Status info */}
          <div className="glass-panel sidebar-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              <ShieldCheck size={16} style={{ color: 'var(--status-vacant)' }} />
              System Diagnostics
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              <div>Sync Protocol: {isConnected ? 'MQTT WS Client' : 'HTTP Polling Fallback'}</div>
              <div>Last Sync: {lastSyncTime || 'Pending'}</div>
              <div>Feed s1: {slots.s1 === 0 ? 'Vacant' : slots.s1 === 1 ? 'Occupied' : 'Reserved'}</div>
              <div>Feed s2: {slots.s2 === 0 ? 'Vacant' : slots.s2 === 1 ? 'Occupied' : 'Reserved'}</div>
              <div>Feed s3: {slots.s3 === 0 ? 'Vacant' : slots.s3 === 1 ? 'Occupied' : 'Reserved'}</div>
              <div>Feed s4: {slots.s4 === 0 ? 'Vacant' : slots.s4 === 1 ? 'Occupied' : 'Reserved'}</div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="app-footer">
        <p>ParkNet IoT - Designed with React & ESP32 Microcontrollers</p>
        <p style={{ marginTop: '0.25rem' }}>
          Connect feeds dynamically on <a href="https://io.adafruit.com" target="_blank" rel="noreferrer">io.adafruit.com</a>
        </p>
      </footer>
    </div>
  );
}
