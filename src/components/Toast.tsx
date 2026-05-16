import React, { createContext, useCallback, useContext, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastCtx {
  toast: (msg: string, type?: ToastType) => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })

let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_id
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const colors: Record<ToastType, string> = {
    success: '#4ade80',
    error: '#f87171',
    info: '#e8ff47',
  }

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: '#18181b',
            border: `1px solid ${colors[t.type]}`,
            color: '#f4f4f5',
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 240,
            maxWidth: 360,
            animation: 'slideIn 0.2s ease',
            boxShadow: `0 0 20px ${colors[t.type]}22`,
          }}>
            <span style={{ color: colors[t.type], fontSize: 16 }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✗' : '·'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
