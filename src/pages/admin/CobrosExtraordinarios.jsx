// src/pages/admin/CobrosExtraordinarios.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import {
  collection, getDocs, addDoc, serverTimestamp,
  doc, updateDoc, deleteDoc, query, where
} from "firebase/firestore";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORIAS = ["infantil", "juvenil", "adulto", "senior"];

export default function CobrosExtraordinarios() {
  const [cobros, setCobros] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null); // cobro seleccionado para ver asignados
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titulo: "", descripcion: "", fechaLimite: "",
    asignacion: "todos", // "todos" | "categoria" | "individual"
    categorias: [],
    sociosSeleccionados: [], // [{socioId, monto}]
    montoBase: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [cobrosSnap, sociosSnap] = await Promise.all([
      getDocs(query(collection(db, "cobros"), ...[])),
      getDocs(collection(db, "socios"))
    ]);
    setCobros(cobrosSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) =>
      (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0)
    ));
    setSocios(sociosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const sociosFiltrados = () => {
    if (form.asignacion === "todos") return socios.filter(s => s.activo);
    if (form.asignacion === "categoria") return socios.filter(s => s.activo && form.categorias.includes(s.categoria));
    return socios.filter(s => s.activo);
  };

  const toggleCategoria = (cat) => {
    setForm(f => ({
      ...f,
      categorias: f.categorias.includes(cat)
        ? f.categorias.filter(c => c !== cat)
        : [...f.categorias, cat]
    }));
  };

  const setSocioMonto = (socioId, monto) => {
    setForm(f => {
      const existing = f.sociosSeleccionados.find(s => s.socioId === socioId);
      if (existing) {
        return { ...f, sociosSeleccionados: f.sociosSeleccionados.map(s => s.socioId === socioId ? { ...s, monto } : s) };
      }
      return { ...f, sociosSeleccionados: [...f.sociosSeleccionados, { socioId, monto }] };
    });
  };

  const toggleSocioSel = (socioId) => {
    setForm(f => {
      const exists = f.sociosSeleccionados.find(s => s.socioId === socioId);
      if (exists) {
        return { ...f, sociosSeleccionados: f.sociosSeleccionados.filter(s => s.socioId !== socioId) };
      }
      return { ...f, sociosSeleccionados: [...f.sociosSeleccionados, { socioId, monto: form.montoBase }] };
    });
  };

  const handleCrear = async () => {
    if (!form.titulo) { toast.error("El título es requerido"); return; }

    setSaving(true);
    try {
      // Determinar asignados con sus montos
      let asignados = [];
      if (form.asignacion === "todos" || form.asignacion === "categoria") {
        asignados = sociosFiltrados().map(s => ({
          socioId: s.id,
          socioNombre: `${s.nombre} ${s.apellido}`,
          socioEmail: s.email,
          monto: Number(form.montoBase),
          estado: "pendiente"
        }));
      } else {
        const seleccionados = socios.filter(s => form.sociosSeleccionados.find(ss => ss.socioId === s.id));
        asignados = seleccionados.map(s => {
          const sel = form.sociosSeleccionados.find(ss => ss.socioId === s.id);
          return {
            socioId: s.id,
            socioNombre: `${s.nombre} ${s.apellido}`,
            socioEmail: s.email,
            monto: Number(sel?.monto || form.montoBase || 0),
            estado: "pendiente"
          };
        });
      }

      await addDoc(collection(db, "cobros"), {
        titulo: form.titulo,
        descripcion: form.descripcion,
        fechaLimite: form.fechaLimite,
        asignacion: form.asignacion,
        categorias: form.categorias,
        asignados,
        montoBase: Number(form.montoBase),
        activo: true,
        creadoEn: serverTimestamp()
      });

      // Crear pagos pendientes para cada asignado
      for (const a of asignados) {
        await addDoc(collection(db, "pagos"), {
          socioId: a.socioId,
          socioNombre: a.socioNombre,
          socioEmail: a.socioEmail,
          concepto: form.titulo,
          descripcion: form.descripcion,
          monto: a.monto,
          tipo: "extraordinario",
          estado: "pendiente",
          metodoPago: null,
          comprobanteUrl: null,
          creadoEn: serverTimestamp()
        });
      }

      toast.success(`✈️ Cobro creado y asignado a ${asignados.length} socios`);
      setModal(false);
      setForm({ titulo: "", descripcion: "", fechaLimite: "", asignacion: "todos", categorias: [], sociosSeleccionados: [], montoBase: "" });
      loadData();
    } catch (err) {
      toast.error("Error al crear el cobro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminarCobro = async (id) => {
    if (!window.confirm("¿Eliminar este cobro extraordinario?")) return;
    await deleteDoc(doc(db, "cobros", id));
    toast.success("Cobro eliminado");
    loadData();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>COBROS EXTRAORDINARIOS</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Viajes, torneos, equipamiento y otros cobros especiales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo Cobro</button>
      </div>

      {/* Lista de cobros */}
      <div style={{ display: "grid", gap: 14 }}>
        {loading ? (
          <p style={{ color: "var(--gris-medio)" }}>Cargando...</p>
        ) : cobros.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>✈️</div>
            <p style={{ color: "var(--gris-medio)" }}>No hay cobros extraordinarios creados</p>
          </div>
        ) : cobros.map(c => {
          const aprobados = c.asignados?.filter(a => a.estado === "aprobado").length || 0;
          const total = c.asignados?.length || 0;
          const recaudado = c.asignados?.filter(a => a.estado === "aprobado").reduce((acc, a) => acc + a.monto, 0) || 0;
          const pct = total > 0 ? (aprobados / total) * 100 : 0;
          return (
            <div key={c.id} className="card" style={{ borderLeft: "3px solid #bb8fce" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <h3 style={{ fontSize: "1.2rem" }}>✈️ {c.titulo}</h3>
                    <span className="badge badge-extraordinario">{c.asignacion}</span>
                  </div>
                  {c.descripcion && <p style={{ color: "var(--gris-medio)", fontSize: "0.88rem", marginBottom: 8 }}>{c.descripcion}</p>}
                  {c.fechaLimite && (
                    <p style={{ color: "var(--amarillo)", fontSize: "0.82rem" }}>
                      ⏰ Fecha límite: {c.fechaLimite}
                    </p>
                  )}

                  {/* Progress */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "0.8rem", color: "var(--gris-medio)" }}>
                        {aprobados} / {total} socios pagaron
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--verde-claro)" }}>
                        ${recaudado.toFixed(2)} recaudados
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#2a2a2a", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--verde)", borderRadius: 3, transition: "width 0.3s" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginLeft: 20 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                    onClick={() => setDetalle(c)}
                  >
                    Ver asignados
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: "7px 14px", fontSize: "0.8rem" }}
                    onClick={() => eliminarCobro(c.id)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal detalle asignados */}
      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.5rem" }}>✈️ {detalle.titulo}</h2>
              <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Socio</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {detalle.asignados?.map((a, i) => (
                  <tr key={i}>
                    <td>{a.socioNombre}</td>
                    <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${a.monto?.toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${a.estado || "pendiente"}`}>
                        {a.estado === "aprobado" ? "✅ Pagado" : a.estado === "revision" ? "🔍 En revisión" : "⏳ Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Crear Cobro */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 580, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: "1.8rem" }}>NUEVO COBRO EXTRAORDINARIO</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Viaje al campeonato en Quito" />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} placeholder="Detalle del cobro..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto base ($)</label>
                  <input type="number" value={form.montoBase} onChange={e => setForm(f => ({ ...f, montoBase: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Fecha límite</label>
                  <input type="date" value={form.fechaLimite} onChange={e => setForm(f => ({ ...f, fechaLimite: e.target.value }))} />
                </div>
              </div>

              {/* Asignación */}
              <div>
                <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Asignar a</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["todos", "categoria", "individual"].map(op => (
                    <button
                      key={op}
                      onClick={() => setForm(f => ({ ...f, asignacion: op }))}
                      className="btn"
                      style={{
                        padding: "8px 14px", fontSize: "0.8rem",
                        background: form.asignacion === op ? "var(--verde)" : "var(--gris)",
                        color: form.asignacion === op ? "white" : "var(--gris-medio)"
                      }}
                    >
                      {op === "todos" ? "Todos" : op === "categoria" ? "Por Categoría" : "Individual"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Por categoría */}
              {form.asignacion === "categoria" && (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Seleccionar categorías</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CATEGORIAS.map(c => (
                      <button
                        key={c}
                        onClick={() => toggleCategoria(c)}
                        className="btn"
                        style={{
                          padding: "7px 14px", fontSize: "0.8rem",
                          background: form.categorias.includes(c) ? "var(--verde)" : "var(--gris)",
                          color: form.categorias.includes(c) ? "white" : "var(--gris-medio)"
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "var(--gris-medio)", fontSize: "0.8rem", marginTop: 6 }}>
                    {sociosFiltrados().length} socios seleccionados
                  </p>
                </div>
              )}

              {/* Individual con monto por socio */}
              {form.asignacion === "individual" && (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Seleccionar socios y montos individuales</label>
                  <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 6 }}>
                    {socios.filter(s => s.activo).map(s => {
                      const sel = form.sociosSeleccionados.find(ss => ss.socioId === s.id);
                      return (
                        <div key={s.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", borderBottom: "1px solid #1e1e1e",
                          background: sel ? "#0f2a1f" : "transparent"
                        }}>
                          <input
                            type="checkbox"
                            checked={!!sel}
                            onChange={() => toggleSocioSel(s.id)}
                            style={{ width: 16, height: 16, accentColor: "var(--verde)" }}
                          />
                          <div style={{ flex: 1, fontSize: "0.9rem" }}>
                            {s.nombre} {s.apellido}
                            <span style={{ color: "var(--gris-medio)", fontSize: "0.78rem", marginLeft: 6 }}>{s.categoria}</span>
                          </div>
                          {sel && (
                            <input
                              type="number"
                              value={sel.monto}
                              onChange={e => setSocioMonto(s.id, e.target.value)}
                              style={{ width: 80, padding: "4px 8px", fontSize: "0.85rem" }}
                              placeholder="$"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--gris-medio)", fontSize: "0.8rem", marginTop: 6 }}>
                    {form.sociosSeleccionados.length} socios seleccionados
                  </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setModal(false)} style={{ flex: 1, justifyContent: "center" }}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCrear} disabled={saving} style={{ flex: 1, justifyContent: "center" }}>
                  {saving ? "Creando..." : "✈️ Crear Cobro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
