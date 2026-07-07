import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Loginpage from "./components/Loginpage.jsx";
import SignupPage from "./components/SignupPage.jsx";
import ParkPulseLanding from "./components/ParkPulseLanding.jsx";
import ParkPulseApp from "./components/ParkPulseApp.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function PublicRoute({ children }) {
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  return isLoggedIn ? <Navigate to="/dashboard" replace /> : children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/login" element={<PublicRoute><Loginpage /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><ParkPulseLanding /></ProtectedRoute>} />
        <Route path="/app" element={<ProtectedRoute><ParkPulseApp /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;