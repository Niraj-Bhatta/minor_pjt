import React, { useState, useEffect } from 'react';
import { Car, Clock, XCircle } from 'lucide-react';

/**
 * Single Parking Slot Component
 */
const ParkingSlot = ({ slotId, state, booking, onCancelBooking }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  // Compute countdown timer for reserved slots
  useEffect(() => {
    if (state !== 2 || !booking?.expiryTime) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = booking.expiryTime - Date.now();
      if (difference <= 0) {
        // Expiry reached!
        onCancelBooking(slotId, true); // Auto-expire
        return 0;
      }
      return Math.ceil(difference / 1000);
    };

    // Set initial
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [state, booking, slotId, onCancelBooking]);

  // Format time remaining as MM:SS
  const formatTime = (seconds) => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Determine CSS class based on slot state
  const getStatusClass = () => {
    if (state === 1) return 'occupied';
    if (state === 2) return 'reserved';
    return 'vacant';
  };

  const getStatusLabel = () => {
    if (state === 1) return 'Occupied';
    if (state === 2) return 'Reserved';
    return 'Vacant';
  };

  return (
    <div className={`glass-panel parking-slot ${getStatusClass()}`}>
      {/* Slot Header */}
      <div className="slot-top">
        <span className="slot-id">Slot {slotId}</span>
        <span className="slot-badge">{getStatusLabel()}</span>
      </div>

      {/* Slot Body / Visual car */}
      <div className="slot-middle">
        {state === 1 || state === 2 ? (
          <Car className="slot-car-icon" />
        ) : (
          <Car className="slot-car-icon" style={{ opacity: 0.05 }} />
        )}

        {state === 2 && booking && (
          <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            <div className="booking-name">{booking.name || 'Reserved'}</div>
            <div className="booking-plate">{booking.plate || 'Pending Arrival'}</div>
          </div>
        )}
      </div>

      {/* Slot Footer */}
      <div className="slot-bottom">
        {state === 2 && timeLeft > 0 ? (
          <>
            <span className="slot-timer">
              <Clock size={14} />
              {formatTime(timeLeft)}
            </span>
            <button 
              className="btn-action cancel" 
              onClick={() => onCancelBooking(slotId, false)}
              title="Cancel Booking"
            >
              <XCircle size={16} />
            </button>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            {state === 1 ? 'Sensor Active' : 'Ready to Park'}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Parking Lot Grid Container Component
 */
export default function ParkingGrid({ slots, activeBookings, onCancelBooking }) {
  // Convert slot states object (e.g. {s1: 0, s2: 1}) to a sorted array
  const slotList = Object.keys(slots).map((key) => {
    const slotId = parseInt(key.replace('s', ''), 10);
    return {
      key,
      slotId,
      state: slots[key]
    };
  }).sort((a, b) => a.slotId - b.slotId);

  return (
    <div className="glass-panel parking-lot-panel">
      <div className="panel-header">
        <h2 className="panel-title">Parking Grid Map</h2>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-indicator vacant"></span>
            <span>Vacant</span>
          </div>
          <div className="legend-item">
            <span className="legend-indicator occupied"></span>
            <span>Occupied</span>
          </div>
          <div className="legend-item">
            <span className="legend-indicator reserved"></span>
            <span>Reserved</span>
          </div>
        </div>
      </div>

      {/* Simulation Road layout for premium look */}
      <div className="parking-road">
        ◀ ENTRY ROADWAY ─── DRIVE SLOWLY ─── EXIT ROADWAY ▶
      </div>

      {/* Slot Grid */}
      <div className="parking-grid">
        {slotList.map((slot) => (
          <ParkingSlot
            key={slot.key}
            slotId={slot.slotId}
            state={slot.state}
            booking={activeBookings[slot.slotId]}
            onCancelBooking={onCancelBooking}
          />
        ))}
      </div>
    </div>
  );
}
