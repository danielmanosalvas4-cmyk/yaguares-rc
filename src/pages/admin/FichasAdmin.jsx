// src/pages/admin/FichasAdmin.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../../config/firebase";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { format, isPast } from "date-fns";
import { es } from "date-fns/locale";

export default function FichasAdmin() {
  const [socios, setSocios] = useState([]);
  const [fichas, setFichas] = useState({});
  const [loading, setLoading] = useState(true);
  const [socioSel, setSocioSel] = useState(null);
  const [search, setSearch] = useState("");
  const [filtroPos, setFiltroPos] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => { loadDatos(); }, []);

  const loadDatos = async () => {
    setLoading(true);
    const [sociosSnap, fichasSnap] = await Promise.all([
      getDocs(collection(db, "socios")),
      getDocs(collection(db, "fichas"))
    ]);
    const sociosList = sociosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fichasMap = {};
    fichasSnap.docs.forEach(d => { fichasMap[d.data().socioId] = { id: d.id, ...d.data() }; });
    setSocios(sociosList);
    setFichas(fichasMap);
    setLoading(false);
  };

  const subirBioimpedancia = async (socio, archivo) => {
    if (!archivo) return;
    setSubiendo(true);
    const ficha = fichas[socio.uid || socio.id];
    if (!ficha) { toast.error("El jugador aún no tiene ficha creada"); setSubiendo(false); return; }
    try {
      const storageRef = ref(storage, `fichas/${socio.uid || socio.id}/bioimpedancia_${Date.now()}.pdf`);
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "fichas", ficha.id), { bioimpedancia: url });
      toast.success("✅ Bioimpedancia subida correctamente");
      loadDatos();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSubiendo(false); }
  };

  const getEstadoMedico = (ficha) => {
    if (!ficha) return { color: "var(--gris-medio)", texto: "Sin ficha", icono: "❓" };
    if (!ficha.aptoMedico) return { color: "var(--rojo)", texto: "Sin apto", icono: "❌" };
    if (ficha.aptoMedicoVencimiento && isPast(new Date(ficha.aptoMedicoVencimiento))) {
      return { color: "var(--rojo)", texto: "Apto vencido", icono: "🔴" };
    }
    if (ficha.aptoMedicoVencimiento) {
      const dias = Math.ceil((new Date(ficha.aptoMedicoVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
      if (dias <= 30) return { color: "var(--amarillo)", texto: `Vence en ${dias}d`, icono: "⚠️" };
    }
    return { color: "var(--verde-claro)", texto: "Apto vigente", icono: "✅" };
  };

  const posiciones = [...new Set(socios.map(s => fichas[s.uid || s.id]?.posicionPrimaria).filter(Boolean))];

  const filtered = socios.filter(s => {
    const matchSearch = `${s.nombre} ${s.apellido}`.toLowerCase().includes(search.toLowerCase());
    const ficha = fichas[s.uid || s.id];
    const matchPos = !filtroPos || ficha?.posicionPrimaria === filtroPos || ficha?.posicionSecundaria1 === filtroPos || ficha?.posicionSecundaria2 === filtroPos;
    return matchSearch && matchPos;
  });

  if (loading) return <p style={{ color: "var(--gris-medio)" }}>Cargando fichas...</p>;

  const fichaSeleccionada = socioSel ? fichas[socioSel.uid || socioSel.id] : null;
  const estadoMedSel = fichaSeleccionada ? getEstadoMedico(fichaSeleccionada) : null;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2.5rem" }}>FICHAS DE JUGADORES</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Estado médico, posiciones y documentos del plantel</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20 }}>
        {/* Lista */}
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <select value={filtroPos} onChange={e => setFiltroPos(e.target.value)}>
              <option value="">Todas las posiciones</option>
              {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(s => {
              const ficha = fichas[s.uid || s.id];
              const estado = getEstadoMedico(ficha);
              return (
                <div key={s.id} onClick={() => setSocioSel(s)} className="card"
                  style={{
                    cursor: "pointer", padding: 12,
                    borderLeft: `3px solid ${socioSel?.id === s.id ? "var(--verde-claro)" : estado.color}`,
                    background: socioSel?.id === s.id ? "var(--verde-oscuro)" : "var(--gris-oscuro)"
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{s.nombre} {s.apellido}</div>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>
                        {ficha?.posicionPrimaria || "Sin posición"}
                      </div>
                    </div>
                    <span title={estado.texto} style={{ fontSize: "1.1rem" }}>{estado.icono}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle */}
        {socioSel ? (
          <div className="fade-in">
            {fichaSeleccionada ? (
              <div>
                {/* Header */}
                <div className="card" style={{ marginBottom: 16, borderLeft: `3px solid ${estadoMedSel.color}` }}>
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    {fichaSeleccionada.foto ? (
                      <img src={fichaSeleccionada.foto} alt="Foto" style={{ width: 70, height: 70, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--verde)" }} />
                    ) : (
                      <div style={{ width: 70, height: 70, borderRadius: "50%", background: "var(--gris)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem" }}>👤</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: "1.5rem" }}>{fichaSeleccionada.nombres} {fichaSeleccionada.apellidos}</h2>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>
                        {fichaSeleccionada.posicionPrimaria || "—"} · {fichaSeleccionada.nacionalidad} · {fichaSeleccionada.estatura}cm / {fichaSeleccionada.peso}kg
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span style={{ color: estadoMedSel.color, fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.85rem" }}>
                          {estadoMedSel.icono} {estadoMedSel.texto}
                        </span>
                        {fichaSeleccionada.aptoMedicoVencimiento && (
                          <span style={{ color: "var(--gris-medio)", fontSize: "0.78rem", marginLeft: 8 }}>
                            Vence: {format(new Date(fichaSeleccionada.aptoMedicoVencimiento), "d MMM yyyy", { locale: es })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Datos personales */}
                  <div className="card">
                    <h4 style={{ marginBottom: 12, color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.08em" }}>DATOS PERSONALES</h4>
                    {[
                      ["Fecha nacimiento", fichaSeleccionada.fechaNacimiento ? format(new Date(fichaSeleccionada.fechaNacimiento), "d MMM yyyy", { locale: es }) : "—"],
                      ["Alergias", fichaSeleccionada.alergias || "Ninguna"],
                      ["Lesiones previas", fichaSeleccionada.lesionesPrevias || "Ninguna"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>{label}</div>
                        <div style={{ fontSize: "0.88rem" }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Rugby */}
                  <div className="card">
                    <h4 style={{ marginBottom: 12, color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.08em" }}>RUGBY</h4>
                    {[
                      ["Posición primaria", fichaSeleccionada.posicionPrimaria || "—"],
                      ["Posición secundaria 1", fichaSeleccionada.posicionSecundaria1 || "—"],
                      ["Posición secundaria 2", fichaSeleccionada.posicionSecundaria2 || "—"],
                    ].map(([label, val]) => (
                      <div key={label} style={{ marginBottom: 8 }}>
                        <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>{label}</div>
                        <div style={{ fontSize: "0.88rem" }}>{val}</div>
                      </div>
                    ))}
                    {fichaSeleccionada.certificadosWR && (
                      <a href={fichaSeleccionada.certificadosWR} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.75rem", marginTop: 4 }}>
                        📄 Ver Cert. WR
                      </a>
                    )}
                  </div>

                  {/* Documentos */}
                  <div className="card">
                    <h4 style={{ marginBottom: 12, color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.08em" }}>DOCUMENTOS</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: "Apto Médico", key: "aptoMedico" },
                        { label: "Cédula/Pasaporte", key: "fotoCedula" },
                        { label: "Cert. WR", key: "certificadosWR" },
                      ].map(d => (
                        <div key={d.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.82rem", color: "var(--gris-medio)" }}>{d.label}</span>
                          {fichaSeleccionada[d.key] ? (
                            <a href={fichaSeleccionada[d.key]} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: "0.72rem" }}>Ver ↗</a>
                          ) : (
                            <span style={{ color: "#3a3a3a", fontSize: "0.75rem" }}>Sin subir</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bioimpedancia — admin sube */}
                  <div className="card" style={{ borderLeft: "3px solid #bb8fce" }}>
                    <h4 style={{ marginBottom: 12, color: "#bb8fce", fontFamily: "'Barlow Condensed'", letterSpacing: "0.08em" }}>BIOIMPEDANCIA</h4>
                    {fichaSeleccionada.bioimpedancia ? (
                      <div>
                        <div style={{ color: "var(--verde-claro)", fontSize: "0.85rem", marginBottom: 8 }}>✅ Análisis cargado</div>
                        <a href={fichaSeleccionada.bioimpedancia} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.78rem", marginBottom: 10, display: "inline-flex" }}>
                          📄 Ver PDF
                        </a>
                      </div>
                    ) : (
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem", marginBottom: 10 }}>Sin análisis cargado</div>
                    )}
                    <label style={{ display: "block", border: "2px dashed #3a3a3a", borderRadius: 6, padding: "8px 12px", cursor: "pointer", fontSize: "0.8rem", color: "var(--gris-medio)", textAlign: "center" }}>
                      <input type="file" accept="application/pdf" style={{ display: "none" }}
                        onChange={e => subirBioimpedancia(socioSel, e.target.files[0])} />
                      {subiendo ? "Subiendo..." : "📤 Subir PDF Bioimpedancia"}
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: "2rem", marginBottom: 12 }}>📋</div>
                <p style={{ color: "var(--gris-medio)" }}>Este jugador aún no completó su ficha</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👈</div>
            <p style={{ color: "var(--gris-medio)" }}>Selecciona un jugador para ver su ficha</p>
          </div>
        )}
      </div>
    </div>
  );
}
