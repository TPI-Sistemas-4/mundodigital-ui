import React, { useState, useEffect } from 'react'
import { cuponesService, type CreateCuponPayload, type UpdateCuponPayload, type Cupon } from '../services/cupones'
import { useToast } from '../components/Toast'
import { Dialog, ConfirmDialog, Btn } from '../components/Dialog'
import { api } from '../services/api'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

interface Cliente {
  idcliente: number
  nombre: string
  apellido: string
  email: string
}

interface DetallePromocion {
  descuentoporcentaje: number
}

interface Promocion {
  idpromocion: number
  nombre: string
  activa: boolean
  fechahasta: string
  detallepromocion: DetallePromocion[]
}

const EMPTY_CREATE: CreateCuponPayload = {
  codigo: '',
  descuentoporcentaje: 10,
  idcliente: undefined,
  idpromocion: undefined,
  fechavencimiento: '',
}

interface EditForm {
  idcliente: number | null
  activo: boolean
  descuentoporcentaje: number
  fechavencimiento: string
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function isoDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
      {activo ? 'Activo' : 'Anulado'}
    </span>
  )
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#71717a', fontWeight: 500 }}>
        {label}{required && <span style={{ color: '#f87171', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: '#52525b' }}>{hint}</span>}
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

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  color: '#52525b',
  cursor: 'not-allowed',
  background: '#0a0a0b',
}

