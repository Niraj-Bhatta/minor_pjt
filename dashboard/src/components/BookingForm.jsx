import React, { useState } from 'react';
import { Calendar, User, ShieldAlert } from 'lucide-react';

export default function BookingForm({ slots, activeBookings, onReserveSlot, userHasBooking }) {
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [error, setError] = useState('');

  // Extract vacant slots for selection
  const vacantSlots = Object.keys(slots)
    .map((key) => ({
      id: parseInt(key.replace('s', ''), 10),
      state: slots[key]
    }))
    .filter((slot) => slot.state === 0) // Only state = 0 is vacant
    .sort((a, b) => a.id - b.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!plate.trim()) {
      setError('Please enter your vehicle plate number.');
      return;
    }

    if (!selectedSlot) {
      setError('Please select a parking slot.');
      return;
    }

    // Trigger booking callback
    onReserveSlot(parseInt(selectedSlot, 10), name.trim(), plate.trim().toUpperCase());

    // Reset inputs
    setName('');
    setPlate('');
    setSelectedSlot('');
  };

  return (
    <div className="glass-panel sidebar-panel">
      <h3 className="sidebar-title">
        <Calendar size={18} className="brand-icon" />
        Reserve a Slot
      </h3>

      {/* If the current browser already has a reservation, show info banner */}
      {userHasBooking ? (
        <div className="alert info">
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div>
            You have an active booking in progress. Please arrive within the 15-minute window or cancel it before reserving another slot.
          </div>
        </div>
      ) : vacantSlots.length === 0 ? (
        <div className="alert info">
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <div>
            Parking is currently full. No slots are available for new reservations.
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert success" style={{ color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.1)' }}>{error}</div>}

          {/* User Name input */}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Plate Number input */}
          <div className="form-group">
            <label className="form-label">Vehicle Plate Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. CAR-7890"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
            />
          </div>

          {/* Slot dropdown */}
          <div className="form-group">
            <label className="form-label">Select Parking Slot</label>
            <select
              className="form-input"
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value)}
            >
              <option value="">-- Choose a Vacant Slot --</option>
              {vacantSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  Slot {slot.id} (Vacant)
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '1.25rem' }}>
            Book Slot (15 Mins Hold)
          </button>
        </form>
      )}
    </div>
  );
}
