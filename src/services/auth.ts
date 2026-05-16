import { api } from './api'

export interface AuthUser {
  token: string
  rol: 'SISTEMA' | 'CLIENTE'
}

export const authService = {
  async login(email: string, password: string): Promise<AuthUser> {
    const { data } = await api.post<AuthUser>('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('rol', data.rol)
    return data
  },

  logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('rol')
  },

  getToken: () => localStorage.getItem('token'),
  getRol: () => localStorage.getItem('rol') as AuthUser['rol'] | null,
  isAuthenticated: () => !!localStorage.getItem('token'),
}