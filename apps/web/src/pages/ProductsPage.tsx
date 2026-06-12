import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Package, Pencil, Trash2, ArrowUp, ArrowDown, Upload, X, Tag, History, Layers } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// ราคาทุนแสดงเฉพาะ admin


interface Category {
  id: string
  name: string
  brand: string
  color: string
}

interface ProductStock {
  id: string
  sku: string
  name: string
  image_url: string | null
  cost_price: number
  current_stock: number
  category_id: string | null
  store_price?: number | null
}

interface PlatformPrice {
  selling_price: string
  discount_percent: string
}

interface ProductForm {
  sku: string
  name: string
  description: string
  cost_price: string
  image_url: string | null
  category_id: string
  platforms: { lazada: PlatformPrice; shopee: PlatformPrice; store: PlatformPrice }
  variants: Variant[]
  hasVariants: boolean
}

interface Variant {
  id?: string
  color: string
  size: string
  image_url: string | null
  current_stock?: number
}

interface VariantStock {
  id: string
  product_id: string
  color: string | null
  size: string | null
  image_url: string | null
  current_stock: number
}

interface StockAdjForm {
  type: 'in' | 'out' | 'adjustment'
  quantity: string
  note: string
  variant_id: string
  movement_date: string
}

interface LotItem {
  product_id: string
  product_name: string
  product_sku: string
  category_id: string | null
  variants: { id: string; label: string }[]
  quantities: Record<string, string>
}

interface StockMovement {
  id: string
  type: string
  quantity: number
  note: string | null
  movement_date: string | null
  created_at: string
  variant_color: string | null
  variant_size: string | null
}

const defaultPlatform = (): PlatformPrice => ({ selling_price: '', discount_percent: '0' })
const defaultForm = (): ProductForm => ({
  sku: '', name: '', description: '', cost_price: '', image_url: null, category_id: '',
  platforms: { lazada: defaultPlatform(), shopee: defaultPlatform(), store: defaultPlatform() },
  variants: [],
  hasVariants: false,
})

