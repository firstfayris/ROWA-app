import { useEffect, useState, useRef } from 'react'
import { Plus, Search, Package, Pencil, Trash2, ArrowUp, ArrowDown, Upload, X, Tag } from 'lucide-react'
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
}

interface StockAdjForm {
  type: 'in' | 'out' | 'adjustment'
  quantity: string
  note: string
}

const defaultPlatform = (): PlatformPrice => ({ selling_price: '', discount_percent: '0' })
const defaultForm = (): ProductForm => ({
  sku: '', name: '', description: '', cost_price: '', image_url: null, category_id: '',
  platforms: { lazada: defaultPlatform(), shopee: defaultPlatform(), store: defaultPlatform() },
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
  const [stockForm, setStockForm] = useState<StockAdjForm>({ type: 'in', quantity: '', note: '' })
  const [stockFilter, setStockFilter] = useState<'all' | 'out' | 'low'>('all')

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('product_stock').select('*, category_id').order('name'),
      supabase.from('categories').select('*').order('brand,name'),
    ])
    setProducts(prods ?? [])
    setCategories(cats ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const brands = [...new Set(categories.map(c => c.brand))]

  const outOfStock = products.filter(p => p.current_stock === 0)
  const lowStock = products.filter(p => p.current_stock > 0 && p.current_stock <= 5)

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCategory || p.category_id === filterCategory
    const matchBrand = !filterBrand || categories.find(c => c.id === p.category_id)?.brand === filterBrand
    const matchStock = stockFilter === 'all' || (stockFilter === 'out' && p.current_stock === 0) || (stockFilter === 'low' && p.current_stock > 0 && p.current_stock <= 5)
    return matchSearch && matchCat && matchBrand && matchStock
  })

  const getCategoryById = (id: string | null) => categories.find(c => c.id === id)

  const openCreate = () => { setForm(defaultForm()); setEditId(null); setShowForm(true) }

  const openEdit = async (p: ProductStock) => {
    const { data: platforms } = await supabase.from('product_platforms').select('*').eq('product_id', p.id)
    const pf = defaultForm()
    pf.sku = p.sku; pf.name = p.name; pf.cost_price = p.cost_price.toString()
    pf.image_url = p.image_url; pf.category_id = p.category_id ?? ''
    for (const pl of platforms ?? []) {
      const key = pl.platform as 'lazada' | 'shopee' | 'store'
      pf.platforms[key] = { selling_price: pl.selling_price?.toString() ?? '', discount_percent: pl.discount_percent?.toString() ?? '0' }
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
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('บันทึกสต็อกแล้ว'); setStockModal(null); fetchAll(); setSaving(false)
  }

  const setPlatform = (platform: 'lazada' | 'shopee' | 'store', field: keyof PlatformPrice, value: string) =>
    setForm(f => ({ ...f, platforms: { ...f.platforms, [platform]: { ...f.platforms[platform], [field]: value } } }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">สินค้า & สต็อก</h1>
          <p className="text-rowa-muted text-sm">{filtered.length} / {products.length} รายการ</p>
        </div>
        {isAdmin && <Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มสินค้า</Button>}
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

      {/* Alert: out of stock */}
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2">
          {outOfStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-red-700 mb-2">🚨 หมดสต็อก ({outOfStock.length} รายการ)</p>
              <div className="flex flex-wrap gap-2">
                {outOfStock.map(p => (
                  <button key={p.id} onClick={() => { setStockModal(p); setStockForm({ type: 'in', quantity: '', note: '' }) }}
                    className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-3 py-1.5 text-sm hover:border-red-400 transition-colors">
                    <span className="font-medium text-red-700">{p.name}</span>
                    <span className="text-xs text-red-400">({p.sku})</span>
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">+ เติม</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-sm font-semibold text-orange-700 mb-2">⚠️ ใกล้หมด ({lowStock.length} รายการ)</p>
              <div className="flex flex-wrap gap-2">
                {lowStock.map(p => (
                  <button key={p.id} onClick={() => { setStockModal(p); setStockForm({ type: 'in', quantity: '', note: '' }) }}
                    className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-sm hover:border-orange-400 transition-colors">
                    <span className="font-medium text-orange-700">{p.name}</span>
                    <span className="text-xs text-orange-400">({p.sku})</span>
                    <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{p.current_stock} ชิ้น</span>
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
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-rowa-muted">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-rowa-muted">
            <Package className="h-10 w-10 opacity-30" /><p>ไม่พบสินค้า</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-rowa-bg/50">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">สินค้า</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมวดหมู่</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">SKU</th>
                {canViewCost && <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">ต้นทุน</th>}
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">สต็อก</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-6 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => {
                const cat = getCategoryById(product.category_id)
                return (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-rowa-bg/30 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rowa-blue/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <Package className="h-5 w-5 text-rowa-blue" />}
                        </div>
                        <span className="font-medium text-sm text-rowa-text">{product.name}</span>
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
                    {canViewCost && <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(product.cost_price)}</td>}
                    <td className="px-4 py-3 text-center">
                      <Badge variant={product.current_stock === 0 ? 'danger' : product.current_stock <= 5 ? 'warning' : 'success'}>
                        {product.current_stock === 0 ? 'หมด' : `${product.current_stock} ชิ้น`}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setStockModal(product); setStockForm({ type: 'in', quantity: '', note: '' }) }}>สต็อก</Button>
                        {isAdmin && <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(product)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                        </>}
                      </div>
                    </td>
                  </tr>
                )
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
