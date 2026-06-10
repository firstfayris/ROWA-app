import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  Settings, LogOut, Store, ChevronLeft, ChevronRight, Megaphone, ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useState } from 'react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'ภาพรวม' },
  { to: '/products', icon: Package, label: 'สินค้า & สต็อก' },
  { to: '/orders', icon: ShoppingCart, label: 'คำสั่งซื้อ' },
  { to: '/stock-audit', icon: ClipboardList, label: 'ตรวจนับสต็อก' },
  { to: '/reports', icon: BarChart3, label: 'รายงาน' },
  { to: '/marketing', icon: Megaphone, label: 'ค่าใช้จ่าย' },
  { to: '/settings', icon: Settings, label: 'ตั้งค่า', adminOnly: true },
]

export function Sidebar() {
  const { profile, signOut } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-gray-100 h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 p-4 border-b border-gray-100', collapsed && 'justify-center px-2')}>
        <div className="w-8 h-8 rounded-lg bg-rowa-blue flex items-center justify-center flex-shrink-0">
          <Store className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-bold text-rowa-blue text-lg leading-none">ROWA</p>
            <p className="text-[10px] text-rowa-muted">ระบบจัดการร้านค้า</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter(item => !item.adminOnly || profile?.role === 'admin')
          .map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  collapsed && 'justify-center px-2',
                  isActive
                    ? 'bg-rowa-blue text-white'
                    : 'text-gray-600 hover:bg-rowa-bg hover:text-rowa-blue'
                )
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 space-y-1">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-rowa-pink/20 flex items-center justify-center">
              <span className="text-sm font-bold text-rowa-pink">
                {profile?.full_name?.[0]?.toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-rowa-muted capitalize">{profile?.role === 'admin' ? 'ผู้ดูแล' : 'พนักงาน'}</p>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 w-full transition-colors',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-1.5 rounded-lg text-gray-400 hover:text-rowa-blue hover:bg-rowa-bg transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
