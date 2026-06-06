// src/pages/admin/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, PieChart, Pie } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { emailCuotaPendiente } from "../../utils/emailService";

const CATEGORIAS = { juvenil: "Juvenil", adulto_mayor: "Adulto Mayor", femenino_juvenil: "Femenino Juvenil", femenino_adulto: "Femenino Adulto" };
const COLORES_CAT = { juvenil: "#5dade2", adulto_mayor: "#1a6b3a", femenino_juvenil: "#bb8fce", femenino_adulto: "#c9a84c" };

export default function Dashboard() {
  const [stats, setStats] = useState({ socios: 0, pendientes: 0, enRevision: 0, recaudado: 0, vencidos: 0 });
  const [pagosRecientes, setPagosRecientes] = useState([]);
  const [chartMeses, setChartMeses] = useState([]);
  const [chartCategorias, setChartCategorias] = useState([]);
  const [tasaCobro, setTasaCobro] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [vistaStat, setVistaStat] = useState("recaudacion"); // recaudacion | categorias

  useEffect(() => { loadDashboard(); }, []);

  const loadDashboard = async () => {
    try {
      const [sociosSnap, pagosSnap] = await Promise.all([
        getDocs(collection(db, "socios")),
        getDocs(collection(db, "pagos"))
      ]);

      const socios = sociosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pagos = pagosSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const mesInicio = startOfMonth(new Date()).toISOString();
      const mesFin = endOfMonth(new Date()).toISOString();

      const aprobadosMes = pagos.filter(p => p.estado === "aprobado" && p.fechaPago >= mesInicio && p.fechaPago <= mesFin);
      const recaudado = aprobadosMes.reduce((a, p) => a + (p.monto || 0), 0);
      const pendientes = pagos.filter(p => p.estado === "pendiente").length;
      const revision = pagos.filter(p => p.estado === "revision").length;
      const vencidos = pagos.filter(p => p.estado === "vencido").length;
      const aprobados = pagos.filter(p => p.estado === "aprobado").length;
      const tasa = pagos.length > 0 ? Math.round((aprobados / pagos.length) * 100) : 0;

      setStats({ socios: socios.filter(s => s.activo).length, pendientes, enRevision: revision, recaudado, vencidos });
      setTasaCobro(tasa);

      // Pagos recientes
      const recientes = pagos.sort((a, b) => (b.creadoEn?.seconds || 0) - (a.creadoEn?.seconds || 0)).slice(0, 5);
      setPagosRecientes(recientes);

      // Chart 6 meses
      const meses = [];
      for (let i = 5; i >= 0; i--) {
        const fecha = subMonths(new Date(), i);
        const ini = startOfMonth(fecha).toISOString();
        const fin = endOfMonth(fecha).toISOString();
        const aprobMes = pagos.filter(p => p.estado === "aprobado" && p.fechaPago >= ini && p.fechaPago <= fin);
        const pendMes = pagos.filter(p => (p.estado === "pendiente" || p.estado === "vencido") && p.creadoEn?.seconds);
        meses.push({
          mes: format(fecha, "MMM", { locale: es }).toUpperCase(),
          recaudado: aprobMes.reduce((a, p) => a + (p.monto || 0), 0),
          cantidad: aprobMes.length,
        });
      }
      setChartMeses(meses);

      // Chart por categoría
      const cats = Object.keys(CATEGORIAS).map(cat => {
        const sociosCat = socios.filter(s => s.categoria === cat && s.activo);
        const pagosCat = pagos.filter(p => sociosCat.some(s => s.uid === p.socioId || s.id === p.socioId));
        const recaudadoCat = pagosCat.filter(p => p.estado === "aprobado").reduce((a, p) => a + (p.monto || 0), 0);
        const deudaCat = pagosCat.filter(p => p.estado === "pendiente" || p.estado === "vencido").reduce((a, p) => a + (p.monto || 0), 0);
        return { cat: CATEGORIAS[cat], socios: sociosCat.length, recaudado: recaudadoCat, deuda: deudaCat, color: COLORES_CAT[cat] };
      }).filter(c => c.socios > 0);
      setChartCategorias(cats);

    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const generarCuotasMes = async () => {
    if (!window.confirm(`¿Generar cuotas de ${format(new Date(), "MMMM yyyy", { locale: es })} para todos los socios activos?`)) return;
    setGenerando(true);
    try {
      const mesActual = format(new Date(), "MMMM yyyy", { locale: es });
      const fechaVencimiento = new Date(new Date().getFullYear(), new Date().getMonth(), 15).toISOString();
      const sociosSnap = await getDocs(query(collection(db, "socios"), where("activo", "==", true)));
      const socios = sociosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      let creados = 0; let omitidos = 0;

      for (const socio of socios) {
        const existe = await getDocs(query(
          collection(db, "pagos"),
          where("socioId", "==", socio.uid || socio.id),
          where("concepto", "==", `Cuota mensual - ${mesActual}`),
          where("tipo", "==", "mensual")
        ));
        if (existe.size > 0) { omitidos++; continue; }

        await addDoc(collection(db, "pagos"), {
          socioId: socio.uid || socio.id,
          socioNombre: `${socio.nombre} ${socio.apellido}`,
          socioEmail: socio.email,
          concepto: `Cuota mensual - ${mesActual}`,
          monto: socio.cuotaMensual || 0,
          tipo: "mensual", estado: "pendiente",
          metodoPago: null, comprobanteUrl: null,
          fechaVencimiento,
          creadoEn: serverTimestamp(),
          generadoAutomaticamente: false,
        });

        await emailCuotaPendiente(socio, socio.cuotaMensual, `Cuota mensual - ${mesActual}`, "15 del mes en curso");
        creados++;
      }

      toast.success(`✅ ${creados} cuotas generadas y notificadas. ${omitidos > 0 ? `${omitidos} ya existían.` : ""}`);
      loadDashboard();
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setGenerando(false); }
  };

  const statCards = [
    { label: "Socios Activos", value: stats.socios, icon: "👥", color: "var(--verde)" },
    { label: "En Revisión", value: stats.enRevision, icon: "🔍", color: "#5dade2", highlight: stats.enRevision > 0 },
    { label: "Pendientes", value: stats.pendientes, icon: "⏳", color: "var(--amarillo)" },
    { label: "Vencidos", value: stats.vencidos, icon: "🔴", color: "var(--rojo)", highlight: stats.vencidos > 0 },
    { label: "Recaudado Mes", value: `$${stats.recaudado.toFixed(2)}`, icon: "💰", color: "var(--dorado)" },
    { label: "Tasa de Cobro", value: `${tasaCobro}%`, icon: "📈", color: tasaCobro >= 70 ? "var(--verde)" : tasaCobro >= 40 ? "var(--amarillo)" : "var(--rojo)" },
  ];

  const estadoBadge = (estado) => {
    const map = { pendiente: "badge-pendiente", revision: "badge-revision", aprobado: "badge-aprobado", rechazado: "badge-rechazado", vencido: "badge-rechazado" };
    const label = { pendiente: "Pendiente", revision: "En Revisión", aprobado: "Aprobado", rechazado: "Rechazado", vencido: "Vencido" };
    return <span className={`badge ${map[estado] || ""}`}>{label[estado] || estado}</span>;
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🐆</div>
        <p style={{ color: "var(--gris-medio)", fontFamily: "'Barlow Condensed'", letterSpacing: "0.1em" }}>CARGANDO...</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: "2.2rem" }}>DASHBOARD</h1>
          <p style={{ color: "var(--gris-medio)", fontSize: "0.85rem", marginTop: 2 }}>
            {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
        <button className="btn btn-gold" onClick={generarCuotasMes} disabled={generando} style={{ fontSize: "0.85rem" }}>
          {generando ? "⏳ Generando..." : `💰 Generar Cuotas ${format(new Date(), "MMMM", { locale: es }).toUpperCase()}`}
        </button>
      </div>

      {/* Alerta revisión */}
      {stats.enRevision > 0 && (
        <div style={{ background: "#1a2a4a", border: "1px solid #5dade2", borderRadius: 8, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.2rem" }}>🔍</span>
          <span style={{ color: "#5dade2", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>
            {stats.enRevision} comprobante{stats.enRevision > 1 ? "s" : ""} esperando validación
          </span>
          <a href="/admin/pagos" style={{ marginLeft: "auto", color: "#5dade2", fontSize: "0.82rem", textDecoration: "underline" }}>Ver ahora →</a>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {statCards.map((s, i) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${s.color}`, padding: 14, position: "relative" }}>
            {s.highlight && <div style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%", background: s.color }} className="pulse-green" />}
            <div style={{ fontSize: "1.3rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: "1.7rem", color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div className="label" style={{ color: "var(--gris-medio)", marginTop: 3, fontSize: "0.65rem" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>

        {/* Recaudación */}
        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {["recaudacion", "categorias"].map(v => (
              <button key={v} onClick={() => setVistaStat(v)} className="btn"
                style={{ padding: "5px 12px", fontSize: "0.75rem", background: vistaStat === v ? "var(--verde)" : "var(--gris)", color: vistaStat === v ? "white" : "var(--gris-medio)" }}>
                {v === "recaudacion" ? "📈 Meses" : "🏷️ Categorías"}
              </button>
            ))}
          </div>

          {vistaStat === "recaudacion" ? (
            <>
              <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--gris-medio)" }}>RECAUDACIÓN 6 MESES</h3>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={chartMeses}>
                  <XAxis dataKey="mes" tick={{ fill: "#6b6b6b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#6b6b6b", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "var(--gris-oscuro)", border: "1px solid #333", borderRadius: 6 }}
                    formatter={(v) => [`$${v.toFixed(2)}`, "Recaudado"]} />
                  <Bar dataKey="recaudado" radius={[4, 4, 0, 0]}>
                    {chartMeses.map((_, idx) => <Cell key={idx} fill={idx === chartMeses.length - 1 ? "var(--verde-claro)" : "var(--verde)"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: "1rem", marginBottom: 12, color: "var(--gris-medio)" }}>RECAUDADO POR CATEGORÍA</h3>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={chartCategorias} layout="vertical">
                  <XAxis type="number" tick={{ fill: "#6b6b6b", fontSize: 10 }} />
                  <YAxis dataKey="cat" type="category" tick={{ fill: "#aaa", fontSize: 10 }} width={60} />
                  <Tooltip contentStyle={{ background: "var(--gris-oscuro)", border: "1px solid #333", borderRadius: 6 }}
                    formatter={(v) => [`$${v.toFixed(2)}`, "Recaudado"]} />
                  <Bar dataKey="recaudado" radius={[0, 4, 4, 0]}>
                    {chartCategorias.map((c, idx) => <Cell key={idx} fill={c.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Resumen por categoría */}
        <div className="card">
          <h3 style={{ fontSize: "1rem", marginBottom: 14, color: "var(--gris-medio)" }}>ESTADO POR CATEGORÍA</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chartCategorias.map((c, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: c.color }}>{c.cat}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--gris-medio)" }}>{c.socios} socios</span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ flex: 1, height: 6, background: "#2a2a2a", borderRadius: 3 }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: c.color,
                      width: c.recaudado + c.deuda > 0 ? `${(c.recaudado / (c.recaudado + c.deuda)) * 100}%` : "0%",
                      transition: "width 0.5s"
                    }} />
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "var(--verde-claro)", minWidth: 50, textAlign: "right" }}>${c.recaudado.toFixed(0)}</span>
                  {c.deuda > 0 && <span style={{ fontSize: "0.75rem", color: "var(--rojo-claro)", minWidth: 50 }}>-${c.deuda.toFixed(0)}</span>}
                </div>
              </div>
            ))}
            {chartCategorias.length === 0 && <p style={{ color: "var(--gris-medio)", fontSize: "0.88rem" }}>Sin datos de categorías aún</p>}
          </div>
        </div>
      </div>

      {/* Pagos recientes */}
      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: "1rem", color: "var(--gris-medio)" }}>ACTIVIDAD RECIENTE</h3>
        {pagosRecientes.length === 0 ? (
          <p style={{ color: "var(--gris-medio)", fontSize: "0.9rem" }}>No hay pagos registrados aún.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {pagosRecientes.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < pagosRecientes.length - 1 ? "1px solid #1e1e1e" : "none", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.socioNombre}</div>
                  <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{p.concepto}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "var(--dorado)", fontFamily: "'Barlow Condensed'", fontWeight: 700 }}>${p.monto?.toFixed(2)}</span>
                  {estadoBadge(p.estado)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
