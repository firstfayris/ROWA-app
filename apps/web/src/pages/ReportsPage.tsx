import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import type { Platform } from '../lib/types'

interface PlatformRow {
  platform: Platform
  revenue: number
  cost: number
  profit: number
  orders: number
}

const platformLabelTh: Record<Platform, string> = {
  lazada: 'Lazada',
  shopee: 'Shopee',
  store: 'หน้าร้าน',
}

export function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [totalOrders, setTotalOrders] = useState(0)
  const [platformRows, setPlatformRows] = useState<PlatformRow[]>([])

  const fetchReport = async () => {
    setLoading(true)
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, cost_price_at_sale)')
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo + 'T23:59:59')
      .neq('status', 'cancelled')

    const byPlatform: Record<string, PlatformRow> = {}
    let rev = 0, cost = 0, ord = 0

    for (const order of orders ?? []) {
      if (!byPlatform[order.platform]) {
        byPlatform[order.platform] = { platform: order.platform, revenue: 0, cost: 0, profit: 0, orders: 0 }
      }
      byPlatform[order.platform].revenue += order.total_amount
      byPlatform[order.platform].orders++
      rev += order.total_amount
      ord++
      for (const item of order.order_items ?? []) {
        const c = item.cost_price_at_sale * item.quantity
        byPlatform[order.platform].cost += c
        cost += c
      }
    }

    Object.values(byPlatform).forEach(r => { r.profit = r.revenue - r.cost })
    setTotalRevenue(rev)
    setTotalCost(cost)
    setTotalOrders(ord)
    setPlatformRows(Object.values(byPlatform))
    setLoading(false)
  }

  useEffect(() => { fetchReport() }, [])

  const grossProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">รายงาน กำไร-ขาดทุน</h1>
          <p className="text-rowa-muted text-sm">เฉพาะ Admin เท่านั้น</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchReport} loading={loading}>
          <RefreshCw className="h-4 w-4" /> รีเฟรช
        </Button>
      </div>

      {/* Date range */}
      <div className="card flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">จากวันที่</label>
          <input type="date" className="input w-auto" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">ถึงวันที่</label>
          <input type="date" className="input w-auto" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button onClick={fetchReport} loading={loading}>ดูรายงาน</Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="รายได้รวม" value={formatCurrency(totalRevenue)} icon={TrendingUp} color="blue" />
        <StatCard title="ต้นทุนรวม" value={formatCurrency(totalCost)} icon={DollarSign} color="orange" />
        <StatCard
          title="กำไรสุทธิ"
          value={formatCurrency(grossProfit)}
          icon={grossProfit >= 0 ? TrendingUp : TrendingDown}
          color={grossProfit >= 0 ? 'green' : 'pink'}
        />
        <StatCard title="Margin" value={`${margin.toFixed(1)}%`} subtitle={`${totalOrders} orders`} icon={TrendingUp} color="blue" />
      </div>

      {/* Platform breakdown chart */}
      {platformRows.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-4">รายได้ vs ต้นทุน vs กำไร ตาม Platform</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={platformRows.map(r => ({ ...r, name: platformLabelTh[r.platform] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={v => `฿${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="revenue" name="รายได้" fill="#4B5DB8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cost" name="ต้นทุน" fill="#F08090" radius={[4, 4, 0, 0]} />
              <Bar dataKey="profit" name="กำไร" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform table */}
      {platformRows.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">สรุปตาม Platform</h2>
            <Button variant="secondary" size="sm">
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-rowa-bg/50">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">Platform</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">Orders</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">รายได้</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">ต้นทุน</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-6 py-3">กำไร</th>
              </tr>
            </thead>
            <tbody>
              {platformRows.map(row => (
                <tr key={row.platform} className="border-t border-gray-50">
                  <td className="px-6 py-3 font-medium">{platformLabelTh[row.platform]}</td>
                  <td className="px-4 py-3 text-right text-sm">{row.orders}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(row.revenue)}</td>
                  <td className="px-4 py-3 text-right text-sm text-orange-600">{formatCurrency(row.cost)}</td>
                  <td className={`px-6 py-3 text-right text-sm font-semibold ${row.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {formatCurrency(row.profit)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-rowa-bg/30 font-semibold">
                <td className="px-6 py-3">รวม</td>
                <td className="px-4 py-3 text-right">{totalOrders}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(totalRevenue)}</td>
                <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totalCost)}</td>
                <td className={`px-6 py-3 text-right ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(grossProfit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
