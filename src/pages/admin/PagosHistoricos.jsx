// src/pages/admin/PagosHistoricos.jsx
import React, { useEffect, useState } from "react";
import { db } from "../../config/firebase";
import { collection, getDocs, addDoc, query, where, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PagosHistoricos() {
  const [socios, setSocios] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    socioId: "", mes: 0, anio: new Date().getFullYear() - 1,
    monto: "", metodoPago: "efectivo", nota: ""
  });
  const [socioSel, setSocioSel] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [pagosCreados, setPagosCreados] = useState([]);

  useEffect(() => { loadSocios(); }, []);

  const loadSocios = async () => {
    const snap = await getDocs(collection(db, "socios"));
    setSocios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const seleccionarSocio = (s) => {
    setSocioSel(s);
    setForm(f => ({ ...f, socioId: s.uid || s.id, monto: s.cuotaMensual || "" }));
  };

  const handleGuardar = async () => {
    if (!socioSel || !form.monto) { toast.error("Selecciona un socio y el monto"); return; }
    setGuardando(true);
    try {
      const mesNombre = `${MESES[form.mes]} ${form.anio}`;
      // Verificar si ya existe
      const existe = await getDocs(query(
        collection(db, "pagos"),
        where("socioId", "==", form.socioId),
        where("concepto", "==", `Cuota mensual - ${mesNombre}`)
      ));
      if (existe.size > 0) {
        toast.error(`Ya existe un pago para ${mesNombre}`);
        setGuardando(false);
        return;
      }

      await addDoc(collection(db, "pagos"), {
        socioId: form.socioId,
        socioNombre: `${socioSel.nombre} ${socioSel.apellido}`,
        socioEmail: socioSel.email,
        concepto: `Cuota mensual - ${mesNombre}`,
        monto: Number(form.monto),
        tipo: "mensual",
        estado: "aprobado",
        metodoPago: form.metodoPago,
        fechaPago: new Date(`${form.anio}-${String(form.mes + 1).padStart(2, "0")}-01`).toISOString(),
        notaAdmin: form.nota || `Pago histórico registrado manualmente`,
        esHistorico: true,
        creadoEn: serverTimestamp(),
      });

      const nuevo = { socio: `${socioSel.nombre} ${socioSel.apellido}`, mes: mesNombre, monto: form.monto };
      setPagosCreados(p => [nuevo, ...p]);
      toast.success(`✅ Pago de ${mesNombre} registrado para ${socioSel.nombre}`);
      setForm(f => ({ ...f, nota: "" }));
    } catch (err) { toast.error("Error: " + err.message); }
    finally { setGuardando(false); }
  };

  const filtered = socios.filter(s =>
    `${s.nombre} ${s.apellido}`.toLowerCase().includes(search.toLowerCase())
  );

  const anioActual = new Date().getFullYear();
  const anios = [anioActual, anioActual - 1, anioActual - 2];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "2.5rem" }}>PAGOS HISTÓRICOS</h1>
        <p style={{ color: "var(--gris-medio)", marginTop: 4 }}>Registra pagos de meses anteriores para completar el historial</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20 }}>
        {/* Lista socios */}
        <div>
          <input type="text" placeholder="Buscar socio..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 10 }} />
          <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map(s => (
              <div key={s.id} onClick={() => seleccionarSocio(s)} className="card"
                style={{
                  cursor: "pointer", padding: 12,
                  borderLeft: socioSel?.id === s.id ? "3px solid var(--verde-claro)" : "3px solid transparent",
                  background: socioSel?.id === s.id ? "var(--verde-oscuro)" : "var(--gris-oscuro)"
                }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{s.nombre} {s.apellido}</div>
                <div style={{ color: "var(--gris-medio)", fontSize: "0.75rem" }}>{s.categoria} · ${s.cuotaMensual}/mes</div>
              </div>
            ))}
          </div>
        </div>

        {/* Formulario */}
        <div>
          {socioSel ? (
            <div className="card" style={{ borderLeft: "3px solid var(--verde)" }}>
              <h3 style={{ fontSize: "1.2rem", marginBottom: 20 }}>
                📋 Registrar pago de {socioSel.nombre} {socioSel.apellido}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Mes</label>
                  <select value={form.mes} onChange={e => setForm(f => ({ ...f, mes: Number(e.target.value) }))}>
                    {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Año</label>
                  <select value={form.anio} onChange={e => setForm(f => ({ ...f, anio: Number(e.target.value) }))}>
                    {anios.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Monto ($)</label>
                  <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Método de pago</label>
                  <select value={form.metodoPago} onChange={e => setForm(f => ({ ...f, metodoPago: e.target.value }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="deposito">Depósito</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: 5, color: "var(--gris-medio)" }}>Nota (opcional)</label>
                  <input type="text" value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} placeholder="Observación..." />
                </div>
              </div>

              <div style={{ background: "#1a2a1a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ color: "var(--gris-medio)", fontSize: "0.82rem" }}>
                  Se registrará: <strong style={{ color: "var(--blanco)" }}>Cuota mensual - {MESES[form.mes]} {form.anio}</strong> por <strong style={{ color: "var(--dorado)" }}>${form.monto}</strong> como <strong style={{ color: "var(--verde-claro)" }}>Aprobado</strong>
                </div>
              </div>

              <button className="btn btn-primary" onClick={handleGuardar} disabled={guardando} style={{ width: "100%", justifyContent: "center" }}>
                {guardando ? "Registrando..." : "✅ Registrar Pago Histórico"}
              </button>
            </div>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👈</div>
              <p style={{ color: "var(--gris-medio)" }}>Selecciona un socio para registrar su pago histórico</p>
            </div>
          )}

          {/* Pagos creados en esta sesión */}
          {pagosCreados.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 12, fontSize: "1rem", color: "var(--verde-claro)" }}>✅ Registrados en esta sesión</h4>
              {pagosCreados.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e1e1e", fontSize: "0.85rem" }}>
                  <span>{p.socio} — {p.mes}</span>
                  <span style={{ color: "var(--dorado)" }}>${p.monto}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
