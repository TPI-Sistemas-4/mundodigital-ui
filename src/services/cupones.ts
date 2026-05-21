import { api } from './api';

export interface CreateCuponPayload {
  codigo: string;
  descuentoporcentaje: number;
  idcliente?: number;
  idpromocion?: number;
  fechavencimiento?: string; // ISO string
}

export interface Cupon {
  idcupon: number;
  codigo: string;
  descuentoporcentaje: number;
  activo: boolean;
  fechavencimiento: string | null;
  clientes: { idcliente: number; nombre: string; apellido: string; email: string } | null;
  promociones: { idpromocion: number; nombre: string } | null;
}

export const cuponesService = {
  async crear(payload: CreateCuponPayload): Promise<Cupon> {
    const { data } = await api.post<Cupon>('/cupones', payload);
    return data;
  },

  async listar(): Promise<Cupon[]> {
    const { data } = await api.get<Cupon[]>('/cupones');
    return data;
  },

  async generarCodigo(): Promise<string> {
    const { data } = await api.get<{ codigo: string }>('/cupones/generar-codigo');
    return data.codigo;
  },
};