// functions/index.js
// Firebase Cloud Functions — se ejecutan en el servidor automáticamente
// Deploy: firebase deploy --only functions

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────
// FUNCIÓN 1: Generar cuotas el día 1 de cada mes a las 8am (UTC-5 Ecuador)
// ─────────────────────────────────────────────
exports.generarCuotasMensuales = functions.pubsub
  .schedule("0 13 1 * *") // 8am Ecuador = 13:00 UTC
  .timeZone("America/Guayaquil")
  .onRun(async (context) => {
    const ahora = new Date();
    const mesActual = ahora.toLocaleString("es-EC", { month: "long", year: "numeric", timeZone: "America/Guayaquil" });
    const fechaVencimiento = new Date(ahora.getFullYear(), ahora.getMonth(), 15).toISOString(); // Vence día 15

    console.log(`Generando cuotas para: ${mesActual}`);

    const sociosSnap = await db.collection("socios").where("activo", "==", true).get();
    const batch = db.batch();
    let creados = 0;
    let omitidos = 0;

    for (const socioDoc of sociosSnap.docs) {
      const socio = socioDoc.data();
      // Verificar si ya existe cuota este mes
      const existe = await db.collection("pagos")
        .where("socioId", "==", socio.uid || socioDoc.id)
        .where("concepto", "==", `Cuota mensual - ${mesActual}`)
        .where("tipo", "==", "mensual")
        .get();

      if (existe.size > 0) { omitidos++; continue; }

      const pagoRef = db.collection("pagos").doc();
      batch.set(pagoRef, {
        socioId: socio.uid || socioDoc.id,
        socioNombre: `${socio.nombre} ${socio.apellido}`,
        socioEmail: socio.email,
        concepto: `Cuota mensual - ${mesActual}`,
        monto: socio.cuotaMensual || 0,
        tipo: "mensual",
        estado: "pendiente",
        metodoPago: null,
        comprobanteUrl: null,
        fechaVencimiento,
        creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        generadoAutomaticamente: true,
      });
      creados++;
    }

    await batch.commit();
    console.log(`✅ Cuotas generadas: ${creados} nuevas, ${omitidos} ya existían`);
    return null;
  });

// ─────────────────────────────────────────────
// FUNCIÓN 2: Marcar cuotas como vencidas todos los días a medianoche
// ─────────────────────────────────────────────
exports.marcarCuotasVencidas = functions.pubsub
  .schedule("0 5 * * *") // Medianoche Ecuador = 5am UTC
  .timeZone("America/Guayaquil")
  .onRun(async (context) => {
    const hoy = new Date().toISOString();
    const pagosSnap = await db.collection("pagos")
      .where("estado", "==", "pendiente")
      .get();

    const batch = db.batch();
    let marcados = 0;

    for (const pagoDoc of pagosSnap.docs) {
      const pago = pagoDoc.data();
      if (pago.fechaVencimiento && pago.fechaVencimiento < hoy) {
        batch.update(pagoDoc.ref, { estado: "vencido" });
        marcados++;
      }
    }

    if (marcados > 0) await batch.commit();
    console.log(`✅ ${marcados} cuotas marcadas como vencidas`);
    return null;
  });

// ─────────────────────────────────────────────
// FUNCIÓN 3: Notificar cuotas próximas a vencer (3 días antes)
// ─────────────────────────────────────────────
exports.notificarCuotasProximas = functions.pubsub
  .schedule("0 14 * * *") // 9am Ecuador
  .timeZone("America/Guayaquil")
  .onRun(async (context) => {
    const en3dias = new Date();
    en3dias.setDate(en3dias.getDate() + 3);
    const fechaLimite = en3dias.toISOString().split("T")[0];

    const pagosSnap = await db.collection("pagos")
      .where("estado", "==", "pendiente")
      .get();

    let notificados = 0;
    for (const pagoDoc of pagosSnap.docs) {
      const pago = pagoDoc.data();
      if (pago.fechaVencimiento?.startsWith(fechaLimite)) {
        // Log para verificar — conectar con EmailJS o SendGrid en producción
        console.log(`Recordatorio: ${pago.socioEmail} — ${pago.concepto} vence en 3 días`);
        notificados++;
      }
    }

    console.log(`✅ ${notificados} recordatorios enviados`);
    return null;
  });
