import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Loginpage from "./components/Loginpage.jsx";
import SignupPage from "./components/SignupPage.jsx";
import ParkPulseLanding from "./components/ParkPulseLanding.jsx";
import ParkPulseApp from "./components/ParkPulseApp.jsx";
import FeaturesPage from "./components/FeaturesPage.jsx";
import HowItWorksPage from "./components/HowItWorksPage.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

function PublicRoute({ children }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/signup" replace />} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Loginpage /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><ParkPulseLanding /></ProtectedRoute>} />
          <Route path="/features" element={<ProtectedRoute><FeaturesPage /></ProtectedRoute>} />
          <Route path="/how-it-works" element={<ProtectedRoute><HowItWorksPage /></ProtectedRoute>} />
          <Route path="/app" element={<ProtectedRoute><ParkPulseApp /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;