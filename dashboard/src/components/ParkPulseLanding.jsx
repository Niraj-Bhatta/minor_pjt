import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Navigation, Zap, Shield, Clock, ChevronRight,
  Star, Users, Car, Wifi, Activity, CheckCircle, Menu, X
} from "lucide-react";

// ── Colour tokens (lifted from screenshot) ──────────────────────────────────
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
  text: "#f1f5f9",
  muted: "#64748b",
  subtle: "#94a3b8",
};

// ── Window Size Hook ────────────────────────────────────────────────────────
function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
      });
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

// ── Small reusable atoms ────────────────────────────────────────────────────
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
    boxShadow: `0 0 0 1px ${C.border}, 0 8px 32px #00000060`,
    ...style,
  }}>{children}</div>
);

const StatPill = ({ icon, label, value, color }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: "10px 14px",
  }}>
    <span style={{ color, fontSize: 18 }}>{icon}</span>
    <div>
      <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 11 }}>{label}</div>
    </div>
  </div>
);

// ── Fake mini-map component ─────────────────────────────────────────────────
const MiniMap = ({ isDesktop, isTablet }) => {
  const height = isDesktop ? 350 : isTablet ? 280 : 200;
  return (
    <div style={{
      background: "#0d1b2e", border: `1px solid ${C.border}`,
      borderRadius: 16, overflow: "hidden", position: "relative", height,
    }}>
      {/* grid lines simulating a map */}
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.15 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke={C.teal} strokeWidth="1" />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={`${i * 8.33}%`} y1="0" x2={`${i * 8.33}%`} y2="100%" stroke={C.teal} strokeWidth="1" />
        ))}
        {/* roads */}
        <rect x="0" y="35%" width="100%" height="10" fill={C.border} opacity="3" />
        <rect x="25%" y="0" width="12" height="100%" fill={C.border} opacity="3" />
        <rect x="0" y="70%" width="100%" height="8" fill={C.border} opacity="2" />
        <rect x="56%" y="0" width="10" height="100%" fill={C.border} opacity="2" />
      </svg>
      {/* parking markers */}
      {[
        { x: "30%", y: "38%", color: C.green, label: "P1" },
        { x: "62%", y: "55%", color: C.accent, label: "P2" },
        { x: "75%", y: "28%", color: C.green, label: "P3" },
      ].map(m => (
        <div key={m.label} style={{
          position: "absolute", left: m.x, top: m.y,
          transform: "translate(-50%,-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: m.color + "33", border: `2px solid ${m.color}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MapPin size={12} color={m.color} />
          </div>
          <span style={{
            background: C.bg, color: m.color, fontSize: 9, fontWeight: 700,
            padding: "1px 5px", borderRadius: 4, border: `1px solid ${m.color}44`,
          }}>{m.label}</span>
        </div>
      ))}
      {/* legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10,
        background: C.card + "ee", borderRadius: 8, padding: "6px 10px",
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
          <span style={{ color: C.subtle, fontSize: 10 }}>Available</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent }} />
          <span style={{ color: C.subtle, fontSize: 10 }}>Reserved</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────
export default function ParkPulseLanding() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = localStorage.getItem("currentUser");

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const features = [
    {
      icon: <Activity size={20} />, color: C.accent,
      title: "Real-Time Prediction",
      desc: "ML models predict slot availability 45 mins before you arrive, learning your spot based on real live traffic patterns.",
      tag: "AI POWERED",
    },
    {
      icon: <Zap size={20} />, color: C.teal,
      title: "Real-Time Precision",
      desc: "Millisecond-accurate occupancy detection ensures you're never sent to an unavailable spot.",
      tag: "LIVE",
    },
    {
      icon: <Shield size={20} />, color: C.green,
      title: "Frictionless Entry",
      desc: "Automated license plate recognition and digital wallet integration — no tickets, no stress.",
      tag: "AUTOMATED",
    },
  ];

  const steps = [
    { num: "1", title: "Select Destination", desc: "Open the app and choose any parking zone in your routing. AI handles the rest." },
    { num: "2", title: "Smart Routing", desc: "Receive a route that accounts for real-time traffic so you roll directly to your reserved space." },
    { num: "3", title: "Effortless Exit", desc: "Payment is processed automatically as you depart — connected automatically as you depart." },
  ];

  const navLinks = ["Features", "How It Works", "Pricing", "Enterprise", "Blog"];

  const { width } = useWindowSize();
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;

  return (
    <div style={{ background: C.bg, width: "100%" }}>
      <div style={{
        background: C.bg, color: C.text, minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, sans-serif",
        maxWidth: isDesktop ? 1280 : "100%",
        margin: "0 auto",
        borderLeft: isDesktop ? `1px solid ${C.border}` : "none",
        borderRight: isDesktop ? `1px solid ${C.border}` : "none",
        boxShadow: isDesktop ? "0 0 100px rgba(0,0,0,0.8)" : "none",
      }}>
        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: C.bg + "f0", backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
          padding: isDesktop ? "20px 40px" : "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Car size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.5 }}>ParkPulse AI</span>
          </div>
          {isDesktop ? (
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {navLinks.map(l => (
                <span
                  key={l}
                  style={{
                    color: C.subtle,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => { e.target.style.color = C.text; }}
                  onMouseLeave={(e) => { e.target.style.color = C.subtle; }}
                >
                  {l}
                </span>
              ))}
              <button
                onClick={() => navigate("/app")}
                style={{
                  background: C.accent, color: "#fff", border: "none",
                  borderRadius: 8, padding: "8px 16px", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", boxShadow: `0 2px 10px ${C.accent}44`,
                }}
              >
                Launch App
              </button>
              {currentUser && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
                  <span style={{ fontSize: 13, color: C.subtle }}>Welcome, {currentUser}</span>
                  <button
                    onClick={handleLogout}
                    style={{
                      background: "none", border: `1px solid ${C.border}`, color: C.text,
                      borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer",
                      fontWeight: 600, transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => { e.target.style.background = C.border; }}
                    onMouseLeave={(e) => { e.target.style.background = "none"; }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: 4 }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </nav>

        {/* mobile menu */}
        {!isDesktop && menuOpen && (
          <div style={{
            background: C.surface, borderBottom: `1px solid ${C.border}`,
            padding: "12px 20px",
          }}>
            {navLinks.map(l => (
              <div key={l} style={{
                padding: "10px 0", borderBottom: `1px solid ${C.border}44`,
                color: C.subtle, fontSize: 14, fontWeight: 500, cursor: "pointer",
              }}>{l}</div>
            ))}
            {currentUser && (
              <div style={{ padding: "12px 0 6px", display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 13, color: C.subtle }}>Welcome, <strong style={{ color: C.text }}>{currentUser}</strong></span>
                <button
                  onClick={handleLogout}
                  style={{
                    background: C.accent, color: "#fff", border: "none",
                    borderRadius: 10, padding: "10px", fontWeight: 700, fontSize: 13,
                    cursor: "pointer", textAlign: "center", width: "100%"
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── HERO ── */}
        <section style={{
          padding: isDesktop ? "60px 40px" : "40px 20px 32px",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* bg glow */}
          <div style={{
            position: "absolute", top: -60, right: -60, width: 240, height: 240,
            borderRadius: "50%", background: C.accent + "18", filter: "blur(60px)", pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", top: 20, left: -80, width: 200, height: 200,
            borderRadius: "50%", background: C.purple + "12", filter: "blur(50px)", pointerEvents: "none",
          }} />

          <div style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            alignItems: "center",
            gap: isDesktop ? 48 : 28,
          }}>
            {/* Left Column (Desktop) / Bottom (Mobile/Tablet) */}
            <div style={{ flex: 1, order: isDesktop ? 1 : 2, width: "100%" }}>
              <h1 style={{
                fontSize: isDesktop ? 56 : isTablet ? 44 : 34,
                fontWeight: 900,
                lineHeight: 1.1,
                letterSpacing: -1.5,
                marginBottom: 16,
                background: `linear-gradient(135deg, ${C.text} 0%, ${C.subtle} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                Intelligent<br />Parking<br />Redefined.
              </h1>
              <p style={{
                color: C.subtle,
                fontSize: isDesktop ? 16 : 14,
                lineHeight: 1.6,
                marginBottom: 24,
                maxWidth: isDesktop ? 500 : 340,
              }}>
                Experience the world's most advanced autonomous parking ecosystem.
                Powered by ParkPulse AI, our smart system eliminates the search, reduces
                emissions, and streamlines every journey.
              </p>

              <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
                <button
                  onClick={() => navigate("/app")}
                  style={{
                    background: C.accent, color: "#fff", border: "none",
                    borderRadius: 12, padding: "12px 20px", fontWeight: 700, fontSize: 14,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: `0 4px 20px ${C.accent}44`,
                  }}
                >
                  Book Your Spot <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => navigate("/app")}
                  style={{
                    background: "transparent", color: C.subtle,
                    border: `1px solid ${C.border}`, borderRadius: 12,
                    padding: "12px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                >
                  View Availability
                </button>
              </div>

              {/* social proof */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex" }}>
                  {["#3b82f6", "#7c3aed", "#10b981"].map((c, i) => (
                    <div key={i} style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: c, border: `2px solid ${C.bg}`,
                      marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Users size={10} color="#fff" />
                    </div>
                  ))}
                </div>
                <div>
                  <span style={{ color: C.text, fontWeight: 700, fontSize: 13 }}>150+ Active Users</span>
                  <span style={{ color: C.muted, fontSize: 12 }}> managing {"{"}10+{"}"} smart zones</span>
                </div>
              </div>
            </div>

            {/* Right Column (Desktop) / Top (Mobile/Tablet) */}
            <div style={{
              flex: 1,
              order: isDesktop ? 2 : 1,
              width: "100%",
            }}>
              {/* hero image placeholder — dark cityscape feel */}
              <div style={{
                borderRadius: 20, overflow: "hidden", position: "relative",
                background: `linear-gradient(160deg, #0f1e38 0%, #0a1628 60%, #070d1a 100%)`,
                height: isDesktop ? 320 : isTablet ? 260 : 200,
                border: `1px solid ${C.border}`,
              }}>
                {/* city grid lines */}
                <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.2 }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <line key={i} x1={i * 120} y1="0" x2={i * 120 - 60} y2="100%" stroke={C.accent} strokeWidth="1" />
                  ))}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                    <line key={`h${i}`} x1="0" y1={`${i * 12.5}%`} x2="100%" y2={`${i * 12.5}%`} stroke={C.teal} strokeWidth="0.5" />
                  ))}
                </svg>
                {/* glow dot */}
                <div style={{
                  position: "absolute", right: 30, top: 30,
                  width: 60, height: 60, borderRadius: "50%",
                  background: `radial-gradient(circle, ${C.accent}66, transparent 70%)`,
                }} />
                <div style={{
                  position: "absolute", bottom: 14, left: 14,
                  background: C.card + "cc", backdropFilter: "blur(8px)",
                  borderRadius: 10, padding: "8px 12px", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
                  <span style={{ fontSize: 11, color: C.subtle }}>Live • 3 slots available nearby</span>
                </div>
                {/* top badge */}
                <div style={{ position: "absolute", top: 14, left: 14 }}>
                  <Badge color={C.teal}>THE FUTURE OF URBAN MOBILITY</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ENTERPRISE BADGE ── */}
        <div style={{ padding: isDesktop ? "0 40px 24px" : "0 20px 24px" }}>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 20, marginBottom: 16 }}>
            <Badge color={C.purple}>ENTERPRISE CAPABILITIES</Badge>
          </div>
          <h2 style={{ fontSize: isDesktop ? 32 : 24, fontWeight: 800, letterSpacing: -0.8, marginBottom: 6 }}>
            Intelligence in Every Inch
          </h2>
        </div>

        {/* ── FEATURE CARDS ── */}
        <section style={{
          padding: isDesktop ? "0 40px" : "0 20px",
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr 1fr" : isTablet ? "1fr 1fr" : "1fr",
          gap: 14,
        }}>
          {features.map((f, i) => (
            <GlowCard key={i}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: f.color + "22", border: `1px solid ${f.color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: f.color,
                }}>{f.icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{f.title}</span>
                    <Badge color={f.color}>{f.tag}</Badge>
                  </div>
                  <p style={{ color: C.subtle, fontSize: 13, lineHeight: 1.55 }}>{f.desc}</p>
                </div>
              </div>
            </GlowCard>
          ))}
        </section>

        {/* ── STATS ── */}
        <section style={{
          padding: isDesktop ? "40px 40px" : "28px 20px",
          display: "grid",
          gridTemplateColumns: isDesktop ? "1fr 1fr 1fr 1fr" : "1fr 1fr",
          gap: 10,
        }}>
          <StatPill icon={<Zap size={16} />} color={C.accent} value="< 200ms" label="Gate response" />
          <StatPill icon={<CheckCircle size={16} />} color={C.green} value="98.5%" label="Detection accuracy" />
          <StatPill icon={<Wifi size={16} />} color={C.teal} value="MQTT" label="Live protocol" />
          <StatPill icon={<Clock size={16} />} color={C.purple} value="15 min" label="Advance booking" />
        </section>

        {/* ── MAP ── */}
        <section style={{ padding: isDesktop ? "40px 40px" : "0 20px 28px" }}>
          <div style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            gap: 24,
            alignItems: "stretch",
          }}>
            <div style={{ flex: isDesktop ? "1 1 40%" : undefined, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ marginBottom: 14 }}>
                <Badge color={C.teal}>LIVE SENSOR ZONES</Badge>
                <h3 style={{ fontSize: isDesktop ? 24 : 18, fontWeight: 800, marginTop: 8, marginBottom: 6 }}>Explore Full Session Map</h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Central Hub: Zone B", slots: "12 slots · 0.4 km", color: C.green },
                  { label: "East Terminal: Alpha", slots: "5 slots · 0.9 km", color: C.accent },
                ].map((z, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <MapPin size={16} color={z.color} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{z.label}</div>
                        <div style={{ color: C.muted, fontSize: 11 }}>{z.slots}</div>
                      </div>
                    </div>
                    <Navigation size={14} color={C.accent} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ flex: isDesktop ? "1 1 60%" : undefined, width: "100%" }}>
              <MiniMap isDesktop={isDesktop} isTablet={isTablet} />
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section style={{ padding: isDesktop ? "40px 40px" : "0 20px 32px" }}>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: isDesktop ? 28 : 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 6 }}>
              Simplified Operations
            </h2>
            <p style={{ color: C.subtle, fontSize: 14 }}>Three steps to a smarter commute.</p>
          </div>

          <div style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            gap: isDesktop ? 24 : 16,
          }}>
            {steps.map((s, i) => (
              <div key={i} style={{
                display: "flex",
                flexDirection: isDesktop ? "column" : "row",
                gap: 14,
                flex: 1,
                alignItems: isDesktop ? "flex-start" : "stretch",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 800, fontSize: 14, color: "#fff",
                  boxShadow: `0 4px 14px ${C.accent}44`,
                }}>{s.num}</div>
                <div style={{ paddingTop: isDesktop ? 4 : 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{s.title}</div>
                  <p style={{ color: C.subtle, fontSize: 13, lineHeight: 1.55 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section style={{
          margin: isDesktop ? "0 40px 48px" : "0 20px 32px",
          background: `linear-gradient(135deg, ${C.accent}22, ${C.purple}22)`,
          border: `1px solid ${C.accent}44`, borderRadius: 24,
          padding: isDesktop ? "48px 40px" : "28px 20px",
          textAlign: "center",
        }}>
          <Badge color={C.accent}>GET STARTED</Badge>
          <h3 style={{ fontSize: isDesktop ? 32 : 22, fontWeight: 800, marginTop: 12, marginBottom: 8, letterSpacing: -0.5 }}>
            Ready for the Future?
          </h3>
          <p style={{
            color: C.subtle,
            fontSize: isDesktop ? 15 : 13,
            lineHeight: 1.6,
            marginBottom: 24,
            maxWidth: isDesktop ? 600 : undefined,
            margin: isDesktop ? "12px auto 24px" : "0 auto 20px",
          }}>
            Join thousands of drivers who have already discovered smarter,
            stress-free parking powered by IoT and real-time intelligence.
          </p>
          <button
            onClick={() => navigate("/app")}
            style={{
              background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
              color: "#fff", border: "none", borderRadius: 12,
              padding: "13px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer",
              boxShadow: `0 4px 20px ${C.accent}44`,
              width: isDesktop ? "auto" : "100%",
            }}
          >
            Get Started Today →
          </button>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          background: C.surface, borderTop: `1px solid ${C.border}`,
          padding: isDesktop ? "48px 40px 32px" : "28px 20px 20px",
        }}>
          <div style={{
            display: "flex",
            flexDirection: isDesktop ? "row" : "column",
            justifyContent: isDesktop ? "space-between" : "flex-start",
            gap: isDesktop ? 48 : 28,
            marginBottom: 32,
          }}>
            {/* Brand Col */}
            <div style={{ flex: isDesktop ? "1 1 40%" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Car size={12} color="#fff" />
                </div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>ParkPulse AI</span>
              </div>
              <p style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 20, maxWidth: 300 }}>
                Building the future of urban parking infrastructure through intelligent IoT
                systems, real-time sensor networks, and seamless user experiences.
              </p>
            </div>

            {/* Links Cols */}
            <div style={{
              display: "flex",
              flexDirection: isDesktop ? "row" : "column",
              gap: isDesktop ? 40 : 18,
              flex: isDesktop ? "1 1 60%" : undefined,
              justifyContent: isDesktop ? "flex-end" : "flex-start",
            }}>
              {[
                { heading: "NAVIGATION", links: ["Home", "Features", "How It Works", "Pricing"] },
                { heading: "COMPANY", links: ["About", "Blog", "Careers", "Contact"] },
                { heading: "LEGAL", links: ["Privacy Policy", "Terms of Service", "Cookie Policy"] },
              ].map(col => (
                <div key={col.heading} style={{ minWidth: isDesktop ? 120 : undefined }}>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
                    {col.heading}
                  </div>
                  {col.links.map(l => (
                    <div key={l} style={{ color: C.subtle, fontSize: 13, marginBottom: 8, cursor: "pointer" }}>{l}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            borderTop: `1px solid ${C.border}`, paddingTop: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ color: C.muted, fontSize: 11 }}>© 2024 ParkPulse AI Technologies</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
              <span style={{ color: C.muted, fontSize: 10 }}>All Systems Operational</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}