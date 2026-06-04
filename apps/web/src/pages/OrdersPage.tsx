import { useEffect, useState } from 'react'
import { ShoppingCart, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency, platformLabel } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Platform, OrderStatus } from '@rowa/core'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface OrderRow {
  id: string
  platform: Platform
  platform_order_id: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
  order_items?: { id: string; quantity: number; unit_price: number; product?: { name: string } }[]
}

interface SaleItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  cost_price: number
}

const statusLabel: Record<OrderStatus, string> = {
  pending: 'รอดำเนินการ',
  confirmed: 'ยืนยันแล้ว',
  shipped: 'จัดส่งแล้ว',
  delivered: 'ส่งถึงแล้ว',
  cancelled: 'ยกเลิก',
}

const statusVariant: Record<OrderStatus, 'default' | 'success' | 'warning' | 'danger'> = {
  pending: 'warning',
  confirmed: 'default',
  shipped: 'default',
  delivered: 'success',
  cancelled: 'danger',
}

export function OrdersPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, cost_price: 0 }])
  const [products, setProducts] = useState<{ id: string; name: string; cost_price: number }[]>([])
  const [saving, setSaving] = useState(false)

  const fetchOrders = async () => {
    setLoading(true)
    const query = supabase
      .from('orders')
      .select('*, order_items(id, quantity, unit_price, product:products(name))')
      .order('created_at', { ascending: false })
      .limit(100)
    const { data } = await query
    setOrders(data ?? [])
    setLoading(false)
  }

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, cost_price').order('name')
    setProducts(data ?? [])
  }

  useEffect(() => { fetchOrders(); fetchProducts() }, [])

  const filtered = orders.filter(o => {
    if (platformFilter !== 'all' && o.platform !== platformFilter) return false
    if (search && !o.platform_order_id?.includes(search) && !o.id.includes(search)) return false
    return true
  })

  const saveSale = async () => {
    const validItems = saleItems.filter(i => i.product_id && i.quantity > 0)
    if (validItems.length === 0) { toast.error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return }
    setSaving(true)
    const total = validItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    const { data: order, error } = await supabase
      .from('orders')
      .insert({ platform: 'store', status: 'delivered', total_amount: total })
      .select()
      .single()
    if (error) { toast.error(error.message); setSaving(false); return }

    const { error: itemsError } = await supabase.from('order_items').insert(
      validItems.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        cost_price_at_sale: i.cost_price,
      }))
    )
    if (itemsError) { toast.error(itemsError.message); setSaving(false); return }

    // Deduct stock
    await Promise.all(validItems.map(i =>
      supabase.from('stock_movements').insert({
        product_id: i.product_id,
        type: 'out',
        quantity: i.quantity,
        note: `ขายหน้าร้าน #${order.id.slice(0, 8)}`,
        created_by: profile!.id,
      })
    ))

    toast.success('บันทึกการขายแล้ว')
    setShowSaleModal(false)
    setSaleItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0, cost_price: 0 }])
    fetchOrders()
    setSaving(false)
  }

  const updateSaleItem = (index: number, field: keyof SaleItem, value: string | number) => {
    setSaleItems(items => {
      const updated = [...items]
      if (field === 'product_id') {
        const product = products.find(p => p.id === value)
        updated[index] = { ...updated[index], product_id: value as string, product_name: product?.name ?? '', cost_price: product?.cost_price ?? 0 }
      } else {
        updated[index] = { ...updated[index], [field]: value }
      }
      return updated
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">คำสั่งซื้อ</h1>
          <p className="text-rowa-muted text-sm">{orders.length} รายการ</p>
        </div>
        <Button onClick={() => setShowSaleModal(true)}>
          <Plus className="h-4 w-4" /> บันทึกขายหน้าร้าน
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 w-48" placeholder="ค้นหา Order ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {(['all', 'lazada', 'shopee', 'store'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                platformFilter === p ? 'bg-rowa-blue text-white' : 'text-gray-500 hover:text-rowa-blue'
              }`}
            >
              {p === 'all' ? 'ทั้งหมด' : platformLabel[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-rowa-muted">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-rowa-muted">
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <p>ไม่พบคำสั่งซื้อ</p>
          </div>
        ) : (
          <div>
            {filtered.map(order => (
              <div key={order.id} className="border-b border-gray-50 last:border-0">
                <button
                  onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-rowa-bg/30 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={order.platform as 'lazada' | 'shopee' | 'store'}>{platformLabel[order.platform]}</Badge>
                      <Badge variant={statusVariant[order.status]}>{statusLabel[order.status]}</Badge>
                    </div>
                    <p className="text-xs text-rowa-muted">
                      {order.platform_order_id ? `#${order.platform_order_id}` : `#${order.id.slice(0, 8).toUpperCase()}`}
                      {' · '}
                      {format(new Date(order.created_at), 'd MMM yyyy HH:mm', { locale: th })}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <span className="font-semibold text-rowa-text">{formatCurrency(order.total_amount)}</span>
                    {expandedId === order.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </div>
                </button>
                {expandedId === order.id && order.order_items && (
                  <div className="px-6 pb-4 bg-rowa-bg/20">
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      {order.order_items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-0 text-sm">
                          <span>{item.product?.name ?? '-'}</span>
                          <span className="text-rowa-muted">x{item.quantity} · {formatCurrency(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                    {isAdmin && (
                      <div className="mt-3 flex justify-end gap-2">
                        {(['confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map(s => (
                          order.status !== s && (
                            <Button
                              key={s}
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                await supabase.from('orders').update({ status: s }).eq('id', order.id)
                                toast.success('อัปเดตสถานะแล้ว')
                                fetchOrders()
                              }}
                            >
                              {statusLabel[s]}
                            </Button>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New sale modal */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">บันทึกขายหน้าร้าน</h2>
            <div className="space-y-3">
              {saleItems.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-rowa-muted">รายการที่ {i + 1}</span>
                    {saleItems.length > 1 && (
                      <button onClick={() => setSaleItems(items => items.filter((_, j) => j !== i))} className="text-red-400 text-xs">ลบ</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-gray-700 block mb-1">สินค้า</label>
                      <select
                        className="input"
                        value={item.product_id}
                        onChange={e => updateSaleItem(i, 'product_id', e.target.value)}
                      >
                        <option value="">-- เลือกสินค้า --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <Input label="จำนวน" type="number" value={item.quantity} onChange={e => updateSaleItem(i, 'quantity', parseInt(e.target.value) || 1)} />
                    <Input label="ราคาขาย/ชิ้น" type="number" prefix="฿" value={item.unit_price || ''} onChange={e => updateSaleItem(i, 'unit_price', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setSaleItems(items => [...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0, cost_price: 0 }])}>
                <Plus className="h-4 w-4" /> เพิ่มสินค้า
              </Button>
            </div>
            <div className="border-t border-gray-100 mt-4 pt-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>รวม</span>
                <span>{formatCurrency(saleItems.reduce((s, i) => s + i.quantity * i.unit_price, 0))}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowSaleModal(false)}>ยกเลิก</Button>
              <Button className="flex-1 justify-center" loading={saving} onClick={saveSale}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
