import React, { useState, useEffect } from 'react'
import { cuponesService, type CreateCuponPayload, type UpdateCuponPayload, type Cupon } from '../services/cupones'
import { useToast } from '../components/Toast'
import { Dialog, ConfirmDialog, Btn } from '../components/Dialog'
import { api } from '../services/api'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { CustomDatePicker } from '../components/CustomDatePicker'
import { exportCuponesPdf } from '../utils/exportPdf'

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

function Badge({ activo, fechavencimiento }: { activo: boolean; fechavencimiento: string | null }) {
  const vencido = activo && !!fechavencimiento && new Date(fechavencimiento) < new Date()
  const label = !activo ? 'Anulado' : vencido ? 'Vencido' : 'Activo'
  const color = !activo ? 'var(--text-muted)' : vencido ? 'var(--warning)' : 'var(--success)'
  const bg = !activo ? 'rgba(113,113,122,0.1)' : vencido ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)'
  const border = !activo ? 'rgba(113,113,122,0.3)' : vencido ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.3)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'DM Mono, monospace',
      background: bg, color, border: `1px solid ${border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

function Field({ label, children, required, hint }: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
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
  color: 'var(--text-muted)',
  cursor: 'not-allowed',
  background: 'var(--bg)',
}

type FiltroEstado = 'todos' | 'activo' | 'vencido' | 'anulado'

export function CuponesPage() {
  const { toast } = useToast()
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDesde, setFilterDesde] = useState<Date | null>(null)
  const [filterHasta, setFilterHasta] = useState<Date | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')

  // create
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateCuponPayload>(EMPTY_CREATE)
  const [promoSeleccionada, setPromoSeleccionada] = useState<Promocion | null>(null)
  const [creating, setCreating] = useState(false)
  const [generando, setGenerando] = useState(false)

  // view
  const [viewTarget, setViewTarget] = useState<Cupon | null>(null)

  // edit
  const [editTarget, setEditTarget] = useState<Cupon | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ idcliente: null, activo: true, descuentoporcentaje: 10, fechavencimiento: '' })
  const [editing, setEditing] = useState(false)

  // anular
  const [anularId, setAnularId] = useState<number | null>(null)

  // sort
  type SortKey = 'id' | 'codigo' | 'descuento' | 'cliente' | 'promocion' | 'vencimiento' | 'activo'
  type SortDir = 'asc' | 'desc'
  const [sortKey, setSortKey] = useState<SortKey>('id')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (key: SortKey | null) => {
    if (!key) return
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

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
        idcliente: editForm.idcliente,
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

  const filtered = cupones.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase()
      const matchText =
        c.codigo.toLowerCase().includes(q) ||
        (c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}`.toLowerCase().includes(q) : false) ||
        (c.promociones?.nombre.toLowerCase().includes(q) ?? false)
      if (!matchText) return false
    }
    if (filterDesde && c.fechavencimiento && new Date(c.fechavencimiento) < filterDesde) return false
    if (filterHasta && c.fechavencimiento && new Date(c.fechavencimiento) > filterHasta) return false
    if (filtroEstado !== 'todos') {
      const vencido = c.activo && !!c.fechavencimiento && new Date(c.fechavencimiento) < new Date()
      if (filtroEstado === 'activo' && (!c.activo || vencido)) return false
      if (filtroEstado === 'vencido' && !vencido) return false
      if (filtroEstado === 'anulado' && c.activo) return false
    }
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let valA: any, valB: any
    switch (sortKey) {
      case 'id': valA = a.idcupon; valB = b.idcupon; break
      case 'codigo': valA = a.codigo.toLowerCase(); valB = b.codigo.toLowerCase(); break
      case 'descuento': valA = a.descuentoporcentaje; valB = b.descuentoporcentaje; break
      case 'cliente':
        valA = a.clientes ? `${a.clientes.nombre} ${a.clientes.apellido}`.toLowerCase() : ''
        valB = b.clientes ? `${b.clientes.nombre} ${b.clientes.apellido}`.toLowerCase() : ''
        break
      case 'promocion':
        valA = a.promociones?.nombre.toLowerCase() ?? ''
        valB = b.promociones?.nombre.toLowerCase() ?? ''
        break
      case 'vencimiento':
        valA = a.fechavencimiento ? new Date(a.fechavencimiento).getTime() : 0
        valB = b.fechavencimiento ? new Date(b.fechavencimiento).getTime() : 0
        break
      case 'activo': {
        const estadoVal = (c: Cupon) => {
          if (!c.activo) return 0
          if (c.fechavencimiento && new Date(c.fechavencimiento) < new Date()) return 1
          return 2
        }
        valA = estadoVal(a); valB = estadoVal(b); break
      }
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1
    if (valA > valB) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const headers: { label: string; key: SortKey | null }[] = [
    { label: 'ID', key: 'id' },
    { label: 'Codigo', key: 'codigo' },
    { label: 'Descuento', key: 'descuento' },
    { label: 'Cliente', key: 'cliente' },
    { label: 'Promocion', key: 'promocion' },
    { label: 'Vencimiento', key: 'vencimiento' },
    { label: 'Estado', key: 'activo' },
    { label: '', key: null },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>Cupones</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {cupones.length} cupon{cupones.length !== 1 ? 'es' : ''} · {cupones.filter(c => c.activo).length} activos
          </p>
        </div>
        <Btn onClick={() => { setCreateForm(EMPTY_CREATE); setPromoSeleccionada(null); setCreateOpen(true) }}>+ Nuevo cupon</Btn>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 10 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, cliente o promoción..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
          style={{ ...inputStyle, width: 130, appearance: 'none', cursor: 'pointer' }}
        >
          <option value="todos">Todos</option>
          <option value="activo">Activos</option>
          <option value="vencido">Vencidos</option>
          <option value="anulado">Anulados</option>
        </select>
        <CustomDatePicker
          selected={filterDesde}
          onChange={(date: Date | null) => setFilterDesde(date)}
          selectsStart
          startDate={filterDesde}
          endDate={filterHasta}
          placeholderText="Vence desde"
          isClearable
          width={140}
        />
        <CustomDatePicker
          selected={filterHasta}
          onChange={(date: Date | null) => setFilterHasta(date)}
          selectsEnd
          startDate={filterDesde}
          endDate={filterHasta}
          minDate={filterDesde ?? undefined}
          placeholderText="Vence hasta"
          isClearable
          width={140}
        />
        <Btn
          variant="ghost"
          onClick={() => exportCuponesPdf(sorted, { search, estado: filtroEstado, desde: filterDesde, hasta: filterHasta })}
          disabled={sorted.length === 0}
          style={{ color: '#a78bfa', borderColor: 'rgba(167,139,250,0.35)', background: 'rgba(167,139,250,0.08)', whiteSpace: 'nowrap' }}
        >
          ↓ PDF
        </Btn>
      </div>

      {/* Tabla */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            {search.trim()
              ? `Sin resultados para "${search}"`
              : <><span>No hay cupones. </span><button onClick={() => setCreateOpen(true)} style={{ color: 'var(--btn-bg)', background: 'none', border: 'none', cursor: 'pointer' }}>Crea el primero</button></>}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {headers.map(h => (
                  <th
                    key={h.label}
                    onClick={() => handleSort(h.key)}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11,
                      color: sortKey === h.key ? 'var(--btn-bg)' : 'var(--text-muted)',
                      fontWeight: 500, fontFamily: 'DM Mono, monospace',
                      whiteSpace: 'nowrap', cursor: h.key ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {h.label}
                    {h.key && sortKey === h.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                    {h.key && sortKey !== h.key && <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr
                  key={c.idcupon}
                  style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>#{c.idcupon}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--btn-bg)', fontSize: 13 }}>{c.codigo}</td>
                  <td style={{ padding: '14px 16px', fontFamily: 'DM Mono, monospace', color: 'var(--text)', fontSize: 13 }}>{c.descuentoporcentaje}%</td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {c.clientes ? `${c.clientes.nombre} ${c.clientes.apellido}` : 'General'}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                    {c.promociones ? c.promociones.nombre : '-'}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap' }}>
                    {c.fechavencimiento ? fmt(c.fechavencimiento) : '-'}
                  </td>
                  <td style={{ padding: '14px 16px' }}><Badge activo={c.activo} fechavencimiento={c.fechavencimiento} /></td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Btn variant="ghost" onClick={() => setViewTarget(c)} style={{ padding: '5px 12px', fontSize: 12 }}>
                        Ver
                      </Btn>
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
                          color: c.activo ? 'var(--danger)' : 'var(--text-dim)',
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
              style={{ ...inputStyle, appearance: 'none', borderColor: !createForm.idpromocion ? 'rgba(248,113,113,0.4)' : 'var(--border)' }}
            >
              <option value="">- Selecciona una promocion -</option>
              {promociones.map(p => (
                <option key={p.idpromocion} value={p.idpromocion}>{p.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Descuento de la promocion">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'var(--btn-bg)', width: `${createForm.descuentoporcentaje}%`, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: promoSeleccionada ? 'var(--btn-bg)' : 'var(--text-dim)', minWidth: 40, textAlign: 'right' }}>
                {createForm.descuentoporcentaje}%
              </span>
            </div>
            {!promoSeleccionada && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Selecciona una promocion para ver el descuento</span>}
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
              style={promoSeleccionada ? readonlyStyle : { ...readonlyStyle, color: 'var(--text-dim)' }}
            />
            {promoSeleccionada && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Corresponde a la fecha hasta de la promocion</span>}
          </Field>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
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

            <Field label="Codigo" hint="El codigo unico no se puede modificar">
              <input readOnly value={editTarget.codigo} style={{ ...readonlyStyle, fontFamily: 'DM Mono, monospace', fontWeight: 600, color: 'var(--btn-bg)' }} />
            </Field>

            <Field label="Promocion asociada">
              <input
                readOnly
                value={editTarget.promociones ? editTarget.promociones.nombre : '- Sin promocion -'}
                style={readonlyStyle}
              />
              {tienePromocion && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>El descuento y vencimiento se rigen por la promocion</span>
              )}
            </Field>

            <Field label={`Descuento${tienePromocion ? ' (de la promocion)' : ''}`}>
              {tienePromocion ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: 'var(--btn-bg)', width: `${editForm.descuentoporcentaje}%` }} />
                  </div>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--btn-bg)', minWidth: 40, textAlign: 'right' }}>
                    {editForm.descuentoporcentaje}%
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 24 }}>1%</span>
                  <input
                    type="range" min={1} max={100} step={1}
                    value={editForm.descuentoporcentaje}
                    onChange={e => setEditForm(f => ({ ...f, descuentoporcentaje: Number(e.target.value) }))}
                    style={{ flex: 1, accentColor: 'var(--btn-bg)' as any }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 32 }}>100%</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: 'var(--btn-bg)', minWidth: 40, textAlign: 'right' }}>
                    {editForm.descuentoporcentaje}%
                  </span>
                </div>
              )}
            </Field>

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

            <Field label="Estado">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editForm.activo}
                  onChange={e => setEditForm(f => ({ ...f, activo: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--btn-bg)' as any }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Cupon activo</span>
              </label>
            </Field>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn variant="ghost" onClick={() => setEditTarget(null)}>Cancelar</Btn>
              <Btn onClick={handleEdit} disabled={editing}>{editing ? 'Guardando...' : 'Guardar cambios'}</Btn>
            </div>
          </div>
        )}
      </Dialog>

      {/* ── Dialog: Ver cupon ── */}
      <Dialog open={viewTarget !== null} title="Detalle de cupón" onClose={() => setViewTarget(null)} maxWidth={480}>
        {viewTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Código + estado */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CÓDIGO</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--btn-bg)' }}>{viewTarget.codigo}</div>
              </div>
              <Badge activo={viewTarget.activo} fechavencimiento={viewTarget.fechavencimiento} />
            </div>

            {/* Descuento */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>DESCUENTO</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, background: 'var(--btn-bg)', width: `${viewTarget.descuentoporcentaje}%` }} />
                </div>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 700, color: 'var(--btn-bg)', minWidth: 48, textAlign: 'right' }}>
                  {viewTarget.descuentoporcentaje}%
                </span>
              </div>
            </div>

            {/* Fechas y cliente */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>VENCIMIENTO</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontFamily: 'DM Mono, monospace' }}>
                  {viewTarget.fechavencimiento ? fmt(viewTarget.fechavencimiento) : '-'}
                </div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>CLIENTE</div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {viewTarget.clientes ? `${viewTarget.clientes.nombre} ${viewTarget.clientes.apellido}` : 'General'}
                </div>
                {viewTarget.clientes && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{viewTarget.clientes.email}</div>
                )}
              </div>
            </div>

            {/* Promoción */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>PROMOCIÓN ASOCIADA</div>
              <div style={{ fontSize: 13, color: viewTarget.promociones ? 'var(--text)' : 'var(--text-muted)' }}>
                {viewTarget.promociones ? viewTarget.promociones.nombre : 'Sin promoción'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <Btn variant="ghost" onClick={() => setViewTarget(null)}>Cerrar</Btn>
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
