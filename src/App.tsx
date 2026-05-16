import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { PromocionesPage } from './pages/Promociones'
import { CuponesPage, PuntosPage, ReportesPage } from './pages/Placeholders'
import { PrivateRoute } from './components/PrivateRoute'
import { LoginPage } from './pages/login'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
            <Route element={<Layout />}>
              <Route path="promociones" element={<PrivateRoute><PromocionesPage /></PrivateRoute>} />
              <Route path="cupones"     element={<PrivateRoute><CuponesPage /></PrivateRoute>} />
              <Route path="puntos"      element={<PrivateRoute><PuntosPage /></PrivateRoute>} />
              <Route path="reportes"    element={<ReportesPage />} /> {/* público */}
            </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
