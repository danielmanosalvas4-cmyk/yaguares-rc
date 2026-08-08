// src/pages/admin/CobrosAbonos.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../../config/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const BANCOS_EC = ["Banco Pichincha", "Banco Guayaquil", "Produbanco", "Banco del Pacífico", "Banco Internacional", "Banco Bolivariano", "DeUna / Pichincha", "Otro"];

export default function CobrosAbonos() {
  const { user } = useAuth();
  const [cobros, setCobros] = useState([]);
  const [socios, setSocios] = useState([]);
  const [abonos, setAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalAbono, setModalAbono] = useState(null); // { cobro, participante }
  const [modalAgregar, setModalAgregar] = useState(null);
  const [sociosAAgregar, setSociosAAgregar] = useState([]);

  const [form, setForm] = useState({
    titulo: "", descripcion: "", fechaLimite: "", fechaEvento: "",
    montoTotal: "", sociosSeleccionados: [],
    cuentaNombre: "", cuentaCedula: "", cuentaEmail: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente"
  });

  const [formAbono, setFormAbono] = useState({ monto: "", metodoPago: "transferencia", nota: "" });
  const [archivoAbono, setArchivoAbono] = useState(null);
  const [subiendoAbono, setSubiendoAbono] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);

    // Cada coleccion se carga por separado para que si una falla
    // (por ejemplo por reglas de Firestore) no tumbe a las demas
    try {
      const snap = await getDocs(collection(db, "socios"));
      setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error cargando socios:", err);
      toast.error("No se pudieron cargar los socios: " + err.message);
    }

    try {
      const snap = await getDocs(collection(db, "cobrosAbonos"));
      setCobros(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0)));
    } catch (err) {
      console.error("Error cargando cobros:", err);
      setCobros([]);
    }

    try {
      const snap = await getDocs(collection(db, "abonos"));
      setAbonos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error cargando abonos:", err);
      setAbonos([]);
    }

    setLoading(false);
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

  const toggleSocio = (socioId) => {
    setForm(f => ({
      ...f,
      sociosSeleccionados: f.sociosSeleccionados.includes(socioId)
        ? f.sociosSeleccionados.filter(id => id !== socioId)
        : [...f.sociosSeleccionados, socioId]
    }));
  };

  const handleCrear = async () => {
    if (!form.titulo || !form.montoTotal) { toast.error("Título y monto son requeridos"); return; }
    if (form.sociosSeleccionados.length === 0) { toast.error("Selecciona al menos un jugador"); return; }

    setSaving(true);
    try {
      const participantes = form.sociosSeleccionados.map(sid => {
        const s = socios.find(x => (x.uid || x.id) === sid);
        return {
          socioId: sid,
          socioNombre: s ? `${s.nombre} ${s.apellido}` : "",
          socioEmail: s?.email || "",
          montoTotal: Number(form.montoTotal),
          abonado: 0,
          estado: "pendiente"
        };
      });

      const cuentaDestino = form.cuentaNombre ? {
        nombre: form.cuentaNombre || "", cedula: form.cuentaCedula || "",
        email: form.cuentaEmail || "", banco: form.cuentaBanco || "",
        numero: form.cuentaNumero || "", tipo: form.cuentaTipo || "corriente"
      } : null;

      await addDoc(collection(db, "cobrosAbonos"), {
        titulo: form.titulo, descripcion: form.descripcion,
        fechaLimite: form.fechaLimite, fechaEvento: form.fechaEvento,
        montoTotal: Number(form.montoTotal),
        participantes, cuentaDestino,
        permiteAbonos: true, activo: true,
        creadoEn: serverTimestamp()
      });

      await registrarAuditoria("COBRO_ABONOS_CREADO", `Cobro con abonos "${form.titulo}" — $${form.montoTotal} para ${participantes.length} jugadores`);
      toast.success(`✅ Cobro creado para ${participantes.length} jugadores`);
      setModal(false);
      setForm({ titulo: "", descripcion: "", fechaLimite: "", fechaEvento: "", montoTotal: "", sociosSeleccionados: [], cuentaNombre: "", cuentaCedula: "", cuentaEmail: "", cuentaBanco: "", cuentaNumero: "", cuentaTipo: "corriente" });
      loadData();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSaving(false); }
  };

  const handleRegistrarAbono = async () => {
    if (!formAbono.monto) { toast.error("Ingresa el monto del abono"); return; }
    setSubiendoAbono(true);
    try {
      const { cobro, participante } = modalAbono;
      let comprobanteUrl = null;

      if (archivoAbono) {
        const storageRef = ref(storage, `abonos/${participante.socioId}/${Date.now()}`);
        await uploadBytes(storageRef, archivoAbono);
        comprobanteUrl = await getDownloadURL(storageRef);
      }

      // Registrar abono
      await addDoc(collection(db, "abonos"), {
        cobroId: cobro.id,
        cobroTitulo: cobro.titulo,
        socioId: participante.socioId,
        socioNombre: participante.socioNombre,
        monto: Number(formAbono.monto),
        metodoPago: formAbono.metodoPago,
        nota: formAbono.nota,
        comprobanteUrl,
        estado: "aprobado",
        registradoPor: user?.email || "admin",
        fecha: new Date().toISOString(),
        creadoEn: serverTimestamp()
      });

      // Actualizar el participante en el cobro
      const nuevoAbonado = (participante.abonado || 0) + Number(formAbono.monto);
      const nuevoEstado = nuevoAbonado >= participante.montoTotal ? "completo" : "parcial";
      const nuevosParticipantes = cobro.participantes.map(p =>
        p.socioId === participante.socioId ? { ...p, abonado: nuevoAbonado, estado: nuevoEstado } : p
      );
      await updateDoc(doc(db, "cobrosAbonos", cobro.id), { participantes: nuevosParticipantes });

      await registrarAuditoria("ABONO_REGISTRADO", `Abono de $${formAbono.monto} de ${participante.socioNombre} para "${cobro.titulo}"`);
      toast.success(`✅ Abono de $${formAbono.monto} registrado`);
      setModalAbono(null);
      setFormAbono({ monto: "", metodoPago: "transferencia", nota: "" });
      setArchivoAbono(null);
      loadData();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSubiendoAbono(false); }
  };

  const handleAgregarJugadores = async () => {
    if (sociosAAgregar.length === 0) { toast.error("Selecciona jugadores"); return; }
    try {
      const cobro = modalAgregar;
      const nuevos = sociosAAgregar.map(sid => {
        const s = socios.find(x => (x.uid || x.id) === sid);
        return {
          socioId: sid, socioNombre: s ? `${s.nombre} ${s.apellido}` : "",
          socioEmail: s?.email || "", montoTotal: cobro.montoTotal,
          abonado: 0, estado: "pendiente"
        };
      });
      await updateDoc(doc(db, "cobrosAbonos", cobro.id), {
        participantes: [...(cobro.participantes || []), ...nuevos]
      });
      await registrarAuditoria("JUGADORES_AGREGADOS_ABONOS", `${nuevos.length} jugadores agregados a "${cobro.titulo}"`);
      toast.success(`✅ ${nuevos.length} jugadores agregados`);
      setModalAgregar(null); setSociosAAgregar([]);
      loadData();
    } catch (err) { toast.error("Error: " + err.message); }
  };

  const eliminarCobro = async (id, titulo) => {
    if (!window.confirm("¿Eliminar este cobro y todos sus abonos?")) return;
    await deleteDoc(doc(db, "cobrosAbonos", id));
    await registrarAuditoria("COBRO_ABONOS_ELIMINADO", `Cobro "${titulo}" eliminado`);
    toast.success("Cobro eliminado");
    loadData();
  };

  const abonosDelParticipante = (cobroId, socioId) =>
    abonos.filter(a => a.cobroId === cobroId && a.socioId === socioId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const sociosDisponibles = socios.filter(s => s.activo !== false);

  const sociosNoAsignados = (cobro) => {
    const ids = cobro.participantes?.map(p => p.socioId) || [];
    return socios.filter(s => s.activo !== false && !ids.includes(s.uid || s.id));
  };

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try { return format(new Date(iso), "d MMM yyyy", { locale: es }); } catch { return iso; }
  };

  const diasRestantes = (fecha) => {
    if (!fecha) return null;
    const dias = Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));
    return dias;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>COBROS CON ABONOS</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Viajes y eventos que se pagan en cuotas parciales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nuevo Cobro</button>
      </div>

      {/* Lista */}
      <div style={{ display: "grid", gap: 16 }}>
        {loading ? <p style={{ color: "var(--gris-medio)" }}>Cargando...</p> :
          cobros.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🌎</div>
              <p style={{ color: "var(--gris-medio)" }}>No hay cobros con abonos creados</p>
            </div>
          ) : cobros.map(c => {
            const totalEsperado = (c.participantes?.length || 0) * (c.montoTotal || 0);
            const totalAbonado = c.participantes?.reduce((a, p) => a + (p.abonado || 0), 0) || 0;
            const pct = totalEsperado > 0 ? (totalAbonado / totalEsperado) * 100 : 0;
            const completos = c.participantes?.filter(p => p.estado === "completo").length || 0;
            const dias = diasRestantes(c.fechaLimite);

            return (
              <div key={c.id} className="card" style={{ borderLeft: "3px solid #bb8fce" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: "1.3rem", marginBottom: 4 }}>🌎 {c.titulo}</h3>
                    {c.descripcion && <p style={{ color: "var(--gris-medio)", fontSize: "0.85rem", marginBottom: 6 }}>{c.descripcion}</p>}
                    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.82rem" }}>
                      <span style={{ color: "var(--dorado)" }}>💰 ${c.montoTotal} por jugador</span>
                      <span style={{ color: "var(--gris-medio)" }}>👥 {c.participantes?.length || 0} jugadores</span>
                      {c.fechaLimite && (
                        <span style={{ color: dias < 0 ? "var(--rojo-claro)" : dias < 15 ? "var(--amarillo)" : "var(--gris-medio)" }}>
                          ⏰ Límite: {formatFecha(c.fechaLimite)} {dias !== null && (dias < 0 ? `(vencido)` : `(${dias} días)`)}
                        </span>
                      )}
                      {c.fechaEvento && <span style={{ color: "#5dade2" }}>✈️ Evento: {formatFecha(c.fechaEvento)}</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => setDetalle(c)}>Ver detalle</button>
                    <button className="btn btn-gold" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => { setModalAgregar(c); setSociosAAgregar([]); }}>+ Jugadores</button>
                    <button className="btn btn-danger" style={{ padding: "7px 12px", fontSize: "0.78rem" }} onClick={() => eliminarCobro(c.id, c.titulo)}>Eliminar</button>
                  </div>
                </div>

                {/* Progreso global */}
                <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--gris-medio)" }}>
                      {completos} / {c.participantes?.length || 0} jugadores completaron
                    </span>
                    <span style={{ fontSize: "0.9rem" }}>
                      <span style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${totalAbonado.toFixed(2)}</span>
                      <span style={{ color: "var(--gris-medio)" }}> / ${totalEsperado.toFixed(2)}</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#2a2a2a", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "var(--verde-claro)" : "var(--verde)", borderRadius: 4, transition: "width 0.4s" }} />
                  </div>
                  <div style={{ textAlign: "right", marginTop: 4, fontSize: "0.78rem", color: "var(--gris-medio)" }}>{pct.toFixed(0)}% recaudado</div>
                </div>
              </div>
            );
          })
        }
      </div>

      {/* Modal detalle con participantes */}
      {detalle && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.5rem" }}>🌎 {detalle.titulo}</h2>
              <button onClick={() => setDetalle(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            {detalle.cuentaDestino && (
              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: "0.85rem" }}>
                <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 6 }}>🏦 CUENTA DE DESTINO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div><strong>Titular:</strong> {detalle.cuentaDestino.nombre}</div>
                  {detalle.cuentaDestino.cedula && <div><strong>CI/RUC:</strong> {detalle.cuentaDestino.cedula}</div>}
                  <div><strong>Banco:</strong> {detalle.cuentaDestino.banco}</div>
                  <div><strong>N°:</strong> <span style={{ color: "var(--dorado)" }}>{detalle.cuentaDestino.numero}</span></div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {detalle.participantes?.map((p, i) => {
                const pct = p.montoTotal > 0 ? ((p.abonado || 0) / p.montoTotal) * 100 : 0;
                const saldo = p.montoTotal - (p.abonado || 0);
                const misAbonos = abonosDelParticipante(detalle.id, p.socioId);
                return (
                  <div key={i} className="card" style={{
                    padding: 12,
                    borderLeft: `3px solid ${p.estado === "completo" ? "var(--verde)" : p.abonado > 0 ? "var(--amarillo)" : "var(--gris-medio)"}`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{p.socioNombre}</div>
                        <div style={{ fontSize: "0.78rem", color: "var(--gris-medio)" }}>
                          {misAbonos.length} abono{misAbonos.length !== 1 ? "s" : ""} registrado{misAbonos.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>
                            <span style={{ color: "var(--verde-claro)" }}>${(p.abonado || 0).toFixed(2)}</span>
                            <span style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}> / ${p.montoTotal}</span>
                          </div>
                          {saldo > 0 ? (
                            <div style={{ color: "var(--rojo-claro)", fontSize: "0.78rem" }}>Falta ${saldo.toFixed(2)}</div>
                          ) : (
                            <span className="badge badge-aprobado" style={{ fontSize: "0.7rem" }}>✅ Completo</span>
                          )}
                        </div>
                        {saldo > 0 && (
                          <button className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                            onClick={() => { setModalAbono({ cobro: detalle, participante: p }); setFormAbono({ monto: "", metodoPago: "transferencia", nota: "" }); setArchivoAbono(null); }}>
                            + Abono
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ height: 5, background: "#2a2a2a", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "var(--verde-claro)" : "var(--amarillo)", borderRadius: 3 }} />
                    </div>

                    {/* Historial de abonos */}
                    {misAbonos.length > 0 && (
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #222" }}>
                        {misAbonos.map(a => (
                          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "3px 0", color: "var(--gris-medio)" }}>
                            <span>{formatFecha(a.fecha)} · {a.metodoPago}</span>
                            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ color: "var(--verde-claro)" }}>${a.monto.toFixed(2)}</span>
                              {a.comprobanteUrl && <a href={a.comprobanteUrl} target="_blank" rel="noreferrer" style={{ color: "#5dade2" }}>📎</a>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal registrar abono */}
      {modalAbono && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.3rem" }}>💵 Registrar Abono</h3>
              <button onClick={() => setModalAbono(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{modalAbono.participante.socioNombre}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--gris-medio)" }}>{modalAbono.cobro.titulo}</div>
              <div style={{ marginTop: 6, fontSize: "0.88rem" }}>
                Abonado: <span style={{ color: "var(--verde-claro)" }}>${(modalAbono.participante.abonado || 0).toFixed(2)}</span>
                {" · "}
                Falta: <span style={{ color: "var(--rojo-claro)" }}>${(modalAbono.participante.montoTotal - (modalAbono.participante.abonado || 0)).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto del abono ($)</label>
                <input type="number" value={formAbono.monto} onChange={e => setFormAbono(f => ({ ...f, monto: e.target.value }))} placeholder="100" />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Método</label>
                <select value={formAbono.metodoPago} onChange={e => setFormAbono(f => ({ ...f, metodoPago: e.target.value }))}>
                  <option value="transferencia">Transferencia</option>
                  <option value="deposito">Depósito</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="deuna">DeUna</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nota (opcional)</label>
              <input value={formAbono.nota} onChange={e => setFormAbono(f => ({ ...f, nota: e.target.value }))} placeholder="Observación..." />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Comprobante (opcional)</label>
              <label style={{ display: "block", border: "2px dashed #3a3a3a", borderRadius: 8, padding: "10px 14px", cursor: "pointer", background: archivoAbono ? "#0f2a1f" : "var(--gris)", textAlign: "center" }}>
                <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => setArchivoAbono(e.target.files[0])} />
                <span style={{ color: archivoAbono ? "var(--verde-claro)" : "var(--gris-medio)", fontSize: "0.85rem" }}>
                  {archivoAbono ? `✅ ${archivoAbono.name}` : "📎 Adjuntar comprobante"}
                </span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalAbono(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleRegistrarAbono} disabled={subiendoAbono || !formAbono.monto}>
                {subiendoAbono ? "Registrando..." : "✅ Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar jugadores */}
      {modalAgregar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: "1.3rem" }}>➕ Agregar Jugadores</h3>
              <button onClick={() => setModalAgregar(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 10, marginBottom: 14 }}>
              <div style={{ fontWeight: 600 }}>{modalAgregar.titulo}</div>
              <div style={{ color: "var(--dorado)", fontSize: "0.85rem" }}>${modalAgregar.montoTotal} por jugador</div>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 8, marginBottom: 16 }}>
              {sociosNoAsignados(modalAgregar).length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "var(--gris-medio)", fontSize: "0.88rem" }}>Todos los socios ya están asignados</div>
              ) : sociosNoAsignados(modalAgregar).map(s => {
                const sid = s.uid || s.id;
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #1e1e1e", background: sociosAAgregar.includes(sid) ? "#0f2a1f" : "transparent" }}>
                    <input type="checkbox" checked={sociosAAgregar.includes(sid)}
                      onChange={() => setSociosAAgregar(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid])}
                      style={{ width: 16, height: 16, accentColor: "var(--verde)" }} />
                    <div style={{ flex: 1, fontSize: "0.9rem" }}>{s.nombre} {s.apellido}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalAgregar(null)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleAgregarJugadores} disabled={sociosAAgregar.length === 0}>
                Agregar {sociosAAgregar.length || ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear cobro */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.7rem" }}>NUEVO COBRO CON ABONOS</h2>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Título *</label>
                <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Viaje a Colombia" />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Descripción</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} placeholder="Torneo internacional..." />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto por jugador ($) *</label>
                  <input type="number" value={form.montoTotal} onChange={e => setForm(f => ({ ...f, montoTotal: e.target.value }))} placeholder="300" />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Fecha límite de pago</label>
                  <input type="date" value={form.fechaLimite} onChange={e => setForm(f => ({ ...f, fechaLimite: e.target.value }))} />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Fecha del evento</label>
                  <input type="date" value={form.fechaEvento} onChange={e => setForm(f => ({ ...f, fechaEvento: e.target.value }))} />
                </div>
              </div>

              {/* Cuenta */}
              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, border: "1px solid #2a4a2a" }}>
                <div className="label" style={{ color: "var(--verde-claro)", marginBottom: 12 }}>🏦 CUENTA DE DESTINO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Titular</label>
                    <input value={form.cuentaNombre} onChange={e => setForm(f => ({ ...f, cuentaNombre: e.target.value }))} placeholder="Nombre del directivo" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Cédula / RUC</label>
                    <input value={form.cuentaCedula} onChange={e => setForm(f => ({ ...f, cuentaCedula: e.target.value }))} placeholder="0912345678" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Email</label>
                    <input type="email" value={form.cuentaEmail} onChange={e => setForm(f => ({ ...f, cuentaEmail: e.target.value }))} placeholder="email@ejemplo.com" />
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Banco</label>
                    <select value={form.cuentaBanco} onChange={e => setForm(f => ({ ...f, cuentaBanco: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {BANCOS_EC.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Tipo</label>
                    <select value={form.cuentaTipo} onChange={e => setForm(f => ({ ...f, cuentaTipo: e.target.value }))}>
                      <option value="corriente">Corriente</option>
                      <option value="ahorros">Ahorros</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Número de cuenta</label>
                    <input value={form.cuentaNumero} onChange={e => setForm(f => ({ ...f, cuentaNumero: e.target.value }))} placeholder="2200123456" />
                  </div>
                </div>
              </div>

              {/* Seleccionar jugadores */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="label" style={{ color: "var(--gris-medio)" }}>Seleccionar jugadores *</label>
                  <span style={{ color: "var(--verde-claro)", fontSize: "0.82rem", fontWeight: 700 }}>{form.sociosSeleccionados.length} seleccionados</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: "0.75rem" }}
                    onClick={() => setForm(f => ({ ...f, sociosSeleccionados: sociosDisponibles.map(s => s.uid || s.id) }))}>
                    Seleccionar todos
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: "0.75rem" }}
                    onClick={() => setForm(f => ({ ...f, sociosSeleccionados: [] }))}>
                    Limpiar
                  </button>
                </div>
                <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #2a2a2a", borderRadius: 8 }}>
                  {sociosDisponibles.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--gris-medio)", fontSize: "0.85rem" }}>
                      No se cargaron socios. Revisa las reglas de Firestore o crea socios en la sección Socios.
                    </div>
                  ) : sociosDisponibles.map(s => {
                    const sid = s.uid || s.id;
                    const sel = form.sociosSeleccionados.includes(sid);
                    return (
                      <label key={s.id} style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                        borderBottom: "1px solid #1e1e1e", cursor: "pointer",
                        background: sel ? "#0f2a1f" : "transparent"
                      }}>
                        <input type="checkbox" checked={sel} onChange={() => toggleSocio(sid)}
                          style={{ width: 18, height: 18, accentColor: "var(--verde)", cursor: "pointer", flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: "0.9rem" }}>
                          {s.nombre} {s.apellido}
                          <span style={{ color: "var(--gris-medio)", fontSize: "0.75rem", marginLeft: 8 }}>{s.categoria}</span>
                          {s.activo === false && <span style={{ color: "var(--rojo-claro)", fontSize: "0.7rem", marginLeft: 6 }}>(inactivo)</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                {form.montoTotal && form.sociosSeleccionados.length > 0 && (
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "#2a2000", borderRadius: 6, fontSize: "0.85rem" }}>
                    Total esperado: <strong style={{ color: "var(--dorado)" }}>${(Number(form.montoTotal) * form.sociosSeleccionados.length).toFixed(2)}</strong>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModal(false)}>Cancelar</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleCrear} disabled={saving}>
                  {saving ? "Creando..." : "🌎 Crear Cobro"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}