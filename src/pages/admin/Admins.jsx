// src/pages/admin/Admins.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../config/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import toast from "react-hot-toast";

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "admins"));
    setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleCrear = async () => {
    if (!form.nombre || !form.email || !form.password) {
      toast.error("Completá todos los campos");
      return;
    }
    setSaving(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await setDoc(doc(db, "admins", cred.user.uid), {
        nombre: form.nombre,
        email: form.email,
        creadoEn: new Date().toISOString()
      });
      toast.success("Administrador creado correctamente");
      setForm({ nombre: "", email: "", password: "" });
      setShowForm(false);
      loadAdmins();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este administrador?")) return;
    await deleteDoc(doc(db, "admins", id));
    toast.success("Administrador eliminado");
    loadAdmins();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>ADMINISTRADORES</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Gestioná quién tiene acceso al panel administrativo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Nuevo Admin</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 24, borderLeft: "3px solid var(--verde)" }}>
          <h3 style={{ marginBottom: 16, fontSize: "1.2rem" }}>NUEVO ADMINISTRADOR</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nombre</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="admin@yaguares.com" />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Contraseña</label>
              <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mín. 6 caracteres" />
            </div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrear} disabled={saving}>
              {saving ? "Creando..." : "🛡️ Crear Administrador"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card table-wrap">
        {loading ? (
          <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>🛡️ {a.nombre}</td>
                  <td style={{ color: "var(--gris-medio)" }}>{a.email}</td>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>{a.creadoEn?.split("T")[0]}</td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => eliminar(a.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: 20, background: "#1a2a1a", borderColor: "var(--verde)" }}>
        <h4 style={{ marginBottom: 8, color: "var(--verde-claro)" }}>⚠️ Nota importante</h4>
        <p style={{ color: "var(--gris-medio)", fontSize: "0.88rem", lineHeight: 1.6 }}>
          El primer administrador debe crearse directamente desde <strong>Firebase Console → Authentication</strong> y luego agregar su UID en la colección <code style={{ background: "#2a2a2a", padding: "1px 6px", borderRadius: 3 }}>admins</code> de Firestore manualmente.
          Los siguientes administradores pueden crearse desde acá.
        </p>
      </div>
    </div>
  );
}
