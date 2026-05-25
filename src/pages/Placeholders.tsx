import React from 'react'

function ComingSoon({ title, icon, desc }: { title: string; icon: string; desc: string }) {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>G4 · MARKETING</div>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--text)' }}>{title}</h1>
      </div>
      <div style={{
        background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12,
        padding: 60, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{desc}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'DM Mono, monospace' }}>Sprint 2</div>
      </div>
    </div>
  )
}

export function CuponesPage() {
  return <ComingSoon title="Cupones" icon="🎫" desc="Gestión de cupones de descuento personalizados" />
}

export function PuntosPage() {
  return <ComingSoon title="Puntos" icon="⭐" desc="Sistema de fidelización y saldo de puntos por cliente" />
}

export function ReportesPage() {
  return <ComingSoon title="Reportes" icon="📊" desc="Reportes gráficos de promociones, cupones y fidelización" />
}
