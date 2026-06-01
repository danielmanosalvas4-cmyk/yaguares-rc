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
      toast.error("Credenciales incorrectas. Verificá tu email y contraseña.");
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
      padding: "24px"
    }}>
      {/* Logo / Brand */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{
          width: 80, height: 80,
          background: "var(--verde)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: "2rem"
        }}>🐆</div>
        <h1 style={{ fontSize: "2.8rem", color: "var(--blanco)", lineHeight: 1 }}>
          YAGUARES RC
        </h1>
        <p style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.15em", fontSize: "0.85rem", marginTop: 4 }}>
          GUAYAQUIL · ECUADOR
        </p>
      </div>

      {/* Card */}
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
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
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@email.com"
              required
            />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8, padding: "13px" }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        {/* Cambiar rol */}
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <button
            onClick={() => navigate(`/login?rol=${isAdmin ? "jugador" : "admin"}`)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--gris-medio)", fontSize: "0.85rem",
              fontFamily: "'Barlow'", textDecoration: "underline"
            }}
          >
            {isAdmin ? "¿Sos jugador? Ir al portal" : "¿Sos administrador? Ir al panel admin"}
          </button>
        </div>
      </div>

      <p style={{ marginTop: 24, color: "#3a3a3a", fontSize: "0.75rem" }}>
        Yaguares RC · Sistema de Gestión de Cobros v1.0
      </p>
    </div>
  );
}
