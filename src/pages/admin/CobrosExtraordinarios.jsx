// src/pages/admin/CobrosExtraordinarios.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, serverTimestamp, doc, deleteDoc, query, where } from "firebase/firestore";
import toast from "react-hot-toast";

const CATEGORIAS = ["juvenil", "adulto", "femenino_juvenil", "femenino_adulto"];
const BANCOS_EC = ["Banco Pichincha", "Banco Guayaquil", "Produbanco", "Banco del Pacífico", "Banco Internacional", "Banco Bolivariano", "DeUna / Pichincha", "Otro"];

export default function CobrosExtraordinarios() {
  const [cobros, setCobros] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    titulo: "", descripcion: "", fechaLimite: "",
    asignacion: "todos",
    categorias: [],
    sociosSeleccionados: [],
    montoBase: "",
    // Cuenta de destino
    cuentaNombre: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente"
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cobrosSnap, sociosSnap] = await Promise.all([
      getDocs(collection(db, "cobros")),
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
      categorias: f.categorias.includes(cat) ? f.categorias.filter(c => c !== cat) : [...f.categorias, cat]
    }));
  };

  const setSocioMonto = (socioId, monto) => {
    setForm(f => {
      const existing = f.sociosSeleccionados.find(s => s.socioId === socioId);
      if (existing) return { ...f, sociosSeleccionados: f.sociosSeleccionados.map(s => s.socioId === socioId ? { ...s, monto } : s) };
      return { ...f, sociosSeleccionados: [...f.sociosSeleccionados, { socioId, monto }] };
    });
  };

  const toggleSocioSel = (socioId) => {
    setForm(f => {
      const exists = f.sociosSeleccionados.find(s => s.socioId === socioId);
      if (exists) return { ...f, sociosSeleccionados: f.sociosSeleccionados.filter(s => s.socioId !== socioId) };
      return { ...f, sociosSeleccionados: [...f.sociosSeleccionados, { socioId, monto: form.montoBase }] };
    });
  };

  const handleCrear = async () => {
    if (!form.titulo) { toast.error("El título es requerido"); return; }

    setSaving(true);
    try {
      let asignados = [];
      if (form.asignacion === "todos" || form.asignacion === "categoria") {
        asignados = sociosFiltrados().map(s => ({
          socioId: s.uid || s.id,
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
            socioId: s.uid || s.id,
            socioNombre: `${s.nombre} ${s.apellido}`,
            socioEmail: s.email,
            monto: Number(sel?.monto || form.montoBase || 0),
            estado: "pendiente"
          };
        });
      }

      const cuentaDestino = form.cuentaNombre ? {
        nombre: form.cuentaNombre,
        banco: form.cuentaBanco,
        numero: form.cuentaNumero,
        tipo: form.cuentaTipo
      } : null;

      await addDoc(collection(db, "cobros"), {
        titulo: form.titulo, descripcion: form.descripcion,
        fechaLimite: form.fechaLimite, asignacion: form.asignacion,
        categorias: form.categorias, asignados,
        montoBase: Number(form.montoBase),
        cuentaDestino,
        activo: true, creadoEn: serverTimestamp()
      });

      for (const a of asignados) {
        await addDoc(collection(db, "pagos"), {
          socioId: a.socioId, socioNombre: a.socioNombre, socioEmail: a.socioEmail,
          concepto: form.titulo, descripcion: form.descripcion,
          monto: a.monto, tipo: "extraordinario", estado: "pendiente",
          metodoPago: null, comprobanteUrl: null,
          cuentaDestino,
          creadoEn: serverTimestamp()
        });
      }

      toast.success(`✈️ Cobro creado y asignado a ${asignados.length} socios`);
      setModal(false);
      setForm({ titulo: "", descripcion: "", fechaLimite: "", asignacion: "todos", categorias: [], sociosSeleccionados: [], montoBase: "", cuentaNombre: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente" });
      loadData();
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally { setSaving(false); }
  };

  const eliminarCobro = async (id) => {
    if (!window.confirm("¿Eliminar este cobro?")) return;
    await deleteDoc(doc(db, "cobros", id));
    toast.success("Cobro eliminado");
    loadData();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>COBROS EXTRAORDINARIOS</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Viajes, torneos, equipamiento y otros cobros especiales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo Cobro</button>
      </div>

      {/* Lista cobros */}
      <div style={{ display: "grid", gap: 14 }}>
        {loading ? <p style={{ color: "var(--gris-medio)" }}>Cargando...</p> :
          cobros.length === 0 ? (
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "1.2rem" }}>✈️ {c.titulo}</h3>
                      <span className="badge badge-extraordinario">{c.asignacion}</span>
                    </div>
                    {c.descripcion && <p style={{ color: "var(--gris-medio)", fontSize: "0.88rem", marginBottom: 6 }}>{c.descripcion}</p>}
                    {c.fechaLimite && <p style={{ color: "var(--amarillo)", fontSize: "0.82rem", marginBottom: 6 }}>⏰ Fecha límite: {c.fechaLimite}</p>}

                    {/* Cuenta destino */}
                    {c.cuentaDestino && (
                      <div style={{ background: "#1a2a1a", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: "0.82rem" }}>
                        <span style={{ color: "var(--verde-claro)" }}>🏦 Cuenta: </span>
                        <span style={{ color: "var(--blanco)" }}>{c.cuentaDestino.nombre} · {c.cuentaDestino.banco} · {c.cuentaDestino.numero} ({c.cuentaDestino.tipo})</span>
                      </div>
                    )}

                    {/* Progress */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.8rem", color: "var(--gris-medio)" }}>{aprobados} / {total} pagaron</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--verde-claro)" }}>${recaudado.toFixed(2)} recaudados</span>
                      </div>
                      <div style={{ height: 6, background: "#2a2a2a", borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "var(--verde)", borderRadius: 3 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary" style={{ padding: "7px 14px", fontSize: "0.8rem" }} onClick={() => setDetalle(c)}>Ver asignados</button>
                    <button className="btn btn-danger" style={{ padding: "7px 14px", fontSize: "0.8rem" }} onClick={() => eliminarCobro(c.id)}>Eliminar</button>
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.5rem" }}>✈️ {detalle.titulo}</h2>
              <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            {detalle.cuentaDestino && (
              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 6 }}>🏦 CUENTA DE DESTINO</div>
                <div style={{ fontSize: "0.88rem" }}>
                  <div><strong>Titular:</strong> {detalle.cuentaDestino.nombre}</div>
                  <div><strong>Banco:</strong> {detalle.cuentaDestino.banco}</div>
                  <div><strong>Número:</strong> {detalle.cuentaDestino.numero}</div>
                  <div><strong>Tipo:</strong> {detalle.cuentaDestino.tipo}</div>
                </div>
              </div>
            )}
            <table>
              <thead><tr><th>Socio</th><th>Monto</th><th>Estado</th></tr></thead>
              <tbody>
                {detalle.asignados?.map((a, i) => (
                  <tr key={i}>
                    <td>{a.socioNombre}</td>
                    <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${a.monto?.toFixed(2)}</td>
                    <td>
                      <span className={`badge badge-${a.estado === "aprobado" ? "aprobado" : "pendiente"}`}>
                        {a.estado === "aprobado" ? "✅ Pagado" : "⏳ Pendiente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear cobro */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto" }}>
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

              {/* Cuenta de destino */}
              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, border: "1px solid #2a4a2a" }}>
                <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 12 }}>🏦 CUENTA DE DESTINO (opcional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nombre del titular</label>
                    <input value={form.cuentaNombre} onChange={e => setForm(f => ({ ...f, cuentaNombre: e.target.value }))} placeholder="Ej: Carlos Rodríguez" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Banco</label>
                    <select value={form.cuentaBanco} onChange={e => setForm(f => ({ ...f, cuentaBanco: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {BANCOS_EC.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Tipo de cuenta</label>
                    <select value={form.cuentaTipo} onChange={e => setForm(f => ({ ...f, cuentaTipo: e.target.value }))}>
                      <option value="corriente">Corriente</option>
                      <option value="ahorros">Ahorros</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Número de cuenta</label>
                    <input value={form.cuentaNumero} onChange={e => setForm(f => ({ ...f, cuentaNumero: e.target.value }))} placeholder="Ej: 2200123456" />
                  </div>
                </div>
              </div>

              {/* Asignación */}
              <div>
                <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Asignar a</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["todos", "categoria", "individual"].map(op => (
                    <button key={op} onClick={() => setForm(f => ({ ...f, asignacion: op }))} className="btn"
                      style={{ padding: "8px 14px", fontSize: "0.8rem", background: form.asignacion === op ? "var(--verde)" : "var(--gris)", color: form.asignacion === op ? "white" : "var(--gris-medio)" }}>
                      {op === "todos" ? "Todos" : op === "categoria" ? "Por Categoría" : "Individual"}
                    </button>
                  ))}
                </div>
              </div>

              {form.asignacion === "categoria" && (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Seleccionar categorías</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CATEGORIAS.map(c => (
                      <button key={c} onClick={() => toggleCategoria(c)} className="btn"
                        style={{ padding: "7px 14px", fontSize: "0.8rem", background: form.categorias.includes(c) ? "var(--verde)" : "var(--gris)", color: form.categorias.includes(c) ? "white" : "var(--gris-medio)" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "var(--gris-medio)", fontSize: "0.8rem", marginTop: 6 }}>{sociosFiltrados().length} socios seleccionados</p>
                </div>
              )}

              {form.asignacion === "individual" && (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Seleccionar socios y montos</label>
                  <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 6 }}>
                    {socios.filter(s => s.activo).map(s => {
                      const sel = form.sociosSeleccionados.find(ss => ss.socioId === s.id);
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #1e1e1e", background: sel ? "#0f2a1f" : "transparent" }}>
                          <input type="checkbox" checked={!!sel} onChange={() => toggleSocioSel(s.id)} style={{ width: 16, height: 16, accentColor: "var(--verde)" }} />
                          <div style={{ flex: 1, fontSize: "0.9rem" }}>{s.nombre} {s.apellido} <span style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{s.categoria}</span></div>
                          {sel && <input type="number" value={sel.monto} onChange={e => setSocioMonto(s.id, e.target.value)} style={{ width: 80, padding: "4px 8px", fontSize: "0.85rem" }} placeholder="$" />}
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ color: "var(--gris-medio)", fontSize: "0.8rem", marginTop: 6 }}>{form.sociosSeleccionados.length} socios seleccionados</p>
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
