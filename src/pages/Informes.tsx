import React, { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { api } from '../services/api'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoStock = 'Disponible' | 'Critico' | 'Sin Stock'

interface ProductoStock {
  idProducto: number
  nombre: string
  precio: number
  stockActual: number
  puntoReposicion: number
  estadoStock: EstadoStock
}

interface SaldoCliente {
  cliente: { idcliente: number; nombre: string; apellido: string; email: string }
  saldo: number
}

interface CuponAPI {
  idcupon: number
  activo: boolean
  promociones: { idpromocion: number; nombre: string } | null
}

interface PromocionAPI {
  idpromocion: number
  nombre: string
  activa: boolean
  fechadesde: string
  fechahasta: string
}

interface VentaFiltrada {
  idventa: number
  idcliente: number
  estado: string
  subtotal: number
  descuento: number
  total: number
  fechaventa: string
}

interface PuntoMovimiento {
  idpuntoscliente: number
  idcliente: number
  idventa: number | null
  puntosotorgados: number
  concepto: string
  fecha: string
}

// ─── Configuración de períodos (tab Resumen) ──────────────────────────────────

interface PeriodoConfig {
  label: string
  descripcion: string
  topClientes: number
  umbrales: { ratio: number; desc: number }[]
  sinReposicion: { stock: number; desc: number }[]
}

const PERIODOS: Record<string, PeriodoConfig> = {
  '7d': {
    label: '7 días',
    descripcion: 'Solo exceso crítico — acción inmediata',
    topClientes: 5,
    umbrales: [{ ratio: 5, desc: 30 }, { ratio: 3, desc: 20 }],
    sinReposicion: [{ stock: 80, desc: 25 }],
  },
  '1m': {
    label: '1 mes',
    descripcion: 'Exceso moderado — ventana de acción razonable',
    topClientes: 8,
    umbrales: [{ ratio: 5, desc: 30 }, { ratio: 3, desc: 20 }, { ratio: 2, desc: 10 }],
    sinReposicion: [{ stock: 50, desc: 25 }, { stock: 20, desc: 15 }],
  },
  '3m': {
    label: '3 meses',
    descripcion: 'Visión trimestral — más productos en el radar',
    topClientes: 10,
    umbrales: [{ ratio: 3, desc: 30 }, { ratio: 2, desc: 20 }, { ratio: 1.5, desc: 15 }, { ratio: 1.2, desc: 10 }],
    sinReposicion: [{ stock: 30, desc: 25 }, { stock: 15, desc: 15 }, { stock: 8, desc: 10 }],
  },
  '1a': {
    label: '1 año',
    descripcion: 'Planificación anual — radar amplio de inventario',
    topClientes: 12,
    umbrales: [{ ratio: 2, desc: 30 }, { ratio: 1.5, desc: 20 }, { ratio: 1.2, desc: 15 }, { ratio: 1, desc: 10 }],
    sinReposicion: [{ stock: 20, desc: 25 }, { stock: 10, desc: 15 }, { stock: 5, desc: 10 }],
  },
}

const PERIODO_KEYS = ['7d', '1m', '3m', '1a']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sugerirDescuento(p: ProductoStock, config: PeriodoConfig): number | null {
  if (p.estadoStock !== 'Disponible') return null
  if (p.puntoReposicion === 0) {
    for (const { stock, desc } of config.sinReposicion) {
      if (p.stockActual >= stock) return desc
    }
    return null
  }
  const ratio = p.stockActual / p.puntoReposicion
  for (const { ratio: umbral, desc } of config.umbrales) {
    if (ratio >= umbral) return desc
  }
  return null
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`
}

function defaultDesde(): string {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function defaultHasta(): string {
  return new Date().toISOString().slice(0, 10)
}

function groupByPeriod(ventas: VentaFiltrada[], desde: string, hasta: string) {
  const start = desde ? new Date(desde) : new Date(Date.now() - 30 * 86400000)
  const end = hasta ? new Date(hasta) : new Date()
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000)

  const getKey = (fecha: string): string => {
    const d = new Date(fecha)
    if (diffDays <= 31) return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    if (diffDays <= 91) {
      const weekStart = new Date(d)
      weekStart.setDate(d.getDate() - d.getDay())
      return `S${String(weekStart.getDate()).padStart(2, '0')}/${String(weekStart.getMonth() + 1).padStart(2, '0')}`
    }
    return `${d.toLocaleString('es-AR', { month: 'short' })} ${d.getFullYear()}`
  }

  const map: Record<string, { conDescuento: number; sinDescuento: number }> = {}
  ventas.forEach(v => {
    const key = getKey(v.fechaventa)
    if (!map[key]) map[key] = { conDescuento: 0, sinDescuento: 0 }
    if (Number(v.descuento) > 0) map[key].conDescuento++
    else map[key].sinDescuento++
  })

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([período, vals]) => ({ período, ...vals }))
}

// ─── Paletas ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#60a5fa', '#4ade80', '#a78bfa', '#fbbf24', '#f87171', '#34d399', '#fb923c', '#e879f9']
const DESCUENTO_COLOR: Record<number, string> = { 30: '#f87171', 25: '#fb923c', 20: '#fbbf24', 15: '#a3e635', 10: '#4ade80' }

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#16162a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      {label && <p style={{ color: '#888', marginBottom: 4, fontSize: 11 }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? '#fff', fontFamily: 'DM Mono, monospace', margin: 0 }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString('es-AR') : p.value}</strong>
        </p>
      ))}
    </div>
  )
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 20px 12px' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent ? 'var(--btn-bg)' : 'var(--text)', fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function EmptyChart({ msg }: { msg: string }) {
  return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{msg}</div>
}

const legendStyle = (value: string) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({
  productos, saldos, cupones, periodo, setPeriodo,
}: {
  productos: ProductoStock[]
  saldos: SaldoCliente[]
  cupones: CuponAPI[]
  periodo: string
  setPeriodo: (p: string) => void
}) {
  const config = PERIODOS[periodo]

  const conSugerencia = productos
    .map(p => ({ ...p, descuento: sugerirDescuento(p, config) }))
    .filter(p => p.descuento !== null)
    .sort((a, b) => {
      const rA = a.puntoReposicion > 0 ? a.stockActual / a.puntoReposicion : a.stockActual
      const rB = b.puntoReposicion > 0 ? b.stockActual / b.puntoReposicion : b.stockActual
      return rB - rA
    })

  const dataExceso = conSugerencia.slice(0, 10).map(p => ({
    nombre: p.nombre.length > 16 ? p.nombre.slice(0, 16) + '…' : p.nombre,
    ratio: p.puntoReposicion > 0 ? Math.round((p.stockActual / p.puntoReposicion) * 10) / 10 : p.stockActual,
    descuento: p.descuento,
    color: DESCUENTO_COLOR[p.descuento!] ?? '#4ade80',
  }))

  const dataClientes = [...saldos]
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, config.topClientes)
    .map(s => ({ nombre: s.cliente.nombre, saldo: s.saldo }))

  const agrupado: Record<string, number> = {}
  cupones.forEach(c => {
    const key = c.promociones?.nombre ?? 'Sin promoción'
    agrupado[key] = (agrupado[key] ?? 0) + 1
  })
  const dataCupones = Object.entries(agrupado).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  const nivelCount: Record<string, number> = {}
  productos.forEach(p => {
    const d = sugerirDescuento(p, config)
    const key = d ? `${d}% off` : 'Sin necesidad'
    nivelCount[key] = (nivelCount[key] ?? 0) + 1
  })
  const nivelOrder = ['30% off', '25% off', '20% off', '15% off', '10% off', 'Sin necesidad']
  const dataOportunidades = nivelOrder
    .filter(k => nivelCount[k] > 0)
    .map(k => ({ name: k, value: nivelCount[k], color: k === 'Sin necesidad' ? '#4b5563' : DESCUENTO_COLOR[parseInt(k)] ?? '#4ade80' }))

  const totalPuntos = saldos.reduce((s, c) => s + c.saldo, 0)

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          <StatCard label="PRODUCTOS EN CATÁLOGO" value={productos.length} sub="total de productos" />
          <StatCard label="CON SUGERENCIA" value={conSugerencia.length} sub={`detectados en ${config.label}`} accent />
          <StatCard label="CUPONES ACTIVOS" value={cupones.length} sub="en circulación" />
          <StatCard label="PUNTOS EMITIDOS" value={totalPuntos.toLocaleString('es-AR')} sub="total acumulado" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>PERÍODO DE ANÁLISIS</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {PERIODO_KEYS.map(k => (
              <button key={k} onClick={() => setPeriodo(k)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                fontFamily: 'DM Mono, monospace', fontWeight: 600, transition: 'all 0.15s',
                background: periodo === k ? 'var(--btn-bg)' : 'transparent',
                color: periodo === k ? 'var(--btn-text)' : 'var(--text-muted)',
                border: periodo === k ? 'none' : '1px solid var(--border)',
              }}>
                {PERIODOS[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <ChartCard title="Productos con mayor exceso de stock" sub={`Ratio mínimo ${config.umbrales[config.umbrales.length - 1]?.ratio}× · ${conSugerencia.length} en radar`}>
          {dataExceso.length === 0 ? <EmptyChart msg="No hay productos con exceso en este período" /> : (
            <ResponsiveContainer key={periodo} width="100%" height={220}>
              <BarChart data={dataExceso} margin={{ top: 4, right: 8, left: -12, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#888' }} angle={-38} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="ratio" name="Ratio stock/reposición" radius={[4, 4, 0, 0]} isAnimationActive>
                  {dataExceso.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Top clientes por puntos acumulados" sub={`Top ${config.topClientes} clientes · ${config.label}`}>
          {dataClientes.length === 0 ? <EmptyChart msg="No hay puntos registrados" /> : (
            <ResponsiveContainer key={periodo} width="100%" height={220}>
              <BarChart data={dataClientes} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#ccc' }} width={72} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="saldo" name="Puntos" fill="#60a5fa" radius={[0, 4, 4, 0]} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Cupones activos por promoción" sub={`${cupones.length} cupones en circulación`}>
          {dataCupones.length === 0 ? <EmptyChart msg="No hay cupones activos" /> : (
            <ResponsiveContainer key={periodo} width="100%" height={220}>
              <PieChart>
                <Pie data={dataCupones} cx="50%" cy="42%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name" isAnimationActive>
                  {dataCupones.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<TooltipCustom />} />
                <Legend formatter={legendStyle} iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Oportunidades de descuento detectadas" sub={`Distribución por nivel de urgencia · ${config.label}`}>
          <ResponsiveContainer key={periodo} width="100%" height={220}>
            <PieChart>
              <Pie data={dataOportunidades} cx="50%" cy="42%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name" isAnimationActive
                label={({ percent }) => percent > 0.05 ? `${Math.round(percent * 100)}%` : ''}
                labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}>
                {dataOportunidades.map(e => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip content={<TooltipCustom />} />
              <Legend formatter={legendStyle} iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {conSugerencia.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Detalle de sugerencias · {config.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>Los descuentos son sugeridos · crear la promo desde Promociones</div>
            </div>
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(232,255,71,0.08)', color: 'var(--btn-bg)', border: '1px solid rgba(232,255,71,0.2)' }}>
              {conSugerencia.length} productos
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Producto', 'Stock actual', 'Pto. reposición', 'Ratio', 'Descuento sugerido'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {conSugerencia.map((p, i) => {
                const ratio = p.puntoReposicion > 0 ? (p.stockActual / p.puntoReposicion).toFixed(1) : '—'
                const color = DESCUENTO_COLOR[p.descuento!] ?? '#4ade80'
                return (
                  <tr key={p.idProducto} style={{ borderBottom: i < conSugerencia.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{p.nombre}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--text)' }}>{p.stockActual.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)' }}>{p.puntoReposicion || '—'}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--text-secondary)' }}>{ratio}×</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'DM Mono, monospace', fontWeight: 700, background: `${color}18`, color, border: `1px solid ${color}40` }}>
                        {p.descuento}% off
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── Tab: Reporte combinado ───────────────────────────────────────────────────

function TabReporte({ saldos, cupones, promociones }: {
  saldos: SaldoCliente[]
  cupones: CuponAPI[]
  promociones: PromocionAPI[]
}) {
  const [fechaDesde, setFechaDesde] = useState(defaultDesde)
  const [fechaHasta, setFechaHasta] = useState(defaultHasta)
  const [idCliente, setIdCliente] = useState('')
  const [estadoPromo, setEstadoPromo] = useState<'todas' | 'vigente' | 'vencida'>('todas')

  const [ventas, setVentas] = useState<VentaFiltrada[]>([])
  const [puntosPorVenta, setPuntosPorVenta] = useState<Map<number, number>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [yaConsultado, setYaConsultado] = useState(false)

  const clienteNombre = new Map(saldos.map(s => [s.cliente.idcliente, `${s.cliente.nombre} ${s.cliente.apellido}`]))

  const aplicar = useCallback(async () => {
    setLoading(true)
    setError('')
    setYaConsultado(true)

    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('fechaDesde', fechaDesde)
      if (fechaHasta) params.set('fechaHasta', fechaHasta)
      if (idCliente) params.set('idCliente', idCliente)

      const { data: result } = await api.get<{ data: VentaFiltrada[]; message?: string }>(`/ventas/filtrar?${params}`)
      const lista: VentaFiltrada[] = result.data ?? []
      setVentas(lista)

      if (lista.length === 0) {
        setPuntosPorVenta(new Map())
        return
      }

      const clientIds = [...new Set(lista.map(v => v.idcliente))]
      const historiales = await Promise.all(
        clientIds.map(id =>
          api.get<{ movimientos: PuntoMovimiento[] }>(`/puntos/cliente/${id}`)
            .then(r => ({ id, movimientos: r.data.movimientos ?? [] }))
            .catch(() => ({ id, movimientos: [] as PuntoMovimiento[] }))
        )
      )

      const map = new Map<number, number>()
      historiales.forEach(({ movimientos }) => {
        movimientos.forEach(m => {
          if (!m.idventa) return
          const fechaMov = new Date(m.fecha)
          if (fechaDesde && fechaMov < new Date(fechaDesde)) return
          if (fechaHasta && fechaMov > new Date(fechaHasta + 'T23:59:59')) return
          map.set(m.idventa, (map.get(m.idventa) ?? 0) + m.puntosotorgados)
        })
      })
      setPuntosPorVenta(map)
    } catch {
      setError('No se pudo obtener el reporte. Verificá la conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [fechaDesde, fechaHasta, idCliente])

  useEffect(() => { aplicar() }, [])

  const now = new Date()

  const promosEnPeriodo = promociones.filter(p => {
    const pDesde = new Date(p.fechadesde)
    const pHasta = new Date(p.fechahasta)
    const rDesde = fechaDesde ? new Date(fechaDesde) : new Date(0)
    const rHasta = fechaHasta ? new Date(fechaHasta) : new Date()
    return pDesde <= rHasta && pHasta >= rDesde
  }).filter(p => {
    if (estadoPromo === 'todas') return true
    const esVigente = p.activa && new Date(p.fechahasta) >= now
    return estadoPromo === 'vigente' ? esVigente : !esVigente
  })

  const totalDescuento = ventas.reduce((s, v) => s + Number(v.descuento), 0)
  const totalPuntosEnPeriodo = [...puntosPorVenta.values()].reduce((s, p) => s + p, 0)
  const ventasConDescuento = ventas.filter(v => Number(v.descuento) > 0).length

  const dataActividad = groupByPeriod(ventas, fechaDesde, fechaHasta)

  const puntosAgrupados: Record<string, number> = {}
  ventas.forEach(v => {
    const pts = puntosPorVenta.get(v.idventa) ?? 0
    if (pts === 0) return
    const nombre = clienteNombre.get(v.idcliente) ?? `Cliente #${v.idcliente}`
    puntosAgrupados[nombre] = (puntosAgrupados[nombre] ?? 0) + pts
  })
  const dataRankingPuntos = Object.entries(puntosAgrupados)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([nombre, pts]) => ({ nombre: nombre.split(' ')[0], pts }))

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 13,
    fontFamily: 'DM Mono, monospace', outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
    marginBottom: 4, display: 'block',
  }

  const chartKey = `${fechaDesde}-${fechaHasta}-${idCliente}`

  return (
    <>
      {/* Filtros */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>Filtros del reporte</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>DESDE</label>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>HASTA</label>
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CLIENTE</label>
            <select value={idCliente} onChange={e => setIdCliente(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
              <option value="">Todos los clientes</option>
              {saldos.map(s => (
                <option key={s.cliente.idcliente} value={s.cliente.idcliente}>
                  {s.cliente.nombre} {s.cliente.apellido}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>ESTADO PROMO</label>
            <select value={estadoPromo} onChange={e => setEstadoPromo(e.target.value as any)} style={{ ...inputStyle, minWidth: 140 }}>
              <option value="todas">Todas</option>
              <option value="vigente">Vigentes</option>
              <option value="vencida">Vencidas</option>
            </select>
          </div>
          <button onClick={aplicar} disabled={loading} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 600, background: 'var(--btn-bg)', color: 'var(--btn-text)', border: 'none',
            opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {loading ? 'Cargando…' : 'Aplicar filtros'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      {yaConsultado && !loading && ventas.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          No hay datos para los filtros aplicados
        </div>
      )}

      {ventas.length > 0 && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="VENTAS EN EL PERÍODO" value={ventas.length} sub={`${formatDate(fechaDesde)} — ${formatDate(fechaHasta)}`} />
            <StatCard label="DESCUENTOS APLICADOS" value={formatMoney(totalDescuento)} sub={`en ${ventasConDescuento} venta(s)`} accent />
            <StatCard label="PUNTOS OTORGADOS" value={totalPuntosEnPeriodo.toLocaleString('es-AR')} sub="en el período seleccionado" />
            <StatCard label="PROMOS EN PERÍODO" value={promosEnPeriodo.length} sub={estadoPromo === 'todas' ? 'vigentes y vencidas' : estadoPromo} />
          </div>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <ChartCard title="Actividad de campañas por período" sub="Ventas con y sin descuento aplicado">
              {dataActividad.length === 0 ? <EmptyChart msg="Sin datos para graficar" /> : (
                <ResponsiveContainer key={chartKey} width="100%" height={220}>
                  <BarChart data={dataActividad} margin={{ top: 4, right: 8, left: -12, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="período" tick={{ fontSize: 10, fill: '#888' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip content={<TooltipCustom />} />
                    <Legend formatter={legendStyle} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="conDescuento" name="Con descuento" fill="#4ade80" radius={[4, 4, 0, 0]} stackId="a" isAnimationActive />
                    <Bar dataKey="sinDescuento" name="Sin descuento" fill="#60a5fa" radius={[4, 4, 0, 0]} stackId="a" isAnimationActive />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Puntos acumulados por cliente" sub="Ranking en el período seleccionado">
              {dataRankingPuntos.length === 0 ? <EmptyChart msg="No hay movimientos de puntos en el período" /> : (
                <ResponsiveContainer key={`pts-${chartKey}`} width="100%" height={220}>
                  <BarChart data={dataRankingPuntos} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#ccc' }} width={68} />
                    <Tooltip content={<TooltipCustom />} />
                    <Bar dataKey="pts" name="Puntos" fill="#a78bfa" radius={[0, 4, 4, 0]} isAnimationActive />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Promociones en el período */}
          {promosEnPeriodo.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 20px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
                Promociones en el período · {promosEnPeriodo.length}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {promosEnPeriodo.map(p => {
                  const vigente = p.activa && new Date(p.fechahasta) >= now
                  return (
                    <div key={p.idpromocion} style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: vigente ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${vigente ? 'rgba(74,222,128,0.25)' : 'var(--border)'}`,
                      fontSize: 12,
                    }}>
                      <span style={{ color: vigente ? '#4ade80' : 'var(--text-muted)', fontWeight: 600 }}>{vigente ? '●' : '○'}</span>
                      <span style={{ marginLeft: 6, color: 'var(--text)' }}>{p.nombre}</span>
                      <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', fontSize: 10 }}>
                        {formatDate(p.fechadesde)} – {formatDate(p.fechahasta)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabla */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Detalle de ventas en el período</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
                "Descuento aplicado" incluye descuentos por promociones vigentes al momento de la venta
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'N° Venta', 'Fecha', 'Estado', 'Descuento aplicado', 'Puntos otorgados', 'Total'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v, i) => {
                    const nombre = clienteNombre.get(v.idcliente) ?? `Cliente #${v.idcliente}`
                    const puntos = puntosPorVenta.get(v.idventa)
                    const descPct = Number(v.subtotal) > 0 ? Math.round((Number(v.descuento) / Number(v.subtotal)) * 100) : 0
                    return (
                      <tr key={v.idventa} style={{ borderBottom: i < ventas.length - 1 ? '1px solid var(--border)' : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '11px 16px', color: 'var(--text)', fontWeight: 500, fontSize: 13 }}>{nombre}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--text-muted)', fontSize: 12 }}>#{v.idventa}</td>
                        <td style={{ padding: '11px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text)' }}>{formatDate(v.fechaventa)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>{v.estado}</span>
                        </td>
                        <td style={{ padding: '11px 16px' }}>
                          {Number(v.descuento) > 0 ? (
                            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#4ade80' }}>
                              {formatMoney(Number(v.descuento))} <span style={{ fontSize: 10, opacity: 0.7 }}>({descPct}%)</span>
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: puntos ? '#a78bfa' : 'var(--text-muted)', fontSize: 13 }}>
                          {puntos != null ? puntos.toLocaleString('es-AR') : '—'}
                        </td>
                        <td style={{ padding: '11px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                          {formatMoney(Number(v.total))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                    <td colSpan={4} style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                      TOTALES · {ventas.length} venta(s) · {cupones.length} cupón(es) activo(s)
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#4ade80', fontSize: 13 }}>{formatMoney(totalDescuento)}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: '#a78bfa', fontSize: 13 }}>{totalPuntosEnPeriodo.toLocaleString('es-AR')}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>
                      {formatMoney(ventas.reduce((s, v) => s + Number(v.total), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function InformesPage() {
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [saldos, setSaldos] = useState<SaldoCliente[]>([])
  const [cupones, setCupones] = useState<CuponAPI[]>([])
  const [promociones, setPromociones] = useState<PromocionAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState<string>('1m')
  const [tab, setTab] = useState<'resumen' | 'reporte'>('resumen')

  useEffect(() => {
    Promise.all([
      api.get<ProductoStock[]>('/productos/stock'),
      api.get<SaldoCliente[]>('/puntos'),
      api.get<CuponAPI[]>('/cupones'),
      api.get<PromocionAPI[]>('/promociones'),
    ])
      .then(([{ data: prod }, { data: sal }, { data: cup }, { data: prom }]) => {
        setProductos(prod)
        setSaldos(sal)
        setCupones(cup)
        setPromociones(prom)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando reportes...</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>Reportes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Análisis de stock, puntos, promociones y campañas de fidelización
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
          {(['resumen', 'reporte'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 18px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              fontWeight: 600, transition: 'all 0.15s', border: 'none',
              background: tab === t ? 'var(--btn-bg)' : 'transparent',
              color: tab === t ? 'var(--btn-text)' : 'var(--text-muted)',
            }}>
              {t === 'resumen' ? 'Resumen' : 'Reporte combinado'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'resumen'
        ? <TabResumen productos={productos} saldos={saldos} cupones={cupones} periodo={periodo} setPeriodo={setPeriodo} />
        : <TabReporte saldos={saldos} cupones={cupones} promociones={promociones} />
      }
    </div>
  )
}
