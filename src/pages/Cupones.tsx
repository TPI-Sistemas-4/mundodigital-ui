import React, { useState, useEffect } from 'react'
import { cuponesService, type CreateCuponPayload } from '../services/cupones'
import { useToast } from '../components/Toast'
import { Dialog, Btn } from '../components/Dialog'
import { api } from '../services/api'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface Cliente {
  idcliente: number
  nombre: string
  apellido: string
  email: string
}

interface Promocion {
  idpromocion: number
  nombre: string
  activa: boolean
}

interface Cupon {
  idcupon: number
  codigo: string
  descuentoporcentaje: number
  activo: boolean
  fechavencimiento: string | null
  clientes: { nombre: string; apellido: string; email: string } | null
  promociones: { nombre: string } | null
}

const EMPTY: CreateCuponPayload = {
  codigo: '',
  descuentoporcentaje: 10,
  idcliente: undefined,
  idpromocion: undefined,
  fechavencimiento: '',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function Badge({ activo }: { activo: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'DM Mono, monospace',
      background: activo ? 'rgba(74,222,128,0.1)' : 'rgba(113,113,122,0.1)',
      color: activo ? '#4ade80' : '#71717a',
      border: `1px solid ${activo ? 'rgba(74,222,128,0.3)' : 'rgba(113,113,122,0.3)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: activo ? '#4ade80' : '#71717a' }} />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0f0f10',
  border: '1px solid #2e2e35',
  borderRadius: 8,
  padding: '9px 12px',
  color: '#f4f4f5',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
}

export function CuponesPage() {
  const { toast } = useToast()
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CreateCuponPayload>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const data = await cuponesService.listar()
      setCupones(data)
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {})
    api.get('/promociones').then(({ data }) =>
      setPromociones(data.filter((p: Promocion) => p.activa))
    ).catch(() => {})
  }, [])

  const handleGenerarCodigo = async () => {
    setGenerando(true)
    try {
      const codigo = await cuponesService.generarCodigo()
      setForm((f) => ({ ...f, codigo }))
    } catch {
      toast('No se pudo generar el codigo', 'error')
    } finally {
      setGenerando(false)
    }
  }

  const handleSave = async () => {
    if (!form.codigo.trim()) { toast('El codigo es obligatorio', 'error'); return }
    if (form.descuentoporcentaje < 1 || form.descuentoporcentaje > 100) {
      toast('El descuento debe estar entre 1 y 100', 'error'); return
    }
    setSaving(true)
    try {
      await cuponesService.crear({
        ...form,
        codigo: form.codigo.toUpperCase(),
        fechavencimiento: form.fechavencimiento || undefined,
        idcliente: form.idcliente || undefined,
        idpromocion: form.idpromocion || undefined,
      })
      toast('Cupon registrado correctamente', 'success')
      setFormOpen(false)
      setForm(EMPTY)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast(Array.isArray(msg) ? msg.join(' - ') : msg ?? e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#f4f4f5' }}>Cupones</h1>
          <p style={{ color: '#71717a', fontSize: 13, marginTop: 4 }}>
            {cupones.length} cupon{cupones.length !== 1 ? 'es' : ''} · {cupones.filter(c => c.activo).length} activos
          </p>
        </div>
        <Btn onClick={() => { setForm(EMPTY); setFormOpen(true) }}>+ Nuevo cupon</Btn>
      </div>

      <div style={{ background: '#18181b', border: '1px solid #2e2e35', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>Cargando...</div>
        ) : cupones.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>
            No hay cupones.{' '}
            <button onClick={() => setFormOpen(true)} style={{ color: '#e8ff47', background: 'none', border: 'none', cursor: 'pointer' }}>
              Crea el primero
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e35' }}>
                {['ID', 'Codigo', 'Descuento', 'Cliente', 'Promocion', 'Vencimiento', 'Estado'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11,
                    color: '#71717a', fontWeight: 500, fontFamily: 'DM Mono, monospace',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cupones.map((c, i) => (
                <tr
                  key={c.idcupon}
                  style={{ borderBottom: i < cupones.length - 1 ? '1px solid #2e2e35' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#232328')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#71717a' }}>#{c.idcupon}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#e8ff47', fontSize: 13 }}>{c.codigo}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', color: '#f4f4f5', fontSize: 13 }}>{c.descuentoporcentaje}%</td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13 }}>
                    {c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13 }}>
                    {c.promociones ? c.promociones.nombre : '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {c.fechavencimiento ? fmt(c.fechavencimiento) : '-'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <Badge activo={c.activo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={formOpen} title="Nuevo cupon" onClose={() => setFormOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Field label="Codigo *">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={form.codigo}
                onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                maxLength={20}
                placeholder="Ej: VERANO25"
                style={{ ...inputStyle, flex: 1, fontFamily: 'DM Mono, monospace' }}
              />
              <Btn variant="ghost" onClick={handleGenerarCodigo} disabled={generando}>
                {generando ? '...' : 'Generar'}
              </Btn>
            </div>
          </Field>

          <Field label={`Descuento: ${form.descuentoporcentaje}%`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#71717a', minWidth: 24 }}>1%</span>
              <input
                type="range" min={1} max={100} step={1}
                value={form.descuentoporcentaje}
                onChange={e => setForm(f => ({ ...f, descuentoporcentaje: Number(e.target.value) }))}
                style={{ flex: 1, accentColor: '#e8ff47' }}
              />
              <span style={{ fontSize: 12, color: '#71717a', minWidth: 32 }}>100%</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: '#e8ff47', minWidth: 40, textAlign: 'right' }}>
                {form.descuentoporcentaje}%
              </span>
            </div>
          </Field>

          <Field label="Cliente destino (opcional)">
            <select
              value={form.idcliente ?? ''}
              onChange={e => setForm(f => ({ ...f, idcliente: e.target.value ? Number(e.target.value) : undefined }))}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">- Sin cliente asignado -</option>
              {clientes.map(c => (
                <option key={c.idcliente} value={c.idcliente}>
                  {c.nombre} {c.apellido} ({c.email})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Promocion asociada (opcional)">
            <select
              value={form.idpromocion ?? ''}
              onChange={e => setForm(f => ({ ...f, idpromocion: e.target.value ? Number(e.target.value) : undefined }))}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">- Sin promocion -</option>
              {promociones.map(p => (
                <option key={p.idpromocion} value={p.idpromocion}>{p.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Fecha de vencimiento (opcional)">
            <DatePicker
              selected={form.fechavencimiento ? new Date(form.fechavencimiento) : null}
              onChange={(date: Date | null) =>
                setForm(f => ({
                  ...f,
                  fechavencimiento: date
                    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                    : '',
                }))
              }
              dateFormat="dd/MM/yyyy"
              locale="es"
              placeholderText="dd/mm/aaaa"
              minDate={new Date()}
              customInput={<input style={inputStyle} />}
            />
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #2e2e35' }}>
            <Btn variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Registrando...' : 'Registrar cupon'}</Btn>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
