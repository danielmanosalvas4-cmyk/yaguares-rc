// src/components/player/PlayerLayout.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function PlayerLayout({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🐆</div>
        <p style={{ color: "var(--gris-medio)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.1em" }}>CARGANDO...</p>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return children;
}
