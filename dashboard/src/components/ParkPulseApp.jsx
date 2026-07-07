import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Navigation, Zap, Clock, ChevronRight,
  Car, Wifi, Activity, CheckCircle, ArrowLeft,
  Search, Settings, X, ShieldAlert, Sparkles, RefreshCw, Info, Calendar
} from "lucide-react";
import {
  connectAdafruitIoMqtt,
  disconnectAdafruitIoMqtt,
  publishBookingCommand,
  fetchLastFeedValue
} from "../services/adafruitIo";

// ── Colors ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0e1a",
  surface: "#111827",
  card: "#141d2e",
  border: "#1e2d45",
  accent: "#3b82f6",      // electric blue
  accentGlow: "#1d4ed8",
  teal: "#06b6d4",
  green: "#10b981",
  purple: "#7c3aed",
  amber: "#f59e0b",
  red: "#ef4444",
  text: "#f1f5f9",
  muted: "#64748b",
  subtle: "#94a3b8",
};

// ── Mock Parking Locations ──────────────────────────────────────────────────
const INITIAL_LOCATIONS = [
  {
    id: "central-hub",
    name: "Central Hub: Zone B",
    address: "Downtown Center, Terminal 1",
    distance: "0.4 km",
    price: "$3.00/hr",
    isIot: true,
    totalSlots: 4,
    coords: { x: "30%", y: "38%" },
  },
  {
    id: "east-terminal",
    name: "East Terminal: Alpha",
    address: "East Plaza, Gate 3",
    distance: "0.9 km",
    price: "$2.50/hr",
    isIot: false,
    totalSlots: 6,
    coords: { x: "62%", y: "55%" },
  },
  {
    id: "skyline-garages",
    name: "Skyline Garages: Zone C",
    address: "Midtown West, 42nd St",
    distance: "1.8 km",
    price: "$4.00/hr",
    isIot: false,
    totalSlots: 8,
    coords: { x: "75%", y: "28%" },
  },
  {
    id: "north-gate",
    name: "North Gate Parking",
    address: "Northside Shopping District",
    distance: "2.5 km",
    price: "$1.80/hr",
    isIot: false,
    totalSlots: 5,
    coords: { x: "45%", y: "65%" },
  }
];

