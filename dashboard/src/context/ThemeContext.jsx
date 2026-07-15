import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

const lightColors = {
  bg: "#F8FAFC",
  surface: "#ffffff",
  card: "#ffffff",
  border: "#E5E7EB",
  accent: "#2563EB",
  accentGlow: "#bfdbfe",
  teal: "#16A34A",
  green: "#16A34A",
  purple: "#7c3aed",
  amber: "#D97706",
  red: "#DC2626",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#6B7280",
};

const darkColors = {
  bg: "#0F172A",
  surface: "#111827",
  card: "#1E293B",
  border: "#334155",
  accent: "#3B82F6",
  accentGlow: "#1e3a8a",
  teal: "#06b6d4",
  green: "#22C55E",
  purple: "#a855f7",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#FFFFFF",
  muted: "#CBD5E1",
  subtle: "#94a3b8",
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("parkpulse_theme") || "light";
  });

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  useEffect(() => {
    localStorage.setItem("parkpulse_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const colors = theme === "light" ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
