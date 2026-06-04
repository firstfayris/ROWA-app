import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Toaster } from 'react-hot-toast'

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-rowa-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'font-sans text-sm',
          success: { iconTheme: { primary: '#4B5DB8', secondary: '#fff' } },
        }}
      />
    </div>
  )
}
