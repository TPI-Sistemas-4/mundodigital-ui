import React, { useState, useEffect, useRef } from 'react'
import { puntosService, type RegistrarPuntosPayload, type SaldoCliente, type HistorialCliente, type VentaPreview } from '../services/Puntos'
import { useToast } from '../components/Toast'
import { Dialog, Btn } from '../components/Dialog'

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtPesos(n: number | string) {
  return Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#52525b' }}>{hint}</span>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
}

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  color: '#52525b',
  cursor: 'not-allowed',
  background: '#0a0a0b',
}

export function PuntosPage() {
  const { toast } = useToast()
  const [saldos, setSaldos] = useState<SaldoCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [regla, setRegla] = useState('')
  const [importePorPunto, setImportePorPunto] = useState(1500)

  // form
  const [formOpen, setFormOpen] = useState(false)
  const [idventaInput, setIdventaInput] = useState('')
  const [ventaPreview, setVentaPreview] = useState<VentaPreview | null>(null)
  const [buscandoVenta, setBuscandoVenta] = useState(false)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // historial
  const [historialTarget, setHistorialTarget] = useState<HistorialCliente | null>(null)
  const [historialOpen, setHistorialOpen] = useState(false)
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  const puntosPreview = ventaPreview ? Math.floor(ventaPreview.total / importePorPunto) : 0

  const load = async () => {
    setLoading(true)
    try {
      const [saldosData, reglaData] = await Promise.all([
        puntosService.listarSaldos(),
        puntosService.getRegla(),
      ])
      setSaldos(saldosData)
      setRegla(reglaData.descripcion)
      setImportePorPunto(reglaData.importePorPunto)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Buscar venta con debounce al escribir el id
  const handleIdventaChange = (val: string) => {
    setIdventaInput(val)
    setVentaPreview(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val || isNaN(Number(val)) || Number(val) <= 0) return

    debounceRef.current = setTimeout(async () => {
      setBuscandoVenta(true)
      try {
        const venta = await puntosService.getVenta(Number(val))
        setVentaPreview(venta)
      } catch {
        setVentaPreview(null)
      } finally {
        setBuscandoVenta(false)
      }
    }, 500)
  }

  const handleRegistrar = async () => {
    if (!ventaPreview) { toast('Ingresa un numero de venta valido', 'error'); return }
    setSaving(true)
    try {
      const res = await puntosService.registrar({ idventa: ventaPreview.idventa })
      toast(`Se otorgaron ${res.puntosotorgados} puntos a ${res.venta.cliente.nombre}. Saldo: ${res.saldo} pts`, 'success')
      setFormOpen(false)
      setIdventaInput('')
      setVentaPreview(null)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast(Array.isArray(msg) ? msg.join(' - ') : msg ?? e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleVerHistorial = async (idcliente: number) => {
    setHistorialOpen(true)
    setLoadingHistorial(true)
    try {
      setHistorialTarget(await puntosService.getHistorial(idcliente))
    } catch (e: any) {
      toast(e.message, 'error')
      setHistorialOpen(false)
    } finally {
      setLoadingHistorial(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>Puntos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {saldos.length} cliente{saldos.length !== 1 ? 's' : ''} con puntos
            {regla && (
              <span style={{ marginLeft: 10, fontFamily: 'DM Mono, monospace', color: 'var(--btn-bg)', fontSize: 11, padding: '2px 8px', background: 'rgba(232,255,71,0.08)', borderRadius: 999, border: '1px solid rgba(232,255,71,0.2)' }}>
                Regla: {regla}
              </span>
            )}
          </p>
        </div>
        <Btn onClick={() => { setIdventaInput(''); setVentaPreview(null); setFormOpen(true) }}>+ Registrar puntos</Btn>
      </div>

      {/* Tabla saldos */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : saldos.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No hay puntos registrados.{' '}
            <button onClick={() => setFormOpen(true)} style={{ color: 'var(--btn-bg)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Registra el primero
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Cliente', 'Email', 'Saldo de puntos', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {saldos.map((s, i) => (
                <tr
                  key={s.cliente.idcliente}
                  style={{ borderBottom: i < saldos.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', color: 'var(--text)', fontWeight: 500 }}>
                    {s.cliente.nombre} {s.cliente.apellido}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: 13 }}>{s.cliente.email}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 15, color: 'var(--btn-bg)' }}>
                      {s.saldo.toLocaleString('es-AR')} pts
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Btn variant="ghost" onClick={() => handleVerHistorial(s.cliente.idcliente)} style={{ padding: '5px 12px', fontSize: 12 }}>
                      Ver historial
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog registrar puntos */}
      <Dialog open={formOpen} title="Registrar puntos por compra" onClose={() => setFormOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Input N° venta */}
          <Field label="N° de venta *" hint="Se obtiene el cliente y total automaticamente">
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min={1}
                value={idventaInput}
                onChange={e => handleIdventaChange(e.target.value)}
                placeholder="Ej: 123"
                style={{ ...inputStyle, paddingRight: buscandoVenta ? 36 : 12 }}
              />
              {buscandoVenta && (
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>...</span>
              )}
            </div>
          </Field>

          {/* Info de la venta — se muestra al encontrarla */}
          {ventaPreview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg)', borderRadius: 10, padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>DATOS DE LA VENTA</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Cliente</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {ventaPreview.cliente.nombre} {ventaPreview.cliente.apellido}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ventaPreview.cliente.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Fecha</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Mono, monospace' }}>
                    {ventaPreview.fechaventa ? fmt(ventaPreview.fechaventa) : '-'}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Total de la venta</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                    {fmtPesos(ventaPreview.total)}
                  </div>
                </div>

                {/* Preview puntos */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 3 }}>Puntos a otorgar</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: puntosPreview > 0 ? 'var(--btn-bg)' : '#3f3f46', fontFamily: 'DM Mono, monospace' }}>
                    {puntosPreview > 0 ? `+${puntosPreview} pts` : '—'}
                  </div>
                </div>
              </div>

              {/* Productos */}
              {ventaPreview.detalleventas.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: '#52525b', marginBottom: 8 }}>PRODUCTOS ({ventaPreview.detalleventas.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {ventaPreview.detalleventas.map(d => (
                      <div key={d.iddetalle} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span>#{d.idproducto} · x{d.cantidad}</span>
                        <span style={{ fontFamily: 'DM Mono, monospace' }}>{fmtPesos(Number(d.preciounitario) * d.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mensaje si no hay venta y se escribió algo */}
          {!ventaPreview && idventaInput && !buscandoVenta && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(248,113,113,0.05)', borderRadius: 8, border: '1px solid rgba(248,113,113,0.2)' }}>
              No se encontro la venta #{idventaInput}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <Btn variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Btn>
            <Btn onClick={handleRegistrar} disabled={saving || !ventaPreview || puntosPreview <= 0}>
              {saving ? 'Registrando...' : ventaPreview && puntosPreview > 0 ? `Otorgar +${puntosPreview} pts` : 'Otorgar puntos'}
            </Btn>
          </div>
        </div>
      </Dialog>

      {/* Dialog historial */}
      <Dialog open={historialOpen} title="Historial de puntos" onClose={() => { setHistorialOpen(false); setHistorialTarget(null) }} maxWidth={560}>
        {loadingHistorial ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : historialTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CLIENTE</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{historialTarget.cliente.nombre} {historialTarget.cliente.apellido}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{historialTarget.cliente.email}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SALDO TOTAL</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 24, fontWeight: 700, color: 'var(--btn-bg)' }}>
                  {historialTarget.saldo.toLocaleString('es-AR')} pts
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#52525b', fontFamily: 'DM Mono, monospace', padding: '6px 10px', background: 'rgba(232,255,71,0.05)', borderRadius: 6, border: '1px solid rgba(232,255,71,0.1)' }}>
              {historialTarget.regla}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
              {historialTarget.movimientos.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin movimientos</div>
              ) : historialTarget.movimientos.map(m => (
                <div key={m.idpunto} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{m.concepto}</div>
                    <div style={{ fontSize: 11, color: '#52525b', marginTop: 3, fontFamily: 'DM Mono, monospace' }}>
                      {m.fecha ? fmt(m.fecha) : '—'}
                      {m.ventas && <span style={{ marginLeft: 8 }}>· Venta #{m.ventas.idventa} · {fmtPesos(Number(m.ventas.total))}</span>}
                    </div>
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14, color: 'var(--success)' }}>
                    +{m.puntosotorgados} pts
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setHistorialOpen(false); setHistorialTarget(null) }}>Cerrar</Btn>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
