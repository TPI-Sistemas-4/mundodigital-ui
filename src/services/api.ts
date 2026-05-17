import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_API_KEY,
  },
  timeout: 10000,
})
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? err.message ?? 'Error de conexión'
    return Promise.reject(new Error(msg))
  }
)

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})