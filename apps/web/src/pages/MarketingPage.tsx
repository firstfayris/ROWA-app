import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2, TrendingDown, Megaphone, Truck } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

interface MarketingExpense {
  id: string
  date: string
  channel: string
  amount: number
  campaign: string | null
  note: string | null
}

interface ShippingExpense {
  id: string
  date: string
  type: string
  courier: string
  tracking_number: string | null
  amount: number
  recipient: string | null
  note: string | null
}

const CHANNELS = ['Lazada Ads', 'Shopee Ads', 'Facebook Ads', 'Instagram Ads', 'TikTok Ads', 'LINE Ads', 'Google Ads', 'อื่นๆ']
const COURIERS = ['Kerry Express', 'Flash Express', 'J&T Express', 'Thailand Post (EMS)', 'Thailand Post (ลงทะเบียน)', 'Ninja Van', 'DHL', 'FedEx', 'SCG Express', 'อื่นๆ']
const SHIPPING_TYPES = [
  { value: 'delivery', label: 'จัดส่งให้ลูกค้า' },
  { value: 'import', label: 'ค่านำเข้า / รับสินค้า' },
]

const emptyMarketing = { date: new Date().toISOString().split('T')[0], channel: 'Facebook Ads', amount: '', campaign: '', note: '' }
const emptyShipping = { date: new Date().toISOString().split('T')[0], type: 'delivery', courier: 'Kerry Express', tracking_number: '', amount: '', recipient: '', note: '' }

