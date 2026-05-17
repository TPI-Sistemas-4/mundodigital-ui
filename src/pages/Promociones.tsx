import React, { useEffect, useState } from 'react'
import { promocionesService, type Promocion, type NuevaPromocion } from '../services/promociones'
import { useToast } from '../components/Toast'
import { Dialog, ConfirmDialog, Btn } from '../components/Dialog'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { api } from '../services/api'

const EMPTY: NuevaPromocion = {
  nombre: '',
  descripcion: '',
  fechaDesde: '',
  fechaHasta: '',
  activa: true,
  detalle: [],
  esGeneral: false,
}

interface DetalleForm {
  idProducto: number
  nombreProducto: string
  descuentoPorcentaje: number
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  // devuelve: 27/11/2026
}

function Badge({ activa }: { activa: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'DM Mono, monospace',
      background: activa ? 'rgba(74,222,128,0.1)' : 'rgba(113,113,122,0.1)',
      color: activa ? '#4ade80' : '#71717a',
      border: `1px solid ${activa ? 'rgba(74,222,128,0.3)' : 'rgba(113,113,122,0.3)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: activa ? '#4ade80' : '#71717a' }} />
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

export function PromocionesPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Promocion | null>(null)
  const [form, setForm] = useState<NuevaPromocion>(EMPTY)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setData(await promocionesService.getAll())
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const [nuevoDetalle, setNuevoDetalle] = useState({
    idProducto: 0,
    nombreProducto: '',
    descuentoPorcentaje: 10,
  })

  const [productos, setProductos] = useState<{ idProducto: number; nombre: string }[]>([])
  const [selectedProducto, setSelectedProducto] = useState('')

  useEffect(() => {
    api.get('/productos')
      .then(({ data }) => {
        setProductos(data.map((p: any) => ({
          idProducto: p.idproducto,
          nombre: p.nombre,
        })))
      })
      .catch((e) => console.error('error productos:', e))
  }, []) // array vacío = solo al montar

  const openNew = () => { setEditTarget(null); setForm(EMPTY); setFormOpen(true) }
  const openEdit = (p: Promocion) => {
    setEditTarget(p)
    setForm({ nombre: p.nombre, descripcion: p.descripcion, fechaDesde: p.fechaDesde.slice(0, 16), fechaHasta: p.fechaHasta.slice(0, 16), activa: p.activa, detalle: p.detalle ?? [] })
    setFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.nombre || !form.fechaDesde || !form.fechaHasta) {
      toast('Completá los campos obligatorios', 'error'); return
    }
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      descripcion: form.descripcion,
      fechaDesde: form.fechaDesde,
      fechaHasta: form.fechaHasta,
      activa: form.activa,
      detalles: form.esGeneral
      ? [{ descuentoPorcentaje: nuevoDetalle.descuentoPorcentaje }]
      : (form.detalle ?? []).map((d) => ({
          idProducto: d.idProducto,
          descuentoPorcentaje: d.descuentoPorcentaje,
        })),
    }

    if (!payload.detalles.length) {
      toast('Agregá al menos un producto a la promoción', 'error')
      return
    }
    try {
      if (editTarget) {
        await promocionesService.update(editTarget.idPromocion, payload)
        toast('Promoción actualizada', 'success')
      } else {
        await promocionesService.create(payload)
        toast('Promoción creada', 'success')
      }
      setFormOpen(false)
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await promocionesService.remove(deleteId)
      toast('Promoción eliminada', 'success')
      setDeleteId(null)
      load()
    } catch (e: any) {
      toast(e.message, 'error')
    }
  }

  const field = (key: keyof NuevaPromocion) => ({
    value: String(form[key] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#f4f4f5' }}>Promociones</h1>
          <p style={{ color: '#71717a', fontSize: 13, marginTop: 4 }}>
            {data.length} promoción{data.length !== 1 ? 'es' : ''} · {data.filter((p) => p.activa).length} activas
          </p>
        </div>
        <Btn onClick={openNew}>+ Nueva promoción</Btn>
      </div>

      {/* Table */}
      <div style={{ background: '#18181b', border: '1px solid #2e2e35', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>Cargando...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>
            No hay promociones. <button onClick={openNew} style={{ color: '#e8ff47', background: 'none', border: 'none', cursor: 'pointer' }}>Creá la primera</button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e35' }}>
                {['ID', 'Nombre', 'Descripción', 'Desde', 'Hasta', 'Tipo', 'Estado', ''].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#71717a', fontWeight: 500, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.idPromocion}
                  style={{ borderBottom: i < data.length - 1 ? '1px solid #2e2e35' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#232328')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#71717a' }}>#{p.idPromocion}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 500, color: '#f4f4f5' }}>{p.nombre}</td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion || '—'}</td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(p.fechaDesde)}</td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(p.fechaHasta)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontFamily: 'DM Mono, monospace',
                      padding: '2px 8px', borderRadius: 999,
                      background: p.esGeneral ? 'rgba(232,255,71,0.1)' : 'rgba(55,138,221,0.1)',
                      color: p.esGeneral ? '#e8ff47' : '#378add',
                      border: `1px solid ${p.esGeneral ? 'rgba(232,255,71,0.3)' : 'rgba(55,138,221,0.3)'}`,
                    }}>
                      {p.esGeneral ? 'General' : 'Por producto'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge activa={p.activa} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="ghost" onClick={() => openEdit(p)} style={{ padding: '5px 12px', fontSize: 12 }}>Editar</Btn>
                      <Btn variant="ghost" onClick={() => setDeleteId(p.idPromocion)} style={{ padding: '5px 12px', fontSize: 12, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Eliminar</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={formOpen} title={editTarget ? 'Editar promoción' : 'Nueva promoción'} onClose={() => setFormOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Nombre *">
            <input {...field('nombre')} placeholder="Ej: Black Friday 2026" style={inputStyle} />
          </Field>
          <Field label="Descripción">
            <textarea {...field('descripcion')} placeholder="Descripción opcional..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Fecha desde *">
              <DatePicker
                selected={form.fechaDesde ? new Date(form.fechaDesde) : null}
                onChange={(date: Date | null) => setForm((f) => ({ ...f, fechaDesde: date ? date.toISOString().split('T')[0] : '' }))}
                dateFormat="dd/MM/yyyy"
                locale="es"
                placeholderText="dd/mm/aaaa"
                minDate={new Date()}
                customInput={<input style={inputStyle} />}
              />
            </Field>
            <Field label="Fecha hasta *">
              <DatePicker
                selected={form.fechaHasta ? new Date(form.fechaHasta) : null}
                onChange={(date: Date | null) => setForm((f) => ({ ...f, fechaHasta: date ? date.toISOString().split('T')[0] : '' }))}
                dateFormat="dd/MM/yyyy"
                locale="es"
                placeholderText="dd/mm/aaaa"
                minDate={form.fechaDesde ? new Date(form.fechaDesde) : new Date()}
                customInput={<input style={inputStyle} />}
              />
            </Field>
          </div>

          {/* Detalle de productos */}
          <div style={{ borderTop: '1px solid #2e2e35', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: '#71717a', fontWeight: 500, marginBottom: 12 }}>
              Descuento
            </div>

            {/* Checkbox descuento general */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={form.esGeneral ?? false}
                onChange={(e) => {
                  setForm((f) => ({ ...f, esGeneral: e.target.checked, detalle: [] }))
                  setSelectedProducto('')
                }}
                style={{ width: 16, height: 16, accentColor: '#e8ff47' }}
              />
              <span style={{ fontSize: 13, color: '#a1a1aa' }}>Descuento general (aplica a todos los productos)</span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#0f0f10', borderRadius: 8, padding: 12, marginBottom: 12 }}>

              {/* Slider siempre visible */}
              <Field label={`Descuento a aplicar: ${nuevoDetalle.descuentoPorcentaje}%`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 24 }}>1%</span>
                  <input
                    type="range" min={1} max={90} step={1}
                    value={nuevoDetalle.descuentoPorcentaje}
                    onChange={(e) => setNuevoDetalle((d) => ({ ...d, descuentoPorcentaje: Number(e.target.value) }))}
                    style={{ flex: 1, accentColor: '#e8ff47' }}
                  />
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 28 }}>90%</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: '#e8ff47', minWidth: 40, textAlign: 'right' }}>
                    {nuevoDetalle.descuentoPorcentaje}%
                  </span>
                </div>
              </Field>

              {/* Dropdown solo si no es general */}
              {!form.esGeneral && (
                <Field label="Agregar producto">
                  <select
                    value={selectedProducto}
                    onChange={(e) => {
                      const id = Number(e.target.value)
                      const p = productos.find((p) => p.idProducto === id)
                      if (!p) return
                      if (form.detalle?.some((d) => d.idProducto === id)) return
                      setForm((f) => ({
                        ...f,
                        detalle: [...(f.detalle ?? []), {
                          idProducto: id,
                          nombreProducto: p.nombre,
                          descuentoPorcentaje: nuevoDetalle.descuentoPorcentaje,
                        }]
                      }))
                      setSelectedProducto('')
                    }}
                    style={{ ...inputStyle, appearance: 'none' }}
                  >
                    <option value="" disabled>Seleccionar producto...</option>
                    {productos
                      .filter((p) => !form.detalle?.some((d) => d.idProducto === p.idProducto))
                      .map((p) => (
                        <option key={p.idProducto} value={p.idProducto}>#{p.idProducto} — {p.nombre}</option>
                      ))
                    }
                  </select>
                </Field>
              )}
            </div>

            {/* Lista productos solo si no es general */}
            {!form.esGeneral && (form.detalle ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(form.detalle ?? []).map((d) => (
                  <div key={d.idProducto} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: '#0f0f10', borderRadius: 8,
                    border: '1px solid #2e2e35'
                  }}>
                    <span style={{ fontSize: 13, color: '#f4f4f5' }}>#{d.idProducto} — {d.nombreProducto}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#e8ff47' }}>
                        {d.descuentoPorcentaje}%
                      </span>
                      <button
                        onClick={() => setForm((f) => ({ ...f, detalle: f.detalle?.filter((x) => x.idProducto !== d.idProducto) }))}
                        style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm((f) => ({ ...f, activa: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: '#e8ff47' }}
            />
            <span style={{ fontSize: 13, color: '#a1a1aa' }}>Promoción activa</span>
          </label>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #2e2e35' }}>
            <Btn variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Btn>
            <Btn onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editTarget ? 'Guardar cambios' : 'Crear promoción'}</Btn>
          </div>
        </div>
      </Dialog>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={deleteId !== null}
        message="¿Eliminar esta promoción? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
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
