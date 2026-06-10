import React, { useEffect, useState } from 'react'
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
  promociones: { idpromocion: number; nombre: string } | null
}

// ─── Paletas ──────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#60a5fa', '#4ade80', '#a78bfa', '#fbbf24', '#f87171', '#34d399', '#fb923c', '#e879f9']

const ESTADO_COLOR: Record<EstadoStock, string> = {
  Disponible:  '#4ade80',
  Critico:     '#fbbf24',
  'Sin Stock': '#f87171',
}

const DESCUENTO_COLOR: Record<number, string> = {
  30: '#f87171',
  25: '#fb923c',
  20: '#fbbf24',
  15: '#a3e635',
  10: '#4ade80',
}

// ─── Lógica de sugerencia ─────────────────────────────────────────────────────

function sugerirDescuento(p: ProductoStock): number | null {
  if (p.estadoStock !== 'Disponible') return null
  if (p.puntoReposicion === 0) {
    if (p.stockActual >= 50) return 25
    if (p.stockActual >= 20) return 15
    return null
  }
  const ratio = p.stockActual / p.puntoReposicion
  if (ratio >= 5) return 30
  if (ratio >= 3) return 20
  if (ratio >= 2) return 10
  return null
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const TooltipCustom = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#16162a', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
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

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 20px', flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--btn-bg)', fontFamily: 'DM Mono, monospace', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function EmptyChart({ msg }: { msg: string }) {
  return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {msg}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function InformesPage() {
  const [productos, setProductos] = useState<ProductoStock[]>([])
  const [saldos, setSaldos] = useState<SaldoCliente[]>([])
  const [cupones, setCupones] = useState<CuponAPI[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<ProductoStock[]>('/productos/stock'),
      api.get<SaldoCliente[]>('/puntos'),
      api.get<CuponAPI[]>('/cupones'),
    ])
      .then(([{ data: prod }, { data: sal }, { data: cup }]) => {
        setProductos(prod)
        setSaldos(sal)
        setCupones(cup)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── Datos derivados ─────────────────────────────────────────────────────────

  const conSugerencia = productos
    .map(p => ({ ...p, descuento: sugerirDescuento(p) }))
    .filter(p => p.descuento !== null)
    .sort((a, b) => {
      const rA = a.puntoReposicion > 0 ? a.stockActual / a.puntoReposicion : a.stockActual
      const rB = b.puntoReposicion > 0 ? b.stockActual / b.puntoReposicion : b.stockActual
      return rB - rA
    })

  // Gráfico 1: top 10 productos con mayor ratio
  const dataExceso = conSugerencia.slice(0, 10).map(p => ({
    nombre: p.nombre.length > 16 ? p.nombre.slice(0, 16) + '…' : p.nombre,
    ratio: p.puntoReposicion > 0
      ? Math.round((p.stockActual / p.puntoReposicion) * 10) / 10
      : p.stockActual,
    descuento: p.descuento,
    color: DESCUENTO_COLOR[p.descuento!] ?? '#4ade80',
  }))

  // Gráfico 2: top 8 clientes por puntos
  const dataClientes = [...saldos]
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 8)
    .map(s => ({ nombre: s.cliente.nombre, saldo: s.saldo }))

  // Gráfico 3: cupones activos por promoción
  const agrupado: Record<string, number> = {}
  cupones.forEach(c => {
    const key = c.promociones?.nombre ?? 'Sin promoción'
    agrupado[key] = (agrupado[key] ?? 0) + 1
  })
  const dataCupones = Object.entries(agrupado)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  // Gráfico 4: estado del stock
  const porEstado: Record<EstadoStock, number> = { Disponible: 0, Critico: 0, 'Sin Stock': 0 }
  productos.forEach(p => porEstado[p.estadoStock]++)
  const dataEstado = (Object.entries(porEstado) as [EstadoStock, number][]).map(([name, value]) => ({ name, value }))

  // Stats resumen
  const totalPuntos = saldos.reduce((s, c) => s + c.saldo, 0)

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando reportes...</div>
  }

  const legendStyle = (value: string) => (
    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>Reportes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Análisis de stock, puntos y cupones del área de marketing
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="PRODUCTOS EN CATÁLOGO" value={productos.length} sub="total de productos" />
        <StatCard label="CON DESCUENTO SUGERIDO" value={conSugerencia.length} sub="exceso de stock detectado" />
        <StatCard label="CUPONES ACTIVOS" value={cupones.length} sub="en circulación" />
        <StatCard label="PUNTOS EMITIDOS" value={totalPuntos.toLocaleString('es-AR')} sub="total acumulado por clientes" />
      </div>

      {/* Grilla de gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Gráfico 1 — Exceso de stock */}
        <ChartCard
          title="Productos con mayor exceso de stock"
          sub="Ratio stock ÷ pto. de reposición · color por urgencia de descuento"
        >
          {dataExceso.length === 0
            ? <EmptyChart msg="No hay productos con exceso de stock" />
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dataExceso} margin={{ top: 4, right: 8, left: -12, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="nombre" tick={{ fontSize: 10, fill: '#888' }} angle={-38} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: '#888' }} />
                  <Tooltip content={<TooltipCustom />} />
                  <Bar dataKey="ratio" name="Ratio stock/reposición" radius={[4, 4, 0, 0]}>
                    {dataExceso.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        {/* Gráfico 2 — Top clientes */}
        <ChartCard
          title="Top clientes por puntos acumulados"
          sub="Los 8 clientes con mayor saldo de puntos de fidelización"
        >
          {dataClientes.length === 0
            ? <EmptyChart msg="No hay puntos registrados" />
            : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dataClientes} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#888' }} />
                  <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#ccc' }} width={72} />
                  <Tooltip content={<TooltipCustom />} />
                  <Bar dataKey="saldo" name="Puntos" fill="#60a5fa" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        {/* Gráfico 3 — Cupones por promoción */}
        <ChartCard
          title="Cupones activos por promoción"
          sub={`${cupones.length} cupones activos en circulación`}
        >
          {dataCupones.length === 0
            ? <EmptyChart msg="No hay cupones activos" />
            : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={dataCupones}
                    cx="50%" cy="42%"
                    innerRadius={52} outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    isAnimationActive
                  >
                    {dataCupones.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<TooltipCustom />} />
                  <Legend formatter={legendStyle} iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </ChartCard>

        {/* Gráfico 4 — Estado del stock */}
        <ChartCard
          title="Estado actual del stock"
          sub={`${productos.length} productos en catálogo`}
        >
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={dataEstado}
                cx="50%" cy="42%"
                innerRadius={52} outerRadius={82}
                paddingAngle={3}
                dataKey="value"
                nameKey="name"
                isAnimationActive
                label={({ percent }) => percent > 0.05 ? `${Math.round(percent * 100)}%` : ''}
                labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
              >
                {dataEstado.map(e => <Cell key={e.name} fill={ESTADO_COLOR[e.name as EstadoStock]} />)}
              </Pie>
              <Tooltip content={<TooltipCustom />} />
              <Legend formatter={legendStyle} iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tabla de detalle */}
      {conSugerencia.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Detalle de sugerencias de descuento</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'DM Mono, monospace' }}>
              Los descuentos son sugeridos · crear la promo desde la sección Promociones
            </div>
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
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 10px', borderRadius: 999, fontSize: 12,
                        fontFamily: 'DM Mono, monospace', fontWeight: 700,
                        background: `${color}18`, color, border: `1px solid ${color}40`,
                      }}>
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
    </div>
  )
}
