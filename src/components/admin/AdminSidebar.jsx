// src/components/admin/AdminSidebar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";

const links = [
  { to: "/admin", label: "Dashboard", icon: "📊", end: true },
  { to: "/admin/socios", label: "Socios", icon: "👥" },
  { to: "/admin/pagos", label: "Validar Pagos", icon: "✅" },
  { to: "/admin/cobros", label: "Cobros Extraordinarios", icon: "✈️" },
  { to: "/admin/reportes", label: "Reportes", icon: "📈" },
  { to: "/admin/admins", label: "Administradores", icon: "🛡️" },
];

export default function AdminSidebar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Sesión cerrada");
    navigate("/login?rol=admin");
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{
        padding: "24px 20px",
        borderBottom: "1px solid #222",
        background: "var(--verde-oscuro)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38,
            background: "var(--verde)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.2rem", flexShrink: 0
          }}>🐆</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.1rem", letterSpacing: "0.05em" }}>
              YAGUARES RC
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed'", fontSize: "0.65rem",
              color: "var(--verde-claro)", letterSpacing: "0.12em",
              textTransform: "uppercase"
            }}>Panel Administrativo</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            style={({ isActive }) => ({
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 20px",
              textDecoration: "none",
              fontFamily: "'Barlow Condensed'",
              fontWeight: 600,
              fontSize: "0.9rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: isActive ? "white" : "var(--gris-medio)",
              background: isActive ? "var(--verde-oscuro)" : "transparent",
              borderLeft: isActive ? "3px solid var(--verde-claro)" : "3px solid transparent",
              transition: "all 0.15s"
            })}
          >
            <span style={{ fontSize: "1rem" }}>{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid #222" }}>
        <button
          onClick={handleLogout}
          className="btn btn-secondary"
          style={{ width: "100%", justifyContent: "center", fontSize: "0.8rem" }}
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
