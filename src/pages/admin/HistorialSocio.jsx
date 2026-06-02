// src/pages/admin/HistorialSocio.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function HistorialSocio() {
  const [socios, setSocios] = useState([]);
  const [socioSel, setSocioSel] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { loadSocios(); }, []);

  const loadSocios = async () => {
    const snap = await getDocs(collection(db, "socios"));
    setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const seleccionarSocio = async (s) => {
    setSocioSel(s);
    setLoading(true);
    const snap = await getDocs(query(
      collection(db, "pagos"),
      where("socioId", "==", s.uid || s.id),
      orderBy("creadoEn", "desc")
    ));
    setPagos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  const aprobar = async (p) => {
    await updateDoc(doc(db, "pagos", p.id), { estado: "aprobado", fechaAprobacion: new Date().toISOString() });
    toast.success("Pago aprobado");
    seleccionarSocio(socioSel);
  };

  const rechazar = async (p) => {
    const nota = window.prompt("Motivo del rechazo:");
    if (!nota) return;
    await updateDoc(doc(db, "pagos", p.id), { estado: "rechazado", notaAdmin: nota });
    toast.success("Pago rechazado");
    seleccionarSocio(socioSel);
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

  const filtered = socios.filter(s =>
    `${s.nombre} ${s.apellido} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalPagado = pagos.filter(p => p.estado === "aprobado").reduce((a, p) => a + (p.monto || 0), 0);
  const totalDeuda = pagos.filter(p => p.estado === "pendiente" || p.estado === "vencido").reduce((a, p) => a + (p.monto || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2.5rem" }}>HISTORIAL POR SOCIO</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Seleccioná un socio para ver su historial completo</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: socioSel ? "300px 1fr" : "1fr", gap: 20 }}>
        {/* Lista socios */}
        <div>
          <input type="text" placeholder="Buscar socio..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto" }}>
            {filtered.map(s => {
              const seleccionado = socioSel?.id === s.id;
              return (
                <div key={s.id}
                  onClick={() => seleccionarSocio(s)}
                  className="card"
                  style={{
                    cursor: "pointer", padding: 14,
                    borderLeft: seleccionado ? "3px solid var(--verde-claro)" : "3px solid transparent",
                    background: seleccionado ? "var(--verde-oscuro)" : "var(--gris-oscuro)",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.nombre} {s.apellido}</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{s.categoria} · ${s.cuotaMensual?.toFixed(2)}/mes</div>
                  <span className={`badge ${s.activo ? "badge-aprobado" : "badge-rechazado"}`} style={{ marginTop: 6, fontSize: "0.68rem" }}>
                    {s.activo ? "Activo" : "Inactivo"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Historial del socio */}
        {socioSel && (
          <div className="fade-in">
            {/* Header socio */}
            <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--verde)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: "1.6rem" }}>{socioSel.nombre} {socioSel.apellido}</h2>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>{socioSel.email} · {socioSel.telefono}</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>CI: {socioSel.cedula} · {socioSel.categoria}</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.5rem", color: "var(--verde-claro)" }}>${totalPagado.toFixed(2)}</div>
                    <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>Total Pagado</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.5rem", color: totalDeuda > 0 ? "var(--rojo-claro)" : "var(--verde-claro)" }}>${totalDeuda.toFixed(2)}</div>
                    <div className="label" style={{ color: "var(--gris-medio)", fontSize: "0.65rem" }}>Deuda Actual</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagos */}
            <div className="card table-wrap">
              {loading ? (
                <p style={{ padding: 20, color: "var(--gris-medio)" }}>Cargando...</p>
              ) : pagos.length === 0 ? (
                <p style={{ padding: 20, color: "var(--gris-medio)", textAlign: "center" }}>Sin pagos registrados</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Monto</th>
                      <th>Vencimiento</th>
                      <th>Método</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{p.concepto}</div>
                          {p.tipo === "extraordinario" && <span className="badge badge-extraordinario" style={{ fontSize: "0.68rem" }}>✈️ Extra</span>}
                        </td>
                        <td style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${p.monto?.toFixed(2)}</td>
                        <td style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>{formatFecha(p.fechaVencimiento)}</td>
                        <td style={{ fontSize: "0.82rem", color: "var(--gris-medio)" }}>
                          {p.metodoPago === "comprobante" ? "📎" : p.metodoPago === "tarjeta" ? "💳" : "—"}
                        </td>
                        <td>{estadoBadge(p.estado)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            {p.comprobanteUrl && (
                              <a href={p.comprobanteUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: "5px 8px", fontSize: "0.72rem" }}>Ver 📎</a>
                            )}
                            {p.estado === "revision" && (
                              <>
                                <button className="btn btn-primary" style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => aprobar(p)}>✅</button>
                                <button className="btn btn-danger" style={{ padding: "5px 8px", fontSize: "0.72rem" }} onClick={() => rechazar(p)}>❌</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
