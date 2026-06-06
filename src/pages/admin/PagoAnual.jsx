// src/pages/admin/PagoAnual.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PagoAnual() {
  const [socios, setSocios] = useState([]);
  const [socioSel, setSocioSel] = useState(null);
  const [search, setSearch] = useState("");
  const [descuento, setDescuento] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [procesando, setProcesando] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => { loadSocios(); }, []);

  const loadSocios = async () => {
    const snap = await getDocs(query(collection(db, "socios"), where("activo", "==", true)));
    setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const calcularPreview = (socio, desc) => {
    if (!socio || desc === "") return null;
    const cuotaBase = socio.cuotaMensual || 0;
    const totalSinDesc = cuotaBase * 12;
    const descMonto = totalSinDesc * (Number(desc) / 100);
    const totalConDesc = totalSinDesc - descMonto;
    return { cuotaBase, totalSinDesc, descMonto, totalConDesc, cuotaEfectiva: totalConDesc / 12 };
  };

  const handleSeleccionar = (s) => {
    setSocioSel(s);
    setPreview(calcularPreview(s, descuento));
  };

  const handleDescuento = (val) => {
    setDescuento(val);
    setPreview(calcularPreview(socioSel, val));
  };

  const handleAplicar = async () => {
    if (!socioSel || descuento === "") { toast.error("Selecciona un socio y el descuento"); return; }
    if (Number(descuento) < 0 || Number(descuento) > 100) { toast.error("El descuento debe ser entre 0 y 100%"); return; }
    if (!window.confirm(`¿Aplicar pago anual ${anio} a ${socioSel.nombre} ${socioSel.apellido} con ${descuento}% de descuento?`)) return;

    setProcesando(true);
    try {
      const p = calcularPreview(socioSel, descuento);
      const socioId = socioSel.uid || socioSel.id;

      // Cancelar cuotas pendientes del año
      const pagosSnap = await getDocs(query(
        collection(db, "pagos"),
        where("socioId", "==", socioId),
        where("tipo", "==", "mensual")
      ));
      
      let cancelados = 0;
      for (const pagoDoc of pagosSnap.docs) {
        const pago = pagoDoc.data();
        if ((pago.estado === "pendiente" || pago.estado === "vencido") && pago.concepto?.includes(String(anio))) {
          await updateDoc(doc(db, "pagos", pagoDoc.id), { estado: "cancelado_anual" });
          cancelados++;
        }
      }

      // Crear un pago anual por cada mes
      for (let mes = 0; mes < 12; mes++) {
        const nombreMes = `${MESES[mes]} ${anio}`;
        // Verificar si ya existe pago aprobado para este mes
        const existe = pagosSnap.docs.find(d => 
          d.data().concepto?.includes(MESES[mes]) && 
          d.data().concepto?.includes(String(anio)) &&
          d.data().estado === "aprobado"
        );
        if (existe) continue;

        await addDoc(collection(db, "pagos"), {
          socioId,
          socioNombre: `${socioSel.nombre} ${socioSel.apellido}`,
          socioEmail: socioSel.email,
          concepto: `Cuota mensual - ${nombreMes}`,
          monto: p.cuotaEfectiva,
          montoOriginal: p.cuotaBase,
          descuentoPct: Number(descuento),
          descuentoMonto: p.descMonto / 12,
          tipo: "mensual",
          tipoPago: "anual",
          estado: "aprobado",
          metodoPago: "pago_anual",
          fechaPago: new Date().toISOString(),
          anio,
          creadoEn: serverTimestamp(),
          notaAdmin: `Pago anual ${anio} con ${descuento}% de descuento`
        });
      }

      toast.success(`✅ Pago anual ${anio} aplicado. ${cancelados} cuotas pendientes canceladas. 12 meses registrados como pagados.`);
      setSocioSel(null);
      setDescuento("");
      setPreview(null);
    } catch (err) {
      toast.error("Error: " + err.message);
    } finally {
      setProcesando(false);
    }
  };

  const filtered = socios.filter(s =>
    `${s.nombre} ${s.apellido} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2.5rem" }}>PAGO ANUAL</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Registra el pago completo del año con descuento personalizado</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Seleccionar socio */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <input type="text" placeholder="Buscar socio..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => handleSeleccionar(s)} className="card"
                style={{
                  cursor: "pointer", padding: 12,
                  borderLeft: socioSel?.id === s.id ? "3px solid var(--dorado)" : "3px solid transparent",
                  background: socioSel?.id === s.id ? "#2a2000" : "var(--gris-oscuro)"
                }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{s.nombre} {s.apellido}</div>
                <div style={{ color: "var(--gris-medio)", fontSize: "0.78rem" }}>{s.categoria} · ${s.cuotaMensual}/mes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Configurar pago */}
        <div>
          {socioSel ? (
            <div className="card" style={{ borderLeft: "3px solid var(--dorado)" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: 16 }}>
                💰 {socioSel.nombre} {socioSel.apellido}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Año</label>
                  <select value={anio} onChange={e => setAnio(Number(e.target.value))}>
                    {[2024, 2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Descuento (%)</label>
                  <input type="number" value={descuento} onChange={e => handleDescuento(e.target.value)} placeholder="10" min="0" max="100" />
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div style={{ background: "#1a2000", border: "1px solid var(--dorado)", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                  <div className="label" style={{ color: "var(--dorado)", marginBottom: 10 }}>RESUMEN DEL PAGO ANUAL</div>
                  {[
                    { label: "Cuota mensual base", value: `$${preview.cuotaBase.toFixed(2)}` },
                    { label: "Total sin descuento (12 meses)", value: `$${preview.totalSinDesc.toFixed(2)}` },
                    { label: `Descuento ${descuento}%`, value: `-$${preview.descMonto.toFixed(2)}`, color: "var(--verde-claro)" },
                    { label: "Total a pagar", value: `$${preview.totalConDesc.toFixed(2)}`, color: "var(--dorado)", grande: true },
                    { label: "Cuota efectiva por mes", value: `$${preview.cuotaEfectiva.toFixed(2)}`, color: "var(--gris-medio)" },
                  ].map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < 4 ? "1px solid #2a2a00" : "none" }}>
                      <span style={{ fontSize: "0.85rem", color: "var(--gris-medio)" }}>{r.label}</span>
                      <span style={{ fontFamily: "'Barlow Condensed'", fontWeight: 700, fontSize: r.grande ? "1.2rem" : "0.95rem", color: r.color || "var(--blanco)" }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}

              <button className="btn btn-gold" style={{ width: "100%", justifyContent: "center", padding: "13px" }}
                onClick={handleAplicar} disabled={procesando || !preview}>
                {procesando ? "Procesando..." : `✅ Aplicar Pago Anual ${anio}`}
              </button>

              <p style={{ color: "var(--gris-medio)", fontSize: "0.78rem", marginTop: 10, lineHeight: 1.5 }}>
                ⚠️ Esto cancelará las cuotas mensuales pendientes del {anio} y registrará los 12 meses como pagados con el descuento aplicado.
              </p>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👈</div>
              <p style={{ color: "var(--gris-medio)" }}>Selecciona un socio para configurar su pago anual</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
