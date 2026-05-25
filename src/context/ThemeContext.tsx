import React, { createContext, useContext, useEffect, useState } from 'react'

interface ThemeCtx {
  isDark: boolean
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ isDark: true, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') !== 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return (
    <Ctx.Provider value={{ isDark, toggle: () => setIsDark((d) => !d) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
