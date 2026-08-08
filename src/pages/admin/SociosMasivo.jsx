// src/pages/admin/SociosMasivo.jsx
import React, { useState } from "react";
import { db } from "../../config/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const CATEGORIAS = [
  { id: "juvenil", label: "Juvenil" },
  { id: "adulto", label: "Adulto" },
  { id: "femenino_juvenil", label: "Femenino Juvenil" },
  { id: "femenino_adulto", label: "Femenino Adulto" },
];

const FILA_VACIA = { nombre: "", apellido: "", email: "", telefono: "", cedula: "", categoria: "adulto", cuotaMensual: "", password: "" };

export default function SociosMasivo({ onVolver }) {
  const { user } = useAuth();
  const [filas, setFilas] = useState([{ ...FILA_VACIA }, { ...FILA_VACIA }, { ...FILA_VACIA }]);
  const [guardando, setGuardando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [cuotaGeneral, setCuotaGeneral] = useState("");
  const [passwordGeneral, setPasswordGeneral] = useState("yaguares2024");

  const actualizarFila = (index, campo, valor) => {
    setFilas(f => f.map((fila, i) => i === index ? { ...fila, [campo]: valor } : fila));
  };

  const agregarFila = () => setFilas(f => [...f, { ...FILA_VACIA }]);
  const agregar5Filas = () => setFilas(f => [...f, ...Array(5).fill(null).map(() => ({ ...FILA_VACIA }))]);
  const eliminarFila = (index) => setFilas(f => f.filter((_, i) => i !== index));

  const aplicarCuotaATodos = () => {
    if (!cuotaGeneral) { toast.error("Ingresa una cuota"); return; }
    setFilas(f => f.map(fila => ({ ...fila, cuotaMensual: cuotaGeneral })));
    toast.success(`Cuota $${cuotaGeneral} aplicada a todas las filas`);
  };

  const aplicarPasswordATodos = () => {
    if (!passwordGeneral || passwordGeneral.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setFilas(f => f.map(fila => ({ ...fila, password: passwordGeneral })));
    toast.success("Contraseña aplicada a todas las filas");
  };

  const registrarAuditoria = async (accion, detalle) => {
    try {
      await addDoc(collection(db, "auditoria"), {
        accion, detalle,
        adminUid: user?.uid || "desconocido",
        adminEmail: user?.email || "desconocido",
        fecha: serverTimestamp()
      });
    } catch (err) { console.error(err); }
  };

  const handleGuardarTodos = async () => {
    // Filtrar filas válidas
    const validas = filas.filter(f => f.nombre.trim() && f.apellido.trim() && f.email.trim());
    if (validas.length === 0) { toast.error("Completa al menos una fila con nombre, apellido y email"); return; }

    setGuardando(true);
    const res = [];
    const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;

    for (const fila of validas) {
      try {
        // Verificar email duplicado en Firestore
        const existeSnap = await getDocs(query(collection(db, "socios"), where("email", "==", fila.email.trim())));
        if (existeSnap.size > 0) {
          res.push({ ...fila, ok: false, error: "Email ya registrado en socios" });
          continue;
        }

        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: fila.email.trim(),
              password: fila.password || passwordGeneral || "yaguares2024",
              returnSecureToken: true
            })
          }
        );
        const data = await response.json();
        if (data.error) {
          res.push({ ...fila, ok: false, error: data.error.message === "EMAIL_EXISTS" ? "Email ya existe en Auth" : data.error.message });
          continue;
        }

        await addDoc(collection(db, "socios"), {
          uid: data.localId,
          nombre: fila.nombre.trim(),
          apellido: fila.apellido.trim(),
          email: fila.email.trim(),
          telefono: fila.telefono.trim(),
          cedula: fila.cedula.trim(),
          categoria: fila.categoria,
          cuotaMensual: Number(fila.cuotaMensual || cuotaGeneral || 0),
          activo: true,
          creadoEn: serverTimestamp()
        });

        res.push({ ...fila, ok: true, password: fila.password || passwordGeneral || "yaguares2024" });
      } catch (err) {
        res.push({ ...fila, ok: false, error: err.message });
      }
    }

    const exitosos = res.filter(r => r.ok).length;
    await registrarAuditoria("SOCIOS_MASIVO", `${exitosos} socios creados de forma masiva`);
    setResultados(res);
    toast.success(`✅ ${exitosos} de ${validas.length} socios creados`);
    setGuardando(false);
  };

  const limpiar = () => {
    setFilas([{ ...FILA_VACIA }, { ...FILA_VACIA }, { ...FILA_VACIA }]);
    setResultados([]);
  };

  const copiarCredenciales = () => {
    const texto = resultados.filter(r => r.ok).map(r =>
      `${r.nombre} ${r.apellido}\nEmail: ${r.email}\nContraseña: ${r.password}\n`
    ).join("\n");
    navigator.clipboard.writeText(texto);
    toast.success("📋 Credenciales copiadas al portapapeles");
  };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onVolver} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "var(--gris-medio)", cursor: "pointer", padding: "6px 12px" }}>← Volver</button>
        <div>
          <h1 style={{ fontSize: "2rem" }}>CARGA MASIVA DE SOCIOS</h1>
          <p style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>Agrega varios socios al mismo tiempo</p>
        </div>
      </div>

      {/* Resultados */}
      {resultados.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "3px solid var(--verde)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <h3 style={{ fontSize: "1.2rem" }}>Resultados de la carga</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-gold" style={{ padding: "6px 12px", fontSize: "0.78rem" }} onClick={copiarCredenciales}>
                📋 Copiar Credenciales
              </button>
              <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.78rem" }} onClick={limpiar}>
                Nueva carga
              </button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {resultados.map((r, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 12px", borderRadius: 6,
                background: r.ok ? "#0f2a1f" : "#2a0f0f", fontSize: "0.85rem"
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{r.ok ? "✅" : "❌"} {r.nombre} {r.apellido}</span>
                  <span style={{ color: "var(--gris-medio)", marginLeft: 8 }}>{r.email}</span>
                </div>
                {r.ok ? (
                  <span style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontSize: "0.82rem" }}>Clave: {r.password}</span>
                ) : (
                  <span style={{ color: "var(--rojo-claro)", fontSize: "0.78rem" }}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {resultados.length === 0 && (
        <>
          {/* Aplicar a todos */}
          <div className="card" style={{ marginBottom: 16, background: "#1a2a1a", borderColor: "#2a4a2a" }}>
            <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 12 }}>⚡ APLICAR A TODAS LAS FILAS</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={cuotaGeneral} onChange={e => setCuotaGeneral(e.target.value)} placeholder="Cuota mensual $" style={{ flex: 1 }} />
                <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "0.78rem" }} onClick={aplicarCuotaATodos}>Aplicar</button>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" value={passwordGeneral} onChange={e => setPasswordGeneral(e.target.value)} placeholder="Contraseña común" style={{ flex: 1 }} />
                <button className="btn btn-secondary" style={{ padding: "8px 12px", fontSize: "0.78rem" }} onClick={aplicarPasswordATodos}>Aplicar</button>
              </div>
            </div>
          </div>

          {/* Tabla de filas */}
          <div className="card table-wrap" style={{ marginBottom: 16 }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 30 }}>#</th>
                  <th>Nombre *</th>
                  <th>Apellido *</th>
                  <th>Email *</th>
                  <th>Teléfono</th>
                  <th>Cédula</th>
                  <th>Categoría</th>
                  <th style={{ width: 90 }}>Cuota $</th>
                  <th style={{ width: 120 }}>Contraseña</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--gris-medio)", fontSize: "0.8rem" }}>{i + 1}</td>
                    <td><input value={fila.nombre} onChange={e => actualizarFila(i, "nombre", e.target.value)} placeholder="Juan" style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td><input value={fila.apellido} onChange={e => actualizarFila(i, "apellido", e.target.value)} placeholder="Pérez" style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td><input type="email" value={fila.email} onChange={e => actualizarFila(i, "email", e.target.value)} placeholder="juan@email.com" style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td><input value={fila.telefono} onChange={e => actualizarFila(i, "telefono", e.target.value)} placeholder="0999..." style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td><input value={fila.cedula} onChange={e => actualizarFila(i, "cedula", e.target.value)} placeholder="0912..." style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td>
                      <select value={fila.categoria} onChange={e => actualizarFila(i, "categoria", e.target.value)} style={{ padding: "6px 8px", fontSize: "0.85rem" }}>
                        {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </td>
                    <td><input type="number" value={fila.cuotaMensual} onChange={e => actualizarFila(i, "cuotaMensual", e.target.value)} placeholder="0" style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td><input value={fila.password} onChange={e => actualizarFila(i, "password", e.target.value)} placeholder={passwordGeneral} style={{ padding: "6px 8px", fontSize: "0.85rem" }} /></td>
                    <td>
                      {filas.length > 1 && (
                        <button onClick={() => eliminarFila(i)} style={{ background: "none", border: "none", color: "var(--rojo-claro)", cursor: "pointer", fontSize: "1rem" }}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Acciones */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={agregarFila}>+ 1 Fila</button>
              <button className="btn btn-secondary" onClick={agregar5Filas}>+ 5 Filas</button>
            </div>
            <button className="btn btn-primary" onClick={handleGuardarTodos} disabled={guardando} style={{ padding: "12px 24px" }}>
              {guardando ? "Creando socios..." : `✅ Crear ${filas.filter(f => f.nombre && f.apellido && f.email).length} Socios`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
