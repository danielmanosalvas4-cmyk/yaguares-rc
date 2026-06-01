// src/pages/player/PortalJugador.jsx
import React, { useEffect, useState } from "react";
import { db, storage, auth } from "../../config/firebase";
import {
  collection, getDocs, query, where, addDoc,
  serverTimestamp, updateDoc, doc, orderBy
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Payphone config — reemplazá con tu token de Payphone
const PAYPHONE_TOKEN = "TU_PAYPHONE_TOKEN";
const PAYPHONE_STORE_ID = "TU_STORE_ID";

export default function PortalJugador() {
  const { user, socioData } = useAuth();
  const navigate = useNavigate();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPago, setModalPago] = useState(null); // pago seleccionado
  const [metodoPago, setMetodoPago] = useState("comprobante");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (user) loadPagos();
  }, [user]);

  const loadPagos = async () => {
    setLoading(true);
    const snap = await getDocs(query(
      collection(db, "pagos"),
      where("socioId", "==", user.uid),
      orderBy("creadoEn", "desc")
    ));
    setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setArchivo(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleEnviarComprobante = async () => {
    if (!archivo) { toast.error("Seleccioná una imagen del comprobante"); return; }
    setSubiendo(true);
    try {
      // Subir imagen a Firebase Storage
      const storageRef = ref(storage, `comprobantes/${user.uid}/${modalPago.id}_${Date.now()}`);
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "pagos", modalPago.id), {
        estado: "revision",
        comprobanteUrl: url,
        metodoPago: "comprobante",
        fechaEnvio: new Date().toISOString()
      });

      toast.success("✅ Comprobante enviado. El administrador lo validará pronto.");
      setModalPago(null);
      setArchivo(null);
      setPreview(null);
      loadPagos();
    } catch (err) {
      toast.error("Error al subir el comprobante: " + err.message);
    } finally {
      setSubiendo(false);
    }
  };

  const handlePagarConTarjeta = (pago) => {
    // Integración Payphone Button
    // Documentación: https://developers.payphone.app/payphone-button
    const amount = Math.round(pago.monto * 100); // centavos
    const reference = `YAGUARES-${pago.id}-${Date.now()}`;

    // Abrir el modal de Payphone
    if (window.PPaymentButtonBox) {
      new window.PPaymentButtonBox({
        token: PAYPHONE_TOKEN,
        amount: amount,
        amountWithTax: 0,
        amountWithoutTax: amount,
        tax: 0,
        service: 0,
        tip: 0,
        currency: "USD",
        storeId: PAYPHONE_STORE_ID,
        reference: reference,
        lang: "es",
        defaultCard: "debit",
        responseCallback: async (response) => {
          if (response.transactionStatus === "Approved") {
            await updateDoc(doc(db, "pagos", pago.id), {
              estado: "aprobado",
              metodoPago: "tarjeta",
              payphoneTransactionId: response.transactionId,
              fechaPago: new Date().toISOString()
            });
            toast.success("🎉 ¡Pago aprobado! Gracias.");
            setModalPago(null);
            loadPagos();
          } else {
            toast.error("Pago no completado. Intenta nuevamente.");
          }
        }
      }).render();
    } else {
      toast.error("El sistema de pagos no está disponible. Verificá que el script de Payphone esté cargado.");
    }
  };

  const pendientes = pagos.filter(p => p.estado === "pendiente" || p.estado === "rechazado");
  const historial = pagos.filter(p => p.estado === "aprobado" || p.estado === "revision");
  const totalDeuda = pendientes.reduce((a, p) => a + (p.monto || 0), 0);

  const estadoBadge = (estado) => {
    const map = { pendiente: "badge-pendiente", revision: "badge-revision", aprobado: "badge-aprobado", rechazado: "badge-rechazado" };
    const icons = { pendiente: "⏳", revision: "🔍", aprobado: "✅", rechazado: "❌" };
    const labels = { pendiente: "Pendiente", revision: "En Revisión", aprobado: "Pagado", rechazado: "Rechazado" };
    return <span className={`badge ${map[estado]}`}>{icons[estado]} {labels[estado]}</span>;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--negro)" }}>
      {/* Header */}
      <header style={{
        background: "var(--gris-oscuro)",
        borderBottom: "1px solid #222",
        padding: "0 24px",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "var(--verde)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>🐆</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.1rem" }}>YAGUARES RC</div>
            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: "0.65rem", color: "var(--verde-claro)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Portal del Jugador</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{socioData?.nombre} {socioData?.apellido}</div>
            <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{socioData?.categoria}</div>
          </div>
          <button className="btn btn-secondary" style={{ padding: "7px 14px", fontSize: "0.78rem" }} onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      <div style={{ padding: "28px 24px", maxWidth: 900, margin: "0 auto" }}>
        {/* Deuda Banner */}
        {totalDeuda > 0 && (
          <div style={{
            background: "linear-gradient(135deg, #3d1f00, #5a2e00)",
            border: "1px solid var(--amarillo)",
            borderRadius: 10, padding: 20, marginBottom: 28,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.6rem", color: "var(--amarillo)" }}>
                ⚠️ SALDO PENDIENTE
              </div>
              <div style={{ color: "#ccc", fontSize: "0.9rem", marginTop: 2 }}>
                Tenés {pendientes.length} pago{pendientes.length > 1 ? "s" : ""} pendiente{pendientes.length > 1 ? "s" : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "2.5rem", color: "var(--amarillo)", lineHeight: 1 }}>
                ${totalDeuda.toFixed(2)}
              </div>
              <div style={{ color: "var(--amarillo)", fontSize: "0.75rem", opacity: 0.7 }}>Total a pagar</div>
            </div>
          </div>
        )}

        {totalDeuda === 0 && !loading && (
          <div style={{
            background: "linear-gradient(135deg, #0f3020, #0f4023)",
            border: "1px solid var(--verde)",
            borderRadius: 10, padding: 20, marginBottom: 28, textAlign: "center"
          }}>
            <div style={{ fontSize: "2rem", marginBottom: 6 }}>🎉</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.5rem", color: "var(--verde-claro)" }}>
              ¡ESTÁS AL DÍA! — Gracias por tu compromiso con el club
            </div>
          </div>
        )}

        {/* Pagos pendientes */}
        {pendientes.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: "1.8rem", marginBottom: 16 }}>PAGOS PENDIENTES</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendientes.map(p => (
                <div key={p.id} className="card card-hover" style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderLeft: p.estado === "rechazado" ? "3px solid var(--rojo)" : "3px solid var(--amarillo)"
                }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.concepto}</div>
                    {p.tipo === "extraordinario" && <span className="badge badge-extraordinario" style={{ marginTop: 4 }}>✈️ Extraordinario</span>}
                    {p.estado === "rechazado" && p.notaAdmin && (
                      <div style={{ color: "var(--rojo-claro)", fontSize: "0.82rem", marginTop: 4 }}>
                        ❌ Rechazado: {p.notaAdmin}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.5rem", color: "var(--dorado)" }}>${p.monto?.toFixed(2)}</div>
                      {estadoBadge(p.estado)}
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => { setModalPago(p); setMetodoPago("comprobante"); setArchivo(null); setPreview(null); }}
                    >
                      Pagar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        <div>
          <h2 style={{ fontSize: "1.8rem", marginBottom: 16 }}>HISTORIAL DE PAGOS</h2>
          <div className="card table-wrap">
            {loading ? (
              <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p>
            ) : historial.length === 0 ? (
              <p style={{ color: "var(--gris-medio)", padding: 20, textAlign: "center" }}>Sin pagos registrados aún</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(p => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.concepto}</div>
                        {p.tipo === "extraordinario" && <span className="badge badge-extraordinario" style={{ fontSize: "0.7rem" }}>✈️ Extraordinario</span>}
                      </td>
                      <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${p.monto?.toFixed(2)}</td>
                      <td style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>
                        {p.metodoPago === "comprobante" ? "📎 Comprobante" : p.metodoPago === "tarjeta" ? "💳 Tarjeta" : "-"}
                      </td>
                      <td style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>
                        {p.fechaPago ? format(new Date(p.fechaPago), "d MMM yyyy", { locale: es }) : "-"}
                      </td>
                      <td>{estadoBadge(p.estado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de pago */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.6rem" }}>REALIZAR PAGO</h2>
              <button onClick={() => setModalPago(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 4 }}>Concepto</div>
              <div style={{ fontWeight: 600 }}>{modalPago.concepto}</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "2rem", color: "var(--dorado)", marginTop: 4 }}>
                ${modalPago.monto?.toFixed(2)}
              </div>
            </div>

            {/* Selector de método */}
            <div style={{ marginBottom: 20 }}>
              <label className="label" style={{ display: "block", marginBottom: 10, color: "var(--gris-medio)" }}>Método de pago</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  onClick={() => setMetodoPago("comprobante")}
                  style={{
                    padding: "14px 10px", borderRadius: 8, cursor: "pointer",
                    border: metodoPago === "comprobante" ? "2px solid var(--verde-claro)" : "2px solid #2a2a2a",
                    background: metodoPago === "comprobante" ? "var(--verde-oscuro)" : "var(--gris)",
                    color: "white", textAlign: "center"
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>📎</div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.85rem" }}>Comprobante</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>Depósito / Transferencia</div>
                </button>
                <button
                  onClick={() => setMetodoPago("tarjeta")}
                  style={{
                    padding: "14px 10px", borderRadius: 8, cursor: "pointer",
                    border: metodoPago === "tarjeta" ? "2px solid var(--dorado)" : "2px solid #2a2a2a",
                    background: metodoPago === "tarjeta" ? "#2a2000" : "var(--gris)",
                    color: "white", textAlign: "center"
                  }}
                >
                  <div style={{ fontSize: "1.5rem", marginBottom: 4 }}>💳</div>
                  <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.85rem" }}>Tarjeta de Débito</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>Pago inmediato</div>
                </button>
              </div>
            </div>

            {/* Formulario según método */}
            {metodoPago === "comprobante" && (
              <div>
                <label className="label" style={{ display: "block", marginBottom: 8, color: "var(--gris-medio)" }}>
                  Adjuntar foto del comprobante (depósito o transferencia)
                </label>
                <label style={{
                  display: "block", border: "2px dashed #3a3a3a", borderRadius: 8,
                  padding: 24, textAlign: "center", cursor: "pointer",
                  background: preview ? "#0f2a1f" : "var(--gris)", transition: "all 0.2s"
                }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, objectFit: "contain" }} />
                  ) : (
                    <div>
                      <div style={{ fontSize: "2rem", marginBottom: 8 }}>📷</div>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.9rem" }}>Tocá para seleccionar una imagen</div>
                      <div style={{ color: "#4a4a4a", fontSize: "0.78rem", marginTop: 4 }}>JPG, PNG o PDF</div>
                    </div>
                  )}
                </label>
                {archivo && <p style={{ color: "var(--verde-claro)", fontSize: "0.82rem", marginTop: 6 }}>✓ {archivo.name}</p>}
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", marginTop: 16, padding: "13px" }}
                  onClick={handleEnviarComprobante}
                  disabled={subiendo || !archivo}
                >
                  {subiendo ? "Subiendo..." : "📤 Enviar Comprobante"}
                </button>
              </div>
            )}

            {metodoPago === "tarjeta" && (
              <div>
                <div style={{ background: "#1a1a2a", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <p style={{ color: "#aaa", fontSize: "0.88rem", lineHeight: 1.6 }}>
                    Serás redirigido al portal seguro de <strong style={{ color: "var(--dorado)" }}>Payphone</strong> para completar el pago con tu tarjeta de débito (Visa / Mastercard / Diners).
                  </p>
                </div>
                {/* El botón de Payphone se renderiza aquí */}
                <div id="pp-button" style={{ marginBottom: 12 }}></div>
                <button
                  className="btn btn-gold"
                  style={{ width: "100%", justifyContent: "center", padding: "13px" }}
                  onClick={() => handlePagarConTarjeta(modalPago)}
                >
                  💳 Pagar ${modalPago.monto?.toFixed(2)} con Tarjeta
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