export default function ParkPulseApp() {
  const navigate = useNavigate();

  // ── States ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLot, setSelectedLot] = useState(INITIAL_LOCATIONS[0]); // default to first lot
  const [filterType, setFilterType] = useState("all"); // all, iot, nearby

  // Adafruit IO Credentials
  const [username, setUsername] = useState(() => localStorage.getItem("parkpulse_username") || "");
  const [aioKey, setAioKey] = useState(() => localStorage.getItem("parkpulse_key") || "");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // MQTT Connection State
  const [mqttStatus, setMqttStatus] = useState("Disconnected");
  const [mqttConnected, setMqttConnected] = useState(false);

  // Slots Data (Live & Mocks)
  const [iotSlots, setIotSlots] = useState({ s1: 0, s2: 0, s3: 0, s4: 0 });
  const [mockLotsSlots, setMockLotsSlots] = useState({
    "east-terminal": [0, 1, 0, 1, 0, 0],
    "skyline-garages": [1, 1, 0, 0, 1, 0, 0, 0],
    "north-gate": [0, 0, 1, 0, 0],
  });

  // Active Booking state: { lotId, slotIndex, expiryTime }
  const [activeBooking, setActiveBooking] = useState(() => {
    const saved = localStorage.getItem("parkpulse_active_booking");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.expiryTime > Date.now()) {
        return parsed;
      }
      localStorage.removeItem("parkpulse_active_booking");
    }
    return null;
  });

  const [bookingTimeRemaining, setBookingTimeRemaining] = useState(0);
  const [showBookingConfirm, setShowBookingConfirm] = useState(null); // slot object
  const [isPublishing, setIsPublishing] = useState(false);
  const mqttClientRef = useRef(null);

  // ── Countdown Timer Effect ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeBooking) {
      setBookingTimeRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((activeBooking.expiryTime - Date.now()) / 1000));
      setBookingTimeRemaining(remaining);

      // Trigger automatic expiration
      if (remaining === 0) {
        clearInterval(interval);
        handleExpiry();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeBooking]);

  // If local booking expires, automatically release the spot
  const handleExpiry = async () => {
    if (activeBooking && activeBooking.lotId === "central-hub") {
      // Release slot in Adafruit IO
      await publishBookingCommand(username, aioKey, { slot: activeBooking.slotIndex, action: "cancel" });
    } else if (activeBooking) {
      // Release slot in mock lot
      setMockLotsSlots(prev => {
        const arr = [...prev[activeBooking.lotId]];
        arr[activeBooking.slotIndex] = 0; // set vacant
        return { ...prev, [activeBooking.lotId]: arr };
      });
    }
    setActiveBooking(null);
    localStorage.removeItem("parkpulse_active_booking");
  };

  // ── Adafruit IO Fetch & Connect Effect ─────────────────────────────────────
  useEffect(() => {
    if (username && aioKey) {
      // 1. Initial REST fetch for instant values
      fetchLastFeedValue(username, aioKey, "parking-slots")
        .then(data => {
          if (data) {
            setIotSlots(data);
          }
        })
        .catch(err => {
          console.error("Initial Adafruit IO REST fetch failed:", err);
        });

      // 2. Establish live WebSockets MQTT connection
      const client = connectAdafruitIoMqtt({
        username,
        aioKey,
        onSlotsUpdate: (updatedSlots) => {
          console.log("MQTT Update received in App:", updatedSlots);
          setIotSlots(updatedSlots);
        },
        onConnectionChange: (connected, statusText) => {
          setMqttConnected(connected);
          setMqttStatus(statusText);
        }
      });
      mqttClientRef.current = client;
    } else {
      setMqttStatus("Offline (No Credentials)");
      setMqttConnected(false);
    }

    return () => {
      disconnectAdafruitIoMqtt();
    };
  }, [username, aioKey]);

  // ── Save Credentials to LocalStorage ──────────────────────────────────────
  const handleSaveCredentials = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const newUsername = data.get("username").trim();
    const newKey = data.get("key").trim();

    localStorage.setItem("parkpulse_username", newUsername);
    localStorage.setItem("parkpulse_key", newKey);
    setUsername(newUsername);
    setAioKey(newKey);
    setIsSettingsOpen(false);
  };

  // ── Handle Reservation Booking ────────────────────────────────────────────
  const handleReserve = async (slotIndex) => {
    setIsPublishing(true);
    const expiryTime = Date.now() + 15 * 60 * 1000; // 15 mins
    const booking = {
      lotId: selectedLot.id,
      slotIndex: slotIndex,
      expiryTime: expiryTime
    };

    if (selectedLot.isIot) {
      // Central Hub - Send reserve MQTT event to Adafruit IO
      if (!username || !aioKey) {
        alert("Please configure Adafruit IO credentials in settings to book live IoT slots!");
        setIsPublishing(false);
        setIsSettingsOpen(true);
        return;
      }

      const success = await publishBookingCommand(username, aioKey, { slot: slotIndex, action: "reserve" });
      if (success) {
        setActiveBooking(booking);
        localStorage.setItem("parkpulse_active_booking", JSON.stringify(booking));
        setShowBookingConfirm(null);
      } else {
        alert("Failed to send booking request. Please check connection and credentials.");
      }
    } else {
      // Mock Parking lot booking
      setMockLotsSlots(prev => {
        const arr = [...prev[selectedLot.id]];
        arr[slotIndex] = 2; // Reserved
        return { ...prev, [selectedLot.id]: arr };
      });
      setActiveBooking(booking);
      localStorage.setItem("parkpulse_active_booking", JSON.stringify(booking));
      setShowBookingConfirm(null);
    }
    setIsPublishing(false);
  };

  // ── Handle Cancellation ───────────────────────────────────────────────────
  const handleCancelBooking = async () => {
    if (!activeBooking) return;
    setIsPublishing(true);

    if (activeBooking.lotId === "central-hub") {
      // Release in Adafruit IO
      const success = await publishBookingCommand(username, aioKey, { slot: activeBooking.slotIndex, action: "cancel" });
      if (success) {
        setActiveBooking(null);
        localStorage.removeItem("parkpulse_active_booking");
      } else {
        alert("Failed to cancel booking. Please try again.");
      }
    } else {
      // Release in mock lot
      setMockLotsSlots(prev => {
        const arr = [...prev[activeBooking.lotId]];
        arr[activeBooking.slotIndex] = 0; // Vacant
        return { ...prev, [activeBooking.lotId]: arr };
      });
      setActiveBooking(null);
      localStorage.removeItem("parkpulse_active_booking");
    }
    setIsPublishing(false);
  };

  // Helper: check if a slot is currently reserved by current user
  const isMyReservedSlot = (lotId, index) => {
    return activeBooking && activeBooking.lotId === lotId && activeBooking.slotIndex === index;
  };

  // ── Parse Slot Lists For Display ──────────────────────────────────────────
  const getSlotsForLot = (lot) => {
    if (!lot) return [];
    if (lot.isIot) {
      return [
        { label: "Slot 1", value: iotSlots.s1, index: 1 },
        { label: "Slot 2", value: iotSlots.s2, index: 2 },
        { label: "Slot 3", value: iotSlots.s3, index: 3 },
        { label: "Slot 4", value: iotSlots.s4, index: 4 }
      ];
    } else {
      const arr = mockLotsSlots[lot.id] || [];
      return arr.map((val, idx) => ({
        label: `Slot ${idx + 1}`,
        value: val,
        index: idx
      }));
    }
  };

  // Helper to count available slots in a lot
  const getAvailableCount = (lot) => {
    if (!lot) return 0;
    if (lot.isIot) {
      let count = 0;
      if (iotSlots.s1 === 0) count++;
      if (iotSlots.s2 === 0) count++;
      if (iotSlots.s3 === 0) count++;
      if (iotSlots.s4 === 0) count++;
      return count;
    } else {
      const arr = mockLotsSlots[lot.id] || [];
      return arr.filter(v => v === 0).length;
    }
  };

  // Get total counts across all lots
  const getTotalAvailableCount = () => {
    return INITIAL_LOCATIONS.reduce((sum, loc) => sum + getAvailableCount(loc), 0);
  };

  const getTotalSlotsCount = () => {
    return INITIAL_LOCATIONS.reduce((sum, loc) => sum + loc.totalSlots, 0);
  };

  // ── Filter and Search Logic ───────────────────────────────────────────────
  const filteredLocations = INITIAL_LOCATIONS.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          loc.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterType === "iot") return loc.isIot;
    if (filterType === "nearby") return parseFloat(loc.distance) < 1.0;
    return true;
  });

  // Format booking time: MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Trigger manual fetch to update Adafruit IO REST API values
  const triggerManualRefresh = async () => {
    if (!username || !aioKey) return;
    setMqttStatus("Refreshing...");
    try {
      const data = await fetchLastFeedValue(username, aioKey, "parking-slots");
      if (data) {
        setIotSlots(data);
        setMqttStatus(mqttConnected ? "Connected" : "Refreshed");
      }
    } catch (e) {
      console.error(e);
      setMqttStatus("Refresh Failed");
    }
  };

  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "'Inter', -apple-system, sans-serif",
      width: "100%", display: "flex", flexDirection: "column",
      position: "relative"
    }}>
      {/* ── TOP DECORATIVE GLOWS ── */}
      <div style={{
        position: "absolute", top: -100, right: 100, width: 400, height: 400,
        borderRadius: "50%", background: C.accent + "0d", filter: "blur(100px)", pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute", bottom: 100, left: -100, width: 350, height: 350,
        borderRadius: "50%", background: C.purple + "08", filter: "blur(90px)", pointerEvents: "none"
      }} />

      {/* ── GLOBAL NAVBAR ── */}
      <nav style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none", border: "none", color: C.subtle, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500
            }}
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
          <span style={{ color: C.border }}>|</span>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Car size={16} color="#fff" />
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5 }}>ParkPulse AI</span>
            <span style={{ fontSize: 11, color: C.subtle, marginLeft: 8 }}>Operator & User Dashboard</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: mqttConnected ? C.green : C.amber,
              boxShadow: `0 0 8px ${mqttConnected ? C.green : C.amber}`
            }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.subtle }}>
              IoT MQTT Feed: {mqttStatus}
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: C.card, border: `1px solid ${C.border}`, color: C.text,
              borderRadius: 10, padding: "8px 14px", cursor: "pointer", display: "flex",
              alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)", transition: "all 0.2s"
            }}
          >
            <Settings size={14} /> Configure API
          </button>
        </div>
      </nav>

      {/* ── MAIN DASHBOARD CONTAINER (Sidebar + Main Area) ── */}
      <div style={{ display: "flex", flex: 1, flexDirection: "row", flexWrap: "wrap", width: "100%" }}>
        
        {/* ── LEFT PANEL: SEARCH & LOT LIST ── */}
        <aside style={{
          width: "100%", maxWidth: "100%", flex: "1 1 360px",
          background: "#0d1321", borderRight: `1px solid ${C.border}`,
          padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>
              Parking Hubs
            </h2>
            <p style={{ color: C.subtle, fontSize: 12, lineHeight: 1.4 }}>
              Select a location to check realtime sensor grids and book slots.
            </p>
          </div>

          {/* Search bar */}
          <div style={{
            position: "relative", background: C.card, borderRadius: 12,
            border: `1px solid ${C.border}`, padding: "12px 14px 12px 42px",
            display: "flex", alignItems: "center"
          }}>
            <Search size={16} color={C.muted} style={{ position: "absolute", left: 16 }} />
            <input
              type="text"
              placeholder="Search city, terminal, zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "none", border: "none", color: C.text, width: "100%",
                fontSize: 13, outline: "none"
              }}
            />
            {searchQuery && (
              <X size={14} color={C.muted} style={{ cursor: "pointer" }} onClick={() => setSearchQuery("")} />
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "all", label: "All Hubs" },
              { id: "iot", label: "IoT Enabled" },
              { id: "nearby", label: "Nearby (<1km)" }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                style={{
                  background: filterType === f.id ? C.accent : C.card,
                  color: filterType === f.id ? "#fff" : C.subtle,
                  border: `1px solid ${filterType === f.id ? C.accent : C.border}`,
                  borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", transition: "all 0.2s"
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lot Cards List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flexGrow: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
              Parking Systems ({filteredLocations.length})
            </span>

            {filteredLocations.length === 0 ? (
              <div style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                padding: "32px 16px", textAlign: "center"
              }}>
                <ShieldAlert size={28} color={C.muted} style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: C.subtle }}>No parking zones found</div>
              </div>
            ) : (
              filteredLocations.map(loc => {
                const available = getAvailableCount(loc);
                const isSelected = selectedLot?.id === loc.id;
                const isLotFull = available === 0;

                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLot(loc)}
                    style={{
                      background: isSelected ? C.card : "transparent",
                      border: `1px solid ${isSelected ? C.accent : C.border + "44"}`,
                      borderRadius: 14, padding: 16, cursor: "pointer",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      boxShadow: isSelected ? `0 4px 16px rgba(0,0,0,0.3)` : "none",
                      transition: "all 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: loc.isIot ? C.accent + "18" : C.surface,
                        border: `1px solid ${loc.isIot ? C.accent + "33" : C.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <Car size={16} color={loc.isIot ? C.accent : C.subtle} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? "#fff" : C.text }}>{loc.name}</span>
                          {loc.isIot && (
                            <span style={{
                              background: C.green + "12", color: C.green, fontSize: 8,
                              fontWeight: 700, padding: "1px 4px", borderRadius: 4
                            }}>IoT</span>
                          )}
                        </div>
                        <span style={{ display: "block", fontSize: 11, color: C.subtle, marginTop: 2 }}>
                          {loc.address}
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: C.muted, display: "flex", alignItems: "center", gap: 3 }}>
                            <Navigation size={10} /> {loc.distance}
                          </span>
                          <span style={{ color: C.border }}>•</span>
                          <span style={{ fontSize: 11, color: C.muted }}>
                            {loc.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{
                        background: isLotFull ? C.red + "12" : C.green + "12",
                        color: isLotFull ? C.red : C.green,
                        fontWeight: 700, fontSize: 11, padding: "3px 6px", borderRadius: 6,
                        border: `1px solid ${isLotFull ? C.red + "22" : C.green + "22"}`
                      }}>
                        {isLotFull ? "Full" : `${available} Free`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── RIGHT PANEL: MAIN DASHBOARD ── */}
        <main style={{
          flex: "3 1 600px", padding: "32px", display: "flex",
          flexDirection: "column", gap: 24
        }}>
          
          {/* ── STATS ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: 18, display: "flex", alignItems: "center", gap: 14
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: C.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent }}>
                <Activity size={20} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>Total Systems</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>4 Active</span>
              </div>
            </div>

            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: 18, display: "flex", alignItems: "center", gap: 14
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: C.green + "18", display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}>
                <CheckCircle size={20} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>Available Slots</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{getTotalAvailableCount()} / {getTotalSlotsCount()}</span>
              </div>
            </div>

            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: 18, display: "flex", alignItems: "center", gap: 14
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: C.purple + "18", display: "flex", alignItems: "center", justifyContent: "center", color: C.purple }}>
                <Clock size={20} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>Active Holds</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>{activeBooking ? "1 Booking" : "0 Holds"}</span>
              </div>
            </div>

            <div style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
              padding: 18, display: "flex", alignItems: "center", gap: 14
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: C.teal + "18", display: "flex", alignItems: "center", justifyContent: "center", color: C.teal }}>
                <Wifi size={20} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>IoT Feed Protocol</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>WebSockets</span>
              </div>
            </div>
          </div>

          {/* ── TWO-COLUMN SPLIT: MAP & SLOT GRID VIEW ── */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            
            {/* Left Box: City Map visualizer */}
            <div style={{
              flex: "1 1 380px", display: "flex", flexDirection: "column", gap: 14
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                  Urban Mobility Map
                </span>
                <span style={{ fontSize: 11, color: C.subtle }}>Click markers to select zones</span>
              </div>

              <div style={{
                background: "#0d1b2e", border: `1px solid ${C.border}`,
                borderRadius: 20, overflow: "hidden", position: "relative", height: 360,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
              }}>
                {/* SVG background grid */}
                <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.15 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <line key={`h${i}`} x1="0" y1={i * 60} x2="100%" y2={i * 60} stroke={C.teal} strokeWidth="1" />
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2="100%" stroke={C.teal} strokeWidth="1" />
                  ))}
                  {/* road layouts */}
                  <rect x="0" y="110" width="100%" height="24" fill={C.border} />
                  <rect x="240" y="0" width="28" height="100%" fill={C.border} />
                  <rect x="0" y="260" width="100%" height="16" fill={C.border} />
                </svg>

                {/* location markers on map */}
                {INITIAL_LOCATIONS.map(loc => {
                  const available = getAvailableCount(loc);
                  const isSelected = selectedLot?.id === loc.id;
                  const color = available > 0 ? (loc.isIot ? C.green : C.teal) : C.red;

                  return (
                    <div
                      key={loc.id}
                      onClick={() => setSelectedLot(loc)}
                      style={{
                        position: "absolute", left: loc.coords.x, top: loc.coords.y,
                        transform: "translate(-50%,-50%)", cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center",
                        zIndex: isSelected ? 20 : 10
                      }}
                    >
                      <div style={{
                        width: isSelected ? 32 : 26, height: isSelected ? 32 : 26, borderRadius: "50%",
                        background: isSelected ? color : color + "33",
                        border: `2px solid ${color}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: `0 0 ${isSelected ? 16 : 8}px ${color}`,
                        transition: "all 0.2s"
                      }}>
                        <MapPin size={isSelected ? 14 : 11} color={isSelected ? "#fff" : color} />
                      </div>
                      <span style={{
                        background: C.bg, color: isSelected ? color : C.text,
                        fontSize: 9, fontWeight: 700,
                        padding: "2px 6px", borderRadius: 4, border: `1px solid ${isSelected ? color : C.border}`,
                        whiteSpace: "nowrap", marginTop: 4, boxShadow: "0 2px 6px rgba(0,0,0,0.3)"
                      }}>
                        {loc.name.split(":")[0]} ({available} Free)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Box: Live Slot Grid Details */}
            <div style={{
              flex: "1.3 1 420px", display: "flex", flexDirection: "column", gap: 14
            }}>
              {selectedLot ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                      Live Status: {selectedLot.name}
                    </span>
                    {selectedLot.isIot && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={triggerManualRefresh}
                          style={{
                            background: C.card, border: `1px solid ${C.border}`, color: C.subtle,
                            borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 10,
                            display: "flex", alignItems: "center", gap: 4
                          }}
                        >
                          <RefreshCw size={10} /> Sync REST
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Slot Details Layout Panel */}
                  <div style={{
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 20, padding: 24, display: "flex", flexDirection: "column",
                    gap: 20, boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
                  }}>
                    {/* Header info */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <h3 style={{ fontSize: 18, fontWeight: 800 }}>{selectedLot.name}</h3>
                        <p style={{ color: C.subtle, fontSize: 12, marginTop: 2 }}>{selectedLot.address}</p>
                      </div>
                      <div style={{ textItems: "right" }}>
                        <span style={{ display: "block", fontSize: 16, fontWeight: 800, color: C.green }}>{selectedLot.price}</span>
                        <span style={{ display: "block", fontSize: 10, color: C.muted }}>Hourly rate</span>
                      </div>
                    </div>

                    <div style={{ height: 1, background: C.border }} />

                    {/* Developer Mock Tool tip */}
                    {selectedLot.isIot && !username && (
                      <div style={{
                        background: C.amber + "12", border: `1px solid ${C.amber}33`, borderRadius: 12,
                        padding: "12px 14px", display: "flex", gap: 10, alignItems: "start"
                      }}>
                        <Clock size={16} color={C.amber} style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.amber, display: "block" }}>Demo / Mock View Active</span>
                          <span style={{ fontSize: 11, color: C.subtle }}>
                            No Adafruit IO credentials configured. Showing mock slots. Set credentials via "Configure API" (top right) to connect your physical ESP32 or simulator.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* The Grid slots mapping */}
                    <div style={{
                      background: "#0d1726", border: `1px solid ${C.border}`, borderRadius: 16,
                      padding: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 16, boxShadow: "inset 0 4px 20px #00000040"
                    }}>
                      {getSlotsForLot(selectedLot).map(slot => {
                        const isOccupied = slot.value === 1;
                        const isReserved = slot.value === 2;
                        const isVacant = slot.value === 0;

                        const isMine = isMyReservedSlot(selectedLot.id, slot.index);

                        let cardBg = C.surface;
                        let cardBorder = C.border;
                        let textColor = C.text;
                        let textStatus = "Available";
                        let statusColor = C.green;

                        if (isOccupied) {
                          cardBg = "#1f1418";
                          cardBorder = C.red + "33";
                          textColor = C.muted;
                          textStatus = "Occupied";
                          statusColor = C.red;
                        } else if (isReserved) {
                          cardBg = isMine ? "#1c1b12" : "#1a1610";
                          cardBorder = isMine ? C.accent + "55" : C.amber + "33";
                          textColor = isMine ? C.text : C.subtle;
                          textStatus = isMine ? "Your Hold" : "Reserved";
                          statusColor = isMine ? C.accent : C.amber;
                        }

                        return (
                          <button
                            key={slot.label}
                            disabled={isOccupied || (isReserved && !isMine)}
                            onClick={() => {
                              if (isMine) {
                                handleCancelBooking();
                              } else {
                                setShowBookingConfirm(slot);
                              }
                            }}
                            style={{
                              background: cardBg, border: `2px solid ${cardBorder}`,
                              borderRadius: 14, padding: "24px 16px", display: "flex",
                              flexDirection: "column", alignItems: "center", gap: 10,
                              cursor: (isOccupied || (isReserved && !isMine)) ? "not-allowed" : "pointer",
                              boxShadow: isVacant ? `0 0 12px ${C.green}08` : isMine ? `0 0 12px ${C.accent}12` : "none",
                              opacity: (isOccupied || (isReserved && !isMine)) ? 0.7 : 1,
                              transition: "all 0.2s"
                            }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: "50%",
                              background: statusColor + "18", display: "flex",
                              alignItems: "center", justifyContent: "center", color: statusColor
                            }}>
                              <Car size={18} />
                            </div>

                            <div style={{ textAlign: "center" }}>
                              <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: textColor }}>
                                {slot.label}
                              </span>
                              <span style={{
                                display: "block", fontSize: 11, fontWeight: 600,
                                color: statusColor, marginTop: 2
                              }}>
                                {textStatus}
                              </span>
                            </div>

                            {isMine && (
                              <span style={{
                                background: C.accent, color: "#fff", fontSize: 10,
                                padding: "3px 8px", borderRadius: 4, fontWeight: 700, marginTop: 4
                              }}>
                                {formatTimer(bookingTimeRemaining)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Developer manual testing layout controls */}
                    {selectedLot.isIot && !mqttConnected && (
                      <div style={{
                        background: C.surface, border: `1px solid ${C.border}`,
                        borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Info size={14} color={C.accent} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.subtle }}>
                            Offline Demo Controls (Simulate physical ESP32 IR Sensor state changes):
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[1, 2, 3, 4].map(num => {
                            const key = `s${num}`;
                            const currentVal = iotSlots[key];
                            const nextVal = (currentVal + 1) % 3; // cycles Vacant -> Occupied -> Reserved

                            return (
                              <button
                                key={key}
                                onClick={() => setIotSlots(prev => ({ ...prev, [key]: nextVal }))}
                                style={{
                                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
                                  padding: "6px 0", fontSize: 10, color: C.text, cursor: "pointer",
                                  fontWeight: 600, transition: "background 0.15s"
                                }}
                              >
                                S{num}: {currentVal === 0 ? "Vacant" : currentVal === 1 ? "Occupied" : "Reserved"}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
                  padding: "48px 24px", textItems: "center", textAlign: "center", display: "flex",
                  flexDirection: "column", gap: 14, justifyContent: "center", height: "100%"
                }}>
                  <MapPin size={36} color={C.muted} style={{ margin: "0 auto" }} />
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800 }}>No Hub Selected</h3>
                    <p style={{ color: C.subtle, fontSize: 12, marginTop: 4 }}>
                      Please choose a parking zone from the left sidebar or click a pin on the urban map to view real-time slots.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── PERSISTENT BOOKING BANNER (FLOATING SIDE CARD ON DESKTOP) ── */}
      {activeBooking && (
        <div style={{
          position: "fixed", bottom: 24, right: 24,
          width: 340, background: C.surface, borderRadius: 16,
          border: `1px solid ${C.border}`, padding: "16px 20px", zIndex: 40,
          boxShadow: "0 10px 40px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 12,
          animation: "slideIn 0.3s ease-out"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: C.accent + "18", display: "flex",
                alignItems: "center", justifyContent: "center", color: C.accent
              }}>
                <Clock size={18} />
              </div>
              <div>
                <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>
                  Active Hold: Slot {activeBooking.slotIndex}
                </span>
                <span style={{ display: "block", fontSize: 11, color: C.subtle, marginTop: 1 }}>
                  {INITIAL_LOCATIONS.find(l => l.id === activeBooking.lotId)?.name}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <span style={{
                display: "block", fontSize: 18, fontWeight: 800,
                color: bookingTimeRemaining < 60 ? C.red : C.green
              }}>
                {formatTimer(bookingTimeRemaining)}
              </span>
              <span style={{ fontSize: 9, color: C.muted }}>Expiry hold</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              onClick={() => {
                const lot = INITIAL_LOCATIONS.find(l => l.id === activeBooking.lotId);
                setSelectedLot(lot);
              }}
              style={{
                flex: 1, background: C.card, border: `1px solid ${C.border}`,
                color: C.text, borderRadius: 8, padding: "8px 0", fontSize: 11,
                fontWeight: 600, cursor: "pointer"
              }}
            >
              Zoom Spot
            </button>
            <button
              onClick={handleCancelBooking}
              disabled={isPublishing}
              style={{
                flex: 1, background: C.red + "18", border: `1px solid ${C.red}33`,
                color: C.red, borderRadius: 8, padding: "8px 0", fontSize: 11,
                fontWeight: 600, cursor: isPublishing ? "not-allowed" : "pointer"
              }}
            >
              Release Spot
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: BOOKING CONFIRMATION DRAWER ── */}
      {showBookingConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex",
          alignItems: "center", justifyContent: "center", background: "#00000088",
          backdropFilter: "blur(4px)"
        }}>
          {/* overlay closer */}
          <div style={{ position: "absolute", inset: 0 }} onClick={() => setShowBookingConfirm(null)} />

          <div style={{
            position: "relative", width: "100%", maxWidth: 400, background: C.card,
            borderRadius: 20, border: `1px solid ${C.border}`, padding: 24,
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 18
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <span style={{
                  background: C.accent + "18", color: C.accent, fontSize: 10,
                  fontWeight: 700, padding: "3px 8px", borderRadius: 6, letterSpacing: 0.5
                }}>SECURE PARKING</span>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                  Reserve {showBookingConfirm.label}
                </h3>
                <span style={{ fontSize: 12, color: C.subtle }}>
                  {selectedLot.name}
                </span>
              </div>
              <button
                onClick={() => setShowBookingConfirm(null)}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
              padding: 16, display: "flex", flexDirection: "column", gap: 10
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.muted }}>Location Spot</span>
                <span style={{ fontWeight: 700 }}>{showBookingConfirm.label}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.muted }}>Billing Rate</span>
                <span style={{ fontWeight: 700 }}>{selectedLot.price}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: C.muted }}>Hold Timer</span>
                <span style={{ fontWeight: 700, color: C.green }}>15 Minutes</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.subtle, alignItems: "start" }}>
              <Clock size={16} color={C.accent} style={{ marginTop: 2, flexShrink: 0 }} />
              <p style={{ lineHeight: 1.4 }}>
                Your 15-minute booking hold starts immediately. Arrive within this timeframe to unlock the entry gate. If you fail to check in, the slot releases back to public availability.
              </p>
            </div>

            <button
              onClick={() => handleReserve(showBookingConfirm.index)}
              disabled={isPublishing}
              style={{
                background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                color: "#fff", border: "none", borderRadius: 12,
                padding: "14px 0", fontWeight: 700, fontSize: 13, cursor: isPublishing ? "not-allowed" : "pointer",
                boxShadow: `0 4px 20px ${C.accent}33`, textAlign: "center"
              }}
            >
              {isPublishing ? "Reserving..." : "Confirm 15-Min Reservation"}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: SETTINGS (ADAFRUIT IO CREDENTIALS) ── */}
      {isSettingsOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 110, display: "flex",
          alignItems: "center", justifyContent: "center", background: "#000000aa",
          backdropFilter: "blur(4px)", padding: 20
        }}>
          {/* overlay closer */}
          <div style={{ position: "absolute", inset: 0 }} onClick={() => setIsSettingsOpen(false)} />

          <div style={{
            position: "relative", width: "100%", maxWidth: 360,
            background: C.card, borderRadius: 20, border: `1px solid ${C.border}`,
            padding: 24, boxShadow: "0 10px 40px #000000cc", display: "flex",
            flexDirection: "column", gap: 16
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wifi size={18} color={C.accent} />
                <h3 style={{ fontSize: 16, fontWeight: 800 }}>IoT Config</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCredentials} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
                  Adafruit IO Username
                </label>
                <input
                  type="text"
                  name="username"
                  defaultValue={username}
                  placeholder="e.g. kiran_parking"
                  required
                  style={{
                    width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text,
                    outline: "none"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.subtle, marginBottom: 6 }}>
                  Adafruit AIO Active Key
                </label>
                <input
                  type="password"
                  name="key"
                  defaultValue={aioKey}
                  placeholder="aio_XXXXX..."
                  required
                  style={{
                    width: "100%", background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.text,
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ height: 1, background: C.border }} />

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("parkpulse_username");
                    localStorage.removeItem("parkpulse_key");
                    setUsername("");
                    setAioKey("");
                    setIsSettingsOpen(false);
                  }}
                  style={{
                    flex: 1, background: "transparent", border: `1px solid ${C.border}`,
                    color: C.red, borderRadius: 10, padding: "10px 0", fontSize: 12,
                    fontWeight: 600, cursor: "pointer"
                  }}
                >
                  Clear Config
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, background: C.accent, color: "#fff", border: "none",
                    borderRadius: 10, padding: "10px 0", fontSize: 12, fontWeight: 700,
                    cursor: "pointer", boxShadow: `0 4px 14px ${C.accent}33`
                  }}
                >
                  Save & Connect
                </button>
              </div>
            </form>

            <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.45 }}>
              Enter your Adafruit IO credentials to sync in real-time with the ESP32 hardware/simulator. The dashboard uses feeds: <strong>parking-slots</strong> and <strong>parking-booking</strong>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
