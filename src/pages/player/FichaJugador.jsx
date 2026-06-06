// src/pages/player/FichaJugador.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../../config/firebase";
import { collection, query, where, getDocs, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const POSICIONES = [
  "Pilar derecho (1)", "Hooker (2)", "Pilar izquierdo (3)",
  "Segunda línea (4)", "Segunda línea (5)",
  "Ala (6)", "Octavo (8)", "Ala (7)",
  "Scrum-half (9)", "Fly-half (10)",
  "Centro (12)", "Centro (13)",
  "Ala (11)", "Ala (14)", "Fullback (15)"
];

const NACIONALIDADES = [
  "Ecuador", "Argentina", "Uruguay", "Colombia", "Perú", "Chile",
  "Brasil", "Venezuela", "Bolivia", "Paraguay", "España", "Otra"
];

export default function FichaJugador({ onVolver }) {
  const { user, socioData } = useAuth();
  const [ficha, setFicha] = useState(null);
  const [fichaId, setFichaId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState({});
  const [bioimpedancia, setBioimpedancia] = useState(null);

  const [form, setForm] = useState({
    foto: "", nombres: "", apellidos: "", fechaNacimiento: "",
    nacionalidad: "Ecuador", estatura: "", peso: "",
    alergias: "", lesionesPrevias: "",
    aptoMedico: "", aptoMedicoVencimiento: "",
    fotoCedula: "", posicionPrimaria: "", posicionSecundaria1: "",
    posicionSecundaria2: "", certificadosWR: [],
    bioimpedancia: ""
  });

  useEffect(() => { if (user) loadFicha(); }, [user]);

  const loadFicha = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "fichas"),
        where("socioId", "==", user.uid)
      ));
      if (!snap.empty) {
        const d = snap.docs[0];
        setFichaId(d.id);
        setForm({ ...form, ...d.data() });
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const datos = {
        ...form,
        socioId: user.uid,
        socioNombre: `${socioData?.nombre} ${socioData?.apellido}`,
        actualizadoEn: serverTimestamp()
      };
      if (fichaId) {
        await updateDoc(doc(db, "fichas", fichaId), datos);
      } else {
        const ref = await addDoc(collection(db, "fichas"), { ...datos, creadoEn: serverTimestamp() });
        setFichaId(ref.id);
      }
      toast.success("✅ Ficha guardada correctamente");
    } catch (err) { toast.error("Error al guardar: " + err.message); }
    finally { setGuardando(false); }
  };

  const subirArchivo = async (campo, archivo, carpeta) => {
    if (!archivo) return;
    setSubiendo(s => ({ ...s, [campo]: true }));
    try {
      const storageRef = ref(storage, `fichas/${user.uid}/${carpeta}_${Date.now()}`);
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);
      setForm(f => ({ ...f, [campo]: url }));
      toast.success("✅ Archivo subido");
    } catch (err) { toast.error("Error al subir: " + err.message); }
    finally { setSubiendo(s => ({ ...s, [campo]: false })); }
  };

  const calcularEdad = (fecha) => {
    if (!fecha) return "";
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--gris-medio)" }}>Cargando ficha...</div>;

  const seccion = (titulo, icono) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0 14px", paddingBottom: 8, borderBottom: "1px solid #2a2a2a" }}>
      <span style={{ fontSize: "1.2rem" }}>{icono}</span>
      <h3 style={{ fontSize: "1.1rem", color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.08em", textTransform: "uppercase" }}>{titulo}</h3>
    </div>
  );

  const campo = (label, key, tipo = "text", placeholder = "") => (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>{label}</label>
      <input type={tipo} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
    </div>
  );

  const campoArchivo = (label, key, carpeta, aceptar = "image/*") => (
    <div>
      <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>{label}</label>
      <label style={{
        display: "flex", alignItems: "center", gap: 10,
        border: "2px dashed #3a3a3a", borderRadius: 8, padding: "10px 14px",
        cursor: "pointer", background: form[key] ? "#0f2a1f" : "var(--gris)"
      }}>
        <input type="file" accept={aceptar} style={{ display: "none" }}
          onChange={e => subirArchivo(key, e.target.files[0], carpeta)} />
        {subiendo[key] ? (
          <span style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>Subiendo...</span>
        ) : form[key] ? (
          <span style={{ color: "var(--verde-claro)", fontSize: "0.85rem" }}>✅ Archivo cargado · <a href={form[key]} target="_blank" rel="noreferrer" style={{ color: "var(--verde-claro)" }}>Ver</a></span>
        ) : (
          <span style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>📎 Seleccionar archivo</span>
        )}
      </label>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={onVolver} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.3rem" }}>←</button>
        <h2 style={{ fontSize: "2rem" }}>MI FICHA DE JUGADOR</h2>
      </div>

      {/* Foto de perfil */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <label style={{ cursor: "pointer", display: "inline-block" }}>
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => subirArchivo("foto", e.target.files[0], "foto")} />
          <div style={{
            width: 100, height: 100, borderRadius: "50%",
            background: form.foto ? `url(${form.foto}) center/cover` : "var(--gris)",
            border: "3px solid var(--verde)", display: "flex",
            alignItems: "center", justifyContent: "center",
            margin: "0 auto", fontSize: "2.5rem", overflow: "hidden"
          }}>
            {!form.foto && "📷"}
          </div>
          <div style={{ color: "var(--verde-claro)", fontSize: "0.78rem", marginTop: 6, fontFamily: "'Barlow Condensed'" }}>
            {subiendo.foto ? "Subiendo..." : "Cambiar foto"}
          </div>
        </label>
      </div>

      {/* INFORMACIÓN PERSONAL */}
      {seccion("Información Personal", "👤")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {campo("Nombres", "nombres", "text", "Juan Carlos")}
        {campo("Apellidos", "apellidos", "text", "Pérez García")}
        <div>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Fecha de Nacimiento</label>
          <input type="date" value={form.fechaNacimiento} onChange={e => setForm(f => ({ ...f, fechaNacimiento: e.target.value }))} />
          {form.fechaNacimiento && (
            <div style={{ color: "var(--verde-claro)", fontSize: "0.78rem", marginTop: 4 }}>
              Edad: {calcularEdad(form.fechaNacimiento)} años
            </div>
          )}
        </div>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nacionalidad</label>
          <select value={form.nacionalidad} onChange={e => setForm(f => ({ ...f, nacionalidad: e.target.value }))}>
            {NACIONALIDADES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Estatura (cm)</label>
          <input type="number" value={form.estatura} onChange={e => setForm(f => ({ ...f, estatura: e.target.value }))} placeholder="175" />
        </div>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Peso (kg)</label>
          <input type="number" value={form.peso} onChange={e => setForm(f => ({ ...f, peso: e.target.value }))} placeholder="80" />
        </div>
      </div>

      {/* INFORMACIÓN MÉDICA */}
      {seccion("Información Médica", "🏥")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <div style={{ gridColumn: "span 2" }}>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Alergias</label>
          <textarea value={form.alergias} onChange={e => setForm(f => ({ ...f, alergias: e.target.value }))} placeholder="Ninguna / Describir alergias conocidas..." rows={2} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Lesiones Previas de Consideración</label>
          <textarea value={form.lesionesPrevias} onChange={e => setForm(f => ({ ...f, lesionesPrevias: e.target.value }))} placeholder="Describir lesiones relevantes..." rows={2} />
        </div>
        <div>
          <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Vencimiento Apto Médico</label>
          <input type="date" value={form.aptoMedicoVencimiento} onChange={e => setForm(f => ({ ...f, aptoMedicoVencimiento: e.target.value }))} />
        </div>
      </div>

      {/* DOCUMENTOS */}
      {seccion("Documentos", "📄")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {campoArchivo("Apto Médico (imagen o PDF)", "aptоMedico", "apto", "image/*,application/pdf")}
        {campoArchivo("Foto Cédula / Pasaporte", "fotoCedula", "cedula", "image/*")}
        <div>
          <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Bioimpedancia (PDF)</label>
          {form.bioimpedancia ? (
            <div style={{ background: "#0f2a1f", borderRadius: 8, padding: 12 }}>
              <div style={{ color: "var(--verde-claro)", fontSize: "0.85rem", marginBottom: 6 }}>✅ Análisis cargado por el club</div>
              <a href={form.bioimpedancia} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.78rem" }}>
                📄 Ver Bioimpedancia
              </a>
            </div>
          ) : (
            <div style={{ background: "var(--gris)", borderRadius: 8, padding: 12, border: "1px solid #2a2a2a" }}>
              <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>⏳ Pendiente — el club subirá tu análisis</div>
            </div>
          )}
        </div>
      </div>

      {/* RUGBY */}
      {seccion("Información Rugby", "🏉")}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {["posicionPrimaria", "posicionSecundaria1", "posicionSecundaria2"].map((key, i) => (
          <div key={key}>
            <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>
              {i === 0 ? "Posición Primaria" : `Posición Secundaria ${i}`}
            </label>
            <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">Seleccionar...</option>
              {POSICIONES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        ))}
        {campoArchivo("Certificados World Rugby (PDF)", "certificadosWR", "certificados", "application/pdf,image/*")}
      </div>

      {/* Guardar */}
      <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando} style={{ padding: "12px 28px" }}>
          {guardando ? "Guardando..." : "💾 Guardar Ficha"}
        </button>
      </div>
    </div>
  );
}
