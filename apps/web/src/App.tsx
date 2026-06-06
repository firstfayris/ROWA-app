import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useAuthStore } from '@/store/authStore'
import { Layout } from '@/components/layout/Layout'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { MarketingPage } from '@/pages/MarketingPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rowa-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rowa-blue flex items-center justify-center animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-rowa-muted text-sm">กำลังโหลด...</p>
        </div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthStore()
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  useSupabaseAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="reports" element={<RequireAdmin><ReportsPage /></RequireAdmin>} />
          <Route path="marketing" element={<RequireAdmin><MarketingPage /></RequireAdmin>} />
          <Route path="settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
