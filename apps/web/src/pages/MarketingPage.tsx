import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2, TrendingDown, Megaphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

interface MarketingExpense {
  id: string
  date: string
  channel: string
  amount: number
  campaign: string | null
  note: string | null
  created_at: string
}

const CHANNELS = ['Lazada Ads', 'Shopee Ads', 'Facebook Ads', 'Instagram Ads', 'TikTok Ads', 'LINE Ads', 'Google Ads', 'อื่นๆ']

const emptyForm = { date: new Date().toISOString().split('T')[0], channel: 'Facebook Ads', amount: '', campaign: '', note: '' }

export function MarketingPage() {
  const [expenses, setExpenses] = useState<MarketingExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  // Filter
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const fetchExpenses = async () => {
    setLoading(true)
    const from = `${filterMonth}-01`
    const to = `${filterMonth}-31`
    const { data, error } = await supabase
      .from('marketing_expenses')
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false })
    if (error) toast.error(error.message)
    setExpenses(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [filterMonth])

  const saveExpense = async () => {
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('กรุณาใส่จำนวนเงิน')
    setSaving(true)
    const { error } = await supabase.from('marketing_expenses').insert({
      date: form.date,
      channel: form.channel,
      amount: parseFloat(form.amount),
      campaign: form.campaign || null,
      note: form.note || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('บันทึกรายจ่ายแล้ว')
    setForm(emptyForm)
    setShowForm(false)
    fetchExpenses()
    setSaving(false)
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('ลบรายการนี้?')) return
    const { error } = await supabase.from('marketing_expenses').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('ลบแล้ว'); fetchExpenses() }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  const byChannel = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.channel] = (acc[e.channel] ?? 0) + e.amount
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">รายจ่ายการตลาด</h1>
          <p className="text-rowa-muted text-sm">ค่าโฆษณาและค่าการตลาดทุกช่องทาง</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> เพิ่มรายจ่าย
        </Button>
      </div>

      {/* Filter + Summary */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card flex flex-col gap-1">
          <label className="text-xs text-rowa-muted font-medium">เดือน</label>
          <input
            type="month"
            className="input"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          />
        </div>
        <div className="card sm:col-span-2 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rowa-pink/10 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-5 w-5 text-rowa-pink" />
          </div>
          <div>
            <p className="text-sm text-rowa-muted">ค่าการตลาดรวมเดือนนี้</p>
            <p className="text-2xl font-bold text-rowa-text">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {/* Breakdown by channel */}
      {Object.keys(byChannel).length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-rowa-text mb-3 flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> สรุปตามช่องทาง
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(byChannel).sort(([, a], [, b]) => b - a).map(([channel, amount]) => (
              <div key={channel} className="flex items-center gap-2 bg-rowa-bg rounded-xl px-3 py-2">
                <span className="text-sm font-medium text-rowa-text">{channel}</span>
                <span className="text-sm text-rowa-muted">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card border-rowa-blue/30 border space-y-4">
          <h2 className="font-semibold text-rowa-text">เพิ่มรายจ่ายใหม่</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              label="วันที่"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">ช่องทาง</label>
              <select className="input" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input
              label="จำนวนเงิน (บาท)"
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            <Input
              label="แคมเปญ (ไม่บังคับ)"
              placeholder="เช่น Summer Sale 2025"
              value={form.campaign}
              onChange={e => setForm(f => ({ ...f, campaign: e.target.value }))}
            />
          </div>
          <Input
            label="หมายเหตุ (ไม่บังคับ)"
            placeholder="รายละเอียดเพิ่มเติม"
            value={form.note}
            onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)}>ยกเลิก</Button>
            <Button loading={saving} onClick={saveExpense}>บันทึก</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-rowa-bg/50 border-b border-gray-100">
              <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">วันที่</th>
              <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">ช่องทาง</th>
              <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">แคมเปญ</th>
              <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">จำนวนเงิน</th>
              <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">หมายเหตุ</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-rowa-muted text-sm">กำลังโหลด...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-rowa-muted text-sm">ยังไม่มีรายจ่ายในเดือนนี้</td></tr>
            ) : (
              expenses.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-6 py-3 text-sm text-rowa-muted whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="default">{e.channel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">{e.campaign ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-right text-rowa-pink">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-sm text-rowa-muted">{e.note ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {expenses.length > 0 && (
            <tfoot>
              <tr className="bg-rowa-bg/30 border-t border-gray-100">
                <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-rowa-text">รวมทั้งหมด</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-rowa-pink">{formatCurrency(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
