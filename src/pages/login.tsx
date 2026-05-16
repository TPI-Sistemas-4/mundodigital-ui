import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../services/auth'
import { useToast } from '../components/Toast'
import { Btn } from '../components/Dialog'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async () => {
    if (!email || !password) { toast('Completá los campos', 'error'); return }
    setLoading(true)
    try {
      await authService.login(email, password)
      toast('Bienvenido', 'success')
      navigate('/promociones')
    } catch (e: any) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f10' }}>
      <div style={{ background: '#18181b', border: '1px solid #2e2e35', borderRadius: 12, padding: 32, width: '100%', maxWidth: 380 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#71717a', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>MUNDODIGITAL S.A.</div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#f4f4f5' }}>Marketing <span style={{ color: '#e8ff47' }}>G4</span></h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" placeholder="Contraseña" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
          <Btn onClick={handleSubmit} disabled={loading} style={{ width: '100%', padding: '10px', marginTop: 4 }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0f0f10', border: '1px solid #2e2e35', borderRadius: 8,
  padding: '10px 12px', color: '#f4f4f5', fontSize: 14, width: '100%',
  outline: 'none', fontFamily: 'DM Sans, sans-serif',
}