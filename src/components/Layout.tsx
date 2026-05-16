import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { authService } from '../services/auth'

const NAV = [
  { to: '/promociones', label: 'Promociones', icon: '⚡' },
  { to: '/cupones', label: 'Cupones', icon: '🎫' },
  { to: '/puntos', label: 'Puntos', icon: '⭐' },
  { to: '/reportes', label: 'Reportes', icon: '📊' },
]

export function Layout() {

  const navigate = useNavigate()

  const handleLogout = () => {
    authService.logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0,
        background: '#0f0f10',
        borderRight: '1px solid #2e2e35',
        display: 'flex', flexDirection: 'column',
        padding: '20px 12px',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
      }}>
        {/* Brand */}
        <div style={{ padding: '0 8px 24px', borderBottom: '1px solid #2e2e35', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#71717a', fontFamily: 'DM Mono, monospace', marginBottom: 2 }}>
            MUNDODIGITAL S.A.
          </div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#f4f4f5' }}>
            Marketing <span style={{ color: '#e8ff47' }}>G4</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                fontSize: 14, fontWeight: isActive ? 500 : 400,
                color: isActive ? '#e8ff47' : '#a1a1aa',
                background: isActive ? 'rgba(232,255,71,0.08)' : 'transparent',
                transition: 'all 0.15s',
                textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 8px 0', borderTop: '1px solid #2e2e35' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'transparent', border: '1px solid #2e2e35',
              color: '#71717a', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'DM Sans, sans-serif', marginBottom: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#f87171'
              e.currentTarget.style.color = '#f87171'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2e2e35'
              e.currentTarget.style.color = '#71717a'
            }}
          >
            <span>→</span> Cerrar sesión
          </button>
          <div style={{ fontSize: 11, color: '#3f3f46' }}>Sprint 1 · v0.1.0</div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
