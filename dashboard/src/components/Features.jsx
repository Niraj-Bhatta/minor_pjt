import {
  Radio, Gauge, DoorOpen, Cpu, Wifi, BellRing,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function Features({ isDesktop = true, isTablet = false }) {
  const { colors: C } = useTheme();

  const Badge = ({ children, color = C.accent }) => (
    <span style={{
      display: "inline-block", background: color + "22", color,
      border: `1px solid ${color}44`, borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
      padding: "3px 10px", textTransform: "uppercase",
    }}>{children}</span>
  );

  const GlowCard = ({ children, style = {} }) => (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 16, padding: "18px 16px",
      boxShadow: `0 0 0 1px ${C.border}, 0 8px 32px rgba(0,0,0,0.06)`,
      ...style,
    }}>{children}</div>
  );

  const FEATURES = [
    {
      icon: <Radio size={20} />, color: C.accent,
      title: "RFID Entry Authentication",
      desc: "Each vehicle is verified with an RFID card at the entry gate before the barrier is allowed to open — no manual tickets, no attendant needed.",
      tag: "SECURE",
    },
    {
      icon: <Gauge size={20} />, color: C.teal,
      title: "Dual-Sensor Slot Detection",
      desc: "Ultrasonic sensors monitor the two car bays, IR sensors monitor the two bike bays — live occupancy across all 4 slots, updated continuously.",
      tag: "LIVE",
    },
    {
      icon: <DoorOpen size={20} />, color: C.green,
      title: "Automated Gate Logic",
      desc: "Entry only opens when a matching slot is free. When the lot is full, entry stays locked while exit remains available — fully automatic, no override needed.",
      tag: "AUTOMATED",
    },
    {
      icon: <Cpu size={20} />, color: C.purple,
      title: "Dual ESP32 Architecture",
      desc: "One controller handles entry, slot sensing and environmental safety; a second dedicated controller handles exit, fare calculation and its own gate.",
      tag: "DUAL-MCU",
    },
    {
      icon: <Wifi size={20} />, color: C.accent,
      title: "MQTT Live Sync",
      desc: "Slot status, gate state and fare data stream from both ESP32 boards to this dashboard in real time — no polling, no manual refresh.",
      tag: "MQTT",
    },
    {
      icon: <BellRing size={20} />, color: C.teal,
      title: "Environmental Safety Guard",
      desc: "DHT11 and MQ2 sensors watch for smoke, gas leaks or heat spikes. On a hazard, the buzzer sounds and both gates auto-open for evacuation.",
      tag: "SAFETY",
    },
  ];

  return (
    <div id="features">
      {/* ── SECTION HEADER ── */}
      <div style={{ padding: isDesktop ? "0 40px 24px" : "0 20px 24px" }}>
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 16 }}>
          <Badge color={C.purple}>SYSTEM CAPABILITIES</Badge>
        </div>
        <h2 style={{ fontSize: isDesktop ? 32 : 24, fontWeight: 800, letterSpacing: -0.8, marginBottom: 6, color: C.text }}>
          Built on Real Sensors, Not Guesswork
        </h2>
        <p style={{ color: C.subtle, fontSize: 14, maxWidth: 520 }}>
          Every reading on this dashboard traces back to a physical sensor on the lot —
          not a simulation.
        </p>
      </div>

      {/* ── FEATURE CARDS ── */}
      <section style={{
        padding: isDesktop ? "0 40px" : "0 20px",
        display: "grid",
        gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : isTablet ? "1fr 1fr" : "1fr",
        gap: 14,
      }}>
        {FEATURES.map((f, i) => (
          <GlowCard key={i}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: f.color + "22", border: `1px solid ${f.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center", color: f.color,
              }}>{f.icon}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.text }}>{f.title}</span>
                  <Badge color={f.color}>{f.tag}</Badge>
                </div>
                <p style={{ color: C.subtle, fontSize: 13, lineHeight: 1.55 }}>{f.desc}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </section>
    </div>
  );
}