export function CuponesPage() {
  const { toast } = useToast()
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [loading, setLoading] = useState(true)

  // create
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateCuponPayload>(EMPTY_CREATE)
  const [promoSeleccionada, setPromoSeleccionada] = useState<Promocion | null>(null)
  const [creating, setCreating] = useState(false)
  const [generando, setGenerando] = useState(false)

  // edit
  const [editTarget, setEditTarget] = useState<Cupon | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ idcliente: null, activo: true, descuentoporcentaje: 10, fechavencimiento: '' })
  const [editing, setEditing] = useState(false)

  // anular
  const [anularId, setAnularId] = useState<number | null>(null)

  // datos auxiliares
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [promociones, setPromociones] = useState<Promocion[]>([])

  const load = async () => {
    setLoading(true)
    try { setCupones(await cuponesService.listar()) }
    catch (e: any) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {})
    api.get('/promociones').then(({ data }) =>
      setPromociones(data.filter((p: Promocion) => p.activa))
    ).catch(() => {})
  }, [])

  // ── Crear ──────────────────────────────────────────────────────────
  const handlePromoChange = (idpromocion: number | undefined) => {
    if (!idpromocion) {
      setPromoSeleccionada(null)
      setCreateForm(f => ({ ...f, idpromocion: undefined, descuentoporcentaje: 10, fechavencimiento: '' }))
      return
    }
    const promo = promociones.find(p => p.idpromocion === idpromocion) ?? null
    setPromoSeleccionada(promo)
    if (promo) {
      setCreateForm(f => ({
        ...f,
        idpromocion,
        descuentoporcentaje: promo.detallepromocion[0]?.descuentoporcentaje ?? 10,
        fechavencimiento: isoDate(promo.fechahasta),
      }))
    }
  }

  const handleGenerarCodigo = async () => {
    setGenerando(true)
    try {
      const codigo = await cuponesService.generarCodigo()
      setCreateForm(f => ({ ...f, codigo }))
    } catch { toast('No se pudo generar el codigo', 'error') }
    finally { setGenerando(false) }
  }

  const handleCreate = async () => {
    if (!createForm.codigo.trim()) { toast('El codigo es obligatorio', 'error'); return }
    if (!createForm.idpromocion) { toast('Debes seleccionar una promocion', 'error'); return }
    setCreating(true)
    try {
      await cuponesService.crear({
        ...createForm,
        codigo: createForm.codigo.toUpperCase(),
        idcliente: createForm.idcliente || undefined,
      })
      toast('Cupon registrado correctamente', 'success')
      setCreateOpen(false)
      setCreateForm(EMPTY_CREATE)
      setPromoSeleccionada(null)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast(Array.isArray(msg) ? msg.join(' - ') : msg ?? e.message, 'error')
    } finally { setCreating(false) }
  }

  // ── Editar ─────────────────────────────────────────────────────────
  const openEdit = (c: Cupon) => {
    setEditTarget(c)
    setEditForm({
      idcliente: c.clientes?.idcliente ?? null,
      activo: c.activo,
      descuentoporcentaje: c.descuentoporcentaje,
      fechavencimiento: c.fechavencimiento ? isoDate(c.fechavencimiento) : '',
    })
  }

  const tienePromocion = !!editTarget?.idpromocion

  const handleEdit = async () => {
    if (!editTarget) return
    setEditing(true)
    try {
      const payload: UpdateCuponPayload = {
        idcliente: editForm.idcliente, // null = general
        activo: editForm.activo,
        ...(!tienePromocion && {
          descuentoporcentaje: editForm.descuentoporcentaje,
          fechavencimiento: editForm.fechavencimiento || undefined,
        }),
      }
      await cuponesService.actualizar(editTarget.idcupon, payload)
      toast('Cupon actualizado correctamente', 'success')
      setEditTarget(null)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast(Array.isArray(msg) ? msg.join(' - ') : msg ?? e.message, 'error')
    } finally { setEditing(false) }
  }

  // ── Anular ─────────────────────────────────────────────────────────
  const handleAnular = async () => {
    if (!anularId) return
    try {
      const res = await cuponesService.anular(anularId)
      toast(res.mensaje ?? 'Cupon anulado', 'success')
      setAnularId(null)
      load()
    } catch (e: any) {
      const msg = e?.response?.data?.message
      toast(Array.isArray(msg) ? msg.join(' - ') : msg ?? e.message, 'error')
      setAnularId(null)
    }
  }

  const headers = ['ID', 'Codigo', 'Descuento', 'Cliente', 'Promocion', 'Vencimiento', 'Estado', '']

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: '#71717a', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: '#f4f4f5' }}>Cupones</h1>
          <p style={{ color: '#71717a', fontSize: 13, marginTop: 4 }}>
            {cupones.length} cupon{cupones.length !== 1 ? 'es' : ''} · {cupones.filter(c => c.activo).length} activos
          </p>
        </div>
        <Btn onClick={() => { setCreateForm(EMPTY_CREATE); setPromoSeleccionada(null); setCreateOpen(true) }}>+ Nuevo cupon</Btn>
      </div>

      {/* Tabla */}
      <div style={{ background: '#18181b', border: '1px solid #2e2e35', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>Cargando...</div>
        ) : cupones.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#71717a' }}>
            No hay cupones.{' '}
            <button onClick={() => setCreateOpen(true)} style={{ color: '#e8ff47', background: 'none', border: 'none', cursor: 'pointer' }}>
              Crea el primero
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e35' }}>
                {headers.map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: '#71717a', fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>{h}</th>
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
                    {c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : 'General'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13 }}>
                    {c.promociones ? c.promociones.nombre : '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#a1a1aa', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {c.fechavencimiento ? fmt(c.fechavencimiento) : '-'}
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge activo={c.activo} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn
                        variant="ghost"
                        disabled={!c.activo}
                        onClick={() => openEdit(c)}
                        style={{ padding: '5px 12px', fontSize: 12, opacity: c.activo ? 1 : 0.4, cursor: c.activo ? 'pointer' : 'not-allowed' }}
                      >
                        Editar
                      </Btn>
                      <Btn
                        variant="ghost"
                        disabled={!c.activo}
                        onClick={() => setAnularId(c.idcupon)}
                        style={{
                          padding: '5px 12px', fontSize: 12,
                          color: c.activo ? '#f87171' : '#3f3f46',
                          borderColor: c.activo ? 'rgba(248,113,113,0.3)' : 'rgba(63,63,70,0.3)',
                          cursor: c.activo ? 'pointer' : 'not-allowed',
                          opacity: c.activo ? 1 : 0.5,
                        }}
                      >
                        Anular
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Dialog: Nuevo cupon ── */}
      <Dialog open={createOpen} title="Nuevo cupon" onClose={() => setCreateOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <Field label="Codigo" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={createForm.codigo}
                onChange={e => setCreateForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))}
                maxLength={20}
                placeholder="Ej: VERANO25"
                style={{ ...inputStyle, flex: 1, fontFamily: 'DM Mono, monospace' }}
              />
              <Btn variant="ghost" onClick={handleGenerarCodigo} disabled={generando}>
                {generando ? '...' : 'Generar'}
              </Btn>
            </div>
          </Field>

          <Field label="Promocion asociada" required hint={!createForm.idpromocion ? 'Requerido' : undefined}>
            <select
              value={createForm.idpromocion ?? ''}
              onChange={e => handlePromoChange(e.target.value ? Number(e.target.value) : undefined)}
              style={{ ...inputStyle, appearance: 'none', borderColor: !createForm.idpromocion ? 'rgba(248,113,113,0.4)' : '#2e2e35' }}
            >
              <option value="">- Selecciona una promocion -</option>
              {promociones.map(p => (
                <option key={p.idpromocion} value={p.idpromocion}>{p.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Descuento de la promocion">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#2e2e35', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: '#e8ff47', width: `${createForm.descuentoporcentaje}%`, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: promoSeleccionada ? '#e8ff47' : '#3f3f46', minWidth: 40, textAlign: 'right' }}>
                {createForm.descuentoporcentaje}%
              </span>
            </div>
            {!promoSeleccionada && <span style={{ fontSize: 11, color: '#3f3f46' }}>Selecciona una promocion para ver el descuento</span>}
          </Field>

          <Field label="Cliente destino" hint="Sin seleccion el cupon aplica a todos los clientes">
            <select
              value={createForm.idcliente ?? ''}
              onChange={e => setCreateForm(f => ({ ...f, idcliente: e.target.value ? Number(e.target.value) : undefined }))}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">- General (todos los clientes) -</option>
              {clientes.map(c => (
                <option key={c.idcliente} value={c.idcliente}>{c.nombre} {c.apellido} ({c.email})</option>
              ))}
            </select>
          </Field>

          <Field label="Fecha de vencimiento" required>
            <input
              readOnly
              value={promoSeleccionada ? fmt(promoSeleccionada.fechahasta) : ''}
              placeholder="Se completa al elegir la promocion"
              style={promoSeleccionada ? readonlyStyle : { ...readonlyStyle, color: '#3f3f46' }}
            />
            {promoSeleccionada && <span style={{ fontSize: 11, color: '#52525b' }}>Corresponde a la fecha hasta de la promocion</span>}
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #2e2e35' }}>
            <Btn variant="ghost" onClick={() => { setCreateOpen(false); setPromoSeleccionada(null) }}>Cancelar</Btn>
            <Btn onClick={handleCreate} disabled={creating || !createForm.idpromocion}>
              {creating ? 'Registrando...' : 'Registrar cupon'}
            </Btn>
          </div>
        </div>
      </Dialog>

      {/* ── Dialog: Editar cupon ── */}
      <Dialog open={editTarget !== null} title="Editar cupon" onClose={() => setEditTarget(null)}>
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Codigo — readonly, no se puede modificar */}
            <Field label="Codigo" hint="El codigo unico no se puede modificar">
              <input readOnly value={editTarget.codigo} style={{ ...readonlyStyle, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: '#e8ff47' }} />
            </Field>

            {/* Promocion — informativa */}
            <Field label="Promocion asociada">
              <input
                readOnly
                value={editTarget.promociones ? editTarget.promociones.nombre : '- Sin promocion -'}
                style={readonlyStyle}
              />
              {tienePromocion && (
                <span style={{ fontSize: 11, color: '#52525b' }}>El descuento y vencimiento se rigen por la promocion</span>
              )}
            </Field>

            {/* Descuento — editable solo sin promocion */}
            <Field label={`Descuento${tienePromocion ? ' (de la promocion)' : ''}`}>
              {tienePromocion ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#2e2e35', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#e8ff47', width: `${editForm.descuentoporcentaje}%` }} />
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: '#e8ff47', minWidth: 40, textAlign: 'right' }}>
                    {editForm.descuentoporcentaje}%
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 24 }}>1%</span>
                  <input
                    type="range" min={1} max={100} step={1}
                    value={editForm.descuentoporcentaje}
                    onChange={e => setEditForm(f => ({ ...f, descuentoporcentaje: Number(e.target.value) }))}
                    style={{ flex: 1, accentColor: '#e8ff47' }}
                  />
                  <span style={{ fontSize: 12, color: '#71717a', minWidth: 32 }}>100%</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: '#e8ff47', minWidth: 40, textAlign: 'right' }}>
                    {editForm.descuentoporcentaje}%
                  </span>
                </div>
              )}
            </Field>

            {/* Fecha vencimiento — editable solo sin promocion */}
            <Field label={`Fecha de vencimiento${tienePromocion ? ' (de la promocion)' : ''}`}>
              {tienePromocion ? (
                <input readOnly value={editTarget.fechavencimiento ? fmt(editTarget.fechavencimiento) : '-'} style={readonlyStyle} />
              ) : (
                <DatePicker
                  selected={editForm.fechavencimiento ? new Date(editForm.fechavencimiento + 'T00:00:00') : null}
                  onChange={(date: Date | null) =>
                    setEditForm(f => ({
                      ...f,
                      fechavencimiento: date ? isoDate(date.toISOString()) : '',
                    }))
                  }
                  dateFormat="dd/MM/yyyy"
                  locale="es"
                  placeholderText="dd/mm/aaaa"
                  minDate={new Date()}
                  customInput={<input style={inputStyle} />}
                />
              )}
            </Field>

            {/* Cliente — siempre editable */}
            <Field label="Cliente destino" hint="Sin seleccion el cupon aplica a todos los clientes">
              <select
                value={editForm.idcliente ?? ''}
                onChange={e => setEditForm(f => ({ ...f, idcliente: e.target.value ? Number(e.target.value) : null }))}
                style={{ ...inputStyle, appearance: 'none' }}
              >
                <option value="">- General (todos los clientes) -</option>
                {clientes.map(c => (
                  <option key={c.idcliente} value={c.idcliente}>{c.nombre} {c.apellido} ({c.email})</option>
                ))}
              </select>
            </Field>

            {/* Estado — siempre editable */}
            <Field label="Estado">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.activo}
                  onChange={e => setEditForm(f => ({ ...f, activo: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#e8ff47' }}
                />
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>Cupon activo</span>
              </label>
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #2e2e35' }}>
              <Btn variant="ghost" onClick={() => setEditTarget(null)}>Cancelar</Btn>
              <Btn onClick={handleEdit} disabled={editing}>{editing ? 'Guardando...' : 'Guardar cambios'}</Btn>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirm anular */}
      <ConfirmDialog
        open={anularId !== null}
        message="Anular este cupon lo desactivara. Si fue utilizado en ventas, el historial quedara registrado. Esta accion no se puede deshacer."
        onConfirm={handleAnular}
        onCancel={() => setAnularId(null)}
      />
    </div>
  )
}
