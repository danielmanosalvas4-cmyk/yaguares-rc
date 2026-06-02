// src/utils/exportExcel.js
// Exporta datos a Excel usando SheetJS

export const exportarPagosExcel = async (pagos, titulo = "Pagos_Yaguares_RC") => {
  try {
    const XLSX = await import("xlsx");
    const datos = pagos.map(p => ({
      "Socio": p.socioNombre || "",
      "Email": p.socioEmail || "",
      "Concepto": p.concepto || "",
      "Tipo": p.tipo === "extraordinario" ? "Extraordinario" : "Mensual",
      "Monto ($)": Number(p.monto || 0).toFixed(2),
      "Estado": p.estado === "aprobado" ? "Aprobado" : p.estado === "pendiente" ? "Pendiente" : p.estado === "revision" ? "En Revisión" : p.estado === "rechazado" ? "Rechazado" : p.estado || "",
      "Método de Pago": p.metodoPago === "comprobante" ? "Comprobante" : p.metodoPago === "tarjeta" ? "Tarjeta" : "—",
      "Fecha Pago": p.fechaPago ? new Date(p.fechaPago).toLocaleDateString("es-EC") : "—",
      "Fecha Vencimiento": p.fechaVencimiento ? new Date(p.fechaVencimiento).toLocaleDateString("es-EC") : "—",
      "Nota Admin": p.notaAdmin || "",
    }));

    const ws = XLSX.utils.json_to_sheet(datos);

    // Ancho de columnas
    ws["!cols"] = [
      { wch: 25 }, { wch: 28 }, { wch: 30 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");

    // Hoja resumen
    const aprobados = pagos.filter(p => p.estado === "aprobado");
    const pendientes = pagos.filter(p => p.estado === "pendiente");
    const resumen = [
      { "Resumen": "Total pagos", "Valor": pagos.length },
      { "Resumen": "Pagos aprobados", "Valor": aprobados.length },
      { "Resumen": "Pagos pendientes", "Valor": pendientes.length },
      { "Resumen": "Total recaudado ($)", "Valor": aprobados.reduce((a, p) => a + Number(p.monto || 0), 0).toFixed(2) },
      { "Resumen": "Total por cobrar ($)", "Valor": pendientes.reduce((a, p) => a + Number(p.monto || 0), 0).toFixed(2) },
      { "Resumen": "Fecha de exportación", "Valor": new Date().toLocaleDateString("es-EC") },
    ];
    const wsResumen = XLSX.utils.json_to_sheet(resumen);
    wsResumen["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${titulo}_${fecha}.xlsx`);
    return true;
  } catch (err) {
    console.error("Error exportando Excel:", err);
    return false;
  }
};

export const exportarSociosExcel = async (socios) => {
  try {
    const XLSX = await import("xlsx");
    const datos = socios.map(s => ({
      "Nombre": s.nombre || "",
      "Apellido": s.apellido || "",
      "Email": s.email || "",
      "Teléfono": s.telefono || "",
      "Cédula": s.cedula || "",
      "Categoría": s.categoria || "",
      "Cuota Mensual ($)": Number(s.cuotaMensual || 0).toFixed(2),
      "Estado": s.activo ? "Activo" : "Inactivo",
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    ws["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 15 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Socios");
    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Socios_Yaguares_RC_${fecha}.xlsx`);
    return true;
  } catch (err) {
    console.error("Error exportando socios:", err);
    return false;
  }
};
