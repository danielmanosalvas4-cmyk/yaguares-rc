// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";

import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import Socios from "./pages/admin/Socios";
import ValidarPagos from "./pages/admin/ValidarPagos";
import CobrosExtraordinarios from "./pages/admin/CobrosExtraordinarios";
import Reportes from "./pages/admin/Reportes";
import Admins from "./pages/admin/Admins";
import HistorialSocio from "./pages/admin/HistorialSocio";
import PagosHistoricos from "./pages/admin/PagosHistoricos";
import PagoAnual from "./pages/admin/PagoAnual";
import FichasAdmin from "./pages/admin/FichasAdmin";
import PortalJugador from "./pages/player/PortalJugador";
import AdminLayout from "./components/admin/AdminLayout";
import PlayerLayout from "./components/player/PlayerLayout";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: "#1e1e1e", color: "#f5f5f0", border: "1px solid #2a2a2a", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem" },
          success: { iconTheme: { primary: "#23a05a", secondary: "#0d0d0d" } },
          error: { iconTheme: { primary: "#c0392b", secondary: "#f5f5f0" } }
        }} />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="socios" element={<Socios />} />
            <Route path="pagos" element={<ValidarPagos />} />
            <Route path="historial" element={<HistorialSocio />} />
            <Route path="historicos" element={<PagosHistoricos />} />
            <Route path="anual" element={<PagoAnual />} />
            <Route path="fichas" element={<FichasAdmin />} />
            <Route path="cobros" element={<CobrosExtraordinarios />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="admins" element={<Admins />} />
          </Route>
          <Route path="/portal" element={<PlayerLayout><PortalJugador /></PlayerLayout>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
