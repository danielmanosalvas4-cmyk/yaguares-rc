// src/pages/player/PortalJugador.jsx
import React, { useEffect, useState } from "react";
import { db, storage, auth } from "../../config/firebase";
import { collection, getDocs, query, where, updateDoc, doc, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut, updatePassword } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { format, isPast, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export default function PortalJugador() {
  const { user, socioData } = useAuth();
  const navigate = useNavigate();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalPago, setModalPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState("comprobante");
  const [archivo, setArchivo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [preview, setPreview] = useState(null);
  const [vista, setVista] = useState("inicio"); // inicio | perfil
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [cambioPass, setCambioPass] = useState(false);

  useEffect(() => { if (user) loadPagos(); }, [user]);

  const loadPagos = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "pagos"),
        where("socioId", "==", user.uid),
        orderBy("creadoEn", "desc")
      ));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Marcar vencidos automáticamente
      const hoy = new Date();
      for (const p of lista) {
        if (p.estado === "pendiente" && p.fechaVencimiento) {
          const vence = new Date(p.fechaVencimiento);
          if (isPast(vence) && p.estado === "pendiente") {
            await updateDoc(doc(db, "pagos", p.id), { estado: "vencido" });
            p.estado = "vencido";
          }
        }
      }
      setPagos(lista);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleLogout = async () => { await signOut(auth); navigate("/login"); };

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
      const storageRef = ref(storage, `comprobantes/${user.uid}/${modalPago.id}_${Date.now()}`);
      await uploadBytes(storageRef, archivo);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "pagos", modalPago.id), {
        estado: "revision", comprobanteUrl: url,
        metodoPago: "comprobante", fechaEnvio: new Date().toISOString()
      });
      toast.success("✅ Comprobante enviado. El administrador lo validará pronto.");
      setModalPago(null); setArchivo(null); setPreview(null);
      loadPagos();
    } catch (err) { toast.error("Error al subir: " + err.message); }
    finally { setSubiendo(false); }
  };

  const handleCambiarPassword = async () => {
    if (nuevaPassword.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setCambioPass(true);
    try {
      await updatePassword(user, nuevaPassword);
      toast.success("✅ Contraseña actualizada");
      setNuevaPassword("");
    } catch (err) {
      if (err.code === "auth/requires-recent-login") {
        toast.error("Por seguridad, cerrá sesión y volvé a ingresar para cambiar la contraseña");
      } else { toast.error(err.message); }
    } finally { setCambioPass(false); }
  };

  const isVencido = (p) => {
    if (p.estado === "vencido") return true;
    if (p.fechaVencimiento && p.estado === "pendiente") {
      return isPast(new Date(p.fechaVencimiento));
    }
    return false;
  };

  const pendientes = pagos.filter(p => p.estado === "pendiente" || p.estado === "revision" || p.estado === "rechazado" || p.estado === "vencido");
  const historial = pagos.filter(p => p.estado === "aprobado");
  const totalDeuda = pagos.filter(p => p.estado === "pendiente" || p.estado === "vencido").reduce((a, p) => a + (p.monto || 0), 0);

  const estadoBadge = (p) => {
    const vencido = isVencido(p);
    if (vencido && p.estado !== "revision" && p.estado !== "aprobado") {
      return <span className="badge" style={{ background: "#3d0f0f", color: "#e74c3c" }}>🔴 Vencido</span>;
    }
    const map = { pendiente: "badge-pendiente", revision: "badge-revision", aprobado: "badge-aprobado", rechazado: "badge-rechazado", vencido: "badge-rechazado" };
    const icons = { pendiente: "⏳", revision: "🔍", aprobado: "✅", rechazado: "❌", vencido: "🔴" };
    const labels = { pendiente: "Pendiente", revision: "En Revisión", aprobado: "Pagado", rechazado: "Rechazado", vencido: "Vencido" };
    return <span className={`badge ${map[p.estado]}`}>{icons[p.estado]} {labels[p.estado]}</span>;
  };

  const formatFecha = (iso) => {
    if (!iso) return "-";
    try { return format(new Date(iso), "d MMM yyyy", { locale: es }); } catch { return iso; }
  };

  const CATEGORIAS = { infantil: "Infantil (Sub-12)", juvenil: "Juvenil (Sub-18)", adulto: "Adulto (Mayor)", senior: "Senior" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--negro)" }}>
      {/* Header */}
      <header style={{ background: "var(--gris-oscuro)", borderBottom: "1px solid #222", padding: "0 16px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "var(--verde)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🐆</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1rem", lineHeight: 1 }}>YAGUARES RC</div>
            <div style={{ fontFamily: "'Barlow Condensed'", fontSize: "0.6rem", color: "var(--verde-claro)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Portal Jugador</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--gris-medio)", display: "none" }} className="hide-mobile">{socioData?.nombre}</span>
          <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: "0.75rem" }} onClick={() => setVista(vista === "perfil" ? "inicio" : "perfil")}>
            {vista === "perfil" ? "🏠 Inicio" : "👤 Mi Perfil"}
          </button>
          <button className="btn" style={{ padding: "6px 12px", fontSize: "0.75rem", background: "var(--gris)", color: "var(--gris-medio)" }} onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <div style={{ padding: "20px 16px", maxWidth: 860, margin: "0 auto" }}>

        {/* ── VISTA PERFIL ── */}
        {vista === "perfil" && (
          <div className="fade-in">
            <h2 style={{ fontSize: "2rem", marginBottom: 20 }}>MI PERFIL</h2>

            {/* Info del socio */}
            <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--verde)" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>📋 Datos del Socio</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                {[
                  { label: "Nombre completo", value: `${socioData?.nombre || ""} ${socioData?.apellido || ""}` },
                  { label: "Email", value: user?.email },
                  { label: "Teléfono", value: socioData?.telefono || "—" },
                  { label: "Cédula", value: socioData?.cedula || "—" },
                  { label: "Categoría", value: CATEGORIAS[socioData?.categoria] || socioData?.categoria },
                  { label: "Cuota mensual", value: `$${socioData?.cuotaMensual?.toFixed(2) || "0.00"}` },
                ].map((f, i) => (
                  <div key={i}>
                    <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 3 }}>{f.label}</div>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: socioData?.activo ? "#0f2a1a" : "#2a0f0f", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: socioData?.activo ? "var(--verde-claro)" : "var(--rojo-claro)", fontWeight: 700, fontSize: "0.85rem" }}>
                  {socioData?.activo ? "✅ Socio Activo" : "❌ Socio Inactivo"}
                </span>
              </div>
            </div>

            {/* Cambiar contraseña */}
            <div className="card" style={{ borderLeft: "3px solid var(--dorado)" }}>
              <h3 style={{ fontSize: "1.1rem", marginBottom: 16 }}>🔒 Cambiar Contraseña</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="password"
                  value={nuevaPassword}
                  onChange={e => setNuevaPassword(e.target.value)}
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button className="btn btn-gold" onClick={handleCambiarPassword} disabled={cambioPass || !nuevaPassword}>
                  {cambioPass ? "Guardando..." : "Actualizar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VISTA INICIO ── */}
        {vista === "inicio" && (
          <div className="fade-in">
            {/* Saludo */}
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: "1.8rem" }}>¡Hola, {socioData?.nombre}! 🐆</h2>
              <p style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>{format(new Date(), "EEEE d 'de' MMMM", { locale: es })}</p>
            </div>

            {/* Banner deuda */}
            {totalDeuda > 0 && (
              <div style={{ background: "linear-gradient(135deg, #3d1f00, #5a2e00)", border: "1px solid var(--amarillo)", borderRadius: 10, padding: 16, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.4rem", color: "var(--amarillo)" }}>⚠️ SALDO PENDIENTE</div>
                  <div style={{ color: "#ccc", fontSize: "0.85rem" }}>{pendientes.length} pago{pendientes.length > 1 ? "s" : ""} pendiente{pendientes.length > 1 ? "s" : ""}</div>
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: "2.2rem", color: "var(--amarillo)", lineHeight: 1 }}>${totalDeuda.toFixed(2)}</div>
              </div>
            )}

            {totalDeuda === 0 && !loading && (
              <div style={{ background: "linear-gradient(135deg, #0f3020, #0f4023)", border: "1px solid var(--verde)", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>🎉</div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.3rem", color: "var(--verde-claro)" }}>¡ESTÁS AL DÍA! — Gracias por tu compromiso</div>
              </div>
            )}

            {/* Pagos pendientes */}
            {pendientes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: "1.4rem", marginBottom: 12 }}>PAGOS PENDIENTES</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {pendientes.map(p => (
                    <div key={p.id} className="card" style={{
                      borderLeft: `3px solid ${isVencido(p) ? "var(--rojo)" : p.estado === "revision" ? "#5dade2" : p.estado === "rechazado" ? "var(--rojo)" : "var(--amarillo)"}`,
                      padding: 14
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{p.concepto}</div>
                          {p.tipo === "extraordinario" && <span className="badge badge-extraordinario" style={{ marginTop: 4, fontSize: "0.7rem" }}>✈️ Extraordinario</span>}
                          {p.fechaVencimiento && (
                            <div style={{ color: isVencido(p) ? "var(--rojo-claro)" : "var(--gris-medio)", fontSize: "0.78rem", marginTop: 4 }}>
                              {isVencido(p) ? "🔴 Venció el" : "⏰ Vence el"} {formatFecha(p.fechaVencimiento)}
                            </div>
                          )}
                          {p.estado === "rechazado" && p.notaAdmin && (
                            <div style={{ color: "var(--rojo-claro)", fontSize: "0.78rem", marginTop: 4 }}>❌ {p.notaAdmin}</div>
                          )}
                          {p.estado === "revision" && (
                            <div style={{ color: "#5dade2", fontSize: "0.78rem", marginTop: 4 }}>🔍 En revisión por el administrador</div>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.4rem", color: "var(--dorado)", lineHeight: 1 }}>${p.monto?.toFixed(2)}</div>
                            {estadoBadge(p)}
                          </div>
                          {(p.estado === "pendiente" || p.estado === "rechazado" || p.estado === "vencido") && (
                            <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                              onClick={() => { setModalPago(p); setMetodoPago("comprobante"); setArchivo(null); setPreview(null); }}>
                              Pagar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial */}
            <div>
              <h3 style={{ fontSize: "1.4rem", marginBottom: 12 }}>HISTORIAL DE PAGOS</h3>
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                {loading ? (
                  <p style={{ color: "var(--gris-medio)", padding: 20 }}>Cargando...</p>
                ) : historial.length === 0 ? (
                  <p style={{ color: "var(--gris-medio)", padding: 20, textAlign: "center" }}>Sin pagos aprobados aún</p>
                ) : (
                  <div>
                    {historial.map((p, i) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < historial.length - 1 ? "1px solid #1e1e1e" : "none", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.concepto}</div>
                          <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{formatFecha(p.fechaPago)} · {p.metodoPago === "comprobante" ? "📎 Comprobante" : "💳 Tarjeta"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${p.monto?.toFixed(2)}</span>
                          <span className="badge badge-aprobado">✅ Pagado</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de pago */}
      {modalPago && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", borderRadius: "16px 16px 0 0", padding: 20 }}>
            <div style={{ width: 40, height: 4, background: "#333", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h2 style={{ fontSize: "1.4rem" }}>REALIZAR PAGO</h2>
              <button onClick={() => setModalPago(null)} style={{ background: "none", border: "none", color: "var(--gris-medio)", cursor: "pointer", fontSize: "1.5rem" }}>✕</button>
            </div>

            <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 4 }}>Concepto</div>
              <div style={{ fontWeight: 600 }}>{modalPago.concepto}</div>
              {modalPago.fechaVencimiento && (
                <div style={{ color: isVencido(modalPago) ? "var(--rojo-claro)" : "var(--amarillo)", fontSize: "0.8rem", marginTop: 4 }}>
                  {isVencido(modalPago) ? "🔴 Venció el" : "⏰ Vence el"} {formatFecha(modalPago.fechaVencimiento)}
                </div>
              )}
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: "2rem", color: "var(--dorado)", marginTop: 4 }}>${modalPago.monto?.toFixed(2)}</div>
            </div>

            {/* Selector método */}
            <div style={{ marginBottom: 16 }}>
              <div className="label" style={{ color: "var(--gris-medio)", marginBottom: 8 }}>Método de pago</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { id: "comprobante", icon: "📎", title: "Comprobante", sub: "Depósito / Transferencia" },
                  { id: "tarjeta", icon: "💳", title: "Tarjeta de Débito", sub: "Pago inmediato - DeUna" },
                ].map(m => (
                  <button key={m.id} onClick={() => setMetodoPago(m.id)} style={{
                    padding: "14px 10px", borderRadius: 8, cursor: "pointer",
                    border: metodoPago === m.id ? `2px solid ${m.id === "comprobante" ? "var(--verde-claro)" : "var(--dorado)"}` : "2px solid #2a2a2a",
                    background: metodoPago === m.id ? (m.id === "comprobante" ? "var(--verde-oscuro)" : "#2a2000") : "var(--gris)",
                    color: "white", textAlign: "center"
                  }}>
                    <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "0.82rem" }}>{m.title}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.72rem" }}>{m.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Comprobante */}
            {metodoPago === "comprobante" && (
              <div>
                <label style={{ display: "block", border: "2px dashed #3a3a3a", borderRadius: 8, padding: 20, textAlign: "center", cursor: "pointer", background: preview ? "#0f2a1f" : "var(--gris)" }}>
                  <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 6, objectFit: "contain" }} />
                  ) : (
                    <div>
                      <div style={{ fontSize: "2rem", marginBottom: 6 }}>📷</div>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>Tocá para adjuntar comprobante</div>
                    </div>
                  )}
                </label>
                {archivo && <p style={{ color: "var(--verde-claro)", fontSize: "0.8rem", marginTop: 6 }}>✓ {archivo.name}</p>}
                <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: "13px" }} onClick={handleEnviarComprobante} disabled={subiendo || !archivo}>
                  {subiendo ? "Subiendo..." : "📤 Enviar Comprobante"}
                </button>
              </div>
            )}

            {/* Tarjeta / DeUna */}
            {metodoPago === "tarjeta" && (
              <div>
                <div style={{ background: "#1a1a2a", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <p style={{ color: "#aaa", fontSize: "0.86rem", lineHeight: 1.6 }}>
                    Próximamente podrás pagar con <strong style={{ color: "var(--dorado)" }}>DeUna</strong> directamente desde acá. Por ahora usá el comprobante.
                  </p>
                </div>
                <button className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMetodoPago("comprobante")}>
                  Usar comprobante en su lugar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
