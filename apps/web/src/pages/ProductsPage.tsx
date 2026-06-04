import { useEffect, useState } from 'react'
import { Plus, Search, Package, ChevronRight, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

interface ProductStock {
  id: string
  sku: string
  name: string
  image_url: string | null
  cost_price: number
  current_stock: number
}

interface ProductForm {
  sku: string
  name: string
  description: string
  cost_price: string
}

interface StockAdjForm {
  type: 'in' | 'out' | 'adjustment'
  quantity: string
  note: string
}

export function ProductsPage() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'

  const [products, setProducts] = useState<ProductStock[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProductForm>({ sku: '', name: '', description: '', cost_price: '' })

  const [stockModal, setStockModal] = useState<ProductStock | null>(null)
  const [stockForm, setStockForm] = useState<StockAdjForm>({ type: 'in', quantity: '', note: '' })

  const fetchProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('product_stock').select('*').order('name')
    setProducts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchProducts() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setForm({ sku: '', name: '', description: '', cost_price: '' })
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (p: ProductStock) => {
    setForm({ sku: p.sku, name: p.name, description: '', cost_price: p.cost_price.toString() })
    setEditId(p.id)
    setShowForm(true)
  }

  const saveProduct = async () => {
    if (!form.sku || !form.name) return
    setSaving(true)
    const payload = {
      sku: form.sku,
      name: form.name,
      description: form.description || null,
      cost_price: parseFloat(form.cost_price) || 0,
    }
    const { error } = editId
      ? await supabase.from('products').update(payload).eq('id', editId)
      : await supabase.from('products').insert(payload)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(editId ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว')
    setShowForm(false)
    fetchProducts()
    setSaving(false)
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('ต้องการลบสินค้านี้?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('ลบสินค้าแล้ว')
    fetchProducts()
  }

  const saveStockAdj = async () => {
    if (!stockModal || !stockForm.quantity) return
    setSaving(true)
    const qty = parseInt(stockForm.quantity)
    const { error } = await supabase.from('stock_movements').insert({
      product_id: stockModal.id,
      type: stockForm.type,
      quantity: Math.abs(qty),
      note: stockForm.note || null,
      created_by: profile!.id,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('บันทึกการเคลื่อนไหวสต็อกแล้ว')
    setStockModal(null)
    fetchProducts()
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">สินค้า & สต็อก</h1>
          <p className="text-rowa-muted text-sm">{products.length} รายการ</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> เพิ่มสินค้า
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="ค้นหาสินค้า, SKU..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Product list */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-rowa-muted">
            กำลังโหลด...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-rowa-muted">
            <Package className="h-10 w-10 opacity-30" />
            <p>ไม่พบสินค้า</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-rowa-bg/50">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">สินค้า</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">SKU</th>
                {isAdmin && <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">ต้นทุน</th>}
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">สต็อก</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-6 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(product => (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-rowa-bg/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rowa-blue/10 flex items-center justify-center flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package className="h-5 w-5 text-rowa-blue" />
                        )}
                      </div>
                      <span className="font-medium text-sm text-rowa-text">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-rowa-muted">{product.sku}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(product.cost_price)}</td>
                  )}
                  <td className="px-4 py-3 text-center">
                    <Badge
                      variant={product.current_stock === 0 ? 'danger' : product.current_stock <= 5 ? 'warning' : 'success'}
                    >
                      {product.current_stock === 0 ? 'หมด' : `${product.current_stock} ชิ้น`}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStockModal(product); setStockForm({ type: 'in', quantity: '', note: '' }) }}
                      >
                        <ChevronRight className="h-4 w-4" /> สต็อก
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteProduct(product.id)}>
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Product form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4">{editId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
            <div className="space-y-3">
              <Input label="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="ROW-001" />
              <Input label="ชื่อสินค้า" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ชื่อสินค้า" />
              <Input label="คำอธิบาย (ไม่บังคับ)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <Input label="ต้นทุน (บาท)" type="number" prefix="฿" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0" />
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button className="flex-1 justify-center" loading={saving} onClick={saveProduct}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}

      {/* Stock adjustment modal */}
      {stockModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-1">ปรับสต็อก</h2>
            <p className="text-rowa-muted text-sm mb-4">{stockModal.name} — คงเหลือ {stockModal.current_stock} ชิ้น</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['in', 'out', 'adjustment'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setStockForm(f => ({ ...f, type: t }))}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    stockForm.type === t ? 'border-rowa-blue bg-rowa-blue/5 text-rowa-blue' : 'border-gray-200 text-gray-500'
                  }`}
                >
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
