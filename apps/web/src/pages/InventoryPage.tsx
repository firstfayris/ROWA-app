import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Package } from 'lucide-react'

interface Variant {
  id: string
  color: string | null
  size: string | null
  current_stock: number
}

interface Product {
  id: string
  name: string
  sku: string
  image_url: string | null
  category_id: string | null
  category_name: string
  brand: string
  variants: Variant[]
  current_stock: number
}

const stockColor = (n: number) =>
  n === 0 ? 'text-red-500' : n <= 3 ? 'text-amber-500' : 'text-green-600'

const stockBg = (n: number) =>
  n === 0 ? 'bg-red-50' : n <= 3 ? 'bg-amber-50' : 'bg-green-50'

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeBrand, setActiveBrand] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStock, setFilterStock] = useState<'all' | 'in' | 'low' | 'out'>('in')

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: variantStocks }, { data: productStocks }] = await Promise.all([
      supabase.from('products').select('id, name, sku, image_url, category_id').order('name'),
      supabase.from('categories').select('id, name, brand').order('brand,name'),
      supabase.from('variant_stock').select('id, product_id, color, size, current_stock'),
      supabase.from('product_stock').select('id, current_stock'),
    ])

    const catMap: Record<string, { name: string; brand: string }> = {}
    for (const c of cats ?? []) catMap[c.id] = { name: c.name, brand: c.brand }

    const variantMap: Record<string, Variant[]> = {}
    for (const v of variantStocks ?? []) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = []
      variantMap[v.product_id].push({ id: v.id, color: v.color, size: v.size, current_stock: v.current_stock ?? 0 })
    }

    const stockMap: Record<string, number> = {}
    for (const s of productStocks ?? []) stockMap[s.id] = s.current_stock ?? 0

    const mapped: Product[] = (prods ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image_url: p.image_url,
      category_id: p.category_id,
      category_name: catMap[p.category_id]?.name ?? '—',
      brand: catMap[p.category_id]?.brand ?? '—',
      variants: variantMap[p.id] ?? [],
      current_stock: stockMap[p.id] ?? 0,
    }))

    setProducts(mapped)
    setLoading(false)
  }

  const brands = [...new Set(products.map(p => p.brand))].filter(b => b !== '—').sort()

  const filtered = products.filter(p => {
    if (activeBrand && p.brand !== activeBrand) return false
    if (filterCategory && p.category_id !== filterCategory) return false
    if (search) {
      const s = search.toLowerCase()
      if (!p.name.toLowerCase().includes(s) && !p.sku.toLowerCase().includes(s)) return false
    }
    const totalStock = p.variants.length > 0
      ? p.variants.reduce((sum, v) => sum + v.current_stock, 0)
      : p.current_stock
    if (filterStock === 'in' && totalStock === 0) return false
    if (filterStock === 'low' && (totalStock === 0 || totalStock > 5)) return false
    if (filterStock === 'out' && totalStock > 0) return false
    return true
  })

  // Group by brand → category
  const grouped: Record<string, Record<string, Product[]>> = {}
  for (const p of filtered) {
    if (!grouped[p.brand]) grouped[p.brand] = {}
    if (!grouped[p.brand][p.category_name]) grouped[p.brand][p.category_name] = []
    grouped[p.brand][p.category_name].push(p)
  }

  const visibleCategories = products
    .filter(p => !activeBrand || p.brand === activeBrand)
    .map(p => ({ id: p.category_id ?? '', name: p.category_name }))
    .filter((v, i, a) => v.id && a.findIndex(x => x.id === v.id) === i)

  const totalProducts = products.length
  const inStock = products.filter(p => {
    const s = p.variants.length > 0 ? p.variants.reduce((sum, v) => sum + v.current_stock, 0) : p.current_stock
    return s > 0
  }).length
  const lowOrOut = totalProducts - inStock

  // Brand colors
  const brandColor: Record<string, string> = {}
  const palette = ['#4B5DB8', '#F08090', '#16a34a', '#d97706', '#7c3aed', '#0891b2']
  brands.forEach((b, i) => { brandColor[b] = palette[i % palette.length] })

  return (
    <div className="space-y-0">
      {/* Header + filters */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-rowa-text mr-auto">คลังสินค้า</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="input pl-9 w-48 text-sm"
              placeholder="ค้นหาชื่อ / SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-40 text-sm"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">ทุกหมวดหมู่</option>
            {visibleCategories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="input w-36 text-sm"
            value={filterStock}
            onChange={e => setFilterStock(e.target.value as any)}
          >
            <option value="in">มีสต็อก</option>
            <option value="all">ทั้งหมด</option>
            <option value="low">ใกล้หมด (≤5)</option>
            <option value="out">หมดสต็อก</option>
          </select>
        </div>

        {/* Brand tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setActiveBrand(''); setFilterCategory('') }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!activeBrand ? 'bg-rowa-blue text-white border-rowa-blue' : 'bg-white text-gray-500 border-gray-200 hover:border-rowa-blue'}`}
          >
            ทั้งหมด
          </button>
          {brands.map(b => (
            <button
              key={b}
              onClick={() => { setActiveBrand(b); setFilterCategory('') }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeBrand === b ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
              style={activeBrand === b ? { backgroundColor: brandColor[b], borderColor: brandColor[b] } : {}}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <p className="text-xs text-rowa-muted">สินค้าทั้งหมด</p>
            <p className="text-2xl font-bold text-rowa-blue mt-1">{totalProducts}</p>
          </div>
          <div className="card">
            <p className="text-xs text-rowa-muted">มีสต็อก</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{inStock}</p>
          </div>
          <div className="card">
            <p className="text-xs text-rowa-muted">ใกล้หมด / หมด</p>
            <p className="text-2xl font-bold text-red-500 mt-1">{lowOrOut}</p>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-rowa-muted">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-2 text-rowa-muted">
            <Package className="h-10 w-10 opacity-30" />
            <p>ไม่พบสินค้า</p>
          </div>
        ) : (
          Object.entries(grouped).map(([brand, categories]) => (
            <div key={brand} className="space-y-4">
              {Object.entries(categories).map(([catName, items]) => (
                <div key={catName}>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: brandColor[brand] ?? '#4B5DB8' }}
                    >
                      {brand}
                    </span>
                    <span className="text-sm font-semibold text-gray-500">{catName}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{items.length} รายการ</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {items.map(product => {
                      const hasVariants = product.variants.length > 0
                      const totalStock = hasVariants
                        ? product.variants.reduce((s, v) => s + v.current_stock, 0)
                        : product.current_stock

                      return (
                        <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
                          {/* Image */}
                          <div className="aspect-square bg-gray-50 overflow-hidden relative">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-10 w-10 text-gray-200" />
                              </div>
                            )}
                            {totalStock === 0 && (
                              <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">หมดสต็อก</span>
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2.5">
                            <p className="text-xs font-semibold text-rowa-text leading-tight line-clamp-2 mb-1">{product.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono mb-2">{product.sku}</p>

                            {hasVariants ? (
                              <div className="space-y-1">
                                {product.variants.map(v => {
                                  const label = [v.color, v.size].filter(Boolean).join(' / ') || 'default'
                                  return (
                                    <div key={v.id} className={`flex items-center justify-between px-2 py-1 rounded-lg ${stockBg(v.current_stock)}`}>
                                      <span className="text-[10px] text-gray-600 truncate flex-1">{label}</span>
                                      <span className={`text-xs font-bold ml-1 ${stockColor(v.current_stock)}`}>{v.current_stock}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className={`rounded-xl py-2 text-center ${stockBg(product.current_stock)}`}>
                                <p className={`text-2xl font-extrabold ${stockColor(product.current_stock)}`}>{product.current_stock}</p>
                                <p className="text-[10px] text-gray-400">ชิ้น</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
