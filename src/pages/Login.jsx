// src/pages/Login.jsx
import React, { useState } from "react";
import { auth } from "../config/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isAdmin = params.get("rol") === "admin";

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate(isAdmin ? "/admin" : "/portal");
    } catch (err) {
      toast.error("Credenciales incorrectas. Verifica tu email y contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--negro)",
      padding: "24px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Escudo de fondo */}
      <div style={{
        position: "absolute",
        right: -80,
        bottom: -80,
        width: 400,
        height: 400,
        backgroundImage: "url('/escudo-yaguares.png')",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        opacity: 0.06,
        pointerEvents: "none"
      }} />
      <div style={{
        position: "absolute",
        left: -80,
        top: -80,
        width: 300,
        height: 300,
        backgroundImage: "url('/escudo-yaguares.png')",
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        opacity: 0.04,
        pointerEvents: "none"
      }} />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "36px", position: "relative" }}>
        <div style={{ position: "relative", display: "inline-block", marginBottom: 16 }}>
          <img src="/escudo-yaguares.png" alt="Yaguares RC" style={{ width: 90, height: 90, objectFit: "contain" }} />
        </div>
        <h1 style={{ fontSize: "2.8rem", color: "var(--blanco)", lineHeight: 1 }}>YAGUARES RC</h1>
        <p style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.15em", fontSize: "0.85rem", marginTop: 4 }}>
          GUAYAQUIL · ECUADOR
        </p>
      </div>

      {/* Card */}
      <div className="card" style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 24, paddingBottom: 16,
          borderBottom: "1px solid #2a2a2a"
        }}>
          <div style={{
            background: isAdmin ? "var(--verde-oscuro)" : "#1a2a4a",
            padding: "6px 12px", borderRadius: 4,
            color: isAdmin ? "var(--verde-claro)" : "#5dade2",
            fontFamily: "'Barlow Condensed'", fontWeight: 700,
            fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase"
          }}>
            {isAdmin ? "🛡️ PANEL ADMIN" : "🏉 PORTAL JUGADOR"}
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tucorreo@email.com" required />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "13px" }}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button onClick={() => navigate(`/login?rol=${isAdmin ? "jugador" : "admin"}`)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gris-medio)", fontSize: "0.85rem", fontFamily: "'Barlow'", textDecoration: "underline" }}>
            {isAdmin ? "¿Eres jugador? Ir al portal" : "¿Eres administrador? Ir al panel admin"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: 24, color: "#2a2a2a", fontSize: "0.75rem", position: "relative" }}>
        Yaguares RC · Sistema de Gestión de Cobros v2.0
      </p>
    </div>
  );
}
