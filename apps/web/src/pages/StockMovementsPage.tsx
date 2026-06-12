import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { ArrowUp, ArrowDown, Package, Search } from 'lucide-react'

interface Movement {
  id: string
  type: 'in' | 'out' | 'adjustment'
  quantity: number
  note: string | null
  movement_date: string | null
  created_at: string
  product_name: string
  product_sku: string
  variant_color: string | null
  variant_size: string | null
  created_by_name: string | null
}

const typeLabel: Record<string, string> = { in: 'รับเข้า', out: 'เบิกออก', adjustment: 'ปรับยอด' }
const typeVariant: Record<string, 'success' | 'danger' | 'default'> = { in: 'success', out: 'danger', adjustment: 'default' }
const typeIcon: Record<string, React.ReactNode> = {
  in: <ArrowUp className="h-3.5 w-3.5" />,
  out: <ArrowDown className="h-3.5 w-3.5" />,
  adjustment: <Package className="h-3.5 w-3.5" />,
}

export function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  const fetchMovements = async () => {
    setLoading(true)
    let query = supabase
      .from('stock_movements')
      .select(`
        id, type, quantity, note, movement_date, created_at,
        product:products(name, sku),
        variant:product_variants(color, size),
        creator:profiles(full_name)
      `)
      .order('movement_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (filterType) query = query.eq('type', filterType)
    if (filterDateFrom) query = query.gte('movement_date', filterDateFrom)
    if (filterDateTo) query = query.lte('movement_date', filterDateTo)

    const { data } = await query
    setMovements((data ?? []).map((d: any) => ({
      id: d.id,
      type: d.type,
      quantity: d.quantity,
      note: d.note,
      movement_date: d.movement_date,
      created_at: d.created_at,
      product_name: d.product?.name ?? '—',
      product_sku: d.product?.sku ?? '—',
      variant_color: d.variant?.color ?? null,
      variant_size: d.variant?.size ?? null,
      created_by_name: d.creator?.full_name ?? null,
    })))
    setLoading(false)
  }

  useEffect(() => { fetchMovements() }, [filterType, filterDateFrom, filterDateTo])

  const filtered = movements.filter(m => {
    if (!search) return true
    const s = search.toLowerCase()
    return m.product_name.toLowerCase().includes(s) || m.product_sku.toLowerCase().includes(s) || (m.note ?? '').toLowerCase().includes(s)
  })

  const totalIn = filtered.filter(m => m.type === 'in').reduce((s, m) => s + m.quantity, 0)
  const totalOut = filtered.filter(m => m.type === 'out').reduce((s, m) => s + m.quantity, 0)

  const formatDate = (dateStr: string | null, fallback: string) => {
    const s = dateStr ?? fallback.slice(0, 10)
    return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-rowa-text">ประวัติรับ-เบิกสต็อก</h1>
        <p className="text-rowa-muted text-sm">ประวัติการเคลื่อนไหวสินค้าทั้งหมด</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-rowa-muted">รายการทั้งหมด</p>
          <p className="text-2xl font-bold text-rowa-blue mt-1">{filtered.length}</p>
        </div>
        <div className="card">
          <p className="text-xs text-rowa-muted">รับเข้ารวม</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totalIn.toLocaleString()} ชิ้น</p>
        </div>
        <div className="card">
          <p className="text-xs text-rowa-muted">เบิกออกรวม</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{totalOut.toLocaleString()} ชิ้น</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input className="input pl-9 w-52" placeholder="ค้นหาสินค้า, SKU, หมายเหตุ..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">ทุกประเภท</option>
          <option value="in">รับเข้า</option>
          <option value="out">เบิกออก</option>
          <option value="adjustment">ปรับยอด</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" className="input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
          <span className="text-rowa-muted text-sm">ถึง</span>
          <input type="date" className="input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        </div>
        {(search || filterType || filterDateFrom || filterDateTo) && (
          <button className="text-sm text-rowa-muted hover:text-rowa-text" onClick={() => { setSearch(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo('') }}>
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        {loading ? (
          <div className="py-16 text-center text-rowa-muted">กำลังโหลด...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-rowa-muted">
            <Package className="h-10 w-10 opacity-30" /><p>ไม่พบรายการ</p>
          </div>
        ) : (
          <table className="w-full" style={{ minWidth: 700 }}>
            <thead>
              <tr className="bg-rowa-bg/50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3" style={{ whiteSpace: 'nowrap' }}>วันที่</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>ประเภท</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>สินค้า</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>ตัวเลือก</th>
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap', minWidth: 80 }}>จำนวน</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3" style={{ whiteSpace: 'nowrap' }}>หมายเหตุ</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3" style={{ whiteSpace: 'nowrap' }}>บันทึกโดย</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const variantLabel = [m.variant_color, m.variant_size].filter(Boolean).join(' / ')
                return (
                  <tr key={m.id} className="border-b border-gray-50 hover:bg-rowa-bg/30 transition-colors">
                    <td className="px-6 py-3 text-sm text-rowa-muted whitespace-nowrap">
                      {formatDate(m.movement_date, m.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap
                        ${m.type === 'in' ? 'bg-green-100 text-green-700' : m.type === 'out' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        {typeIcon[m.type]} {typeLabel[m.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-rowa-text">{m.product_name}</p>
                      <p className="text-xs text-rowa-muted font-mono">{m.product_sku}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">{variantLabel || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-500' : 'text-blue-600'}`}>
                        {m.type === 'in' ? '+' : m.type === 'out' ? '-' : ''}{m.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">{m.note ?? '—'}</td>
                    <td className="px-6 py-3 text-sm text-rowa-muted">{m.created_by_name ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
