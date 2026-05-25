import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { Cupon } from '../services/cupones'
import type { Promocion } from '../services/promociones'

function fmt(iso: string) {
  const normalized = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(normalized).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function estadoCupon(c: Cupon): string {
  if (!c.activo) return 'Anulado'
  if (c.fechavencimiento && new Date(c.fechavencimiento) < new Date()) return 'Vencido'
  return 'Activo'
}

function addHeader(doc: jsPDF, title: string, info: string[]): number {
  const W = doc.internal.pageSize.getWidth()

  // Fondo oscuro del encabezado
  doc.setFillColor(15, 15, 16)
  doc.rect(0, 0, W, 38, 'F')

  // Línea de acento amarilla
  doc.setFillColor(232, 255, 71)
  doc.rect(0, 38, W, 2.5, 'F')

  // Etiqueta G4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(161, 161, 170)
  doc.text('G4 · MARKETING', 14, 12)

  // Nombre del sistema
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text('MundoDigital', 14, 24)

  // Subtítulo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(161, 161, 170)
  doc.text('Sistema de Marketing y Fidelización', 14, 31)

  // Fecha de generación (esquina derecha)
  const now = new Date().toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.setFontSize(8)
  doc.text(`Generado: ${now}`, W - 14, 31, { align: 'right' })

  // Título del reporte
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text(title, 14, 52)

  // Info de filtros
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 100, 110)
  doc.text(info.join('   ·   '), 14, 59)

  return 66
}

export function exportCuponesPdf(
  sorted: Cupon[],
  filtros: { search: string; estado: string; desde: Date | null; hasta: Date | null }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const infoItems: string[] = [`${sorted.length} cupón${sorted.length !== 1 ? 'es' : ''}`]
  if (filtros.search) infoItems.push(`Búsqueda: "${filtros.search}"`)
  if (filtros.estado !== 'todos') infoItems.push(`Estado: ${filtros.estado}`)
  if (filtros.desde) infoItems.push(`Vence desde: ${filtros.desde.toLocaleDateString('es-AR')}`)
  if (filtros.hasta) infoItems.push(`Vence hasta: ${filtros.hasta.toLocaleDateString('es-AR')}`)

  const startY = addHeader(doc, 'Listado de Cupones', infoItems)

  autoTable(doc, {
    startY,
    head: [['ID', 'Código', 'Descuento', 'Cliente', 'Promoción', 'Vencimiento', 'Estado']],
    body: sorted.map(c => [
      `#${c.idcupon}`,
      c.codigo,
      `${c.descuentoporcentaje}%`,
      c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : 'General',
      c.promociones?.nombre ?? '-',
      c.fechavencimiento ? fmt(c.fechavencimiento) : '-',
      estadoCupon(c),
    ]),
    headStyles: {
      fillColor: [35, 35, 40],
      textColor: [161, 161, 170],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 248],
    },
    columnStyles: {
      0: { cellWidth: 16, fontStyle: 'bold', textColor: [100, 100, 110] },
      1: { cellWidth: 34, fontStyle: 'bold', textColor: [55, 138, 221] },
      2: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 24, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      if (data.column.index === 6) {
        const v = String(data.cell.raw)
        if (v === 'Activo') data.cell.styles.textColor = [22, 163, 74]
        else if (v === 'Vencido') data.cell.styles.textColor = [180, 120, 0]
        else data.cell.styles.textColor = [120, 120, 128]
      }
    },
  })

  doc.save(`cupones_${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function exportPromocionesPdf(
  sorted: Promocion[],
  filtros: { search: string; desde: Date | null; hasta: Date | null }
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const infoItems: string[] = [`${sorted.length} promoción${sorted.length !== 1 ? 'es' : ''}`]
  if (filtros.search) infoItems.push(`Búsqueda: "${filtros.search}"`)
  if (filtros.desde) infoItems.push(`Desde: ${filtros.desde.toLocaleDateString('es-AR')}`)
  if (filtros.hasta) infoItems.push(`Hasta: ${filtros.hasta.toLocaleDateString('es-AR')}`)

  const startY = addHeader(doc, 'Listado de Promociones', infoItems)

  autoTable(doc, {
    startY,
    head: [['ID', 'Nombre', 'Descripción', 'Desde', 'Hasta', 'Tipo', 'Estado']],
    body: sorted.map(p => [
      `#${p.idPromocion}`,
      p.nombre,
      p.descripcion || '-',
      fmt(p.fechaDesde),
      fmt(p.fechaHasta),
      p.esGeneral ? 'General' : 'Por producto',
      p.activa
        ? (p.esAplicable ? 'Activa · Aplicable' : 'Activa · No aplicable')
        : 'Inactiva',
    ]),
    headStyles: {
      fillColor: [35, 35, 40],
      textColor: [161, 161, 170],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 248],
    },
    columnStyles: {
      0: { cellWidth: 14, fontStyle: 'bold', textColor: [100, 100, 110] },
      1: { cellWidth: 48 },
      2: { cellWidth: 70, textColor: [100, 100, 110] },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 28, halign: 'center' },
      6: { cellWidth: 34 },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      if (data.column.index === 6) {
        const v = String(data.cell.raw)
        if (v.startsWith('Activa')) data.cell.styles.textColor = [22, 163, 74]
        else data.cell.styles.textColor = [120, 120, 128]
      }
      if (data.column.index === 5) {
        const v = String(data.cell.raw)
        if (v === 'General') data.cell.styles.textColor = [180, 120, 0]
        else data.cell.styles.textColor = [55, 138, 221]
      }
    },
  })

  doc.save(`promociones_${new Date().toISOString().slice(0, 10)}.pdf`)
}
