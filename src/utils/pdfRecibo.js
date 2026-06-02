// src/utils/pdfRecibo.js
// Genera recibo PDF usando jsPDF (sin dependencias externas)

export const generarReciboPDF = async (pago, socio) => {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const verde = [26, 107, 58];
    const negro = [13, 13, 13];
    const gris = [100, 100, 100];
    const blanco = [245, 245, 240];

    // Header verde
    doc.setFillColor(...verde);
    doc.rect(0, 0, 210, 45, "F");

    // Logo/título
    doc.setTextColor(...blanco);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("YAGUARES RC", 20, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CLUB DE RUGBY · GUAYAQUIL, ECUADOR", 20, 30);
    doc.text("Sistema de Gestión de Cobros", 20, 37);

    // RECIBO badge
    doc.setFillColor(201, 168, 76);
    doc.rect(150, 10, 45, 25, "F");
    doc.setTextColor(...negro);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO", 172, 22, { align: "center" });
    doc.setFontSize(9);
    doc.text("DE PAGO", 172, 29, { align: "center" });

    // Número de recibo
    doc.setTextColor(...gris);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`N° ${pago.id?.substring(0, 8).toUpperCase()}`, 172, 40, { align: "center" });

    // Línea separadora
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.5);
    doc.line(20, 52, 190, 52);

    // Info del socio
    doc.setTextColor(...negro);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS DEL SOCIO", 20, 62);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const infoSocio = [
      ["Nombre:", `${socio?.nombre || pago.socioNombre} ${socio?.apellido || ""}`],
      ["Email:", pago.socioEmail || socio?.email || "—"],
      ["Cédula:", socio?.cedula || "—"],
      ["Categoría:", socio?.categoria || "—"],
    ];
    infoSocio.forEach(([label, value], i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...gris);
      doc.text(label, 20, 72 + i * 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...negro);
      doc.text(value, 55, 72 + i * 8);
    });

    // Línea
    doc.setDrawColor(230, 230, 230);
    doc.line(20, 108, 190, 108);

    // Detalle del pago
    doc.setTextColor(...negro);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DEL PAGO", 20, 118);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const infoPago = [
      ["Concepto:", pago.concepto || "—"],
      ["Tipo:", pago.tipo === "extraordinario" ? "Cobro Extraordinario" : "Cuota Mensual"],
      ["Método de pago:", pago.metodoPago === "comprobante" ? "Depósito / Transferencia" : pago.metodoPago === "tarjeta" ? "Tarjeta de Débito" : "—"],
      ["Fecha de pago:", pago.fechaAprobacion ? new Date(pago.fechaAprobacion).toLocaleDateString("es-EC") : new Date().toLocaleDateString("es-EC")],
      ["Aprobado por:", "Yaguares RC — Administración"],
    ];
    infoPago.forEach(([label, value], i) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...gris);
      doc.text(label, 20, 128 + i * 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...negro);
      doc.text(String(value), 70, 128 + i * 8);
    });

    // Caja de monto
    doc.setFillColor(...verde);
    doc.roundedRect(20, 175, 170, 30, 4, 4, "F");
    doc.setTextColor(...blanco);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL PAGADO", 105, 186, { align: "center" });
    doc.setFontSize(22);
    doc.text(`$${Number(pago.monto).toFixed(2)}`, 105, 198, { align: "center" });

    // Estado aprobado
    doc.setFillColor(15, 48, 32);
    doc.roundedRect(70, 212, 70, 12, 3, 3, "F");
    doc.setTextColor(82, 190, 128);
    doc.setFontSize(10);
    doc.text("✓ PAGO APROBADO", 105, 220, { align: "center" });

    // Footer
    doc.setDrawColor(...verde);
    doc.setLineWidth(0.5);
    doc.line(20, 255, 190, 255);
    doc.setTextColor(...gris);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Este recibo es un comprobante válido de pago emitido por Yaguares RC.", 105, 262, { align: "center" });
    doc.text("Guayaquil, Ecuador · yaguares.com · Sistema de Gestión de Cobros v1.0", 105, 268, { align: "center" });
    doc.text(`Generado el ${new Date().toLocaleDateString("es-EC")} a las ${new Date().toLocaleTimeString("es-EC")}`, 105, 274, { align: "center" });

    // Descargar
    const nombreArchivo = `Recibo_${pago.socioNombre?.replace(/ /g, "_")}_${pago.id?.substring(0, 6)}.pdf`;
    doc.save(nombreArchivo);
    return true;
  } catch (err) {
    console.error("Error generando PDF:", err);
    return false;
  }
};
