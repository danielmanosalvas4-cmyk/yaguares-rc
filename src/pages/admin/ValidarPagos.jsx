// src/pages/admin/ValidarPagos.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, updateDoc, doc, query, orderBy, where } from "firebase/firestore";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { emailPagoAprobado, emailPagoRechazado } from "../../utils/emailService";
import { generarReciboPDF } from "../../utils/pdfRecibo";

const FILTROS = ["todos", "revision", "pendiente", "aprobado", "rechazado", "vencido"];

export default function ValidarPagos() {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("revision");
  const [pagoSel, setPagoSel] = useState(null);
  const [notaRechazo, setNotaRechazo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);

  useEffect(() => { loadPagos(); }, [filtro]);

  const loadPagos = async () => {
    setLoading(true);
    let q;
    if (filtro === "todos") q = query(collection(db, "pagos"), orderBy("creadoEn", "desc"));
    else q = query(collection(db, "pagos"), where("estado", "==", filtro), orderBy("creadoEn", "desc"));
    const snap = await getDocs(q);
    setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const aprobar = async (pago) => {
    setProcesando(true);
    try {
      await updateDoc(doc(db, "pagos", pago.id), {
        estado: "aprobado",
        fechaAprobacion: new Date().toISOString(),
        fechaPago: new Date().toISOString(),
        notaAdmin: ""
      });
      // Enviar email de confirmación
      await emailPagoAprobado(
        { nombre: pago.socioNombre, apellido: "", email: pago.socioEmail },
        pago.monto, pago.concepto
      );
      toast.success(`✅ Pago aprobado. Email enviado a ${pago.socioEmail}`);
      setPagoSel(null);
      loadPagos();
    } catch { toast.error("Error al aprobar"); }
    finally { setProcesando(false); }
  };

  const rechazar = async (pago) => {
    if (!notaRechazo.trim()) { toast.error("Escribí el motivo del rechazo"); return; }
    setProcesando(true);
    try {
      await updateDoc(doc(db, "pagos", pago.id), {
        estado: "rechazado",
        notaAdmin: notaRechazo,
        fechaRechazo: new Date().toISOString()
      });
      await emailPagoRechazado(
        { nombre: pago.socioNombre, apellido: "", email: pago.socioEmail },
        pago.monto, pago.concepto, notaRechazo
      );
      toast.success("Pago rechazado y email enviado al socio");
      setNotaRechazo("");
      setPagoSel(null);
      loadPagos();
    } catch { toast.error("Error al rechazar"); }
    finally { setProcesando(false); }
  };

  const handleDescargarRecibo = async (pago) => {
    setGenerandoPDF(true);
    const ok = await generarReciboPDF(pago, { nombre: pago.socioNombre, apellido: "", email: pago.socioEmail });
    if (ok) toast.success("📄 Recibo descargado");
    else toast.error("Error generando recibo");
    setGenerandoPDF(false);
  };

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try { return format(new Date(iso?.toDate?.() || iso), "d MMM yyyy, HH:mm", { locale: es }); }
    catch { return iso; }
  };

  const estadoBadge = (estado) => {
    const map = { pendiente: "badge-pendiente", revision: "badge-revision", aprobado: "badge-aprobado", rechazado: "badge-rechazado", vencido: "badge-rechazado" };
    const icons = { pendiente: "⏳", revision: "🔍", aprobado: "✅", rechazado: "❌", vencido: "🔴" };
    const labels = { pendiente: "Pendiente", revision: "En Revisión", aprobado: "Aprobado", rechazado: "Rechazado", vencido: "Vencido" };
    return <span className={`badge ${map[estado]}`}>{icons[estado]} {labels[estado]}</span>;
  };

  const pendientesRevision = pagos.filter(p => p.estado === "revision").length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontSize: "2.5rem" }}>VALIDAR PAGOS</h1>
          {pendientesRevision > 0 && (
            <span style={{ background: "var(--amarillo)", color: "var(--negro)", borderRadius: 20, padding: "2px 10px", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.9rem" }}>
              {pendientesRevision} por revisar
            </span>
          )}
        </div>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Al aprobar se envía email automático al socio</p>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)} className="btn"
            style={{ padding: "7px 14px", fontSize: "0.78rem", background: filtro === f ? "var(--verde)" : "var(--gris)", color: filtro === f ? "white" : "var(--gris-medio)" }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards">
        {loading ? <p style={{ color: "var(--gris-medio)" }}>Cargando...</p> :
          pagos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2rem" }}>🎉</div>
              <p style={{ color: "var(--gris-medio)", marginTop: 8 }}>No hay pagos en este estado</p>
            </div>
          ) : pagos.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 10, padding: 14, borderLeft: `3px solid ${p.estado === "aprobado" ? "var(--verde)" : p.estado === "revision" ? "#5dade2" : p.estado === "rechazado" ? "var(--rojo)" : "var(--amarillo)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{p.socioNombre}</div>
                <div style={{ color: "var(--dorado)", fontWeight: 700, fontFamily: "'Barlow Condensed'", fontSize: "1.1rem" }}>${p.monto?.toFixed(2)}</div>
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--gris-medio)", marginBottom: 6 }}>{p.concepto}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {estadoBadge(p.estado)}
                <button className="btn btn-secondary" style={{ padding: "5px 12px", fontSize: "0.75rem" }} onClick={() => { setPagoSel(p); setNotaRechazo(""); }}>
                  Ver detalle
                </button>
              </div>
            </div>
          ))
        }
      </div>

      {/* Desktop table */}
      <div className="card table-wrap desktop-table">
        {loading ? <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p> :
          pagos.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem" }}>🎉</div>
              <p style={{ color: "var(--gris-medio)", marginTop: 8 }}>No hay pagos en este estado</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr><th>Socio</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {pagos.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.socioNombre}</div>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.8rem" }}>{p.socioEmail}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.9rem" }}>{p.concepto}</div>
                      {p.tipo === "extraordinario" && <span className="badge badge-extraordinario">✈️ Extra</span>}
                    </td>
                    <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.1rem" }}>${p.monto?.toFixed(2)}</td>
                    <td style={{ fontSize: "0.85rem" }}>{p.metodoPago === "comprobante" ? "📎 Comprobante" : p.metodoPago === "tarjeta" ? "💳 Tarjeta" : "—"}</td>
                    <td style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>{formatFecha(p.creadoEn?.toDate?.() || p.creadoEn)}</td>
                    <td>{estadoBadge(p.estado)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary" style={{ padding: "5px 10px", fontSize: "0.75rem" }} onClick={() => { setPagoSel(p); setNotaRechazo(""); }}>Ver</button>
                        {p.estado === "aprobado" && (
                          <button className="btn btn-gold" style={{ padding: "5px 10px", fontSize: "0.75rem" }} onClick={() => handleDescargarRecibo(p)} disabled={generandoPDF}>📄</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Modal detalle */}
      {pagoSel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.6rem" }}>DETALLE DEL PAGO</h2>
              <button onClick={() => setPagoSel(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Socio", value: pagoSel.socioNombre },
                { label: "Email", value: pagoSel.socioEmail },
                { label: "Concepto", value: pagoSel.concepto },
                { label: "Monto", value: `$${pagoSel.monto?.toFixed(2)}` },
                { label: "Método", value: pagoSel.metodoPago },
                { label: "Fecha envío", value: formatFecha(pagoSel.creadoEn?.toDate?.() || pagoSel.creadoEn) },
              ].map(f => (
                <div key={f.label}>
                  <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontWeight: 500 }}>{f.value}</div>
                </div>
              ))}
            </div>

            {pagoSel.comprobanteUrl && (
              <div style={{ marginBottom: 20 }}>
                <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 8 }}>Comprobante Adjunto</div>
                <a href={pagoSel.comprobanteUrl} target="_blank" rel="noreferrer">
                  <img src={pagoSel.comprobanteUrl} alt="Comprobante" style={{ width: "100%", borderRadius: 8, border: "1px solid #333" }} onError={e => { e.target.style.display = "none"; }} />
                </a>
                <a href={pagoSel.comprobanteUrl} target="_blank" rel="noreferrer" style={{ color: "var(--verde-claro)", fontSize: "0.85rem", display: "block", marginTop: 6 }}>🔗 Abrir en nueva pestaña</a>
              </div>
            )}

            {pagoSel.notaAdmin && (
              <div style={{ background: "#3d0f0f", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                <div className="label" style={{ color: "#ec7063", marginBottom: 4 }}>Nota</div>
                <div style={{ fontSize: "0.9rem" }}>{pagoSel.notaAdmin}</div>
              </div>
            )}

            {/* Acciones */}
            {(pagoSel.estado === "revision" || pagoSel.estado === "pendiente") && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Nota de rechazo</label>
                  <textarea value={notaRechazo} onChange={e => setNotaRechazo(e.target.value)} placeholder="Motivo del rechazo..." rows={3} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-danger" style={{ flex: 1, justifyContent: "center" }} onClick={() => rechazar(pagoSel)} disabled={procesando}>❌ Rechazar</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => aprobar(pagoSel)} disabled={procesando}>✅ Aprobar y Notificar</button>
                </div>
              </div>
            )}

            {pagoSel.estado === "aprobado" && (
              <div>
                <div style={{ background: "#0f3020", borderRadius: 8, padding: 14, textAlign: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: "1.8rem" }}>✅</div>
                  <div style={{ color: "#52be80", fontFamily: "'Barlow Condensed'", fontWeight: 700, marginTop: 4 }}>PAGO APROBADO</div>
                </div>
                <button className="btn btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={() => handleDescargarRecibo(pagoSel)} disabled={generandoPDF}>
                  {generandoPDF ? "Generando..." : "📄 Descargar Recibo PDF"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
