import { Navigate, Route, Routes, NavLink } from "react-router-dom";
import ResidentPage from "./pages/ResidentPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <header className="top-nav">
        <span className="brand">ANACITY - Move In / Move Out</span>
        <nav>
          <NavLink to="/resident" className={({ isActive }) => (isActive ? "active" : "")}>
            Resident
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            Admin
          </NavLink>
        </nav>
      </header>
      <main className="page-body">
        <Routes>
          <Route path="/" element={<Navigate to="/resident" replace />} />
          <Route path="/resident" element={<ResidentPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
