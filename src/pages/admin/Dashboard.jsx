// src/pages/admin/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

export default function Dashboard() {
  const [stats, setStats] = useState({ socios: 0, pendientes: 0, enRevision: 0, recaudado: 0 });
  const [pagosRecientes, setPagosRecientes] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Total socios
      const sociosSnap = await getDocs(collection(db, "socios"));
      const totalSocios = sociosSnap.size;

      // Pagos en revisión
      const revSnap = await getDocs(query(
        collection(db, "pagos"),
        where("estado", "==", "revision")
      ));

      // Recaudado este mes
      const mesInicio = startOfMonth(new Date());
      const mesFin = endOfMonth(new Date());
      const aprobSnap = await getDocs(query(
        collection(db, "pagos"),
        where("estado", "==", "aprobado"),
        where("fechaPago", ">=", mesInicio.toISOString()),
        where("fechaPago", "<=", mesFin.toISOString())
      ));
      const recaudado = aprobSnap.docs.reduce((acc, d) => acc + (d.data().monto || 0), 0);

      // Pendientes
      const pendSnap = await getDocs(query(
        collection(db, "pagos"),
        where("estado", "==", "pendiente")
      ));

      setStats({
        socios: totalSocios,
        pendientes: pendSnap.size,
        enRevision: revSnap.size,
        recaudado
      });

      // Pagos recientes
      const recientesSnap = await getDocs(query(
        collection(db, "pagos"),
        orderBy("creadoEn", "desc"),
        limit(5)
      ));
      setPagosRecientes(recientesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Chart últimos 6 meses
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        const fecha = subMonths(new Date(), i);
        const inicio = startOfMonth(fecha).toISOString();
        const fin = endOfMonth(fecha).toISOString();
        const snap = await getDocs(query(
          collection(db, "pagos"),
          where("estado", "==", "aprobado"),
          where("fechaPago", ">=", inicio),
          where("fechaPago", "<=", fin)
        ));
        const total = snap.docs.reduce((acc, d) => acc + (d.data().monto || 0), 0);
        meses.push({
          mes: format(fecha, "MMM", { locale: es }).toUpperCase(),
          total
        });
      }
      setChartData(meses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Socios Activos", value: stats.socios, icon: "👥", color: "var(--verde)" },
    { label: "Pagos Pendientes", value: stats.pendientes, icon: "⏳", color: "var(--amarillo)" },
    { label: "En Revisión", value: stats.enRevision, icon: "🔍", color: "#5dade2", highlight: stats.enRevision > 0 },
    { label: "Recaudado Este Mes", value: `$${stats.recaudado.toFixed(2)}`, icon: "💰", color: "var(--dorado)" },
  ];

  const estadoBadge = (estado) => {
    const map = {
      pendiente: "badge-pendiente",
      revision: "badge-revision",
      aprobado: "badge-aprobado",
      rechazado: "badge-rechazado"
    };
    const label = {
      pendiente: "Pendiente", revision: "En Revisión",
      aprobado: "Aprobado", rechazado: "Rechazado"
    };
    return <span className={`badge ${map[estado] || ""}`}>{label[estado] || estado}</span>;
  };

  if (loading) return <p style={{ color: "var(--gris-medio)" }}>Cargando dashboard...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "2.5rem", color: "var(--blanco)" }}>DASHBOARD</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {statCards.map((s, i) => (
          <div
            key={i}
            className="card"
            style={{
              borderLeft: `3px solid ${s.color}`,
              position: "relative",
              overflow: "hidden"
            }}
          >
            {s.highlight && (
              <div style={{
                position: "absolute", top: 10, right: 10,
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--amarillo)"
              }} className="pulse-green" />
            )}
            <div style={{ fontSize: "1.6rem", marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "2rem", color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div className="label" style={{ color: "var(--gris-medio)", marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: "1.3rem" }}>RECAUDACIÓN ÚLTIMOS 6 MESES</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="mes" tick={{ fill: "#6b6b6b", fontSize: 11, fontFamily: "Barlow Condensed" }} />
              <YAxis tick={{ fill: "#6b6b6b", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "var(--gris-oscuro)", border: "1px solid #333", borderRadius: 6 }}
                labelStyle={{ fontFamily: "Barlow Condensed", color: "var(--blanco)" }}
                formatter={(v) => [`$${v.toFixed(2)}`, "Recaudado"]}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={idx === chartData.length - 1 ? "var(--verde-claro)" : "var(--verde)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pagos recientes */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: "1.3rem" }}>PAGOS RECIENTES</h3>
          {pagosRecientes.length === 0 ? (
            <p style={{ color: "var(--gris-medio)", fontSize: "0.9rem" }}>No hay pagos registrados aún.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {pagosRecientes.map(p => (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 0", borderBottom: "1px solid #1e1e1e"
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{p.socioNombre}</div>
                    <div style={{ color: "var(--gris-medio)", fontSize: "0.8rem" }}>{p.concepto}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>
                      ${p.monto?.toFixed(2)}
                    </div>
                    {estadoBadge(p.estado)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
