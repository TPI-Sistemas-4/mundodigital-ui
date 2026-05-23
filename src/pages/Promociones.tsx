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
  activa: false,
  detalle: [],
  esGeneral: false,
  updatedat: '',
}

interface DetalleForm {
  idProducto: number
  nombreProducto: string
  descuentoPorcentaje: number
}

function fmt(iso: string) {
  const normalized = iso.includes('T') ? iso : iso + 'T00:00:00'
  return new Date(normalized).toLocaleDateString('es-AR', {
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
      color: activa ? 'var(--success)' : 'var(--text-muted)',
      border: `1px solid ${activa ? 'rgba(74,222,128,0.3)' : 'rgba(113,113,122,0.3)'}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: activa ? 'var(--success)' : 'var(--text-muted)' }} />
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

export function PromocionesPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Promocion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Promocion | null>(null)
  const [form, setForm] = useState<NuevaPromocion>(EMPTY)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [viewTarget, setViewTarget] = useState<Promocion | null>(null)
  const [saving, setSaving] = useState(false)
  type SortKey = 'updatedat' | 'activa' | 'fechadesde' | 'fechahasta' | 'duracion' |'nombre' | 'descripcion' | 'id'
  type SortDir = 'asc' | 'desc'

  const [sortKey, setSortKey] = useState<SortKey>('updatedat')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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
    idproducto: 0,
    nombreProducto: '',
    descuentoPorcentaje: 10,
  })

  const [productos, setProductos] = useState<{ idproducto: number; nombre: string }[]>([])
  const [selectedProducto, setSelectedProducto] = useState('')

  const filtered = search.trim()
    ? data.filter((p) => p.nombre.toLowerCase().includes(search.toLowerCase()))
    : data

  const sorted = [...filtered].sort((a, b) => {
  let valA: any, valB: any

    switch (sortKey) {
      case 'updatedat':
        valA = new Date(a.updatedat ?? 0).getTime()
        valB = new Date(b.updatedat ?? 0).getTime()
        break
      case 'activa':
        valA = a.activa ? 1 : 0
        valB = b.activa ? 1 : 0
        break
      case 'fechadesde':
        valA = new Date(a.fechaDesde).getTime()
        valB = new Date(b.fechaDesde).getTime()
        break
      case 'fechahasta':
        valA = new Date(a.fechaHasta).getTime()
        valB = new Date(b.fechaHasta).getTime()
        break
      case 'duracion':
        valA = new Date(a.fechaHasta).getTime() - new Date(a.fechaDesde).getTime()
        valB = new Date(b.fechaHasta).getTime() - new Date(b.fechaDesde).getTime()
        break
      case 'nombre':
        valA = a.nombre?.toLowerCase()
        valB = b.nombre?.toLowerCase()
        break
      case 'descripcion':
        valA = a.descripcion?.toLowerCase() ?? ''
        valB = b.descripcion?.toLowerCase() ?? ''
        break
      case 'id':
        valA = a.idPromocion
        valB = b.idPromocion
        break
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const headers: { label: string; key: SortKey | null }[] = [
    { label: 'ID', key: 'id' },
    { label: 'Nombre', key: 'nombre' },
    { label: 'Descripción', key: 'descripcion' },
    { label: 'Desde', key: 'fechadesde' },
    { label: 'Hasta', key: 'fechahasta' },
    { label: 'Tipo', key: null },
    { label: 'Estado', key: 'activa' },
    { label: 'Activa', key: null },
    { label: '', key: null },
  ]

  const handleSort = (key: SortKey | null) => {
    if (!key) return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  useEffect(() => {
    api.get('/productos')
      .then(({ data }) => {
        setProductos(data.map((p: any) => ({
          idproducto: p.idproducto,
          nombre: p.nombre,
        })))
      })
      .catch((e) => console.error('error productos:', e))
  }, []) // array vacío = solo al montar

  const openNew = () => { setEditTarget(null); setForm(EMPTY); setFormOpen(true) }

  const openEdit = (p: Promocion) => {
    console.log('detalle raw:', p.detalle)
    // si es general, precargás el slider con el descuento existente
    if (p.esGeneral && p.detalle?.[0]) {
      const d = p.detalle[0] as any
      setNuevoDetalle((prev) => ({
        ...prev,
        descuentoPorcentaje: d.descuentoporcentaje ?? d.descuentoPorcentaje ?? 10,
      }))
    }
    setEditTarget(p)
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion,
      fechaDesde: p.fechaDesde.split('T')[0],
      fechaHasta: p.fechaHasta.split('T')[0],
      activa: p.activa,
      esGeneral: p.esGeneral,
      updatedat: p.updatedat,
      detalle: (p.detalle ?? []).map((d: any) => ({
        idProducto: d.idproducto ?? d.idProducto,
        nombreProducto: d.productos?.nombre ?? d.nombreProducto ?? '—',
        descuentoPorcentaje: d.descuentoporcentaje ?? d.descuentoPorcentaje,
      })),
    })
    setFormOpen(true)
  }

  const handleSave = async () => {

    if (!form.nombre || !form.fechaDesde || !form.fechaHasta) {
      toast('Completá los campos obligatorios', 'error')
      return
    }

    setSaving(true)
    try {
      // Desactivar promocion Activa
      if (
        editTarget &&
        editTarget.activa &&
        form.activa === false
      ) {

        await promocionesService.update(
          editTarget.idPromocion,
          { activa: false }
        )
        toast('Promoción desactivada', 'success')
        setFormOpen(false)
        load()
        return
      }

      // Payload normal
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion,
        fechaDesde: form.fechaDesde,
        fechaHasta: form.fechaHasta,
        activa: form.activa,
        esGeneral: form.esGeneral,
        updatedat: form.updatedat,
        detalles: form.esGeneral
          ? [
            {
              idProducto: null,
              descuentoPorcentaje:
                nuevoDetalle.descuentoPorcentaje,
            },
          ]
          : (form.detalle ?? []).map((d) => ({
            idProducto: d.idProducto,
            descuentoPorcentaje:
              d.descuentoPorcentaje,
          })),
      }

      if (!payload.detalles.length) {
        toast(
          'Agregá al menos un producto a la promoción',
          'error'
        )
        return
      }

      if (editTarget) {
        await promocionesService.update(
          editTarget.idPromocion,
          payload
        )
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
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>Promociones</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {data.length} promoción{data.length !== 1 ? 'es' : ''} · {data.filter((p) => p.activa).length} activas
          </p>
        </div>
        <Btn onClick={openNew}>+ Nueva promoción</Btn>
      </div>


      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar promoción..."
          style={inputStyle}
        />
      </div>
      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid #2e2e35', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {search.trim()
              ? `Sin resultados para "${search}"`
              : <><span>No hay promociones. </span><button onClick={openNew} style={{ color: 'var(--btn-bg)', background: 'none', border: 'none', cursor: 'pointer' }}>Creá la primera</button></>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2e2e35' }}>
                {headers.map((h) => (
                  <th
                    key={h.label}
                    onClick={() => handleSort(h.key)}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11,
                      color: sortKey === h.key ? 'var(--btn-bg)' : 'var(--text-muted)',
                      fontWeight: 500, fontFamily: 'DM Mono, monospace',
                      whiteSpace: 'nowrap',
                      cursor: h.key ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {h.label}
                    {h.key && sortKey === h.key && (
                      <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                    {h.key && sortKey !== h.key && (
                      <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, i) => (
                <tr key={p.idPromocion}
                  style={{ borderBottom: i < data.length - 1 ? '1px solid #2e2e35' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>#{p.idPromocion}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--text)' }}>{p.nombre}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion || '—'}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(p.fechaDesde)}</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>{fmt(p.fechaHasta)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 11, fontFamily: 'DM Mono, monospace',
                      padding: '2px 8px', borderRadius: 999,
                      background: p.esGeneral ? 'rgba(232,255,71,0.1)' : 'rgba(55,138,221,0.1)',
                      color: p.esGeneral ? 'var(--btn-bg)' : '#378add',
                      border: `1px solid ${p.esGeneral ? 'rgba(232,255,71,0.3)' : 'rgba(55,138,221,0.3)'}`,
                    }}>
                      {p.esGeneral ? 'General' : 'Por producto'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge activa={p.activa} />
                    <div style={{ marginTop: 4, fontSize: 11, color: p.esAplicable ? 'var(--success)' : 'var(--text-muted)' }}>
                      {p.esAplicable ? 'Aplicable hoy' : 'No aplicable'}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={async () => {
                          try {
                            await promocionesService.update(p.idPromocion, { activa: !p.activa })
                            toast(p.activa ? 'Promoción desactivada' : 'Promoción activada', 'success')
                            load()
                          } catch (e: any) { toast(e.message, 'error') }
                        }}
                        title={p.activa ? 'Desactivar' : 'Activar'}
                        style={{
                          width: 36, height: 20, borderRadius: 999, border: 'none', cursor: 'pointer',
                          background: p.activa ? 'var(--toggle-active)' : 'var(--border)', position: 'relative',
                          transition: 'background 0.2s', flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute', top: 2, left: p.activa ? 18 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: p.activa ? 'var(--bg)' : 'var(--text-muted)',
                          transition: 'left 0.2s',
                        }} />
                      </button>
                      <Btn variant="ghost" onClick={() => setViewTarget(p)} style={{ padding: '5px 12px', fontSize: 12 }}>Ver</Btn>
                      <Btn
                        variant="ghost"
                        //disabled={p.activa}
                        onClick={() => openEdit(p)}
                        style={{
                          padding: '5px 12px',
                          fontSize: 12,
                          // opacity: p.activa ? 0.5 : 1,
                          // cursor: p.activa ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Editar
                      </Btn>
                      <Btn variant="ghost" onClick={() => {
                        if (p.activa) { toast('No se puede eliminar una promoción activa. Desactivala primero.', 'error'); return }
                        setDeleteId(p.idPromocion)
                      }} style={{ padding: '5px 12px', fontSize: 12, color: 'var(--danger)', borderColor: 'rgba(248,113,113,0.3)' }}>Eliminar</Btn>
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
                selected={form.fechaDesde ? new Date(form.fechaDesde + 'T00:00:00') : null}
                onChange={(date: Date | null) =>
                  setForm((f) => ({
                    ...f,
                    fechaDesde: date
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
            <Field label="Fecha hasta *">
              <DatePicker
                selected={form.fechaHasta ? new Date(form.fechaHasta + 'T00:00:00') : null}
                onChange={(date: Date | null) =>
                  setForm((f) => ({
                    ...f,
                    fechaHasta: date
                      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                      : '',
                  }))
                }
                dateFormat="dd/MM/yyyy"
                locale="es"
                placeholderText="dd/mm/aaaa"
                minDate={form.fechaDesde ? new Date(form.fechaDesde + 'T00:00:00') : new Date()}
                customInput={<input style={inputStyle} />}
              />
            </Field>
          </div>

          {/* Detalle de productos */}
          <div style={{ borderTop: '1px solid #2e2e35', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 12 }}>
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
                style={{ width: 16, height: 16, accentColor: 'var(--btn-bg)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Descuento general (aplica a todos los productos)</span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--bg)', borderRadius: 8, padding: 12, marginBottom: 12 }}>

              {/* Slider siempre visible */}
              <Field label={`Descuento a aplicar: ${nuevoDetalle.descuentoPorcentaje}%`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 24 }}>1%</span>
                  <input
                    type="range" min={1} max={90} step={1}
                    value={nuevoDetalle.descuentoPorcentaje}
                    onChange={(e) => setNuevoDetalle((d) => ({ ...d, descuentoPorcentaje: Number(e.target.value) }))}
                    style={{ flex: 1, accentColor: 'var(--btn-bg)' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 28 }}>90%</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 500, color: 'var(--btn-bg)', minWidth: 40, textAlign: 'right' }}>
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
                      const p = productos.find((p) => p.idproducto === id)
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
                      .filter((p) => !form.detalle?.some((d) => d.idProducto === p.idproducto))
                      .map((p) => (
                        <option key={p.idproducto} value={p.idproducto}>#{p.idproducto} — {p.nombre}</option>
                      ))
                    }
                  </select>
                </Field>
              )}
            </div>

            {/* Lista productos solo si no es general */}
            {!form.esGeneral && (form.detalle ?? []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(form.detalle ?? []).map((d, index) => (
                  <div key={`${d.idProducto}-${index}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
                    border: '1px solid #2e2e35'
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--text)' }}>#{d.idProducto} — {d.nombreProducto}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--btn-bg)' }}>
                        {d.descuentoPorcentaje}%
                      </span>
                      <button
                        onClick={() => setForm((f) => ({ ...f, detalle: f.detalle?.filter((x) => x.idProducto !== d.idProducto) }))}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                      >×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


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

      {/* View Dialog */}
      <Dialog open={viewTarget !== null} title="Detalle de promoción" onClose={() => setViewTarget(null)} maxWidth={560}>
        {viewTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nombre + tipo */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>NOMBRE</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{viewTarget.nombre}</div>
              </div>
              <span style={{
                flexShrink: 0, fontSize: 11, fontFamily: 'DM Mono, monospace',
                padding: '3px 10px', borderRadius: 999,
                background: viewTarget.esGeneral ? 'rgba(232,255,71,0.1)' : 'rgba(55,138,221,0.1)',
                color: viewTarget.esGeneral ? 'var(--btn-bg)' : '#378add',
                border: `1px solid ${viewTarget.esGeneral ? 'rgba(232,255,71,0.3)' : 'rgba(55,138,221,0.3)'}`,
              }}>
                {viewTarget.esGeneral ? 'General' : 'Por producto'}
              </span>
            </div>

            {/* Descripción */}
            {viewTarget.descripcion && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>DESCRIPCIÓN</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{viewTarget.descripcion}</div>
              </div>
            )}

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid #2e2e35' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>FECHA DESDE</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{fmt(viewTarget.fechaDesde)}</div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid #2e2e35' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>FECHA HASTA</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>{fmt(viewTarget.fechaHasta)}</div>
              </div>
            </div>

            {/* Estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Badge activa={viewTarget.activa} />
              <span style={{ fontSize: 12, color: viewTarget.esAplicable ? 'var(--success)' : 'var(--text-muted)' }}>
                {viewTarget.esAplicable ? '● Aplicable hoy' : '○ No aplicable hoy'}
              </span>
            </div>

            {/* Descuento */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                {viewTarget.esGeneral ? 'DESCUENTO GENERAL' : 'PRODUCTOS CON DESCUENTO'}
              </div>
              {viewTarget.esGeneral ? (
                <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid #2e2e35', display: 'inline-block' }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, fontWeight: 700, color: 'var(--btn-bg)' }}>
                    {viewTarget.detalle?.[0]?.descuentoPorcentaje ?? '—'}%
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>sobre todos los productos</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(viewTarget.detalle ?? []).length === 0 ? (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin productos asignados</span>
                  ) : (viewTarget.detalle ?? []).map((d) => (
                    <div key={d.idProducto} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid #2e2e35',
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>#{d.idProducto} — {d.nombreProducto}</span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: 'var(--btn-bg)' }}>{d.descuentoPorcentaje}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Última actualización */}
            <div style={{ paddingTop: 8, borderTop: '1px solid #2e2e35', fontSize: 11, color: 'var(--text-muted)' }}>
              Última actualización: {fmt(viewTarget.updatedat)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setViewTarget(null)}>Cerrar</Btn>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</label>
      {children}
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
