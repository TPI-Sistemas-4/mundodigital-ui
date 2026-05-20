import { api } from './api'

export interface DetallePromocion {
  idProducto: number
  nombreProducto: string
  descuentoPorcentaje: number
}

export interface Promocion {
  updatedat: string
  idPromocion: number
  nombre: string
  descripcion: string
  fechaDesde: string
  fechaHasta: string
  activa: boolean
  eliminada?: boolean
  esAplicable?: boolean
  detalle?: DetallePromocion[]
  esGeneral?: boolean
}

export type NuevaPromocion = Omit<Promocion, 'idPromocion'>

// ── Mock data para la demo ───────────────────────────────────────────────────
const MOCK: Promocion[] = [
  {
    idPromocion: 1,
    nombre: 'Black Friday 2026',
    descripcion: 'Descuentos en electrónica seleccionada',
    fechaDesde: '2026-11-27T00:00:00',
    fechaHasta: '2026-11-30T23:59:59',
    activa: true,
    detalle: [
      { idProducto: 1, nombreProducto: 'Auriculares BT Pro', descuentoPorcentaje: 20 },
      { idProducto: 2, nombreProducto: 'Monitor 27"', descuentoPorcentaje: 15 },
    ],
    updatedat: '2026-10-01T12:00:00',
  },
  {
    idPromocion: 2,
    nombre: 'Cyber Monday',
    descripcion: 'Ofertas especiales en accesorios',
    fechaDesde: '2026-12-02T00:00:00',
    fechaHasta: '2026-12-02T23:59:59',
    activa: true,
    detalle: [
      { idProducto: 3, nombreProducto: 'Teclado Mecánico', descuentoPorcentaje: 25 },
    ],
    updatedat: '2026-10-01T12:00:00',
  },
  {
    idPromocion: 3,
    nombre: 'Liquidación Invierno',
    descripcion: 'Últimas unidades de temporada',
    fechaDesde: '2026-06-01T00:00:00',
    fechaHasta: '2026-06-15T23:59:59',
    activa: false,
    detalle: [],
    updatedat: '2026-05-20T09:30:00',
  },
]

let mockStore = [...MOCK]
let nextId = 4

// ── Service (usa mock; reemplazar por api.get/post cuando el backend esté) ───

export const promocionesService = {
  async getAll(): Promise<Promocion[]> {
    const { data } = await api.get<any[]>('/promociones')
    return data.map((p) => ({
      idPromocion: p.idpromocion,
      nombre: p.nombre,
      descripcion: p.descripcion,
      fechaDesde: p.fechadesde,
      fechaHasta: p.fechahasta,
      activa: p.activa,
      esAplicable: p.esAplicable,
      esGeneral: p.esGeneral,
      detalle: p.detallepromocion ?? [],
      updatedat: p.updatedat,
    }))
  },

  async getById(id: number): Promise<Promocion> {
    try {
      const { data } = await api.get<any>(`/promociones/${id}`)
      return {
        idPromocion: data.idpromocion,
        nombre: data.nombre,
        descripcion: data.descripcion,
        fechaDesde: data.fechadesde,
        fechaHasta: data.fechahasta,
        activa: data.activa,
        esAplicable: data.esAplicable,
        esGeneral: data.esgeneral,
        detalle: data.detallepromocion ?? [],
        updatedat: data.updatedat,
      }
    } catch {
      const p = mockStore.find((x) => x.idPromocion === id)
      if (!p) {
        throw new Error('Promoción no encontrada')
      }
      return p
    }
  },

  async buscarPorNombre(nombre: string): Promise<Promocion[]> {
    const { data } = await api.get(`/promociones/buscar/${nombre}`)
    return data
  },

  async create(payload: NuevaPromocion): Promise<Promocion> {
    const { data } = await api.post<Promocion>('/promociones', payload)
    return data
  },

  async update(id: number, payload: Partial<NuevaPromocion>): Promise<Promocion> {
    const { data } = await api.put<Promocion>(`/promociones/${id}`, payload)
    return data
  },

  async remove(id: number): Promise<void> {
    try {
      await api.delete(`/promociones/${id}`)
    } catch {
      mockStore = mockStore.map((p) =>
        p.idPromocion === id
          ? {
            ...p,
            eliminada: true,
            activa: false,
          }
          : p
      )
    }
  },

  async getVigentes(fecha?: string): Promise<Promocion[]> {
    const f = fecha ?? new Date().toISOString().split('T')[0]
    try {
      const { data } = await api.get<Promocion[]>(`/promociones/vigentes?fecha=${f}`)
      return data
    } catch {
      return mockStore.filter((p) => {
        const now = new Date(f)
        return !p.eliminada && p.activa && new Date(p.fechaDesde) <= now && now <= new Date(p.fechaHasta)
      })
    }
  },
}