export function MarketingPage() {
  const [tab, setTab] = useState<'marketing' | 'shipping'>('marketing')
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7))

  // Marketing
  const [marketing, setMarketing] = useState<MarketingExpense[]>([])
  const [loadingMarketing, setLoadingMarketing] = useState(true)
  const [showMktForm, setShowMktForm] = useState(false)
  const [mktForm, setMktForm] = useState(emptyMarketing)
  const [savingMkt, setSavingMkt] = useState(false)

  // Shipping
  const [shipping, setShipping] = useState<ShippingExpense[]>([])
  const [loadingShipping, setLoadingShipping] = useState(true)
  const [showShipForm, setShowShipForm] = useState(false)
  const [shipForm, setShipForm] = useState(emptyShipping)
  const [savingShip, setSavingShip] = useState(false)

  const dateRange = { from: `${filterMonth}-01`, to: `${filterMonth}-31` }

  const fetchAll = async () => {
    setLoadingMarketing(true)
    setLoadingShipping(true)
    const [mktRes, shipRes] = await Promise.all([
      supabase.from('marketing_expenses').select('*').gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: false }),
      supabase.from('shipping_expenses').select('*').gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: false }),
    ])
    if (mktRes.error) toast.error(mktRes.error.message)
    if (shipRes.error) toast.error(shipRes.error.message)
    setMarketing(mktRes.data ?? [])
    setShipping(shipRes.data ?? [])
    setLoadingMarketing(false)
    setLoadingShipping(false)
  }

  useEffect(() => { fetchAll() }, [filterMonth])

  const saveMarketing = async () => {
    if (!mktForm.amount || parseFloat(mktForm.amount) <= 0) return toast.error('กรุณาใส่จำนวนเงิน')
    setSavingMkt(true)
    const { error } = await supabase.from('marketing_expenses').insert({
      date: mktForm.date, channel: mktForm.channel, amount: parseFloat(mktForm.amount),
      campaign: mktForm.campaign || null, note: mktForm.note || null,
    })
    if (error) { toast.error(error.message); setSavingMkt(false); return }
    toast.success('บันทึกแล้ว')
    setMktForm(emptyMarketing); setShowMktForm(false); fetchAll(); setSavingMkt(false)
  }

  const saveShipping = async () => {
    if (!shipForm.amount || parseFloat(shipForm.amount) <= 0) return toast.error('กรุณาใส่จำนวนเงิน')
    setSavingShip(true)
    const { error } = await supabase.from('shipping_expenses').insert({
      date: shipForm.date, type: shipForm.type, courier: shipForm.courier,
      tracking_number: shipForm.tracking_number || null,
      amount: parseFloat(shipForm.amount),
      recipient: shipForm.recipient || null,
      note: shipForm.note || null,
    })
    if (error) { toast.error(error.message); setSavingShip(false); return }
    toast.success('บันทึกแล้ว')
    setShipForm(emptyShipping); setShowShipForm(false); fetchAll(); setSavingShip(false)
  }

  const deleteMarketing = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    const { error } = await supabase.from('marketing_expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('ลบแล้ว'); fetchAll() }
  }

  const deleteShipping = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    const { error } = await supabase.from('shipping_expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('ลบแล้ว'); fetchAll() }
  }

  const totalMarketing = marketing.reduce((s, e) => s + e.amount, 0)
  const totalShipping = shipping.reduce((s, e) => s + e.amount, 0)

  const byChannel = marketing.reduce<Record<string, number>>((acc, e) => {
    acc[e.channel] = (acc[e.channel] ?? 0) + e.amount; return acc
  }, {})

  const byCourier = shipping.reduce<Record<string, number>>((acc, e) => {
    acc[e.courier] = (acc[e.courier] ?? 0) + e.amount; return acc
  }, {})

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">ค่าใช้จ่าย</h1>
          <p className="text-rowa-muted text-sm">ค่าการตลาด ค่าขนส่ง และค่าใช้จ่ายอื่นๆ</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-rowa-muted">เดือน</label>
          <input type="month" className="input text-sm" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rowa-pink/10 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-5 w-5 text-rowa-pink" />
          </div>
          <div>
            <p className="text-xs text-rowa-muted">รวมทั้งหมด</p>
            <p className="text-xl font-bold text-rowa-text">{formatCurrency(totalMarketing + totalShipping)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rowa-blue/10 flex items-center justify-center flex-shrink-0">
            <Megaphone className="h-5 w-5 text-rowa-blue" />
          </div>
          <div>
            <p className="text-xs text-rowa-muted">ค่าการตลาด</p>
            <p className="text-xl font-bold text-rowa-text">{formatCurrency(totalMarketing)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <Truck className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-rowa-muted">ค่าขนส่ง</p>
            <p className="text-xl font-bold text-rowa-text">{formatCurrency(totalShipping)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {([['marketing', Megaphone, 'ค่าการตลาด'], ['shipping', Truck, 'ค่าขนส่ง']] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === key ? 'bg-rowa-blue text-white' : 'text-gray-500 hover:text-rowa-blue'}`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* ---- MARKETING TAB ---- */}
      {tab === 'marketing' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            {Object.keys(byChannel).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byChannel).sort(([, a], [, b]) => b - a).map(([ch, amt]) => (
                  <div key={ch} className="flex items-center gap-2 bg-rowa-bg rounded-xl px-3 py-1.5 text-sm">
                    <span className="font-medium text-rowa-text">{ch}</span>
                    <span className="text-rowa-muted">{formatCurrency(amt)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" className="ml-auto" onClick={() => setShowMktForm(true)}>
              <Plus className="h-4 w-4" /> เพิ่มรายจ่าย
            </Button>
          </div>

          {showMktForm && (
            <div className="card border-rowa-blue/30 border space-y-4">
              <h2 className="font-semibold">เพิ่มค่าการตลาด</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input label="วันที่" type="date" value={mktForm.date} onChange={e => setMktForm(f => ({ ...f, date: e.target.value }))} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">ช่องทาง</label>
                  <select className="input" value={mktForm.channel} onChange={e => setMktForm(f => ({ ...f, channel: e.target.value }))}>
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <Input label="จำนวนเงิน (บาท)" type="number" placeholder="0.00" value={mktForm.amount} onChange={e => setMktForm(f => ({ ...f, amount: e.target.value }))} />
                <Input label="แคมเปญ (ไม่บังคับ)" placeholder="เช่น Summer Sale" value={mktForm.campaign} onChange={e => setMktForm(f => ({ ...f, campaign: e.target.value }))} />
              </div>
              <Input label="หมายเหตุ" placeholder="รายละเอียดเพิ่มเติม" value={mktForm.note} onChange={e => setMktForm(f => ({ ...f, note: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowMktForm(false)}>ยกเลิก</Button>
                <Button loading={savingMkt} onClick={saveMarketing}>บันทึก</Button>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-rowa-bg/50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">วันที่</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ช่องทาง</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">แคมเปญ</th>
                  <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">จำนวนเงิน</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมายเหตุ</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingMarketing ? (
                  <tr><td colSpan={6} className="text-center py-10 text-rowa-muted text-sm">กำลังโหลด...</td></tr>
                ) : marketing.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-rowa-muted text-sm">ยังไม่มีรายจ่ายในเดือนนี้</td></tr>
                ) : marketing.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-sm text-rowa-muted whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3"><Badge variant="default">{e.channel}</Badge></td>
                    <td className="px-4 py-3 text-sm">{e.campaign ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-rowa-pink">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">{e.note ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteMarketing(e.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {marketing.length > 0 && (
                <tfoot>
                  <tr className="bg-rowa-bg/30 border-t border-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-semibold">รวม</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-rowa-pink">{formatCurrency(totalMarketing)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ---- SHIPPING TAB ---- */}
      {tab === 'shipping' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            {Object.keys(byCourier).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(byCourier).sort(([, a], [, b]) => b - a).map(([courier, amt]) => (
                  <div key={courier} className="flex items-center gap-2 bg-rowa-bg rounded-xl px-3 py-1.5 text-sm">
                    <span className="font-medium text-rowa-text">{courier}</span>
                    <span className="text-rowa-muted">{formatCurrency(amt)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" className="ml-auto" onClick={() => setShowShipForm(true)}>
              <Plus className="h-4 w-4" /> เพิ่มรายจ่าย
            </Button>
          </div>

          {showShipForm && (
            <div className="card border-rowa-blue/30 border space-y-4">
              <h2 className="font-semibold">เพิ่มค่าขนส่ง</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input label="วันที่" type="date" value={shipForm.date} onChange={e => setShipForm(f => ({ ...f, date: e.target.value }))} />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">ประเภท</label>
                  <select className="input" value={shipForm.type} onChange={e => setShipForm(f => ({ ...f, type: e.target.value }))}>
                    {SHIPPING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">ขนส่ง</label>
                  <select className="input" value={shipForm.courier} onChange={e => setShipForm(f => ({ ...f, courier: e.target.value }))}>
                    {COURIERS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <Input label="เลขพัสดุ (ไม่บังคับ)" placeholder="เช่น TH123456789" value={shipForm.tracking_number} onChange={e => setShipForm(f => ({ ...f, tracking_number: e.target.value }))} />
                <Input label="จำนวนเงิน (บาท)" type="number" placeholder="0.00" value={shipForm.amount} onChange={e => setShipForm(f => ({ ...f, amount: e.target.value }))} />
                <Input label="ผู้รับ / ปลายทาง (ไม่บังคับ)" placeholder="ชื่อลูกค้าหรือที่อยู่" value={shipForm.recipient} onChange={e => setShipForm(f => ({ ...f, recipient: e.target.value }))} />
              </div>
              <Input label="หมายเหตุ" placeholder="รายละเอียดเพิ่มเติม" value={shipForm.note} onChange={e => setShipForm(f => ({ ...f, note: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowShipForm(false)}>ยกเลิก</Button>
                <Button loading={savingShip} onClick={saveShipping}>บันทึก</Button>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-rowa-bg/50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">วันที่</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ประเภท</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ขนส่ง</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">เลขพัสดุ</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ผู้รับ</th>
                  <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">จำนวนเงิน</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loadingShipping ? (
                  <tr><td colSpan={7} className="text-center py-10 text-rowa-muted text-sm">กำลังโหลด...</td></tr>
                ) : shipping.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-rowa-muted text-sm">ยังไม่มีรายจ่ายในเดือนนี้</td></tr>
                ) : shipping.map(e => (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 text-sm text-rowa-muted whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.type === 'delivery' ? 'success' : 'warning'}>
                        {SHIPPING_TYPES.find(t => t.value === e.type)?.label ?? e.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{e.courier}</td>
                    <td className="px-4 py-3 text-sm font-mono text-rowa-blue">
                      {e.tracking_number ?? <span className="text-gray-300 font-sans">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">{e.recipient ?? <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-orange-500">{formatCurrency(e.amount)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteShipping(e.id)} className="p-1.5 rounded hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {shipping.length > 0 && (
                <tfoot>
                  <tr className="bg-rowa-bg/30 border-t border-gray-100">
                    <td colSpan={5} className="px-6 py-3 text-sm font-semibold">รวม</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-orange-500">{formatCurrency(totalShipping)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
