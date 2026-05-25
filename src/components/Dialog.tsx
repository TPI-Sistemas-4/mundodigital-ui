import React from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}

export function Dialog({ open, title, onClose, children, maxWidth = 520 }: Props) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth,
          padding: '24px',
          animation: 'dialogIn 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: 20, lineHeight: 1, cursor: 'pointer', padding: '0 4px',
            }}
          >×</button>
        </div>
        {children}
      </div>
      <style>{`@keyframes dialogIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  )
}

interface ConfirmProps {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, message, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog open={open} title="Confirmar acción" onClose={onCancel} maxWidth={380}>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn variant="danger" onClick={onConfirm}>Confirmar</Btn>
      </div>
    </Dialog>
  )
}

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
}

export function Btn({ variant = 'primary', children, style, ...rest }: BtnProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--btn-bg)', color: 'var(--btn-text)', border: 'none', fontWeight: 500 },
    ghost: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    danger: { background: 'var(--danger)', color: '#ffffff', border: 'none', fontWeight: 500 },
  }
  return (
    <button
      {...rest}
      style={{
        padding: '8px 16px', borderRadius: 8, fontSize: 13,
        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
        ...styles[variant], ...style,
      }}
    >
      {children}
    </button>
  )
}
