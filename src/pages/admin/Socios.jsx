// src/pages/admin/Socios.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import DetalleSocio from "./DetalleSocio";

const CATEGORIAS = [
  { id: "juvenil", label: "Juvenil" },
  { id: "adulto", label: "Adulto" },
  { id: "femenino_juvenil", label: "Femenino Juvenil" },
  { id: "femenino_adulto", label: "Femenino Adulto" },
];

const EMPTY = { nombre: "", apellido: "", email: "", telefono: "", cedula: "", categoria: "adulto", cuotaMensual: 0, activo: true, password: "" };

export default function Socios() {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [socioDetalle, setSocioDetalle] = useState(null);

  useEffect(() => { loadSocios(); }, []);

  const loadSocios = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "socios"));
    setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (s, e) => { e.stopPropagation(); setForm({ ...s, password: "" }); setEditId(s.id); setModal(true); };

  const handleSave = async () => {
    if (!form.nombre || !form.apellido || !form.email) { toast.error("Completa nombre, apellido y email"); return; }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "socios", editId), {
          nombre: form.nombre, apellido: form.apellido, telefono: form.telefono,
          cedula: form.cedula, categoria: form.categoria, cuotaMensual: Number(form.cuotaMensual),
          activo: form.activo, actualizadoEn: serverTimestamp()
        });
        toast.success("Socio actualizado");
      } else {
        const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
          { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email, password: form.password || "yaguares2024", returnSecureToken: true }) }
        );
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        await addDoc(collection(db, "socios"), {
          uid: data.localId, nombre: form.nombre, apellido: form.apellido,
          email: form.email, telefono: form.telefono, cedula: form.cedula,
          categoria: form.categoria, cuotaMensual: Number(form.cuotaMensual),
          activo: true, creadoEn: serverTimestamp()
        });
        toast.success(`✅ Socio creado. Contraseña: ${form.password || "yaguares2024"}`);
      }
      setModal(false);
      loadSocios();
    } catch (err) {
      if (err.message === "EMAIL_EXISTS") toast.error("Ese email ya está registrado");
      else toast.error(err.message || "Error al guardar");
    } finally { setSaving(false); }
  };

  const toggleActivo = async (s, e) => {
    e.stopPropagation();
    await updateDoc(doc(db, "socios", s.id), { activo: !s.activo });
    toast.success(s.activo ? "Socio desactivado" : "Socio activado");
    loadSocios();
  };

  const eliminarSocio = async (s, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar a ${s.nombre} ${s.apellido}?`)) return;
    await deleteDoc(doc(db, "socios", s.id));
    toast.success("Socio eliminado");
    loadSocios();
  };

  const filtered = socios.filter(s =>
    `${s.nombre} ${s.apellido} ${s.email} ${s.cedula}`.toLowerCase().includes(search.toLowerCase())
  );

  // Si hay socio seleccionado mostrar detalle
  if (socioDetalle) {
    return <DetalleSocio socio={socioDetalle} onVolver={() => { setSocioDetalle(null); loadSocios(); }} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>SOCIOS</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>{socios.length} socios · Click en un socio para ver su detalle</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Socio</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="Buscar por nombre, email o cédula..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 400 }} />
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards" style={{ display: "none" }}>
        {filtered.map(s => (
          <div key={s.id} className="card card-hover" style={{ marginBottom: 12, borderLeft: `3px solid ${s.activo ? "var(--verde)" : "var(--gris-medio)"}`, cursor: "pointer" }}
            onClick={() => setSocioDetalle(s)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>{s.nombre} {s.apellido}</div>
                <div style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>{s.email}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: "#1a2a1a", color: "var(--verde-claro)", padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 600 }}>
                    {CATEGORIAS.find(c => c.id === s.categoria)?.label || s.categoria}
                  </span>
                  <span style={{ color: "var(--dorado)", fontWeight: 700 }}>${s.cuotaMensual?.toFixed(2)}/mes</span>
                </div>
              </div>
              <span className={`badge ${s.activo ? "badge-aprobado" : "badge-rechazado"}`}>{s.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", padding: "7px", fontSize: "0.78rem" }} onClick={e => openEdit(s, e)}>Editar</button>
              <button className={`btn ${s.activo ? "btn-danger" : "btn-primary"}`} style={{ flex: 1, justifyContent: "center", padding: "7px", fontSize: "0.78rem" }} onClick={e => toggleActivo(s, e)}>{s.activo ? "Desactivar" : "Activar"}</button>
              <button className="btn btn-danger" style={{ padding: "7px 10px", fontSize: "0.78rem" }} onClick={e => eliminarSocio(s, e)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="card table-wrap desktop-table">
        {loading ? <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p> : (
          <table>
            <thead>
              <tr><th>Nombre</th><th>Categoría</th><th>Cuota</th><th>Email</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} onClick={() => setSocioDetalle(s)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.nombre} {s.apellido}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.8rem" }}>CI: {s.cedula} · {s.telefono}</div>
                  </td>
                  <td>
                    <span style={{ background: "#1a2a1a", color: "var(--verde-claro)", padding: "3px 8px", borderRadius: 4, fontFamily: "'Barlow Condensed'", fontSize: "0.8rem", fontWeight: 600 }}>
                      {CATEGORIAS.find(c => c.id === s.categoria)?.label || s.categoria}
                    </span>
                  </td>
                  <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.05rem" }}>${s.cuotaMensual?.toFixed(2)}</td>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>{s.email}</td>
                  <td><span className={`badge ${s.activo ? "badge-aprobado" : "badge-rechazado"}`}>{s.activo ? "Activo" : "Inactivo"}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-secondary" style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={e => openEdit(s, e)}>Editar</button>
                      <button className={`btn ${s.activo ? "btn-danger" : "btn-primary"}`} style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={e => toggleActivo(s, e)}>{s.activo ? "Desactivar" : "Activar"}</button>
                      <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: "0.75rem" }} onClick={e => eliminarSocio(s, e)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: "1.8rem" }}>{editId ? "EDITAR SOCIO" : "NUEVO SOCIO"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[{ key: "nombre", label: "Nombre *" }, { key: "apellido", label: "Apellido *" }, { key: "cedula", label: "Cédula" }, { key: "telefono", label: "Teléfono" }].map(f => (
                <div key={f.key}>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: "span 2" }}>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!!editId} />
              </div>
              {!editId && (
                <div style={{ gridColumn: "span 2" }}>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Contraseña temporal</label>
                  <input type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="yaguares2024" />
                </div>
              )}
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Cuota Mensual ($)</label>
                <input type="number" value={form.cuotaMensual} onChange={e => setForm(p => ({ ...p, cuotaMensual: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editId ? "Guardar Cambios" : "Crear Socio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
