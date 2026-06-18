// src/pages/admin/CobrosExtraordinarios.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";

const CATEGORIAS = ["juvenil", "adulto", "femenino_juvenil", "femenino_adulto"];
const BANCOS_EC = ["Banco Pichincha", "Banco Guayaquil", "Produbanco", "Banco del Pacífico", "Banco Internacional", "Banco Bolivariano", "DeUna / Pichincha", "Otro"];

export default function CobrosExtraordinarios() {
  const { user } = useAuth();
  const [cobros, setCobros] = useState([]);
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalAgregar, setModalAgregar] = useState(null); // cobro al que agregar jugadores

  const [form, setForm] = useState({
    titulo: "", descripcion: "", fechaLimite: "",
    asignacion: "todos", categorias: [], sociosSeleccionados: [], montoBase: "",
    cuentaNombre: "", cuentaCedula: "", cuentaEmail: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente"
  });

  // Para agregar jugadores a cobro existente
  const [sociosAAgregar, setSociosAAgregar] = useState([]);
  const [montoExtra, setMontoExtra] = useState("");
  const [agregando, setAgregando] = useState(false);

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
    setForm(f => ({ ...f, categorias: f.categorias.includes(cat) ? f.categorias.filter(c => c !== cat) : [...f.categorias, cat] }));
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

  const registrarAuditoria = async (accion, detalle) => {
    try {
      await addDoc(collection(db, "auditoria"), {
        accion, detalle,
        adminUid: user?.uid || "desconocido",
        adminEmail: user?.email || "desconocido",
        fecha: serverTimestamp()
      });
    } catch (err) { console.error("Error auditoria:", err); }
  };

  const handleCrear = async () => {
    if (!form.titulo) { toast.error("El título es requerido"); return; }
    setSaving(true);
    try {
      let asignados = [];
      if (form.asignacion === "todos" || form.asignacion === "categoria") {
        asignados = sociosFiltrados().map(s => ({
          socioId: s.uid || s.id, socioNombre: `${s.nombre} ${s.apellido}`,
          socioEmail: s.email, monto: Number(form.montoBase), estado: "pendiente"
        }));
      } else {
        const seleccionados = socios.filter(s => form.sociosSeleccionados.find(ss => ss.socioId === s.id));
        asignados = seleccionados.map(s => {
          const sel = form.sociosSeleccionados.find(ss => ss.socioId === s.id);
          return { socioId: s.uid || s.id, socioNombre: `${s.nombre} ${s.apellido}`, socioEmail: s.email, monto: Number(sel?.monto || form.montoBase || 0), estado: "pendiente" };
        });
      }

      const cuentaDestino = form.cuentaNombre ? {
        nombre: form.cuentaNombre || "", cedula: form.cuentaCedula || "",
        email: form.cuentaEmail || "", banco: form.cuentaBanco || "",
        numero: form.cuentaNumero || "", tipo: form.cuentaTipo || "corriente"
      } : null;

      const cobroRef = await addDoc(collection(db, "cobros"), {
        titulo: form.titulo, descripcion: form.descripcion, fechaLimite: form.fechaLimite,
        asignacion: form.asignacion, categorias: form.categorias, asignados,
        montoBase: Number(form.montoBase), cuentaDestino, activo: true, creadoEn: serverTimestamp()
      });

      for (const a of asignados) {
        await addDoc(collection(db, "pagos"), {
          socioId: a.socioId, socioNombre: a.socioNombre, socioEmail: a.socioEmail,
          concepto: form.titulo, descripcion: form.descripcion, monto: a.monto,
          tipo: "extraordinario", estado: "pendiente", metodoPago: null, comprobanteUrl: null,
          cuentaDestino, cobroId: cobroRef.id, creadoEn: serverTimestamp()
        });
      }

      await registrarAuditoria("COBRO_CREADO", `Cobro "${form.titulo}" creado y asignado a ${asignados.length} socios`);
      toast.success(`✈️ Cobro creado y asignado a ${asignados.length} socios`);
      setModal(false);
      setForm({ titulo: "", descripcion: "", fechaLimite: "", asignacion: "todos", categorias: [], sociosSeleccionados: [], montoBase: "", cuentaNombre: "", cuentaCedula: "", cuentaEmail: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente" });
      loadData();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSaving(false); }
  };

  // Agregar jugadores a cobro existente
  const handleAgregarJugadores = async () => {
    if (sociosAAgregar.length === 0) { toast.error("Selecciona al menos un jugador"); return; }
    setAgregando(true);
    try {
      const cobro = modalAgregar;
      const cuentaDestino = cobro.cuentaDestino || null;
      const nuevosAsignados = [...(cobro.asignados || [])];
      let agregados = 0;

      for (const socioId of sociosAAgregar) {
        // Verificar que no esté ya asignado
        const yaAsignado = nuevosAsignados.find(a => a.socioId === socioId);
        if (yaAsignado) continue;

        const socio = socios.find(s => s.uid === socioId || s.id === socioId);
        if (!socio) continue;

        const monto = Number(montoExtra || cobro.montoBase || 0);
        nuevosAsignados.push({ socioId, socioNombre: `${socio.nombre} ${socio.apellido}`, socioEmail: socio.email, monto, estado: "pendiente" });

        await addDoc(collection(db, "pagos"), {
          socioId, socioNombre: `${socio.nombre} ${socio.apellido}`, socioEmail: socio.email,
          concepto: cobro.titulo, descripcion: cobro.descripcion || "", monto,
          tipo: "extraordinario", estado: "pendiente", metodoPago: null, comprobanteUrl: null,
          cuentaDestino, cobroId: cobro.id, creadoEn: serverTimestamp()
        });
        agregados++;
      }

      await updateDoc(doc(db, "cobros", cobro.id), { asignados: nuevosAsignados });
      await registrarAuditoria("JUGADORES_AGREGADOS", `${agregados} jugadores agregados al cobro "${cobro.titulo}"`);
      toast.success(`✅ ${agregados} jugador${agregados > 1 ? "es" : ""} agregado${agregados > 1 ? "s" : ""} al cobro`);
      setModalAgregar(null); setSociosAAgregar([]); setMontoExtra("");
      loadData();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setAgregando(false); }
  };

  const eliminarCobro = async (id, titulo) => {
    if (!window.confirm("¿Eliminar este cobro?")) return;
    await deleteDoc(doc(db, "cobros", id));
    await registrarAuditoria("COBRO_ELIMINADO", `Cobro "${titulo}" eliminado`);
    toast.success("Cobro eliminado");
    loadData();
  };

  // Socios no asignados a un cobro
  const sociosNoAsignados = (cobro) => {
    const asignadosIds = cobro.asignados?.map(a => a.socioId) || [];
    return socios.filter(s => s.activo && !asignadosIds.includes(s.uid || s.id));
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
                    {c.cuentaDestino && (
                      <div style={{ background: "#1a2a1a", borderRadius: 6, padding: "6px 10px", marginBottom: 8, fontSize: "0.8rem" }}>
                        🏦 <span style={{ color: "var(--verde-claro)" }}>{c.cuentaDestino.nombre}</span> · {c.cuentaDestino.banco} · <strong style={{ color: "var(--dorado)" }}>{c.cuentaDestino.numero}</strong>
                      </div>
                    )}
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
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => setDetalle(c)}>Ver asignados</button>
                    <button className="btn btn-gold" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => { setModalAgregar(c); setSociosAAgregar([]); setMontoExtra(c.montoBase || ""); }}>+ Jugadores</button>
                    <button className="btn btn-danger" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => eliminarCobro(c.id, c.titulo)}>Eliminar</button>
                  </div>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Modal detalle asignados */}
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
                <div style={{ fontSize: "0.88rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><strong>Titular:</strong> {detalle.cuentaDestino.nombre}</div>
                  {detalle.cuentaDestino.cedula && <div><strong>CI/RUC:</strong> {detalle.cuentaDestino.cedula}</div>}
                  <div><strong>Banco:</strong> {detalle.cuentaDestino.banco}</div>
                  <div><strong>Tipo:</strong> {detalle.cuentaDestino.tipo}</div>
                  <div style={{ gridColumn: "span 2" }}><strong>N°:</strong> <span style={{ color: "var(--dorado)" }}>{detalle.cuentaDestino.numero}</span></div>
                  {detalle.cuentaDestino.email && <div style={{ gridColumn: "span 2" }}><strong>Email:</strong> {detalle.cuentaDestino.email}</div>}
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
                    <td><span className={`badge badge-${a.estado === "aprobado" ? "aprobado" : "pendiente"}`}>{a.estado === "aprobado" ? "✅ Pagado" : "⏳ Pendiente"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal agregar jugadores a cobro existente */}
      {modalAgregar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.5rem" }}>➕ Agregar Jugadores</h2>
              <button onClick={() => setModalAgregar(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 10, marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>✈️ {modalAgregar.titulo}</div>
              <div style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>Monto base: ${modalAgregar.montoBase}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto para estos jugadores ($)</label>
              <input type="number" value={montoExtra} onChange={e => setMontoExtra(e.target.value)} placeholder={modalAgregar.montoBase} />
            </div>

            <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 8 }}>Jugadores disponibles ({sociosNoAsignados(modalAgregar).length})</div>
            <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 8, marginBottom: 16 }}>
              {sociosNoAsignados(modalAgregar).length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--gris-medio)", fontSize: "0.88rem" }}>Todos los socios activos ya están asignados</div>
              ) : sociosNoAsignados(modalAgregar).map(s => (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                  borderBottom: "1px solid #1e1e1e",
                  background: sociosAAgregar.includes(s.uid || s.id) ? "#0f2a1f" : "transparent"
                }}>
                  <input type="checkbox" checked={sociosAAgregar.includes(s.uid || s.id)}
                    onChange={() => {
                      const id = s.uid || s.id;
                      setSociosAAgregar(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                    }}
                    style={{ width: 16, height: 16, accentColor: "var(--verde)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>{s.nombre} {s.apellido}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>{s.categoria}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalAgregar(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleAgregarJugadores} disabled={agregando || sociosAAgregar.length === 0}>
                {agregando ? "Agregando..." : `✅ Agregar ${sociosAAgregar.length > 0 ? sociosAAgregar.length : ""} Jugador${sociosAAgregar.length !== 1 ? "es" : ""}`}
              </button>
            </div>
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

              {/* Cuenta destino */}
              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, border: "1px solid #2a4a2a" }}>
                <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 12 }}>🏦 CUENTA DE DESTINO (opcional)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nombre del titular</label>
                    <input value={form.cuentaNombre} onChange={e => setForm(f => ({ ...f, cuentaNombre: e.target.value }))} placeholder="Ej: Carlos Rodríguez" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Cédula / RUC</label>
                    <input value={form.cuentaCedula || ""} onChange={e => setForm(f => ({ ...f, cuentaCedula: e.target.value }))} placeholder="0912345678" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Email del titular</label>
                    <input type="email" value={form.cuentaEmail || ""} onChange={e => setForm(f => ({ ...f, cuentaEmail: e.target.value }))} placeholder="titular@email.com" />
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
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Categorías</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {CATEGORIAS.map(c => (
                      <button key={c} onClick={() => toggleCategoria(c)} className="btn"
                        style={{ padding: "7px 14px", fontSize: "0.8rem", background: form.categorias.includes(c) ? "var(--verde)" : "var(--gris)", color: form.categorias.includes(c) ? "white" : "var(--gris-medio)" }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <p style={{ color: "var(--gris-medio)", fontSize: "0.8rem", marginTop: 6 }}>{sociosFiltrados().length} socios</p>
                </div>
              )}

              {form.asignacion === "individual" && (
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>Seleccionar socios</label>
                  <div style={{ maxHeight: 250, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 6 }}>
                    {socios.filter(s => s.activo).map(s => {
                      const sel = form.sociosSeleccionados.find(ss => ss.socioId === s.id);
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #1e1e1e", background: sel ? "#0f2a1f" : "transparent" }}>
                          <input type="checkbox" checked={!!sel} onChange={() => toggleSocioSel(s.id)} style={{ width: 16, height: 16, accentColor: "var(--verde)" }} />
                          <div style={{ flex: 1, fontSize: "0.9rem" }}>{s.nombre} {s.apellido} <span style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>{s.categoria}</span></div>
                          {sel && <input type="number" value={sel.monto} onChange={e => setSocioMonto(s.id, e.target.value)} style={{ width: 80, padding: "4px 8px", fontSize: "0.85rem" }} placeholder="$" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 12 }}>
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
