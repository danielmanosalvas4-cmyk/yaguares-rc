// src/components/admin/AdminLayout.jsx
import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AdminSidebar from "./AdminSidebar";
import FooterBrand from "../shared/FooterBrand";

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>🐆</div>
        <p style={{ color: "var(--gris-medio)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.1em" }}>
          CARGANDO...
        </p>
      </div>
    </div>
  );

  if (!user || !isAdmin) return <Navigate to="/login?rol=admin" replace />;

  return (
    <div style={{ display: "flex" }}>
      <AdminSidebar />
      <main className="main-content fade-in">
        <Outlet />
        <FooterBrand />
      </main>
    </div>
  );
}
