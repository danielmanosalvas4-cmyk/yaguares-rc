// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import Socios from "./pages/admin/Socios";
import ValidarPagos from "./pages/admin/ValidarPagos";
import CobrosExtraordinarios from "./pages/admin/CobrosExtraordinarios";
import Reportes from "./pages/admin/Reportes";
import Admins from "./pages/admin/Admins";
import PortalJugador from "./pages/player/PortalJugador";

// Layouts
import AdminLayout from "./components/admin/AdminLayout";
import PlayerLayout from "./components/player/PlayerLayout";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e1e1e",
              color: "#f5f5f0",
              border: "1px solid #2a2a2a",
              fontFamily: "'Barlow', sans-serif",
              fontSize: "0.9rem"
            },
            success: { iconTheme: { primary: "#23a05a", secondary: "#0d0d0d" } },
            error: { iconTheme: { primary: "#c0392b", secondary: "#f5f5f0" } }
          }}
        />

        <Routes>
          {/* Landing — redirige al login de jugadores por defecto */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Login compartido */}
          <Route path="/login" element={<Login />} />

          {/* Panel Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="socios" element={<Socios />} />
            <Route path="pagos" element={<ValidarPagos />} />
            <Route path="cobros" element={<CobrosExtraordinarios />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="admins" element={<Admins />} />
          </Route>

          {/* Portal Jugador */}
          <Route path="/portal" element={
            <PlayerLayout>
              <PortalJugador />
            </PlayerLayout>
          } />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
