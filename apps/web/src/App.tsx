import { Navigate, Route, Routes } from "react-router-dom";
import BuffersPage from "./pages/BuffersPage.js";
import SimulatorPage from "./pages/SimulatorPage.js";

const SIM_ENABLED = import.meta.env.VITE_SIM_ENABLED === "true";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/buffers" replace />} />
      <Route path="/buffers" element={<BuffersPage />} />
      {SIM_ENABLED && <Route path="/sim" element={<SimulatorPage />} />}
    </Routes>
  );
}
