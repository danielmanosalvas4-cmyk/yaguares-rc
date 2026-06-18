// src/pages/admin/DetalleSocio.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../../config/firebase";
import {
  collection, getDocs, addDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function DetalleSocio({ socio, onVolver }) {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pagos"); // pagos | agregar | ficha
  const [ficha, setFicha] = useState(null);

  // Form pago histórico
  const [formPago, setFormPago] = useState({
    mes: new Date().getMonth(),
    anio: new Date().getFullYear(),
    monto: socio.cuotaMensual || 0,
    metodoPago: "efectivo",
    nota: "",
    tipo: "mensual"
  });
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [comprobante, setComprobante] = useState(null);
  const [previewComp, setPreviewComp] = useState(null);
  const [pagoSelComp, setPagoSelComp] = useState(null); // pago al que adjuntar comprobante
  const [modalComp, setModalComp] = useState(false);

  useEffect(() => { loadPagos(); loadFicha(); }, []);

  const loadPagos = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "pagos"),
        where("socioId", "==", socio.uid || socio.id),
        orderBy("creadoEn", "desc")
      ));
      setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const loadFicha = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, "fichas"),
        where("socioId", "==", socio.uid || socio.id)
      ));
      if (!snap.empty) setFicha({ id: snap.docs[0].id, ...snap.docs[0].data() });
    } catch (err) { console.error(err); }
  };

  const handleAgregarPago = async () => {
    if (!formPago.monto) { toast.error("Ingresa el monto"); return; }
    setGuardando(true);
    try {
      const mesNombre = `${MESES[formPago.mes]} ${formPago.anio}`;
      const concepto = formPago.tipo === "mensual" ? `Cuota mensual - ${mesNombre}` : formPago.nota || `Cobro - ${mesNombre}`;

      // Verificar duplicado solo para cuotas mensuales
      if (formPago.tipo === "mensual") {
        const existe = await getDocs(query(
          collection(db, "pagos"),
          where("socioId", "==", socio.uid || socio.id),
          where("concepto", "==", concepto)
        ));
        if (existe.size > 0) { toast.error(`Ya existe pago para ${mesNombre}`); setGuardando(false); return; }
      }

      // Subir comprobante si hay
      let comprobanteUrl = null;
      if (comprobante) {
        const storageRef = ref(storage, `comprobantes/${socio.uid || socio.id}/hist_${Date.now()}`);
        await uploadBytes(storageRef, comprobante);
        comprobanteUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "pagos"), {
        socioId: socio.uid || socio.id,
        socioNombre: `${socio.nombre} ${socio.apellido}`,
        socioEmail: socio.email,
        concepto,
        monto: Number(formPago.monto),
        tipo: formPago.tipo,
        estado: "aprobado",
        metodoPago: formPago.metodoPago,
        comprobanteUrl,
        fechaPago: new Date(`${formPago.anio}-${String(formPago.mes + 1).padStart(2, "0")}-01`).toISOString(),
        notaAdmin: formPago.nota,
        esHistorico: true,
        creadoEn: serverTimestamp(),
      });

      toast.success(`✅ Pago registrado: ${concepto}`);
      setFormPago({ mes: new Date().getMonth(), anio: new Date().getFullYear(), monto: socio.cuotaMensual || 0, metodoPago: "efectivo", nota: "", tipo: "mensual" });
      setComprobante(null); setPreviewComp(null);
      loadPagos();
      setTab("pagos");
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setGuardando(false); }
  };

  const handleAdjuntarComprobante = async () => {
    if (!comprobante || !pagoSelComp) return;
    setSubiendo(true);
    try {
      const storageRef = ref(storage, `comprobantes/${socio.uid || socio.id}/adj_${Date.now()}`);
      await uploadBytes(storageRef, comprobante);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "pagos", pagoSelComp.id), {
        comprobanteUrl: url,
        estado: pagoSelComp.estado === "pendiente" ? "revision" : pagoSelComp.estado
      });
      toast.success("✅ Comprobante adjuntado");
      setModalComp(false); setComprobante(null); setPreviewComp(null); setPagoSelComp(null);
      loadPagos();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setSubiendo(false); }
  };

  const aprobar = async (pago) => {
    await updateDoc(doc(db, "pagos", pago.id), { estado: "aprobado", fechaAprobacion: new Date().toISOString() });
    toast.success("Pago aprobado");
    loadPagos();
  };

  const rechazar = async (pago) => {
    const nota = window.prompt("Motivo del rechazo:");
    if (!nota) return;
    await updateDoc(doc(db, "pagos", pago.id), { estado: "rechazado", notaAdmin: nota });
    toast.success("Pago rechazado");
    loadPagos();
  };

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try { return format(new Date(iso), "d MMM yyyy", { locale: es }); } catch { return iso; }
  };

  const estadoBadge = (estado) => {
    const map = { pendiente: "badge-pendiente", revision: "badge-revision", aprobado: "badge-aprobado", rechazado: "badge-rechazado", vencido: "badge-rechazado" };
    const icons = { pendiente: "⏳", revision: "🔍", aprobado: "✅", rechazado: "❌", vencido: "🔴" };
    const labels = { pendiente: "Pendiente", revision: "En Revisión", aprobado: "Aprobado", rechazado: "Rechazado", vencido: "Vencido" };
    return <span className={`badge ${map[estado] || "badge-pendiente"}`}>{icons[estado]} {labels[estado] || estado}</span>;
  };

  const totalPagado = pagos.filter(p => p.estado === "aprobado").reduce((a, p) => a + (p.monto || 0), 0);
  const totalDeuda = pagos.filter(p => p.estado === "pendiente" || p.estado === "vencido").reduce((a, p) => a + (p.monto || 0), 0);

  const CATEGORIAS_LABEL = { juvenil: "Juvenil", adulto: "Adulto", femenino_juvenil: "Femenino Juvenil", femenino_adulto: "Femenino Adulto" };

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={onVolver} style={{ background: "none", border: "1px solid #333", borderRadius: 6, color: "var(--gris-medio)", cursor: "pointer", padding: "6px 12px", fontSize: "0.9rem" }}>← Volver</button>
        <h1 style={{ fontSize: "2rem" }}>{socio.nombre} {socio.apellido}</h1>
      </div>

      {/* Info del socio */}
      <div className="card" style={{ marginBottom: 20, borderLeft: "3px solid var(--verde)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ background: "#1a2a1a", color: "var(--verde-claro)", padding: "3px 10px", borderRadius: 4, fontFamily: "'Barlow Condensed'", fontWeight: 600, fontSize: "0.82rem" }}>
                {CATEGORIAS_LABEL[socio.categoria] || socio.categoria}
              </span>
              <span className={`badge ${socio.activo ? "badge-aprobado" : "badge-rechazado"}`}>{socio.activo ? "Activo" : "Inactivo"}</span>
            </div>
            <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>{socio.email}</div>
            {socio.telefono && <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>{socio.telefono}</div>}
            {socio.cedula && <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>CI: {socio.cedula}</div>}
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.8rem", color: "var(--verde-claro)", lineHeight: 1 }}>${totalPagado.toFixed(2)}</div>
              <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>Total Pagado</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.8rem", color: totalDeuda > 0 ? "var(--rojo-claro)" : "var(--verde-claro)", lineHeight: 1 }}>${totalDeuda.toFixed(2)}</div>
              <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>Deuda Actual</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.8rem", color: "var(--dorado)", lineHeight: 1 }}>${socio.cuotaMensual?.toFixed(2)}</div>
              <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>Cuota/Mes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { id: "pagos", label: "📋 Pagos", count: pagos.length },
          { id: "agregar", label: "➕ Agregar Pago", count: null },
          { id: "ficha", label: "🏉 Ficha", count: null },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className="btn"
            style={{ padding: "9px 16px", fontSize: "0.85rem", background: tab === t.id ? "var(--verde)" : "var(--gris)", color: tab === t.id ? "white" : "var(--gris-medio)" }}>
            {t.label} {t.count !== null && <span style={{ background: "rgba(255,255,255,0.2)", borderRadius: 10, padding: "1px 7px", marginLeft: 6, fontSize: "0.75rem" }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* TAB: PAGOS */}
      {tab === "pagos" && (
        <div>
          {loading ? <p style={{ color: "var(--gris-medio)" }}>Cargando pagos...</p> :
            pagos.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
                <p style={{ color: "var(--gris-medio)" }}>Sin pagos registrados</p>
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setTab("agregar")}>Agregar primer pago</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pagos.map(p => (
                  <div key={p.id} className="card" style={{
                    padding: 14,
                    borderLeft: `3px solid ${p.estado === "aprobado" ? "var(--verde)" : p.estado === "revision" ? "#5dade2" : p.estado === "rechazado" || p.estado === "vencido" ? "var(--rojo)" : "var(--amarillo)"}`
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.92rem" }}>{p.concepto}</div>
                        <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem", marginTop: 2 }}>
                          {formatFecha(p.fechaPago)} · {p.metodoPago || "—"}
                          {p.esHistorico && <span style={{ color: "#bb8fce", marginLeft: 6 }}>· Histórico</span>}
                        </div>
                        {p.notaAdmin && p.estado === "rechazado" && (
                          <div style={{ color: "var(--rojo-claro)", fontSize: "0.78rem", marginTop: 3 }}>❌ {p.notaAdmin}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.1rem" }}>${p.monto?.toFixed(2)}</div>
                          {estadoBadge(p.estado)}
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      {p.comprobanteUrl ? (
                        <a href={p.comprobanteUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.75rem" }}>
                          📎 Ver Comprobante
                        </a>
                      ) : (
                        <button className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                          onClick={() => { setPagoSelComp(p); setComprobante(null); setPreviewComp(null); setModalComp(true); }}>
                          📎 Adjuntar Comprobante
                        </button>
                      )}
                      {p.estado === "revision" && (
                        <>
                          <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "0.75rem" }} onClick={() => aprobar(p)}>✅ Aprobar</button>
                          <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: "0.75rem" }} onClick={() => rechazar(p)}>❌ Rechazar</button>
                        </>
                      )}
                      {p.estado === "pendiente" && (
                        <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: "0.75rem" }} onClick={() => aprobar(p)}>✅ Marcar Pagado</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* TAB: AGREGAR PAGO */}
      {tab === "agregar" && (
        <div className="card" style={{ borderLeft: "3px solid var(--verde)" }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: 20 }}>➕ Registrar Pago para {socio.nombre}</h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 16 }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Tipo</label>
              <select value={formPago.tipo} onChange={e => setFormPago(f => ({ ...f, tipo: e.target.value }))}>
                <option value="mensual">Cuota Mensual</option>
                <option value="extraordinario">Cobro Extraordinario</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Mes</label>
              <select value={formPago.mes} onChange={e => setFormPago(f => ({ ...f, mes: Number(e.target.value) }))}>
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Año</label>
              <select value={formPago.anio} onChange={e => setFormPago(f => ({ ...f, anio: Number(e.target.value) }))}>
                {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto ($)</label>
              <input type="number" value={formPago.monto} onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))} />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Método de pago</label>
              <select value={formPago.metodoPago} onChange={e => setFormPago(f => ({ ...f, metodoPago: e.target.value }))}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="deposito">Depósito</option>
                <option value="tarjeta">Tarjeta</option>
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nota / Concepto</label>
              <input type="text" value={formPago.nota} onChange={e => setFormPago(f => ({ ...f, nota: e.target.value }))} placeholder="Descripción..." />
            </div>
          </div>

          {/* Adjuntar comprobante al agregar */}
          <div style={{ marginBottom: 16 }}>
            <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>
              Adjuntar comprobante (opcional)
            </label>
            <label style={{
              display: "flex", alignItems: "center", gap: 10,
              border: "2px dashed #3a3a3a", borderRadius: 8, padding: "10px 14px",
              cursor: "pointer", background: previewComp ? "#0f2a1f" : "var(--gris)"
            }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setComprobante(file);
                  const reader = new FileReader();
                  reader.onload = () => setPreviewComp(reader.result);
                  reader.readAsDataURL(file);
                }} />
              {previewComp ? (
                <span style={{ color: "var(--verde-claro)", fontSize: "0.85rem" }}>✅ {comprobante?.name}</span>
              ) : (
                <span style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>📎 Seleccionar imagen o PDF</span>
              )}
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => setTab("pagos")}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleAgregarPago} disabled={guardando}>
              {guardando ? "Registrando..." : "✅ Registrar Pago"}
            </button>
          </div>
        </div>
      )}

      {/* TAB: FICHA */}
      {tab === "ficha" && (
        <div>
          {ficha ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Foto y datos personales */}
              <div className="card">
                <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
                  {ficha.foto ? (
                    <img src={ficha.foto} alt="Foto" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--verde)" }} />
                  ) : (
                    <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--gris)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>👤</div>
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{ficha.nombres} {ficha.apellidos}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>{ficha.nacionalidad} · {ficha.estatura}cm · {ficha.peso}kg</div>
                  </div>
                </div>
                <h4 style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", marginBottom: 10, letterSpacing: "0.08em" }}>DATOS PERSONALES</h4>
                {[
                  ["Fecha nac.", ficha.fechaNacimiento ? format(new Date(ficha.fechaNacimiento), "d MMM yyyy", { locale: es }) : "—"],
                  ["Alergias", ficha.alergias || "Ninguna"],
                  ["Lesiones", ficha.lesionesPrevias || "Ninguna"],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 6 }}>
                    <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>{l}</div>
                    <div style={{ fontSize: "0.88rem" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Rugby */}
              <div className="card">
                <h4 style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", marginBottom: 10, letterSpacing: "0.08em" }}>🏉 RUGBY</h4>
                {[
                  ["Posición primaria", ficha.posicionPrimaria || "—"],
                  ["Posición sec. 1", ficha.posicionSecundaria1 || "—"],
                  ["Posición sec. 2", ficha.posicionSecundaria2 || "—"],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 8 }}>
                    <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>{l}</div>
                    <div style={{ fontSize: "0.88rem" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Documentos */}
              <div className="card">
                <h4 style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", marginBottom: 10, letterSpacing: "0.08em" }}>📄 DOCUMENTOS</h4>
                {[
                  { label: "Apto Médico", key: "aptoMedico" },
                  { label: "Cédula/Pasaporte", key: "fotoCedula" },
                  { label: "Cert. WR", key: "certificadosWR" },
                  { label: "Bioimpedancia", key: "bioimpedancia" },
                ].map(d => (
                  <div key={d.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--gris-medio)" }}>{d.label}</span>
                    {ficha[d.key] ? (
                      <a href={ficha[d.key]} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: "0.72rem" }}>
                        Ver ↗
                      </a>
                    ) : (
                      <span style={{ color: "#3a3a3a", fontSize: "0.75rem" }}>Sin subir</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
              <p style={{ color: "var(--gris-medio)" }}>Este jugador aún no completó su ficha</p>
            </div>
          )}
        </div>
      )}

      {/* Modal adjuntar comprobante a pago existente */}
      {modalComp && pagoSelComp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h3 style={{ fontSize: "1.3rem" }}>📎 Adjuntar Comprobante</h3>
              <button onClick={() => setModalComp(false)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>
            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{pagoSelComp.concepto}</div>
              <div style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${pagoSelComp.monto?.toFixed(2)}</div>
            </div>
            <label style={{ display: "block", border: "2px dashed #3a3a3a", borderRadius: 8, padding: 20, textAlign: "center", cursor: "pointer", background: previewComp ? "#0f2a1f" : "var(--gris)", marginBottom: 16 }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  setComprobante(file);
                  const reader = new FileReader();
                  reader.onload = () => setPreviewComp(reader.result);
                  reader.readAsDataURL(file);
                }} />
              {previewComp ? (
                <div>
                  <img src={previewComp} alt="Preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 6, objectFit: "contain" }} onError={() => {}} />
                  <div style={{ color: "var(--verde-claro)", fontSize: "0.82rem", marginTop: 6 }}>✅ {comprobante?.name}</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: "1.8rem", marginBottom: 6 }}>📷</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>Seleccionar imagen o PDF</div>
                </div>
              )}
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }} onClick={() => setModalComp(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleAdjuntarComprobante} disabled={subiendo || !comprobante}>
                {subiendo ? "Subiendo..." : "📤 Adjuntar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
