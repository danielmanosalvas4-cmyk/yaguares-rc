// src/pages/admin/Socios.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../config/firebase";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import toast from "react-hot-toast";

const CATEGORIAS = [
  { id: "infantil", label: "Infantil (Sub-12)", cuota: 20 },
  { id: "juvenil", label: "Juvenil (Sub-18)", cuota: 30 },
  { id: "adulto", label: "Adulto (Mayor)", cuota: 45 },
  { id: "senior", label: "Senior", cuota: 35 },
];

const EMPTY = {
  nombre: "", apellido: "", email: "", telefono: "",
  cedula: "", categoria: "adulto", cuotaMensual: 45,
  activo: true, password: ""
};

export default function Socios() {
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { loadSocios(); }, []);

  const loadSocios = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "socios"));
    setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const openNew = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (s) => {
    setForm({ ...s, password: "" });
    setEditId(s.id);
    setModal(true);
  };

  const handleCategoriaChange = (cat) => {
    const found = CATEGORIAS.find(c => c.id === cat);
    setForm(f => ({ ...f, categoria: cat, cuotaMensual: found?.cuota || 0 }));
  };

  const handleSave = async () => {
    if (!form.nombre || !form.apellido || !form.email) {
      toast.error("Completá nombre, apellido y email");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "socios", editId), {
          nombre: form.nombre, apellido: form.apellido,
          telefono: form.telefono, cedula: form.cedula,
          categoria: form.categoria, cuotaMensual: Number(form.cuotaMensual),
          activo: form.activo,
          actualizadoEn: serverTimestamp()
        });
        toast.success("Socio actualizado");
      } else {
        // Crear usuario en Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, form.email, form.password || "yaguares2024");
        await addDoc(collection(db, "socios"), {
          uid: cred.user.uid,
          nombre: form.nombre, apellido: form.apellido,
          email: form.email, telefono: form.telefono,
          cedula: form.cedula, categoria: form.categoria,
          cuotaMensual: Number(form.cuotaMensual),
          activo: true,
          creadoEn: serverTimestamp()
        });
        toast.success(`Socio creado. Contraseña temporal: ${form.password || "yaguares2024"}`);
      }
      setModal(false);
      loadSocios();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (s) => {
    await updateDoc(doc(db, "socios", s.id), { activo: !s.activo });
    toast.success(s.activo ? "Socio desactivado" : "Socio activado");
    loadSocios();
  };

  const filtered = socios.filter(s =>
    `${s.nombre} ${s.apellido} ${s.email} ${s.cedula}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>SOCIOS</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>{socios.length} socios registrados</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo Socio</button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text" placeholder="Buscar por nombre, email o cédula..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
      </div>

      {/* Table */}
      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Cuota</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.nombre} {s.apellido}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.8rem" }}>CI: {s.cedula}</div>
                  </td>
                  <td>
                    <span style={{
                      background: "#1a2a1a", color: "var(--verde-claro)",
                      padding: "3px 8px", borderRadius: 4,
                      fontFamily: "'Barlow Condensed'", fontSize: "0.8rem", fontWeight: 600
                    }}>
                      {CATEGORIAS.find(c => c.id === s.categoria)?.label || s.categoria}
                    </span>
                  </td>
                  <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.05rem" }}>
                    ${s.cuotaMensual?.toFixed(2)}
                  </td>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>{s.email}</td>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>{s.telefono}</td>
                  <td>
                    <span className={`badge ${s.activo ? "badge-aprobado" : "badge-rechazado"}`}>
                      {s.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => openEdit(s)}>
                        Editar
                      </button>
                      <button
                        className={`btn ${s.activo ? "btn-danger" : "btn-primary"}`}
                        style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                        onClick={() => toggleActivo(s)}
                      >
                        {s.activo ? "Desactivar" : "Activar"}
                      </button>
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
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000, padding: 20
        }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: "1.8rem" }}>{editId ? "EDITAR SOCIO" : "NUEVO SOCIO"}</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { key: "nombre", label: "Nombre *" },
                { key: "apellido", label: "Apellido *" },
                { key: "cedula", label: "Cédula" },
                { key: "telefono", label: "Teléfono" },
              ].map(f => (
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
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>
                    Contraseña temporal (mín. 6 caracteres)
                  </label>
                  <input type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="yaguares2024" />
                </div>
              )}

              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Categoría</label>
                <select value={form.categoria} onChange={e => handleCategoriaChange(e.target.value)}>
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
