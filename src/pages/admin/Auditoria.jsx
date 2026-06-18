// src/pages/admin/Auditoria.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const ICONOS = {
  COBRO_CREADO: "✈️",
  COBRO_ELIMINADO: "🗑️",
  JUGADORES_AGREGADOS: "➕",
  PAGO_APROBADO: "✅",
  PAGO_RECHAZADO: "❌",
  SOCIO_CREADO: "👥",
  SOCIO_ELIMINADO: "🗑️",
  ADMIN_CREADO: "🛡️",
};

export default function Auditoria() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroAdmin, setFiltroAdmin] = useState("");

  useEffect(() => { loadAuditoria(); }, []);

  const loadAuditoria = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "auditoria"),
        orderBy("fecha", "desc"),
        limit(200)
      ));
      setRegistros(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const formatFecha = (ts) => {
    if (!ts) return "—";
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return format(date, "d MMM yyyy, HH:mm", { locale: es });
    } catch { return "—"; }
  };

  const admins = [...new Set(registros.map(r => r.adminEmail))].filter(Boolean);
  const filtered = registros.filter(r => !filtroAdmin || r.adminEmail === filtroAdmin);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2.5rem" }}>AUDITORÍA</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Registro de todas las acciones realizadas por administradores</p>
      </div>

      {/* Filtro por admin */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filtroAdmin} onChange={e => setFiltroAdmin(e.target.value)} style={{ maxWidth: 280 }}>
          <option value="">Todos los administradores</option>
          {admins.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ color: "var(--gris-medio)", fontSize: "0.85rem" }}>{filtered.length} registros</span>
      </div>

      {/* Lista */}
      <div className="card table-wrap">
        {loading ? (
          <p style={{ padding: 20, color: "var(--gris-medio)" }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
            <p style={{ color: "var(--gris-medio)" }}>Sin registros de auditoría aún</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Detalle</th>
                <th>Administrador</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                    {formatFecha(r.fecha)}
                  </td>
                  <td>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontFamily: "'Barlow Condensed'", fontWeight: 700,
                      fontSize: "0.8rem", letterSpacing: "0.06em",
                      color: r.accion?.includes("ELIMINAR") || r.accion?.includes("RECHAZ") ? "var(--rojo-claro)" :
                             r.accion?.includes("APROB") ? "var(--verde-claro)" : "var(--blanco)"
                    }}>
                      {ICONOS[r.accion] || "📌"} {r.accion?.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.88rem", color: "var(--gris-medio)" }}>{r.detalle}</td>
                  <td style={{ fontSize: "0.82rem", color: "#5dade2" }}>{r.adminEmail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
