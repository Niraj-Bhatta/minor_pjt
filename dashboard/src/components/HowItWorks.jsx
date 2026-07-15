import { useState, useEffect, useRef } from "react";
import {
  ScanLine, DoorOpen, LayoutGrid, Receipt, BellRing,
  Car, Bike, Radio, ChevronRight, Play, Pause,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export default function HowItWorks({ isDesktop = true }) {
  const { colors: C } = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef(null);

  const Badge = ({ children, color = C.accent }) => (
    <span style={{
      display: "inline-block", background: color + "22", color,
      border: `1px solid ${color}44`, borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
      padding: "3px 10px", textTransform: "uppercase",
    }}>{children}</span>
  );

  const LCD = ({ label, lines, color }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{
        background: "#04140a", border: `1px solid ${color}55`, borderRadius: 8,
        padding: "10px 12px", fontFamily: "'Courier New', monospace",
        boxShadow: `inset 0 0 12px ${color}22`,
      }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: color, fontSize: 12.5, letterSpacing: 1, lineHeight: 1.6 }}>{l}</div>
        ))}
      </div>
    </div>
  );

  const Gate = ({ label, state, color }) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{
        position: "relative", width: "100%", maxWidth: 90, height: 46,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
        display: "flex", alignItems: "flex-end", justifyContent: "center", overflow: "hidden",
      }}>
        <div style={{
          width: "80%", height: 6, borderRadius: 3,
          background: state === "open" ? C.green : C.red,
          boxShadow: `0 0 8px ${state === "open" ? C.green : C.red}`,
          position: "absolute",
          bottom: 8,
          transform: state === "open" ? "rotate(-62deg) translateX(-6px)" : "rotate(0deg)",
          transformOrigin: "left center",
          transition: "transform 0.5s ease",
        }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: state === "open" ? C.green : C.red }}>
        {state === "open" ? "OPEN" : "CLOSED"}
      </span>
    </div>
  );

  const Slot = ({ index, kind, occupant }) => {
    const isBike = kind === "bike";
    const filled = !!occupant;
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        background: filled ? (isBike ? C.purple + "18" : C.accent + "18") : C.surface,
        border: `1px solid ${filled ? (isBike ? C.purple : C.accent) + "66" : C.border}`,
        borderRadius: 10, padding: "10px 6px", flex: 1,
        transition: "all 0.4s ease",
      }}>
        {filled ? (
          isBike ? <Bike size={16} color={C.purple} /> : <Car size={16} color={C.accent} />
        ) : (
          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px dashed ${C.muted}` }} />
        )}
        <span style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>SLOT {index + 1}</span>
        <span style={{ fontSize: 8, color: C.muted }}>{isBike ? "IR" : "US"}</span>
      </div>
    );
  };

  const STEPS = [
    {
      icon: <ScanLine size={18} />, color: C.accent,
      title: "Approach & Scan",
      desc: "Entry ultrasonic detects a vehicle at the gate. Driver taps their RFID card at the reader.",
      gate: { entry: "closed", exit: "closed" },
      lcdEntry: ["SCAN RFID CARD", "Waiting..."],
      lcdExit: ["EXIT GATE", "Standby"],
      slots: [null, null, "bike", null],
      buzzer: false,
    },
    {
      icon: <Radio size={18} />, color: C.teal,
      title: "Slot Check",
      desc: "ESP32-A reads car slots 1–2 (ultrasonic) and bike slots 3–4 (IR) to confirm space is free before granting entry.",
      gate: { entry: "closed", exit: "closed" },
      lcdEntry: ["CHECKING SLOTS", "Car: 2 free"],
      lcdExit: ["EXIT GATE", "Standby"],
      slots: [null, null, "bike", null],
      buzzer: false,
    },
    {
      icon: <DoorOpen size={18} />, color: C.green,
      title: "Gate Opens",
      desc: "A free car slot exists, so the entry servo swings open. If the lot were full, this step would not fire.",
      gate: { entry: "open", exit: "closed" },
      lcdEntry: ["ACCESS GRANTED", "Gate opening"],
      lcdExit: ["EXIT GATE", "Standby"],
      slots: [null, null, "bike", null],
      buzzer: false,
    },
    {
      icon: <LayoutGrid size={18} />, color: C.purple,
      title: "Slot Occupied & Synced",
      desc: "The car parks in slot 1. The entry LCD refreshes its empty/full count and the reading is published over MQTT to this dashboard.",
      gate: { entry: "closed", exit: "closed" },
      lcdEntry: ["3 / 4 FREE", "Car:1 Bike:1"],
      lcdExit: ["EXIT GATE", "Standby"],
      slots: ["car", null, "bike", null],
      buzzer: false,
    },
    {
      icon: <Receipt size={18} />, color: C.accent,
      title: "Exit & Fare Calculation",
      desc: "On departure, ESP32-B opens the exit servo and its LCD shows entry time, exit time and the computed parking fare.",
      gate: { entry: "closed", exit: "open" },
      lcdEntry: ["3 / 4 FREE", "Car:1 Bike:1"],
      lcdExit: ["IN 09:14 OUT 11:02", "FARE: Rs 70"],
      slots: [null, null, "bike", null],
      buzzer: false,
    },
    {
      icon: <BellRing size={18} />, color: C.red,
      title: "Hazard Override (any time)",
      desc: "If DHT11 or the MQ2 gas sensor crosses a safety threshold, the buzzer sounds and BOTH gates force open for evacuation, overriding normal logic.",
      gate: { entry: "open", exit: "open" },
      lcdEntry: ["! HAZARD !", "EVACUATE"],
      lcdExit: ["! HAZARD !", "GATES OPEN"],
      slots: ["car", null, "bike", null],
      buzzer: true,
    },
  ];

  useEffect(() => {
    if (!playing) return;
    timerRef.current = setInterval(() => {
      setStepIndex((i) => (i + 1) % STEPS.length);
    }, 2600);
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const step = STEPS[stepIndex];
  const slotKinds = ["car", "car", "bike", "bike"];

  return (
    <section id="how-it-works" style={{ padding: isDesktop ? "40px 40px" : "0 20px 32px" }}>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, marginBottom: 24 }}>
        <Badge color={C.teal}>LIVE SIMULATION</Badge>
        <h2 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 800, letterSpacing: -0.5, marginTop: 10, marginBottom: 6, color: C.text }}>
          How the System Works
        </h2>
        <p style={{ color: C.subtle, fontSize: 14 }}>
          From gate to slot to checkout — watch the entry/exit controllers coordinate in real time.
        </p>
      </div>

      <div style={{
        display: "flex",
        flexDirection: isDesktop ? "row" : "column",
        gap: 20,
      }}>
        {/* ── STEP LIST ── */}
        <div style={{ flex: isDesktop ? "0 0 300px" : undefined, display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((s, i) => {
            const active = i === stepIndex;
            return (
              <button
                key={i}
                onClick={() => { setPlaying(false); setStepIndex(i); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                  background: active ? s.color + "18" : C.card,
                  border: `1px solid ${active ? s.color + "66" : C.border}`,
                  borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                  transition: "all 0.25s ease",
                }}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: s.color + "22", border: `1px solid ${s.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: s.color,
                }}>{s.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? C.text : C.subtle }}>{s.title}</div>
                </div>
                {active && <ChevronRight size={14} color={s.color} style={{ marginLeft: "auto", flexShrink: 0 }} />}
              </button>
            );
          })}

          <button
            onClick={() => setPlaying((p) => !p)}
            style={{
              marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10,
              padding: "9px 0", color: C.subtle, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {playing ? <Pause size={13} /> : <Play size={13} />}
            {playing ? "Pause auto-play" : "Resume auto-play"}
          </button>
        </div>

        {/* ── SIMULATION PANEL ── */}
        <div style={{ flex: 1 }}>
          <div style={{
            background: C.card, border: `1px solid ${step.buzzer ? C.red + "77" : C.border}`,
            borderRadius: 18, padding: isDesktop ? 24 : 16,
            boxShadow: step.buzzer
              ? `0 0 0 1px ${C.red}44, 0 0 32px ${C.red}33`
              : `0 0 0 1px ${C.border}, 0 8px 32px #00000060`,
            transition: "all 0.4s ease",
          }}>
            {/* headline row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: step.color + "22", border: `1px solid ${step.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center", color: step.color,
              }}>{step.icon}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{step.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>Step {stepIndex + 1} of {STEPS.length}</div>
              </div>
              {step.buzzer && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: C.red, fontSize: 12, fontWeight: 700 }}>
                  <BellRing size={14} /> BUZZER ACTIVE
                </span>
              )}
            </div>

            <p style={{ color: C.subtle, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{step.desc}</p>

            {/* gates */}
            <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              <Gate label="Entry Gate (ESP32-A)" state={step.gate.entry} />
              <Gate label="Exit Gate (ESP32-B)" state={step.gate.exit} />
            </div>

            {/* slots */}
            <div style={{ marginBottom: 20 }}>
              <span style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
                Slot Occupancy
              </span>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {slotKinds.map((kind, i) => (
                  <Slot key={i} index={i} kind={kind} occupant={step.slots[i]} />
                ))}
              </div>
            </div>

            {/* LCDs */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr",
              gap: 14,
            }}>
              <LCD label="Entry LCD (ESP32-A)" lines={step.lcdEntry} color={step.buzzer ? C.red : C.green} />
              <LCD label="Exit LCD (ESP32-B)" lines={step.lcdExit} color={step.buzzer ? C.red : C.teal} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}