// src/pages/player/MisAbonos.jsx
import React, { useEffect, useState } from "react";
import { db, storage } from "../../config/firebase";
import { collection, getDocs, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function MisAbonos() {
  const { user, socioData } = useAuth();
  const [cobros, setCobros] = useState([]);
  const [misAbonos, setMisAbonos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { cobro, participante }
  const [form, setForm] = useState({ monto: "", metodoPago: "transferencia", nota: "" });
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "cobrosAbonos"));
      const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Solo los cobros donde este jugador participa
      setCobros(todos.filter(c => c.participantes?.some(p => p.socioId === user.uid)));
    } catch (err) { console.error("Error cargando cobros:", err); }

    try {
      const snap = await getDocs(query(collection(db, "abonos"), where("socioId", "==", user.uid)));
      setMisAbonos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error("Error cargando abonos:", err); }

    setLoading(false);
  };

  const handleArchivo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleEnviarAbono = async () => {
    if (!form.monto || Number(form.monto) <= 0) { toast.error("Ingresa el monto del abono"); return; }
    if (!archivo) { toast.error("Adjunta el comprobante del depósito"); return; }

    setEnviando(true);
    try {
      const { cobro, participante } = modal;
      const storageRef = ref(storage, `abonos/${user.uid}/${Date.now()}`);
      await uploadBytes(storageRef, archivo);
      const comprobanteUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "abonos"), {
        cobroId: cobro.id,
        cobroTitulo: cobro.titulo,
        socioId: user.uid,
        socioNombre: `${socioData?.nombre || ""} ${socioData?.apellido || ""}`.trim(),
        socioEmail: socioData?.email || user.email,
        monto: Number(form.monto),
        metodoPago: form.metodoPago,
        nota: form.nota,
        comprobanteUrl,
        estado: "revision",
        origen: "jugador",
        fecha: new Date().toISOString(),
        creadoEn: serverTimestamp()
      });

      toast.success("✅ Abono enviado. El administrador lo validará pronto.");
      setModal(null);
      setForm({ monto: "", metodoPago: "transferencia", nota: "" });
      setArchivo(null); setPreview(null);
      loadData();
    } catch (err) {
      toast.error("Error al enviar: " + err.message);
    } finally { setEnviando(false); }
  };

  const abonosDeCobro = (cobroId) =>
    misAbonos.filter(a => a.cobroId === cobroId).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const aprobadoDeCobro = (cobroId) =>
    misAbonos.filter(a => a.cobroId === cobroId && a.estado === "aprobado")
      .reduce((s, a) => s + (a.monto || 0), 0);

  const enRevisionDeCobro = (cobroId) =>
    misAbonos.filter(a => a.cobroId === cobroId && a.estado === "revision")
      .reduce((s, a) => s + (a.monto || 0), 0);

  const formatFecha = (iso) => {
    if (!iso) return "—";
    try { return format(new Date(iso), "d MMM yyyy", { locale: es }); } catch { return iso; }
  };

  const diasRestantes = (fecha) => {
    if (!fecha) return null;
    return Math.ceil((new Date(fecha) - new Date()) / (1000 * 60 * 60 * 24));
  };

  const estadoAbono = (estado) => {
    if (estado === "aprobado") return <span className="badge badge-aprobado" style={{ fontSize: "0.68rem" }}>✅ Aprobado</span>;
    if (estado === "rechazado") return <span className="badge badge-rechazado" style={{ fontSize: "0.68rem" }}>❌ Rechazado</span>;
    return <span className="badge badge-revision" style={{ fontSize: "0.68rem" }}>🔍 En revisión</span>;
  };

  if (loading) return <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p>;
  if (cobros.length === 0) return null; // no mostrar la seccion si no participa en ningun viaje

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: "1.4rem", marginBottom: 12 }}>🌎 MIS VIAJES Y EVENTOS</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {cobros.map(c => {
          const participante = c.participantes.find(p => p.socioId === user.uid);
          const total = participante?.montoTotal || c.montoTotal || 0;
          const aprobado = aprobadoDeCobro(c.id);
          const enRevision = enRevisionDeCobro(c.id);
          const saldo = total - aprobado;
          const pct = total > 0 ? (aprobado / total) * 100 : 0;
          const dias = diasRestantes(c.fechaLimite);
          const historial = abonosDeCobro(c.id);
          const completo = saldo <= 0;

          return (
            <div key={c.id} className="card" style={{
              borderLeft: `3px solid ${completo ? "var(--verde)" : dias !== null && dias < 0 ? "var(--rojo)" : "#bb8fce"}`,
              padding: 16
            }}>
              {/* Encabezado */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{c.titulo}</div>
                  {c.descripcion && <div style={{ color: "var(--gris-medio)", fontSize: "0.82rem", marginTop: 2 }}>{c.descripcion}</div>}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: "0.78rem" }}>
                    {c.fechaLimite && (
                      <span style={{ color: dias < 0 ? "var(--rojo-claro)" : dias < 15 ? "var(--amarillo)" : "var(--gris-medio)" }}>
                        ⏰ Pagar hasta {formatFecha(c.fechaLimite)}
                        {dias !== null && (dias < 0 ? " (vencido)" : ` · faltan ${dias} días`)}
                      </span>
                    )}
                    {c.fechaEvento && <span style={{ color: "#5dade2" }}>✈️ {formatFecha(c.fechaEvento)}</span>}
                  </div>
                </div>
                {completo ? (
                  <span className="badge badge-aprobado">✅ Completo</span>
                ) : (
                  <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                    onClick={() => { setModal({ cobro: c, participante }); setForm({ monto: "", metodoPago: "transferencia", nota: "" }); setArchivo(null); setPreview(null); }}>
                    💵 Abonar
                  </button>
                )}
              </div>

              {/* Progreso */}
              <div style={{ background: "#1a1a1a", borderRadius: 8, padding: 12, marginBottom: historial.length ? 12 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontSize: "0.85rem" }}>
                    <span style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.1rem" }}>${aprobado.toFixed(2)}</span>
                    <span style={{ color: "var(--gris-medio)" }}> de ${total.toFixed(2)}</span>
                  </span>
                  {saldo > 0 && <span style={{ color: "var(--rojo-claro)", fontSize: "0.85rem" }}>Falta ${saldo.toFixed(2)}</span>}
                </div>
                <div style={{ height: 8, background: "#2a2a2a", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? "var(--verde-claro)" : "var(--verde)", borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                {enRevision > 0 && (
                  <div style={{ color: "#5dade2", fontSize: "0.78rem", marginTop: 6 }}>
                    🔍 ${enRevision.toFixed(2)} en revisión (no suma hasta ser aprobado)
                  </div>
                )}
              </div>

              {/* Cuenta de destino */}
              {c.cuentaDestino?.nombre && !completo && (
                <div style={{ background: "#0f2a1f", border: "1px solid #1a4a2a", borderRadius: 8, padding: 12, marginBottom: historial.length ? 12 : 0 }}>
                  <div style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.08em", marginBottom: 6 }}>
                    🏦 DEPOSITAR A ESTA CUENTA
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: "0.82rem" }}>
                    <div><span style={{ color: "var(--gris-medio)" }}>Titular: </span>{c.cuentaDestino.nombre}</div>
                    {c.cuentaDestino.cedula && <div><span style={{ color: "var(--gris-medio)" }}>CI/RUC: </span>{c.cuentaDestino.cedula}</div>}
                    <div><span style={{ color: "var(--gris-medio)" }}>Banco: </span>{c.cuentaDestino.banco}</div>
                    <div><span style={{ color: "var(--gris-medio)" }}>Tipo: </span>{c.cuentaDestino.tipo}</div>
                    <div style={{ gridColumn: "span 2" }}>
                      <span style={{ color: "var(--gris-medio)" }}>N° Cuenta: </span>
                      <strong style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontSize: "1rem" }}>{c.cuentaDestino.numero}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de mis abonos */}
              {historial.length > 0 && (
                <div>
                  <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 6 }}>MIS ABONOS ({historial.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {historial.map(a => (
                      <div key={a.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "7px 10px", borderRadius: 6, background: "#161616", fontSize: "0.8rem", gap: 8, flexWrap: "wrap"
                      }}>
                        <div>
                          <span style={{ color: "var(--gris-medio)" }}>{formatFecha(a.fecha)} · {a.metodoPago}</span>
                          {a.estado === "rechazado" && a.notaAdmin && (
                            <div style={{ color: "var(--rojo-claro)", fontSize: "0.75rem" }}>❌ {a.notaAdmin}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${a.monto?.toFixed(2)}</span>
                          {estadoAbono(a.estado)}
                          {a.comprobanteUrl && <a href={a.comprobanteUrl} target="_blank" rel="noreferrer" style={{ color: "#5dade2" }}>📎</a>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal para abonar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1100 }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20 }}>
            <div style={{ width: 40, height: 4, background: "#333", borderRadius: 2, margin: "0 auto 18px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.4rem" }}>💵 REGISTRAR ABONO</h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            {/* Resumen */}
            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{modal.cobro.titulo}</div>
              <div style={{ marginTop: 6, fontSize: "0.88rem" }}>
                Abonado: <span style={{ color: "var(--verde-claro)" }}>${aprobadoDeCobro(modal.cobro.id).toFixed(2)}</span>
                {" · "}
                Falta: <span style={{ color: "var(--rojo-claro)" }}>
                  ${((modal.participante?.montoTotal || modal.cobro.montoTotal) - aprobadoDeCobro(modal.cobro.id)).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Cuenta */}
            {modal.cobro.cuentaDestino?.nombre && (
              <div style={{ background: "#0f2a1f", border: "1px solid #1a4a2a", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: "0.82rem" }}>
                <div style={{ color: "var(--verde-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.75rem", marginBottom: 6 }}>
                  🏦 DEPOSITAR A:
                </div>
                <div>{modal.cobro.cuentaDestino.nombre} · {modal.cobro.cuentaDestino.banco}</div>
                <div style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1rem" }}>
                  {modal.cobro.cuentaDestino.numero}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto abonado ($) *</label>
                <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} placeholder="100" />
              </div>
              <div>
                <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Método</label>
                <select value={form.metodoPago} onChange={e => setForm(f => ({ ...f, metodoPago: e.target.value }))}>
                  <option value="transferencia">Transferencia</option>
                  <option value="deposito">Depósito</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="deuna">DeUna</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nota (opcional)</label>
              <input value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder="Ej: primer abono" />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="label" style={{ display: "block", marginBottom: 6, color: "var(--gris-medio)" }}>Comprobante *</label>
              <label style={{ display: "block", border: "2px dashed #3a3a3a", borderRadius: 8, padding: 20, textAlign: "center", cursor: "pointer", background: preview ? "#0f2a1f" : "var(--gris)" }}>
                <input type="file" accept="image/*" onChange={handleArchivo} style={{ display: "none" }} />
                {preview ? (
                  <img src={preview} alt="Comprobante" style={{ maxWidth: "100%", maxHeight: 170, borderRadius: 6, objectFit: "contain" }} />
                ) : (
                  <div>
                    <div style={{ fontSize: "2rem", marginBottom: 6 }}>📷</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>Toca para adjuntar el comprobante</div>
                  </div>
                )}
              </label>
              {archivo && <p style={{ color: "var(--verde-claro)", fontSize: "0.8rem", marginTop: 6 }}>✓ {archivo.name}</p>}
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "13px" }}
              onClick={handleEnviarAbono} disabled={enviando || !form.monto || !archivo}>
              {enviando ? "Enviando..." : "📤 Enviar Abono"}
            </button>

            <p style={{ color: "var(--gris-medio)", fontSize: "0.75rem", marginTop: 10, textAlign: "center", lineHeight: 1.5 }}>
              Tu abono quedará en revisión hasta que el administrador confirme el depósito.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
