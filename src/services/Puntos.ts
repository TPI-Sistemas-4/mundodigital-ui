import { api } from './api';

export interface RegistrarPuntosPayload {
  idventa: number;
}

export interface MovimientoPuntos {
  idpunto: number;
  idcliente: number;
  idventa: number | null;
  puntosotorgados: number;
  concepto: string;
  fecha: string;
  ventas: { idventa: number; total: string; fechaventa: string } | null;
}

export interface SaldoCliente {
  cliente: { idcliente: number; nombre: string; apellido: string; email: string };
  saldo: number;
}

export interface HistorialCliente {
  cliente: { idcliente: number; nombre: string; apellido: string; email: string };
  saldo: number;
  movimientos: MovimientoPuntos[];
  regla: string;
}

export interface VentaPreview {
  idventa: number;
  total: number;
  fechaventa: string;
  idcliente: number;
  cliente: { idcliente: number; nombre: string; apellido: string; email: string };
  detalleventas: { iddetalle: number; idproducto: number; cantidad: number; preciounitario: string }[];
}

export interface RegistroResult {
  registro: MovimientoPuntos;
  venta: VentaPreview;
  puntosotorgados: number;
  saldo: number;
  regla: string;
}

export const puntosService = {
  async registrar(payload: RegistrarPuntosPayload): Promise<RegistroResult> {
    const { data } = await api.post<RegistroResult>('/puntos', payload);
    return data;
  },

  async listarSaldos(): Promise<SaldoCliente[]> {
    const { data } = await api.get<SaldoCliente[]>('/puntos');
    return data;
  },

  async getHistorial(idcliente: number): Promise<HistorialCliente> {
    const { data } = await api.get<HistorialCliente>(`/puntos/cliente/${idcliente}`);
    return data;
  },

  async consultarSaldo(idcliente: number): Promise<ConsultaSaldo> {
    const { data } = await api.get<ConsultaSaldo>(`/puntos/cliente/${idcliente}/saldo`);
    return data;
  },

  async getRegla(): Promise<{ importePorPunto: number; descripcion: string }> {
    const { data } = await api.get('/puntos/regla');
    return data;
  },

  async getVenta(idventa: number): Promise<VentaPreview> {
    const { data } = await api.get<VentaPreview>(`/ventas/${idventa}`);
    return data;
  },
};

export interface CriterioFrecuente {
  puntosRequeridos: number;
  comprasRequeridas: number;
  cumplePuntos: boolean;
  cumpleCompras: boolean;
}

export interface ConsultaSaldo {
  cliente: { idcliente: number; nombre: string; apellido: string; email: string; activo: boolean };
  saldo: number;
  cantidadCompras: number;
  esFrecuente: boolean;
  criterioFrecuente: CriterioFrecuente;
  ultimosMovimientos: MovimientoPuntos[];
  regla: string;
}