export function ProductsPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const canViewCost = isAdmin

  const [products, setProducts] = useState<ProductStock[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProductForm>(defaultForm())
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [stockModal, setStockModal] = useState<ProductStock | null>(null)
  const [stockForm, setStockForm] = useState<StockAdjForm>({ type: 'in', quantity: '', note: '', variant_id: '', movement_date: new Date().toISOString().slice(0, 10) })
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'cost_price' | 'current_stock'>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [variantStocks, setVariantStocks] = useState<Record<string, VariantStock[]>>({})

  // Lot receive
  const [showLot, setShowLot] = useState(false)
  const [lotDate, setLotDate] = useState(new Date().toISOString().slice(0, 10))
  const [lotNote, setLotNote] = useState('')
  const [lotItems, setLotItems] = useState<LotItem[]>([])
  const [lotSaving, setLotSaving] = useState(false)
  const [bulkQty, setBulkQty] = useState('')
  const [lotFilterBrand, setLotFilterBrand] = useState('')
  const [lotFilterCategory, setLotFilterCategory] = useState('')

  // Image hover preview
  const [hoverImg, setHoverImg] = useState<{ url: string; x: number; y: number } | null>(null)

  // History
  const [historyProduct, setHistoryProduct] = useState<ProductStock | null>(null)
  const [historyItems, setHistoryItems] = useState<StockMovement[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: allVariants }, { data: storePrices }] = await Promise.all([
      supabase.from('product_stock').select('*, category_id').order('name'),
      supabase.from('categories').select('*').order('brand,name'),
      supabase.from('variant_stock').select('*'),
      supabase.from('product_platforms').select('product_id, selling_price, discount_percent').eq('platform', 'store'),
    ])
    // merge store price into products
    const priceMap: Record<string, number> = {}
    for (const sp of storePrices ?? []) {
      const disc = sp.discount_percent ?? 0
      priceMap[sp.product_id] = sp.selling_price * (1 - disc / 100)
    }
    setProducts((prods ?? []).map((p: any) => ({ ...p, store_price: priceMap[p.id] ?? null })))
    setCategories(cats ?? [])
    // Group variants by product_id
    const grouped: Record<string, VariantStock[]> = {}
    for (const v of allVariants ?? []) {
      if (!grouped[v.product_id]) grouped[v.product_id] = []
      grouped[v.product_id].push(v)
    }
    setVariantStocks(grouped)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const brands = [...new Set(categories.map(c => c.brand))]

  const outOfStock = products.filter(p => p.current_stock === 0)
  const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= 5)

  type SortKey = 'name' | 'cost_price' | 'current_stock'
  type SortDir = 'asc' | 'desc'

  const filtered = products
    .filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
      const matchCat = !filterCategory || p.category_id === filterCategory
      const matchBrand = !filterBrand || categories.find(c => c.id === p.category_id)?.brand === filterBrand
      const matchStock = stockFilter === 'all' || (stockFilter === 'out' && p.current_stock === 0) || (stockFilter === 'low' && p.current_stock > 0 && p.current_stock <= 5)
      return matchSearch && matchCat && matchBrand && matchStock
    })
    .sort((a, b) => {
      if (sortKey === 'name') return sortDir === 'asc' ? a.name.localeCompare(b.name, 'th') : b.name.localeCompare(a.name, 'th')
      if (sortKey === 'cost_price') return sortDir === 'asc' ? a.cost_price - b.cost_price : b.cost_price - a.cost_price
      if (sortKey === 'current_stock') return sortDir === 'asc' ? a.current_stock - b.current_stock : b.current_stock - a.current_stock
      return 0
    })

  const getCategoryById = (id: string | null) => categories.find(c => c.id === id)

  const handleSort = (key: 'name' | 'cost_price' | 'current_stock') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }
  const sortIcon = (key: string) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'

  const openCreate = () => { setForm(defaultForm()); setEditId(null); setShowForm(true) }

  const openEdit = async (p: ProductStock) => {
    const [{ data: platforms }, { data: variants }] = await Promise.all([
      supabase.from('product_platforms').select('*').eq('product_id', p.id),
      supabase.from('product_variants').select('*').eq('product_id', p.id),
    ])
    const pf = defaultForm()
    pf.sku = p.sku; pf.name = p.name; pf.cost_price = p.cost_price.toString()
    pf.image_url = p.image_url; pf.category_id = p.category_id ?? ''
    for (const pl of platforms ?? []) {
      const key = pl.platform as 'lazada' | 'shopee' | 'store'
      pf.platforms[key] = { selling_price: pl.selling_price?.toString() ?? '', discount_percent: pl.discount_percent?.toString() ?? '0' }
    }
    if (variants && variants.length > 0) {
      pf.hasVariants = true
      pf.variants = variants.map(v => ({ id: v.id, color: v.color ?? '', size: v.size ?? '', image_url: v.image_url }))
    }
    setForm(pf); setEditId(p.id); setShowForm(true)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
    if (error) { toast.error('อัปโหลดรูปไม่สำเร็จ'); setUploading(false); return }
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: data.publicUrl }))
    setUploading(false)
    toast.success('อัปโหลดรูปแล้ว')
  }

  const saveProduct = async () => {
    if (!form.sku || !form.name) return toast.error('กรุณาใส่ SKU และชื่อสินค้า')
    setSaving(true)
    const payload = {
      sku: form.sku, name: form.name, description: form.description || null,
      cost_price: parseFloat(form.cost_price) || 0,
      image_url: form.image_url,
      category_id: form.category_id || null,
    }
    let productId = editId
    if (editId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('products').insert(payload).select().single()
      if (error) { toast.error(error.message); setSaving(false); return }
      productId = data.id
    }
    for (const platform of ['lazada', 'shopee', 'store'] as const) {
      const pp = form.platforms[platform]
      if (!pp.selling_price) continue
      await supabase.from('product_platforms').upsert({
        product_id: productId, platform,
        selling_price: parseFloat(pp.selling_price) || 0,
        discount_percent: parseFloat(pp.discount_percent) || 0,
        active: true,
      }, { onConflict: 'product_id,platform' })
    }
    // Save variants
    if (form.hasVariants && form.variants.length > 0) {
      for (const v of form.variants) {
        if (v.id) {
          await supabase.from('product_variants').update({ color: v.color || null, size: v.size || null, image_url: v.image_url }).eq('id', v.id)
        } else {
          await supabase.from('product_variants').insert({ product_id: productId, color: v.color || null, size: v.size || null, image_url: v.image_url })
        }
      }
    } else if (!form.hasVariants && editId) {
      // Remove all variants if toggled off
      await supabase.from('product_variants').delete().eq('product_id', editId)
    }
    toast.success(editId ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว')
    setShowForm(false); fetchAll(); setSaving(false)
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('ต้องการลบสินค้านี้?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('ลบสินค้าแล้ว'); fetchAll()
  }

  const saveStockAdj = async () => {
    if (!stockModal || !stockForm.quantity) return
    setSaving(true)
    const { error } = await supabase.from('stock_movements').insert({
      product_id: stockModal.id, type: stockForm.type,
      quantity: Math.abs(parseInt(stockForm.quantity)),
      note: stockForm.note || null, created_by: profile!.id,
      variant_id: stockForm.variant_id || null,
      movement_date: stockForm.movement_date || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('บันทึกสต็อกแล้ว'); setStockModal(null); fetchAll(); setSaving(false)
  }

  const setPlatform = (platform: 'lazada' | 'shopee' | 'store', field: keyof PlatformPrice, value: string) =>
    setForm(f => ({ ...f, platforms: { ...f.platforms, [platform]: { ...f.platforms[platform], [field]: value } } }))

  // ---- LOT RECEIVE ----
  const openLot = async () => {
    setLotDate(new Date().toISOString().slice(0, 10))
    setLotNote('')
    setBulkQty('')
    setLotFilterBrand('')
    setLotFilterCategory('')
    const items: LotItem[] = products.map(p => {
      const vs = variantStocks[p.id] ?? []
      const variants = vs.map(v => ({ id: v.id, label: [v.color, v.size].filter(Boolean).join(' / ') }))
      const quantities: Record<string, string> = {}
      if (variants.length > 0) variants.forEach(v => { quantities[v.id] = '' })
      else quantities[''] = ''
      return { product_id: p.id, product_name: p.name, product_sku: p.sku, category_id: p.category_id, variants, quantities }
    })
    setLotItems(items)
    setShowLot(true)
  }

  const applyBulkQty = () => {
    if (!bulkQty) return
    setLotItems(items => items.map(item => {
      const cat = categories.find(c => c.id === item.category_id)
      const matchBrand = !lotFilterBrand || cat?.brand === lotFilterBrand
      const matchCat = !lotFilterCategory || item.category_id === lotFilterCategory
      if (!matchBrand || !matchCat) return item
      return {
        ...item,
        quantities: Object.fromEntries(Object.keys(item.quantities).map(k => [k, bulkQty]))
      }
    }))
  }

  const saveLot = async () => {
    const movements = lotItems.flatMap(item =>
      Object.entries(item.quantities)
        .filter(([, qty]) => qty && parseInt(qty) > 0)
        .map(([variantId, qty]) => ({
          product_id: item.product_id,
          variant_id: variantId || null,
          type: 'in' as const,
          quantity: parseInt(qty),
          note: lotNote || null,
          movement_date: lotDate,
          created_by: profile!.id,
        }))
    )
    if (movements.length === 0) return toast.error('ยังไม่ได้ใส่จำนวนสินค้า')
    setLotSaving(true)
    const { error } = await supabase.from('stock_movements').insert(movements)
    if (error) { toast.error(error.message); setLotSaving(false); return }
    toast.success(`บันทึกสต็อกล็อต ${movements.length} รายการแล้ว`)
    setShowLot(false)
    fetchAll()
    setLotSaving(false)
  }

  // ---- HISTORY ----
  const openHistory = async (product: ProductStock) => {
    setHistoryProduct(product)
    setHistoryLoading(true)
    setHistoryItems([])
    const { data } = await supabase
      .from('stock_movements')
      .select('id, type, quantity, note, movement_date, created_at, variant:product_variants(color, size)')
      .eq('product_id', product.id)
      .order('movement_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    setHistoryItems((data ?? []).map((d: any) => ({
      id: d.id, type: d.type, quantity: d.quantity, note: d.note,
      movement_date: d.movement_date, created_at: d.created_at,
      variant_color: d.variant?.color ?? null, variant_size: d.variant?.size ?? null,
    })))
    setHistoryLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">สินค้า & สต็อก</h1>
          <p className="text-rowa-muted text-sm">{filtered.length} / {products.length} รายการ</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={openLot}><Layers className="h-4 w-4" /> รับสต็อกล็อต</Button>
          {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มสินค้า</Button>}
        </div>
      </div>

      {/* Stock summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'สินค้าทั้งหมด', value: products.length, color: 'bg-rowa-blue/10 text-rowa-blue', filter: 'all' as const },
          { label: 'มีสต็อก', value: products.filter(p => p.current_stock > 5).length, color: 'bg-green-100 text-green-700', filter: 'all' as const },
          { label: 'ใกล้หมด (≤5)', value: lowStock.length, color: 'bg-orange-100 text-orange-600', filter: 'low' as const },
          { label: 'หมดสต็อก', value: outOfStock.length, color: 'bg-red-100 text-red-600', filter: 'out' as const },
        ].map(({ label, value, color, filter }) => (
          <button key={label} onClick={() => setStockFilter(stockFilter === filter && filter !== 'all' ? 'all' : filter)}
            className={`card text-left transition-all hover:shadow-md ${stockFilter === filter && filter !== 'all' ? 'ring-2 ring-rowa-blue' : ''}`}>
            <p className="text-xs text-rowa-muted">{label}</p>
            <p className={`text-2xl font-bold mt-1 inline-block px-2 py-0.5 rounded-lg ${color}`}>{value}</p>
          </button>
        ))}
      </div>

      {/* Alert: out of stock only */}
      {outOfStock.length > 0 && (
        <div className="space-y-2">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-red-700 mb-2">🚨 หมดสต็อก ({outOfStock.length} รายการ)</p>
              <div className="flex flex-wrap gap-2">
                {outOfStock.map(p => (
                  <button key={p.id} onClick={() => { setStockModal(p); setStockForm({ type: 'in', quantity: '', note: '', variant_id: '', movement_date: new Date().toISOString().slice(0, 10) }) }}
                    className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-3 py-1.5 text-sm hover:border-red-400 transition-colors">
                    <span className="font-medium text-red-700">{p.name}</span>
                    <span className="text-xs text-red-400">({p.sku})</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">+ เติม</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 w-56" placeholder="ค้นหาสินค้า, SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-40" value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setFilterCategory('') }}>
          <option value="">ทุกแบรนด์</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select className="input w-48" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">ทุกหมวดหมู่</option>
          {categories.filter(c => !filterBrand || c.brand === filterBrand).map(c => (
            <option key={c.id} value={c.id}>{c.brand} — {c.name}</option>
          ))}
        </select>
        {(filterBrand || filterCategory || search) && (
          <button className="text-sm text-rowa-muted hover:text-rowa-text" onClick={() => { setSearch(''); setFilterBrand(''); setFilterCategory(''); setStockFilter('all') }}>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Product list */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-rowa-muted">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-rowa-muted">
            <Package className="h-10 w-10 opacity-30" /><p>ไม่พบสินค้า</p>
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: 750 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-rowa-bg/50">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3 cursor-pointer select-none hover:text-rowa-blue" style={{ whiteSpace: 'nowrap' }} onClick={() => handleSort('name')}>
                  สินค้า{sortIcon('name')}
                </th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>หมวดหมู่</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>SKU</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap', minWidth: 90 }}>ราคาขาย</th>
                {canViewCost && (
                  <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3 cursor-pointer select-none hover:text-rowa-blue" style={{ whiteSpace: 'nowrap', minWidth: 90 }} onClick={() => handleSort('cost_price')}>
                    ต้นทุน{sortIcon('cost_price')}
                  </th>
                )}
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3 cursor-pointer select-none hover:text-rowa-blue" style={{ whiteSpace: 'nowrap', minWidth: 110 }} onClick={() => handleSort('current_stock')}>
                  สต็อก{sortIcon('current_stock')}
                </th>
                <th className="text-right text-xs font-medium text-rowa-muted px-6 py-3" style={{ whiteSpace: 'nowrap', minWidth: 130 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const cat = getCategoryById(product.category_id)
                return (<>
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-rowa-bg/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rowa-blue/10 flex items-center justify-center flex-shrink-0 overflow-hidden cursor-pointer"
                          onMouseEnter={product.image_url ? (e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setHoverImg({ url: product.image_url!, x: r.right + 10, y: r.top })
                          } : undefined}
                          onMouseLeave={() => setHoverImg(null)}>
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-rowa-blue" />}
                        </div>
                        <div>
                          <span className="font-medium text-sm text-rowa-text">{product.name}</span>
                          {(variantStocks[product.id] ?? []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(variantStocks[product.id] ?? []).map(v => (
                                <span key={v.id} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
                                  ${v.current_stock === 0 ? 'bg-red-50 border-red-200 text-red-600' : v.current_stock <= 5 ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                  {[v.color, v.size].filter(Boolean).join(' / ')}
                                  <span className="font-bold">{v.current_stock}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {cat ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                          <Tag className="h-3 w-3" />{cat.brand} · {cat.name}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">{product.sku}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-rowa-blue">
                      {product.store_price != null ? formatCurrency(product.store_price) : <span className="text-gray-300">—</span>}
                    </td>
                    {canViewCost && <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(product.cost_price)}</td>}
                    <td className="px-4 py-3 text-center" style={{ minWidth: 110, whiteSpace: 'nowrap' }}>
                      <Badge variant={product.current_stock === 0 ? 'danger' : product.current_stock <= 5 ? 'warning' : 'success'}>
                        {product.current_stock === 0 ? 'หมดสต็อก' : `${product.current_stock} ชิ้น`}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" style={{ whiteSpace: 'nowrap' }} onClick={() => {
                          setStockModal(product)
                          const vs = variantStocks[product.id] ?? []
                          setStockForm({ type: 'in', quantity: '', note: '', variant_id: vs.length > 0 ? vs[0].id : '', movement_date: new Date().toISOString().slice(0, 10) })
                        }}>สต็อก</Button>
                        <Button variant="ghost" size="sm" onClick={() => openHistory(product)} title="ประวัติสต็อก"><History className="h-4 w-4 text-gray-400" /></Button>
                        {isAdmin && <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                </>)
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Product form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Image */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">รูปสินค้า</label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-rowa-blue/50 transition-colors" onClick={() => fileRef.current?.click()}>
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="preview" className="h-24 w-24 object-cover rounded-lg" />
                    <button className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5" onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, image_url: null })) }}><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <><Upload className="h-8 w-8 text-gray-300" /><p className="text-sm text-rowa-muted">{uploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดรูป'}</p></>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="SKU *" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="ROW-001" />
                <Input label="ชื่อสินค้า *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อสินค้า" />
              </div>

              {/* Brand + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">แบรนด์</label>
                  <select className="input" value={categories.find(c => c.id === form.category_id)?.brand ?? ''}
                    onChange={e => setForm(f => ({ ...f, category_id: '' }))}>
                    <option value="">— เลือกแบรนด์ —</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">หมวดหมู่</label>
                  <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">— เลือกหมวดหมู่ —</option>
                    {brands.map(brand => (
                      <optgroup key={brand} label={brand}>
                        {categories.filter(c => c.brand === brand).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <Input label="คำอธิบาย (ไม่บังคับ)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดสินค้า" />
              <Input label="ราคาทุน (บาท)" type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0" />
            </div>

            {/* Variants */}
            <div className="mt-4 border border-gray-100 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">ตัวเลือกสินค้า (สี / ไซส์)</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.hasVariants}
                    onChange={e => setForm(f => ({ ...f, hasVariants: e.target.checked, variants: e.target.checked && f.variants.length === 0 ? [{ color: '', size: '', image_url: null }] : f.variants }))}
                    className="accent-rowa-blue w-4 h-4" />
                  <span className="text-sm text-gray-600">มีหลายตัวเลือก</span>
                </label>
              </div>
              {form.hasVariants && (
                <div className="space-y-2">
                  {form.variants.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input flex-1" placeholder="สี เช่น แดง / ฟ้า" value={v.color}
                        onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, color: e.target.value } : x) }))} />
                      <input className="input flex-1" placeholder="ไซส์ เช่น S / M / L / XL" value={v.size}
                        onChange={e => setForm(f => ({ ...f, variants: f.variants.map((x, j) => j === i ? { ...x, size: e.target.value } : x) }))} />
                      <button onClick={async () => {
                        if (v.id) await supabase.from('product_variants').delete().eq('id', v.id)
                        setForm(f => ({ ...f, variants: f.variants.filter((_, j) => j !== i) }))
                      }} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-red-400" /></button>
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" onClick={() => setForm(f => ({ ...f, variants: [...f.variants, { color: '', size: '', image_url: null }] }))}>
                    <Plus className="h-4 w-4" /> เพิ่มตัวเลือก
                  </Button>
                </div>
              )}
            </div>

            {/* Platform pricing */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">ราคาขายแต่ละ Platform</p>
              <div className="space-y-3">
                {(['lazada', 'shopee', 'store'] as const).map(platform => (
                  <div key={platform} className="border border-gray-100 rounded-xl p-3">
                    <p className="text-sm font-medium mb-2">
                      {platform === 'store' ? '🏪 หน้าร้าน' : platform === 'lazada' ? '🛍 Lazada' : '🛒 Shopee'}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input label="ราคาขาย (บาท)" type="number" value={form.platforms[platform].selling_price} onChange={e => setPlatform(platform, 'selling_price', e.target.value)} placeholder="0" />
                      <Input label="ส่วนลด (%)" type="number" value={form.platforms[platform].discount_percent} onChange={e => setPlatform(platform, 'discount_percent', e.target.value)} placeholder="0" />
                    </div>
                    {form.platforms[platform].selling_price && (
                      <p className="text-xs text-rowa-muted mt-1">
                        ราคาหลังลด: {formatCurrency(parseFloat(form.platforms[platform].selling_price || '0') * (1 - parseFloat(form.platforms[platform].discount_percent || '0') / 100))}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button className="flex-1 justify-center" loading={saving} onClick={saveProduct}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}

      {/* LOT RECEIVE MODAL */}
      {showLot && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold">รับสต็อกเป็นล็อต</h2>
                <p className="text-xs text-rowa-muted">ใส่จำนวนสินค้าที่รับเข้าพร้อมกัน</p>
              </div>
              <button onClick={() => setShowLot(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>

            {/* Controls row 1: date + note */}
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">วันที่รับสินค้า</label>
                <input type="date" className="input" value={lotDate} onChange={e => setLotDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-36">
                <label className="text-xs font-medium text-gray-600">หมายเหตุ / ชื่อล็อต</label>
                <input className="input" placeholder="เช่น ล็อต เม.ย. 68" value={lotNote} onChange={e => setLotNote(e.target.value)} />
              </div>
            </div>

            {/* Controls row 2: filter + bulk qty */}
            <div className="px-6 py-3 border-b border-gray-100 bg-rowa-bg/40 flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">เลือกแบรนด์</label>
                <select className="input w-36" value={lotFilterBrand} onChange={e => { setLotFilterBrand(e.target.value); setLotFilterCategory('') }}>
                  <option value="">ทุกแบรนด์</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">เลือกหมวดหมู่</label>
                <select className="input w-44" value={lotFilterCategory} onChange={e => setLotFilterCategory(e.target.value)}>
                  <option value="">ทุกหมวดหมู่</option>
                  {categories.filter(c => !lotFilterBrand || c.brand === lotFilterBrand).map(c => (
                    <option key={c.id} value={c.id}>{c.brand} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">
                    ใส่จำนวนเท่ากัน{lotFilterBrand || lotFilterCategory ? ' (เฉพาะที่เลือก)' : ' (ทุกรายการ)'}
                  </label>
                  <input type="number" className="input w-24" placeholder="จำนวน" value={bulkQty} onChange={e => setBulkQty(e.target.value)} />
                </div>
                <Button variant="secondary" size="sm" onClick={applyBulkQty}>ใส่ทั้งหมด</Button>
              </div>
              {(lotFilterBrand || lotFilterCategory) && (
                <button className="text-xs text-rowa-muted hover:text-rowa-text self-end pb-1.5" onClick={() => { setLotFilterBrand(''); setLotFilterCategory('') }}>ล้าง</button>
              )}
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full">
                <thead className="sticky top-0 bg-rowa-bg/80">
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-rowa-muted px-6 py-2">สินค้า</th>
                    <th className="text-left text-xs font-medium text-rowa-muted px-4 py-2">ตัวเลือก</th>
                    <th className="text-center text-xs font-medium text-rowa-muted px-4 py-2 w-28">จำนวนรับเข้า</th>
                  </tr>
                </thead>
                <tbody>
                  {lotItems.filter(item => {
                    const cat = categories.find(c => c.id === item.category_id)
                    const matchBrand = !lotFilterBrand || cat?.brand === lotFilterBrand
                    const matchCat = !lotFilterCategory || item.category_id === lotFilterCategory
                    return matchBrand && matchCat
                  }).map(item => {
                    const updateQty = (key: string, val: string) =>
                      setLotItems(its => its.map(it => it.product_id === item.product_id
                        ? { ...it, quantities: { ...it.quantities, [key]: val } } : it))
                    if (item.variants.length === 0) {
                      return (
                        <tr key={item.product_id} className="border-b border-gray-50">
                          <td className="px-6 py-2">
                            <p className="text-sm font-medium">{item.product_name}</p>
                            <p className="text-xs text-rowa-muted font-mono">{item.product_sku}</p>
                          </td>
                          <td className="px-4 py-2 text-xs text-rowa-muted">—</td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" placeholder="0" className="input text-center w-20 mx-auto block"
                              value={item.quantities['']}
                              onChange={e => updateQty('', e.target.value)} />
                          </td>
                        </tr>
                      )
                    }
                    return item.variants.map((v, vi) => (
                      <tr key={`${item.product_id}-${v.id}`} className="border-b border-gray-50">
                        <td className="px-6 py-2">
                          {vi === 0 && <>
                            <p className="text-sm font-medium">{item.product_name}</p>
                            <p className="text-xs text-rowa-muted font-mono">{item.product_sku}</p>
                          </>}
                        </td>
                        <td className="px-4 py-2 text-xs text-rowa-muted">{v.label}</td>
                        <td className="px-4 py-2">
                          <input type="number" min="0" placeholder="0" className="input text-center w-20 mx-auto block"
                            value={item.quantities[v.id]}
                            onChange={e => updateQty(v.id, e.target.value)} />
                        </td>
                      </tr>
                    ))
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowLot(false)}>ยกเลิก</Button>
              <Button loading={lotSaving} onClick={saveLot}><ArrowUp className="h-4 w-4" /> บันทึกรับสต็อก</Button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold">ประวัติสต็อก</h2>
                <p className="text-sm text-rowa-muted">{historyProduct.name}</p>
              </div>
              <button onClick={() => setHistoryProduct(null)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="py-12 text-center text-rowa-muted text-sm">กำลังโหลด...</div>
              ) : historyItems.length === 0 ? (
                <div className="py-12 text-center text-rowa-muted text-sm">ยังไม่มีประวัติการเคลื่อนไหว</div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-rowa-bg/80">
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-medium text-rowa-muted px-6 py-2">วันที่</th>
                      <th className="text-left text-xs font-medium text-rowa-muted px-4 py-2">ประเภท</th>
                      <th className="text-left text-xs font-medium text-rowa-muted px-4 py-2">ตัวเลือก</th>
                      <th className="text-center text-xs font-medium text-rowa-muted px-4 py-2">จำนวน</th>
                      <th className="text-left text-xs font-medium text-rowa-muted px-4 py-2">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map(h => {
                      const dateStr = h.movement_date ?? h.created_at.slice(0, 10)
                      const d = new Date(dateStr)
                      const label = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
                      const variantLabel = [h.variant_color, h.variant_size].filter(Boolean).join(' / ')
                      return (
                        <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-6 py-2 text-sm text-rowa-muted whitespace-nowrap">{label}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap
                              ${h.type === 'in' ? 'bg-green-100 text-green-700' : h.type === 'out' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                              {h.type === 'in' ? '↑ รับเข้า' : h.type === 'out' ? '↓ ตัดออก' : '⟳ ปรับยอด'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-rowa-muted">{variantLabel || '—'}</td>
                          <td className="px-4 py-2 text-center text-sm font-bold">{h.quantity}</td>
                          <td className="px-4 py-2 text-xs text-rowa-muted">{h.note ?? '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image hover preview (fixed, escapes overflow) */}
      {hoverImg && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: hoverImg.x, top: hoverImg.y }}>
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-1.5">
            <img src={hoverImg.url} alt="" className="w-52 h-52 object-cover rounded-lg" />
          </div>
        </div>
      )}

      {/* Stock modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-1">ปรับสต็อก</h2>
            <p className="text-rowa-muted text-sm mb-4">{stockModal.name} — คงเหลือ {stockModal.current_stock} ชิ้น</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['in', 'out', 'adjustment'] as const).map(t => (
                <button key={t} onClick={() => setStockForm(f => ({ ...f, type: t }))}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${stockForm.type === t ? 'border-rowa-blue bg-rowa-blue/5 text-rowa-blue' : 'border-gray-200 text-gray-500'}`}>
                  {t === 'in' ? <ArrowUp className="h-4 w-4" /> : t === 'out' ? <ArrowDown className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  {t === 'in' ? 'รับเข้า' : t === 'out' ? 'ตัดออก' : 'ปรับยอด'}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {(variantStocks[stockModal?.id ?? ''] ?? []).length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">ตัวเลือก (สี/ไซส์)</label>
                  <select className="input" value={stockForm.variant_id} onChange={e => setStockForm(f => ({ ...f, variant_id: e.target.value }))}>
                    <option value="">— ไม่ระบุ (รวม) —</option>
                    {variantStocks[stockModal?.id ?? ''].map(v => (
                      <option key={v.id} value={v.id}>
                        {[v.color, v.size].filter(Boolean).join(' / ')} — สต็อก {v.current_stock} ชิ้น
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">วันที่รับ/ตัดสต็อก</label>
                <input type="date" className="input" value={stockForm.movement_date} onChange={e => setStockForm(f => ({ ...f, movement_date: e.target.value }))} />
              </div>
              <Input label="จำนวน" type="number" value={stockForm.quantity} onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
              <Input label="หมายเหตุ" value={stockForm.note} onChange={e => setStockForm(f => ({ ...f, note: e.target.value }))} placeholder="ไม่บังคับ" />
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setStockModal(null)}>ยกเลิก</Button>
              <Button className="flex-1 justify-center" loading={saving} onClick={saveStockAdj}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
