import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { TrendingUp, Package, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Platform } from '../lib/types'

const PLATFORM_COLORS: Record<Platform, string> = {
  lazada: '#F97316',
  shopee: '#EF4444',
  store: '#4B5DB8',
}

interface LowStockItem {
  id: string
  sku: string
  name: string
  current_stock: number
}

interface RevenueRow {
  date: string
  amount: number
}

interface PlatformRevenue {
  platform: Platform
  amount: number
}

export function DashboardPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [loading, setLoading] = useState(true)
  const [revenue, setRevenue] = useState(0)
  const [profit, setProfit] = useState(0)
  const [orderCount, setOrderCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [dailyRevenue, setDailyRevenue] = useState<RevenueRow[]>([])
  const [platformRevenue, setPlatformRevenue] = useState<PlatformRevenue[]>([])
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [ordersRes, stockRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(quantity, unit_price, cost_price_at_sale)')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .neq('status', 'cancelled'),
        supabase.from('product_stock').select('*'),
      ])

      const orders = ordersRes.data ?? []
      const stock = stockRes.data ?? []

      let totalRevenue = 0
      let totalCost = 0
      const byPlatform: Record<string, number> = {}
      const byDate: Record<string, number> = {}

      for (const order of orders) {
        totalRevenue += order.total_amount
        const date = order.created_at.split('T')[0]
        byDate[date] = (byDate[date] ?? 0) + order.total_amount
        byPlatform[order.platform] = (byPlatform[order.platform] ?? 0) + order.total_amount
        for (const item of order.order_items ?? []) {
          totalCost += item.cost_price_at_sale * item.quantity
        }
      }

      setRevenue(totalRevenue)
      setProfit(totalRevenue - totalCost)
      setOrderCount(orders.length)

      const lowStock = stock.filter((s: LowStockItem) => s.current_stock <= 5)
      setLowStockCount(lowStock.length)
      setLowStockItems(lowStock.slice(0, 5))

      const sortedDates = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({
          date: new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
          amount,
        }))
      setDailyRevenue(sortedDates)

      setPlatformRevenue(
        Object.entries(byPlatform).map(([platform, amount]) => ({
          platform: platform as Platform,
          amount,
        }))
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDashboard() }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">ภาพรวม</h1>
          <p className="text-rowa-muted text-sm">ข้อมูล 30 วันที่ผ่านมา</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchDashboard} loading={loading}>
          <RefreshCw className="h-4 w-4" />
          รีเฟรช
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <>
            <StatCard
              title="รายได้รวม"
              value={formatCurrency(revenue)}
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="กำไรสุทธิ"
              value={formatCurrency(profit)}
              icon={TrendingUp}
              color="green"
            />
          </>
        )}
        <StatCard
          title="คำสั่งซื้อ"
          value={orderCount.toString()}
          subtitle="30 วันที่ผ่านมา"
          icon={ShoppingCart}
          color="pink"
        />
        <StatCard
          title="สินค้าใกล้หมด"
          value={lowStockCount.toString()}
          subtitle="สต็อก ≤ 5 ชิ้น"
          icon={AlertTriangle}
          color="orange"
        />
        {!isAdmin && (
          <StatCard
            title="สินค้าทั้งหมด"
            value="-"
            icon={Package}
            color="blue"
          />
        )}
      </div>

      {/* Charts */}
      {isAdmin && (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Revenue chart */}
          <div className="card lg:col-span-2">
            <h2 className="font-semibold text-rowa-text mb-4">รายได้รายวัน</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyRevenue}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4B5DB8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4B5DB8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#4B5DB8"
                  strokeWidth={2}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform pie */}
          <div className="card">
            <h2 className="font-semibold text-rowa-text mb-4">รายได้ตาม Platform</h2>
            {platformRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={platformRevenue}
                    dataKey="amount"
                    nameKey="platform"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                  >
                    {platformRevenue.map(entry => (
                      <Cell key={entry.platform} fill={PLATFORM_COLORS[entry.platform]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend
                    formatter={value => ({ lazada: 'Lazada', shopee: 'Shopee', store: 'หน้าร้าน' }[value] ?? value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-rowa-muted text-sm">
                ยังไม่มีข้อมูล
              </div>
            )}
          </div>
        </div>
      )}

      {/* Low stock */}
      {lowStockItems.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <h2 className="font-semibold text-rowa-text">สินค้าใกล้หมด</h2>
          </div>
          <div className="space-y-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-rowa-text">{item.name}</p>
                  <p className="text-xs text-rowa-muted">SKU: {item.sku}</p>
                </div>
                <Badge variant={item.current_stock === 0 ? 'danger' : 'warning'}>
                  {item.current_stock === 0 ? 'หมดสต็อก' : `${item.current_stock} ชิ้น`}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
