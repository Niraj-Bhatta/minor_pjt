import { Routes, Route } from "react-router-dom";
import LoginPage from "./components/Loginpage.jsx";

function Home() {
  return <h1>Home Page</h1>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default App;