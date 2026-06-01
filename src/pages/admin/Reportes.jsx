// src/pages/admin/Reportes.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORES = ["#1a6b3a", "#c9a84c", "#c0392b", "#5dade2", "#bb8fce"];

export default function Reportes() {
  const [stats, setStats] = useState(null);
  const [deudores, setDeudores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReportes(); }, []);

  const loadReportes = async () => {
    setLoading(true);
    const [pagosSnap, sociosSnap] = await Promise.all([
      getDocs(collection(db, "pagos")),
      getDocs(collection(db, "socios"))
    ]);

    const pagos = pagosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const socios = sociosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const totalRecaudado = pagos.filter(p => p.estado === "aprobado").reduce((a, p) => a + (p.monto || 0), 0);
    const porEstado = [
      { name: "Aprobados", value: pagos.filter(p => p.estado === "aprobado").length },
      { name: "En Revisión", value: pagos.filter(p => p.estado === "revision").length },
      { name: "Pendientes", value: pagos.filter(p => p.estado === "pendiente").length },
      { name: "Rechazados", value: pagos.filter(p => p.estado === "rechazado").length },
    ].filter(d => d.value > 0);

    // Deudores: socios con pagos pendientes
    const sociosConDeuda = socios.filter(s => s.activo).map(s => {
      const pagosPend = pagos.filter(p => p.socioId === s.id && p.estado === "pendiente");
      const totalDeuda = pagosPend.reduce((a, p) => a + (p.monto || 0), 0);
      return { ...s, pagosPendientes: pagosPend.length, totalDeuda };
    }).filter(s => s.totalDeuda > 0).sort((a, b) => b.totalDeuda - a.totalDeuda);

    setStats({ totalRecaudado, totalPagos: pagos.length, totalSocios: socios.filter(s => s.activo).length, porEstado });
    setDeudores(sociosConDeuda);
    setLoading(false);
  };

  if (loading) return <p style={{ color: "var(--gris-medio)" }}>Cargando reportes...</p>;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: "2.5rem" }}>REPORTES</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Estadísticas y análisis del club</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
        {[
          { label: "Total Recaudado", value: `$${stats?.totalRecaudado?.toFixed(2)}`, color: "var(--dorado)", icon: "💰" },
          { label: "Total Pagos", value: stats?.totalPagos, color: "var(--verde)", icon: "📋" },
          { label: "Socios Activos", value: stats?.totalSocios, color: "#5dade2", icon: "👥" },
          { label: "Socios con Deuda", value: deudores.length, color: "var(--rojo)", icon: "⚠️" },
        ].map((k, i) => (
          <div key={i} className="card" style={{ borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>{k.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.8rem", color: k.color }}>{k.value}</div>
            <div className="label" style={{ color: "var(--gris-medio)", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, marginBottom: 32 }}>
        {/* Pie chart */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: "1.3rem" }}>PAGOS POR ESTADO</h3>
          {stats?.porEstado?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {stats.porEstado.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--gris-oscuro)", border: "1px solid #333" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--gris-medio)", fontSize: "0.9rem" }}>Sin datos</p>}
        </div>

        {/* Deudores */}
        <div className="card">
          <h3 style={{ marginBottom: 20, fontSize: "1.3rem" }}>⚠️ SOCIOS CON DEUDA</h3>
          {deudores.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30 }}>
              <div style={{ fontSize: "2rem" }}>🎉</div>
              <p style={{ color: "var(--verde-claro)", marginTop: 8 }}>¡Todos los socios están al día!</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Socio</th>
                    <th>Categoría</th>
                    <th>Pagos Pend.</th>
                    <th>Deuda Total</th>
                  </tr>
                </thead>
                <tbody>
                  {deudores.map(d => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{d.nombre} {d.apellido}</div>
                        <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{d.email}</div>
                      </td>
                      <td style={{ fontSize: "0.85rem" }}>{d.categoria}</td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ background: "#3d2b00", color: "var(--amarillo)", padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem" }}>
                          {d.pagosPendientes}
                        </span>
                      </td>
                      <td style={{ color: "var(--rojo-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.1rem" }}>
                        ${d.totalDeuda.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
