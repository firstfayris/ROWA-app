import { useEffect, useState } from 'react'
import { ShoppingCart, Plus, Search, ChevronDown, ChevronUp, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency, platformLabel } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { Platform, OrderStatus } from '../lib/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface OrderRow {
  id: string
  platform: Platform
  platform_order_id: string | null
  status: OrderStatus
  total_amount: number
  payment_method: string | null
  payment_date: string | null
  slip_url: string | null
  created_at: string
  order_items?: { id: string; quantity: number; unit_price: number; product?: { name: string } }[]
}

interface CustomerGroup {
  id: string
  name: string
  discount_percent: number
}

interface ProductVariant {
  id: string
  color: string | null
  size: string | null
  current_stock: number
}

interface ProductOption {
  id: string
  name: string
  sku: string
  cost_price: number
  category_id: string | null
  prices: Record<Platform, number | null>
  variants: ProductVariant[]
  current_stock: number
}

interface Category {
  id: string
  name: string
  brand: string
}

interface SaleItem {
  product_id: string
  variant_id: string
  quantity: number
  unit_price: number    // selling price per unit (auto-filled, editable)
  discount: number      // baht discount per order line
  note: string
  cost_price: number
  filterBrand: string
  filterCategory: string
}

const emptyItem = (): SaleItem => ({ product_id: '', variant_id: '', quantity: 1, unit_price: 0, discount: 0, note: '', cost_price: 0, filterBrand: '', filterCategory: '' })

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

  // Sale modal
  const [showSaleModal, setShowSaleModal] = useState(false)
  const [salePlatform, setSalePlatform] = useState<Platform>('store')
  const [saleOrderId, setSaleOrderId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash')
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [saleItems, setSaleItems] = useState<SaleItem[]>([emptyItem()])
  const [saleNote, setSaleNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Products + categories + customer groups
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')

  const fetchOrders = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(id, quantity, unit_price, product:products(name))')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders(data ?? [])
    setLoading(false)
    return data
  }

  const fetchProducts = async () => {
    const [{ data: prods }, { data: cats }, { data: platforms }, { data: groups }, { data: variantStocks }, { data: productStocks }] = await Promise.all([
      supabase.from('products').select('id, name, sku, cost_price, category_id').order('name'),
      supabase.from('categories').select('id, name, brand').order('brand,name'),
      supabase.from('product_platforms').select('product_id, platform, selling_price, discount_percent'),
      supabase.from('customer_groups').select('id, name, discount_percent').eq('active', true).order('name'),
      supabase.from('variant_stock').select('id, product_id, color, size, current_stock'),
      supabase.from('product_stock').select('product_id, current_stock'),
    ])
    setCustomerGroups(groups ?? [])
    setCategories(cats ?? [])

    const priceMap: Record<string, Record<string, number | null>> = {}
    for (const pp of platforms ?? []) {
      if (!priceMap[pp.product_id]) priceMap[pp.product_id] = {}
      const disc = pp.discount_percent ?? 0
      priceMap[pp.product_id][pp.platform] = pp.selling_price * (1 - disc / 100)
    }

    const variantMap: Record<string, ProductVariant[]> = {}
    for (const v of variantStocks ?? []) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id].push({ id: v.id, color: v.color, size: v.size, current_stock: v.current_stock ?? 0 })
    }

    const stockMap: Record<string, number> = {}
    for (const s of productStocks ?? []) {
      stockMap[s.product_id] = s.current_stock ?? 0
    }

    setProducts((prods ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      cost_price: p.cost_price,
      category_id: p.category_id,
      prices: {
        store: priceMap[p.id]?.['store'] ?? null,
        lazada: priceMap[p.id]?.['lazada'] ?? null,
        shopee: priceMap[p.id]?.['shopee'] ?? null,
      },
      variants: variantMap[p.id] ?? [],
      current_stock: stockMap[p.id] ?? 0,
    })))
  }

  useEffect(() => { fetchOrders(); fetchProducts() }, [])

  const brands = [...new Set(categories.map(c => c.brand))].filter(Boolean)

  const visibleProducts = (filterBrand: string, filterCategory: string) =>
    products.filter(p => {
      const cat = categories.find(c => c.id === p.category_id)
      if (filterBrand && cat?.brand !== filterBrand) return false
      if (filterCategory && p.category_id !== filterCategory) return false
      // ถ้ามี variant ให้แสดงเฉพาะเมื่อยังมี variant ที่มีสต็อก
      if (p.variants.length > 0) return p.variants.some(v => v.current_stock > 0)
      return true
    })

  const filtered = orders.filter(o => {
    if (platformFilter !== 'all' && o.platform !== platformFilter) return false
    if (search && !o.platform_order_id?.includes(search) && !o.id.includes(search)) return false
    return true
  })

  const lineTotal = (item: SaleItem) => Math.max(0, item.quantity * item.unit_price - item.discount)
  const grandTotal = saleItems.reduce((s, i) => s + lineTotal(i), 0)

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setSaleItems(items => items.map((it, j) => j === index ? { ...it, ...patch } : it))
  }

  const selectProduct = (index: number, productId: string) => {
    const p = products.find(x => x.id === productId)
    if (!p) { updateItem(index, { product_id: '', variant_id: '', unit_price: 0, cost_price: 0 }); return }
    const price = p.prices[salePlatform] ?? 0
    updateItem(index, { product_id: productId, variant_id: '', unit_price: price, cost_price: p.cost_price })
  }

  // Re-fill prices when platform changes
  const changePlatform = (p: Platform) => {
    setSalePlatform(p)
    setSaleItems(items => items.map(item => {
      if (!item.product_id) return item
      const prod = products.find(x => x.id === item.product_id)
      return { ...item, unit_price: prod?.prices[p] ?? item.unit_price }
    }))
  }

  const applyGroupDiscount = (groupId: string) => {
    setSelectedGroupId(groupId)
    const group = customerGroups.find(g => g.id === groupId)
    setSaleItems(items => items.map(item => {
      if (!item.product_id) return { ...item, discount: 0 }
      const discountAmt = group
        ? Math.round(item.unit_price * item.quantity * group.discount_percent / 100)
        : 0
      return { ...item, discount: discountAmt }
    }))
  }

  const openModal = () => {
    setSalePlatform('store'); setSaleOrderId(''); setPaymentMethod('cash')
    setPaymentDate(new Date().toISOString().split('T')[0])
    setSlipFile(null); setSlipPreview(null)
    setSaleItems([emptyItem()]); setSaleNote('')
    setSelectedGroupId('')
    setShowSaleModal(true)
  }

  const saveSale = async () => {
    const validItems = saleItems.filter(i => i.product_id && i.quantity > 0)
    if (validItems.length === 0) { toast.error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ'); return }
    setSaving(true)

    let slip_url: string | null = null
    if (slipFile) {
      const ext = slipFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('payment-slips').upload(path, slipFile)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('payment-slips').getPublicUrl(path)
        slip_url = urlData.publicUrl
      }
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        platform: salePlatform,
        platform_order_id: saleOrderId || null,
        status: 'delivered',
        total_amount: grandTotal,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        slip_url,
        note: saleNote || null,
      })
      .select().single()
    if (error) { toast.error(error.message); setSaving(false); return }

    const { error: itemsError } = await supabase.from('order_items').insert(
      validItems.map(i => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        cost_price_at_sale: i.cost_price,
        note: i.note || null,
      }))
    )
    if (itemsError) { toast.error(itemsError.message); setSaving(false); return }

    const stockResults = await Promise.all(validItems.map(i =>
      supabase.from('stock_movements').insert({
        product_id: i.product_id,
        variant_id: i.variant_id || null,
        type: 'out',
        quantity: i.quantity,
        note: `ขาย${platformLabel[salePlatform]}${saleOrderId ? ' #' + saleOrderId : ''}`,
        created_by: profile!.id,
        movement_date: paymentDate,
        source_order_id: order.id,
      })
    ))
    const stockError = stockResults.find(r => r.error)?.error
    if (stockError) toast.error(`ตัดสต็อกไม่สำเร็จ: ${stockError.message}`)
    else toast.success('บันทึกการขายและตัดสต็อกแล้ว')

    await fetchOrders()   // โหลดข้อมูลก่อน แล้วค่อยปิด modal
    setShowSaleModal(false)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">คำสั่งซื้อ</h1>
          <p className="text-rowa-muted text-sm">{orders.length} รายการ</p>
        </div>
        <Button onClick={openModal}><Plus className="h-4 w-4" /> บันทึกการขาย</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 w-48" placeholder="ค้นหา Order ID..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {(['all', 'lazada', 'shopee', 'store'] as const).map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${platformFilter === p ? 'bg-rowa-blue text-white' : 'text-gray-500 hover:text-rowa-blue'}`}>
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
            <ShoppingCart className="h-10 w-10 opacity-30" /><p>ไม่พบคำสั่งซื้อ</p>
          </div>
        ) : (
          <div>
            {filtered.map(order => (
              <div key={order.id} className="border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2 pr-4">
                  <button onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    className="flex-1 flex items-center gap-4 px-6 py-4 hover:bg-rowa-bg/30 transition-colors text-left">
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
                  {isAdmin && (
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        if (!confirm('ต้องการลบคำสั่งซื้อนี้? สต็อกจะถูกคืนกลับอัตโนมัติ')) return
                        // ลบ stock_movements ที่ผูกกับออเดอร์นี้โดยตรง
                        await supabase.from('stock_movements').delete().eq('source_order_id', order.id)
                        await supabase.from('order_items').delete().eq('order_id', order.id)
                        await supabase.from('orders').delete().eq('id', order.id)
                        toast.success('ลบคำสั่งซื้อและคืนสต็อกแล้ว'); fetchOrders()
                      }}
                      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      title="ลบคำสั่งซื้อ">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {expandedId === order.id && order.order_items && (
                  <div className="px-6 pb-4 bg-rowa-bg/20 space-y-3">
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      {order.order_items.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-0 text-sm">
                          <span>{item.product?.name ?? '-'}</span>
                          <span className="text-rowa-muted">x{item.quantity} · {formatCurrency(item.unit_price)}</span>
                        </div>
                      ))}
                    </div>
                    {(order.payment_method || order.slip_url) && (
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {order.payment_method && (
                          <span className="bg-white border border-gray-200 rounded-lg px-3 py-1">
                            {order.payment_method === 'cash' ? '💵 เงินสด' : '📱 โอนเงิน'}
                          </span>
                        )}
                        {order.payment_date && (
                          <span className="text-rowa-muted">รับเงิน {new Date(order.payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                        )}
                        {order.slip_url && (
                          <a href={order.slip_url} target="_blank" rel="noreferrer" className="text-rowa-blue underline text-xs">ดูสลิป</a>
                        )}
                      </div>
                    )}
                    {isAdmin && (order.platform === 'store'
                      ? (['cancelled'] as OrderStatus[])
                      : (['confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
                    ).some(s => order.status !== s) && (
                      <div className="mt-3 flex justify-end gap-2">
                        {(order.platform === 'store'
                          ? (['cancelled'] as OrderStatus[])
                          : (['confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
                        ).map(s => (
                          order.status !== s && (
                            <Button key={s} variant={s === 'cancelled' ? 'danger' : 'secondary'} size="sm" onClick={async () => {
                              await supabase.from('orders').update({ status: s }).eq('id', order.id)
                              toast.success('อัปเดตสถานะแล้ว'); fetchOrders()
                            }}>{statusLabel[s]}</Button>
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

      {/* ===== NEW SALE MODAL ===== */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold">บันทึกการขาย</h2>
              <button onClick={() => setShowSaleModal(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

              {/* Platform + Order ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Platform</label>
                  <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                    {(['store', 'lazada', 'shopee'] as Platform[]).map(p => (
                      <button key={p} onClick={() => changePlatform(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${salePlatform === p ? 'bg-white text-rowa-blue shadow-sm' : 'text-gray-500'}`}>
                        {platformLabel[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <Input
                  label={`เลข Order ID ${salePlatform !== 'store' ? '' : '(ไม่บังคับ)'}`}
                  placeholder={salePlatform === 'lazada' ? '123456789' : salePlatform === 'shopee' ? '2412345678' : '-'}
                  value={saleOrderId} onChange={e => setSaleOrderId(e.target.value)}
                />
              </div>

              {/* Customer group discount */}
              {customerGroups.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">กลุ่มลูกค้า (ส่วนลดพิเศษ)</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => applyGroupDiscount('')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${!selectedGroupId ? 'bg-rowa-blue text-white border-rowa-blue' : 'bg-white text-gray-500 border-gray-200 hover:border-rowa-blue'}`}>
                      ลูกค้าทั่วไป
                    </button>
                    {customerGroups.map(g => (
                      <button key={g.id}
                        onClick={() => applyGroupDiscount(g.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${selectedGroupId === g.id ? 'bg-rowa-pink text-white border-rowa-pink' : 'bg-white text-gray-500 border-gray-200 hover:border-rowa-pink'}`}>
                        {g.name} (-{g.discount_percent}%)
                      </button>
                    ))}
                  </div>
                  {selectedGroupId && (
                    <p className="text-xs text-rowa-pink">
                      ✓ ใช้ส่วนลด {customerGroups.find(g => g.id === selectedGroupId)?.discount_percent}% — ส่วนลดถูกคำนวณและใส่ในแต่ละรายการแล้ว (ปรับได้)
                    </p>
                  )}
                </div>
              )}

              {/* Sale items */}
              <div className="space-y-3">
                {saleItems.map((item, i) => {
                  const prod = products.find(p => p.id === item.product_id)
const autoPrice = prod?.prices[salePlatform] ?? null
                  const itemProducts = visibleProducts(item.filterBrand, item.filterCategory)
                  return (
                    <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-rowa-muted">รายการที่ {i + 1}</span>
                        {saleItems.length > 1 && (
                          <button onClick={() => setSaleItems(items => items.filter((_, j) => j !== i))}
                            className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Per-item brand/category filter */}
                      <div className="flex gap-2">
                        <select className="input flex-1 text-xs" value={item.filterBrand}
                          onChange={e => updateItem(i, { filterBrand: e.target.value, filterCategory: '', product_id: '', unit_price: 0 })}>
                          <option value="">ทุกแบรนด์</option>
                          {brands.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <select className="input flex-1 text-xs" value={item.filterCategory}
                          onChange={e => {
                            const catId = e.target.value
                            const cat = categories.find(c => c.id === catId)
                            updateItem(i, {
                              filterCategory: catId,
                              filterBrand: cat?.brand ?? item.filterBrand,
                              product_id: '',
                              unit_price: 0,
                            })
                          }}>
                          <option value="">ทุกหมวดหมู่</option>
                          {categories.filter(c => !item.filterBrand || c.brand === item.filterBrand).map(c => (
                            <option key={c.id} value={c.id}>{c.brand} — {c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Product select */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">สินค้า</label>
                        <select className="input" value={item.product_id} onChange={e => selectProduct(i, e.target.value)}>
                          <option value="">-- เลือกสินค้า --</option>
                          {itemProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                        {prod && autoPrice != null && (
                          <p className="text-xs text-rowa-muted mt-0.5">
                            ราคาขาย{platformLabel[salePlatform]}: <span className="text-rowa-blue font-medium">{formatCurrency(autoPrice)}</span>
                          </p>
                        )}
                      </div>

                      {/* Variant selector */}
                      {prod && prod.variants.length > 0 && (
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1">ตัวเลือก (สี / ไซส์)</label>
                          <select className="input" value={item.variant_id}
                            onChange={e => updateItem(i, { variant_id: e.target.value })}>
                            <option value="">-- เลือกตัวเลือก --</option>
                            {prod.variants.filter(v => v.current_stock > 0).map(v => {
                              const label = [v.color, v.size].filter(Boolean).join(' / ') || `ตัวเลือก ${v.id.slice(0, 6)}`
                              return (
                                <option key={v.id} value={v.id}>{label} (คงเหลือ {v.current_stock})</option>
                              )
                            })}
                          </select>
                        </div>
                      )}

                      {/* Qty + Price + Discount */}
                      <div className="grid grid-cols-3 gap-2">
                        <Input label="จำนวน" type="number" value={item.quantity}
                          onChange={e => updateItem(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                        <Input label="ราคาขาย/ชิ้น (฿)" type="number" value={item.unit_price || ''}
                          onChange={e => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })} />
                        <Input label="ส่วนลด (฿)" type="number" value={item.discount || ''}
                          placeholder="0"
                          onChange={e => updateItem(i, { discount: parseFloat(e.target.value) || 0 })} />
                      </div>

                      {/* Note per item */}
                      <div>
                        <label className="text-xs font-medium text-gray-700 block mb-1">หมายเหตุรายการนี้</label>
                        <input className="input text-sm" placeholder="ไม่บังคับ" value={item.note}
                          onChange={e => updateItem(i, { note: e.target.value })} />
                      </div>

                      {/* Line subtotal */}
                      <div className="flex justify-end text-sm">
                        <span className="text-rowa-muted mr-2">ยอดรายการนี้</span>
                        <span className="font-semibold text-rowa-blue">{formatCurrency(lineTotal(item))}</span>
                      </div>
                    </div>
                  )
                })}

                <Button variant="secondary" size="sm"
                  onClick={() => setSaleItems(items => [...items, emptyItem()])}>
                  <Plus className="h-4 w-4" /> เพิ่มสินค้า
                </Button>
              </div>

              {/* Payment */}
              <div className="border border-gray-100 rounded-xl p-3 space-y-3">
                <p className="text-sm font-medium text-rowa-text">การชำระเงิน</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-700">ช่องทาง</label>
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                      {([['cash', '💵 เงินสด'], ['transfer', '📱 โอนเงิน']] as const).map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setPaymentMethod(val)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${paymentMethod === val ? 'bg-white text-rowa-blue shadow-sm' : 'text-gray-500'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input label="วันที่รับเงิน" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
                {paymentMethod === 'transfer' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-700">แนบสลิป</label>
                    <input type="file" accept="image/*" className="text-sm"
                      onChange={e => {
                        const f = e.target.files?.[0] ?? null
                        setSlipFile(f); setSlipPreview(f ? URL.createObjectURL(f) : null)
                      }} />
                    {slipPreview && <img src={slipPreview} className="mt-2 h-32 object-contain rounded-lg border border-gray-200" />}
                  </div>
                )}
              </div>

              {/* Order note */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">หมายเหตุ (รวมทั้งบิล)</label>
                <input className="input" placeholder="ไม่บังคับ" value={saleNote} onChange={e => setSaleNote(e.target.value)} />
              </div>
            </div>

            {/* Footer: total + actions */}
            <div className="border-t border-gray-100 px-6 py-4 flex-shrink-0">
              <div className="flex justify-between text-base font-bold mb-3">
                <span>รวมทั้งหมด</span>
                <span className="text-rowa-blue">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowSaleModal(false)}>ยกเลิก</Button>
                <Button className="flex-1 justify-center" loading={saving} onClick={saveSale}>บันทึก</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
