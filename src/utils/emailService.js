// src/utils/emailService.js
// Servicio de emails usando EmailJS (gratis hasta 200 emails/mes)
// Registrate en https://emailjs.com
// Necesitás: SERVICE_ID, TEMPLATE_IDs y PUBLIC_KEY

const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "";

const TEMPLATES = {
  cuotaPendiente: process.env.REACT_APP_EMAILJS_TEMPLATE_CUOTA || "",
  pagoAprobado: process.env.REACT_APP_EMAILJS_TEMPLATE_APROBADO || "",
  pagoRechazado: process.env.REACT_APP_EMAILJS_TEMPLATE_RECHAZADO || "",
  cuotaVencida: process.env.REACT_APP_EMAILJS_TEMPLATE_VENCIDA || "",
};

const sendEmail = async (templateId, params) => {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_PUBLIC_KEY || !templateId) {
    console.warn("EmailJS no configurado");
    return false;
  }
  try {
    const { default: emailjs } = await import("@emailjs/browser");
    await emailjs.send(EMAILJS_SERVICE_ID, templateId, params, EMAILJS_PUBLIC_KEY);
    return true;
  } catch (err) {
    console.error("Error enviando email:", err);
    return false;
  }
};

export const emailCuotaPendiente = (socio, monto, concepto, fechaVencimiento) =>
  sendEmail(TEMPLATES.cuotaPendiente, {
    to_name: `${socio.nombre} ${socio.apellido}`,
    to_email: socio.email,
    concepto, monto: `$${Number(monto).toFixed(2)}`,
    fecha_vencimiento: fechaVencimiento || "No especificada",
    club: "Yaguares RC",
  });

export const emailPagoAprobado = (socio, monto, concepto) =>
  sendEmail(TEMPLATES.pagoAprobado, {
    to_name: `${socio.nombre} ${socio.apellido}`,
    to_email: socio.email,
    concepto, monto: `$${Number(monto).toFixed(2)}`,
    fecha_aprobacion: new Date().toLocaleDateString("es-EC"),
    club: "Yaguares RC",
  });

export const emailPagoRechazado = (socio, monto, concepto, motivo) =>
  sendEmail(TEMPLATES.pagoRechazado, {
    to_name: `${socio.nombre} ${socio.apellido}`,
    to_email: socio.email,
    concepto, monto: `$${Number(monto).toFixed(2)}`,
    motivo_rechazo: motivo, club: "Yaguares RC",
  });
