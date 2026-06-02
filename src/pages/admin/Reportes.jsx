// src/pages/admin/Reportes.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { exportarPagosExcel, exportarSociosExcel } from "../../utils/exportExcel";
import toast from "react-hot-toast";

const COLORES = ["#1a6b3a", "#c9a84c", "#c0392b", "#5dade2", "#bb8fce"];

export default function Reportes() {
  const [stats, setStats] = useState(null);
  const [deudores, setDeudores] = useState([]);
  const [todosPagos, setTodosPagos] = useState([]);
  const [todosSocios, setTodosSocios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportando, setExportando] = useState(false);

  useEffect(() => { loadReportes(); }, []);

  const loadReportes = async () => {
    setLoading(true);
    const [pagosSnap, sociosSnap] = await Promise.all([getDocs(collection(db, "pagos")), getDocs(collection(db, "socios"))]);
    const pagos = pagosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const socios = sociosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setTodosPagos(pagos);
    setTodosSocios(socios);

    const totalRecaudado = pagos.filter(p => p.estado === "aprobado").reduce((a, p) => a + (p.monto || 0), 0);
    const porEstado = [
      { name: "Aprobados", value: pagos.filter(p => p.estado === "aprobado").length },
      { name: "En Revisión", value: pagos.filter(p => p.estado === "revision").length },
      { name: "Pendientes", value: pagos.filter(p => p.estado === "pendiente").length },
      { name: "Rechazados", value: pagos.filter(p => p.estado === "rechazado").length },
      { name: "Vencidos", value: pagos.filter(p => p.estado === "vencido").length },
    ].filter(d => d.value > 0);

    const sociosConDeuda = socios.filter(s => s.activo).map(s => {
      const pagosPend = pagos.filter(p => (p.socioId === s.uid || p.socioId === s.id) && (p.estado === "pendiente" || p.estado === "vencido"));
      const totalDeuda = pagosPend.reduce((a, p) => a + (p.monto || 0), 0);
      return { ...s, pagosPendientes: pagosPend.length, totalDeuda };
    }).filter(s => s.totalDeuda > 0).sort((a, b) => b.totalDeuda - a.totalDeuda);

    setStats({ totalRecaudado, totalPagos: pagos.length, totalSocios: socios.filter(s => s.activo).length, porEstado });
    setDeudores(sociosConDeuda);
    setLoading(false);
  };

  const handleExportarPagos = async () => {
    setExportando(true);
    const ok = await exportarPagosExcel(todosPagos);
    if (ok) toast.success("📊 Excel de pagos descargado");
    else toast.error("Error exportando");
    setExportando(false);
  };

  const handleExportarSocios = async () => {
    setExportando(true);
    const ok = await exportarSociosExcel(todosSocios);
    if (ok) toast.success("📊 Excel de socios descargado");
    else toast.error("Error exportando");
    setExportando(false);
  };

  const handleExportarDeudores = async () => {
    setExportando(true);
    const pagosDeudores = todosPagos.filter(p => p.estado === "pendiente" || p.estado === "vencido");
    const ok = await exportarPagosExcel(pagosDeudores, "Deudores_Yaguares_RC");
    if (ok) toast.success("📊 Excel de deudores descargado");
    else toast.error("Error exportando");
    setExportando(false);
  };

  if (loading) return <p style={{ color: "var(--gris-medio)" }}>Cargando reportes...</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.5rem" }}>REPORTES</h1>
          <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Estadísticas y exportaciones del club</p>
        </div>
        {/* Botones exportar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "8px 14px" }} onClick={handleExportarSocios} disabled={exportando}>
            📊 Socios Excel
          </button>
          <button className="btn btn-secondary" style={{ fontSize: "0.8rem", padding: "8px 14px" }} onClick={handleExportarPagos} disabled={exportando}>
            📊 Pagos Excel
          </button>
          <button className="btn btn-danger" style={{ fontSize: "0.8rem", padding: "8px 14px" }} onClick={handleExportarDeudores} disabled={exportando}>
            ⚠️ Deudores Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Total Recaudado", value: `$${stats?.totalRecaudado?.toFixed(2)}`, color: "var(--dorado)", icon: "💰" },
          { label: "Total Pagos", value: stats?.totalPagos, color: "var(--verde)", icon: "📋" },
          { label: "Socios Activos", value: stats?.totalSocios, color: "#5dade2", icon: "👥" },
          { label: "Con Deuda", value: deudores.length, color: "var(--rojo)", icon: "⚠️" },
        ].map((k, i) => (
          <div key={i} className="card" style={{ borderTop: `3px solid ${k.color}`, padding: 16 }}>
            <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{k.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.7rem", color: k.color }}>{k.value}</div>
            <div className="label" style={{ color: "var(--gris-medio)", marginTop: 2, fontSize: "0.68rem" }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 28 }}>
        {/* Pie chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontSize: "1.2rem" }}>PAGOS POR ESTADO</h3>
          {stats?.porEstado?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.porEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {stats.porEstado.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--gris-oscuro)", border: "1px solid #333" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p style={{ color: "var(--gris-medio)", fontSize: "0.9rem" }}>Sin datos</p>}
        </div>

        {/* Deudores top */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "1.2rem" }}>⚠️ TOP DEUDORES</h3>
          </div>
          {deudores.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: "1.8rem" }}>🎉</div>
              <p style={{ color: "var(--verde-claro)", marginTop: 8, fontSize: "0.9rem" }}>¡Todos al día!</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {deudores.slice(0, 6).map((d, i) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: i < 3 ? "var(--rojo-claro)" : "var(--gris-medio)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>#{i + 1}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{d.nombre} {d.apellido}</div>
                      <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>{d.pagosPendientes} cuota{d.pagosPendientes > 1 ? "s" : ""} · {d.categoria}</div>
                    </div>
                  </div>
                  <div style={{ color: "var(--rojo-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.05rem" }}>${d.totalDeuda.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla completa deudores */}
      {deudores.length > 0 && (
        <div className="card table-wrap">
          <h3 style={{ marginBottom: 16, fontSize: "1.2rem" }}>LISTADO COMPLETO DE DEUDORES</h3>
          <table>
            <thead>
              <tr><th>Socio</th><th>Categoría</th><th>Email</th><th>Pagos Pend.</th><th>Deuda Total</th></tr>
            </thead>
            <tbody>
              {deudores.map(d => (
                <tr key={d.id}>
                  <td><div style={{ fontWeight: 600 }}>{d.nombre} {d.apellido}</div></td>
                  <td style={{ fontSize: "0.85rem" }}>{d.categoria}</td>
                  <td style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>{d.email}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ background: "#3d2b00", color: "var(--amarillo)", padding: "2px 8px", borderRadius: 10, fontWeight: 700, fontSize: "0.85rem" }}>{d.pagosPendientes}</span>
                  </td>
                  <td style={{ color: "var(--rojo-claro)", fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: "1.1rem" }}>${d.totalDeuda.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
