// src/components/admin/AdminLayout.jsx
import React, { useState } from "react";
import { Outlet, Navigate, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import FooterBrand from "../shared/FooterBrand";
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";

const links = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/socios", label: "Socios", icon: "👥" },
  { to: "/admin/pagos", label: "Validar Pagos", icon: "✅" },
  { to: "/admin/historial", label: "Historial", icon: "📋" },
  { to: "/admin/historicos", label: "Históricos", icon: "🕐" },
  { to: "/admin/anual", label: "Pago Anual", icon: "💰" },
  { to: "/admin/fichas", label: "Fichas", icon: "🏉" },
  { to: "/admin/cobros", label: "Extraordinarios", icon: "✈️" },
  { to: "/admin/reportes", label: "Reportes", icon: "📈" },
  { to: "/admin/admins", label: "Admins", icon: "🛡️" },
];

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--negro)" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/escudo-yaguares.png" alt="Yaguares" style={{ width: 60, height: 60, objectFit: "contain", marginBottom: 12, opacity: 0.6 }} />
        <p style={{ color: "var(--gris-medio)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.1em" }}>CARGANDO...</p>
      </div>
    </div>
  );

  if (!user || !isAdmin) return <Navigate to="/login?rol=admin" replace />;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login?rol=admin");
  };

  return (
    <div style={{ display: "flex" }}>
      {/* Sidebar desktop */}
      <div style={{ display: "block" }} className="sidebar-desktop-wrapper">
        <AdminSidebar />
      </div>

      {/* Header mobile */}
      <div style={{
        display: "none",
        position: "fixed", top: 0, left: 0, right: 0,
        background: "var(--gris-oscuro)",
        borderBottom: "1px solid #222",
        padding: "0 16px", height: 56,
        alignItems: "center", justifyContent: "space-between",
        zIndex: 300
      }} className="mobile-header-admin">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/escudo-yaguares.png" alt="Yaguares" style={{ width: 28, height: 28, objectFit: "contain" }} />
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: "1rem" }}>YAGUARES RC</span>
        </div>
        <button onClick={() => setMenuAbierto(!menuAbierto)} style={{
          background: "none", border: "1px solid #333", borderRadius: 6,
          color: "white", padding: "6px 12px", cursor: "pointer", fontSize: "1.2rem"
        }}>
          {menuAbierto ? "✕" : "☰"}
        </button>
      </div>

      {/* Dropdown menu mobile */}
      {menuAbierto && (
        <div style={{
          position: "fixed", top: 56, left: 0, right: 0,
          background: "var(--gris-oscuro)", borderBottom: "1px solid #222",
          zIndex: 299, padding: "8px 0", display: "block"
        }} className="mobile-menu-admin">
          {links.map(link => (
            <NavLink key={link.to} to={link.to} end={link.end}
              onClick={() => setMenuAbierto(false)}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 12,
                padding: "11px 20px", textDecoration: "none",
                fontFamily: "'Barlow Condensed'", fontWeight: 600,
                fontSize: "0.88rem", letterSpacing: "0.06em", textTransform: "uppercase",
                color: isActive ? "white" : "var(--gris-medio)",
                background: isActive ? "var(--verde-oscuro)" : "transparent",
                borderLeft: isActive ? "3px solid var(--verde-claro)" : "3px solid transparent",
              })}
            >
              <span>{link.icon}</span>{link.label}
            </NavLink>
          ))}
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "11px 20px", width: "100%", background: "none",
            border: "none", borderTop: "1px solid #222", cursor: "pointer",
            fontFamily: "'Barlow Condensed'", fontWeight: 600,
            fontSize: "0.88rem", color: "var(--gris-medio)", textTransform: "uppercase"
          }}>
            🚪 Cerrar Sesión
          </button>
        </div>
      )}

      <main className="main-content fade-in" style={{ position: "relative", overflow: "hidden" }}>
        {/* Escudo de fondo */}
        <div style={{
          position: "fixed", right: -60, bottom: -60,
          width: 350, height: 350,
          backgroundImage: "url('/escudo-yaguares.png')",
          backgroundSize: "contain", backgroundRepeat: "no-repeat",
          opacity: 0.03, pointerEvents: "none", zIndex: 0
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <Outlet />
          <FooterBrand />
        </div>
      </main>
    </div>
  );
}
