import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Car, Menu, X } from "lucide-react";
import HowItWorks from "./HowItWorks";
import { useTheme } from "../context/ThemeContext.jsx";

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth });
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

export default function HowItWorksPage() {
  const { colors: C } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentUser = localStorage.getItem("currentUser");

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("currentUser");
    navigate("/login");
  };

  const navLinks = [
    { label: "Features", path: "/features" },
    { label: "How It Works", path: "/how-it-works" },
  ];

  const { width } = useWindowSize();
  const isDesktop = width >= 1024;

  return (
    <div style={{ background: C.bg, width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{
        background: C.bg, color: C.text, flex: 1,
        fontFamily: "'Inter', -apple-system, sans-serif",
        maxWidth: isDesktop ? 1280 : "100%",
        width: "100%",
        margin: "0 auto",
        borderLeft: isDesktop ? `1px solid ${C.border}` : "none",
        borderRight: isDesktop ? `1px solid ${C.border}` : "none",
        boxShadow: isDesktop ? "0 0 100px rgba(0,0,0,0.8)" : "none",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* ── NAV ── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: C.bg + "f0", backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
          padding: isDesktop ? "20px 40px" : "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div 
            onClick={() => navigate("/dashboard")}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
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
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  style={{
                    color: l.path === "/how-it-works" ? C.text : C.subtle,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => { e.target.style.color = C.text; }}
                  onMouseLeave={(e) => { e.target.style.color = l.path === "/how-it-works" ? C.text : C.subtle; }}
                >
                  {l.label}
                </span>
              ))}
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
              <div
                key={l.path}
                onClick={() => { navigate(l.path); setMenuOpen(false); }}
                style={{
                  padding: "10px 0", borderBottom: `1px solid ${C.border}44`,
                  color: l.path === "/how-it-works" ? C.text : C.subtle, fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >{l.label}</div>
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

        {/* Page Content */}
        <main style={{ flex: 1, padding: isDesktop ? "48px 0" : "24px 0" }}>
          <HowItWorks isDesktop={isDesktop} />
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          background: C.surface, borderTop: `1px solid ${C.border}`,
          padding: isDesktop ? "48px 40px 32px" : "28px 20px 20px",
          marginTop: "auto",
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
                <span style={{ fontWeight: 800, fontSize: 14, cursor: "pointer" }} onClick={() => navigate("/dashboard")}>ParkPulse AI</span>
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
                { heading: "NAVIGATION", links: [{ label: "Home", path: "/dashboard" }, { label: "Features", path: "/features" }, { label: "How It Works", path: "/how-it-works" }] },
                { heading: "COMPANY", links: [{ label: "About" }, { label: "Blog" }, { label: "Careers" }, { label: "Contact" }] },
                { heading: "LEGAL", links: [{ label: "Privacy Policy" }, { label: "Terms of Service" }, { label: "Cookie Policy" }] },
              ].map(col => (
                <div key={col.heading} style={{ minWidth: isDesktop ? 120 : undefined }}>
                  <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>
                    {col.heading}
                  </div>
                  {col.links.map(l => (
                    <div 
                      key={l.label} 
                      onClick={() => l.path && navigate(l.path)}
                      style={{ color: C.subtle, fontSize: 13, marginBottom: 8, cursor: l.path ? "pointer" : "default" }}
                    >
                      {l.label}
                    </div>
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
