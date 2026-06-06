// src/pages/admin/Admins.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../config/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import toast from "react-hot-toast";

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [cambioPass, setCambioPass] = useState({ actual: "", nueva: "", confirmar: "" });
  const [cambiandoPass, setCambiandoPass] = useState(false);

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "admins"));
    setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleCrear = async () => {
    if (!form.nombre || !form.email || !form.password) { toast.error("Completa todos los campos"); return; }
    if (form.password.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    setSaving(true);
    try {
      // Usar la API REST de Firebase para crear el usuario SIN cambiar la sesión actual
      const apiKey = process.env.REACT_APP_FIREBASE_API_KEY;
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            returnSecureToken: true
          })
        }
      );
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      // Guardar en Firestore con el UID del nuevo admin
      await setDoc(doc(db, "admins", data.localId), {
        nombre: form.nombre,
        email: form.email,
        creadoEn: new Date().toISOString()
      });

      toast.success("✅ Administrador creado correctamente");
      setForm({ nombre: "", email: "", password: "" });
      setShowForm(false);
      loadAdmins();
    } catch (err) {
      if (err.message === "EMAIL_EXISTS") toast.error("Ese email ya está registrado");
      else toast.error("Error: " + err.message);
    }
    finally { setSaving(false); }
  };

  const handleCambiarPassword = async () => {
    if (!cambioPass.actual || !cambioPass.nueva || !cambioPass.confirmar) {
      toast.error("Completa todos los campos"); return;
    }
    if (cambioPass.nueva !== cambioPass.confirmar) {
      toast.error("Las contraseñas nuevas no coinciden"); return;
    }
    if (cambioPass.nueva.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres"); return;
    }
    setCambiandoPass(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, cambioPass.actual);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, cambioPass.nueva);
      toast.success("✅ Contraseña actualizada correctamente");
      setCambioPass({ actual: "", nueva: "", confirmar: "" });
    } catch (err) {
      if (err.code === "auth/wrong-password") toast.error("La contraseña actual es incorrecta");
      else toast.error("Error: " + err.message);
    } finally { setCambiandoPass(false); }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar este administrador?")) return;
    await deleteDoc(doc(db, "admins", id));
    toast.success("Administrador eliminado");
    loadAdmins();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>ADMINISTRADORES</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Gestiona el acceso al panel administrativo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ Nuevo Admin</button>
      </div>

      {/* Cambiar mi contraseña */}
      <div className="card" style={{ marginBottom: 20, borderLeft: "3px solid var(--dorado)" }}>
        <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>🔒 Cambiar Mi Contraseña</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Contraseña actual</label>
            <input type="password" value={cambioPass.actual} onChange={e => setCambioPass(p => ({ ...p, actual: e.target.value }))} placeholder="••••••••" />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nueva contraseña</label>
            <input type="password" value={cambioPass.nueva} onChange={e => setCambioPass(p => ({ ...p, nueva: e.target.value }))} placeholder="••••••••" />
          </div>
          <div>
            <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Confirmar nueva</label>
            <input type="password" value={cambioPass.confirmar} onChange={e => setCambioPass(p => ({ ...p, confirmar: e.target.value }))} placeholder="••••••••" />
          </div>
        </div>
        <button className="btn btn-gold" onClick={handleCambiarPassword} disabled={cambiandoPass} style={{ marginTop: 14 }}>
          {cambiandoPass ? "Actualizando..." : "🔒 Actualizar Contraseña"}
        </button>
      </div>

      {/* Form nuevo admin */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20, borderLeft: "3px solid var(--verde)" }}>
          <h3 style={{ marginBottom: 16, fontSize: "1.1rem" }}>NUEVO ADMINISTRADOR</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
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
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCrear} disabled={saving}>
              {saving ? "Creando..." : "🛡️ Crear Administrador"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="card table-wrap">
        {loading ? <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p> : (
          <table>
            <thead><tr><th>Nombre</th><th>Email</th><th>Creado</th><th>Acciones</th></tr></thead>
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
    </div>
  );
}
