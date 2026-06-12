import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface CustomerGroup {
  id: string
  name: string
  discount_percent: number
  description: string | null
  active: boolean
}

const emptyForm = () => ({ name: '', discount_percent: '', description: '', active: true })

export function CustomerGroupsPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('customer_groups').select('*').order('name')
    setGroups(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => { setForm(emptyForm()); setEditId(null); setShowForm(true) }
  const openEdit = (g: CustomerGroup) => {
    setForm({ name: g.name, discount_percent: g.discount_percent.toString(), description: g.description ?? '', active: g.active })
    setEditId(g.id); setShowForm(true)
  }

  const save = async () => {
    if (!form.name) return toast.error('กรุณาใส่ชื่อกลุ่ม')
    setSaving(true)
    const payload = {
      name: form.name,
      discount_percent: parseFloat(form.discount_percent) || 0,
      description: form.description || null,
      active: form.active,
    }
    if (editId) {
      const { error } = await supabase.from('customer_groups').update(payload).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('แก้ไขแล้ว')
    } else {
      const { error } = await supabase.from('customer_groups').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('เพิ่มกลุ่มแล้ว')
    }
    setShowForm(false); fetch(); setSaving(false)
  }

  const remove = async (id: string) => {
    if (!confirm('ต้องการลบกลุ่มนี้?')) return
    const { error } = await supabase.from('customer_groups').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('ลบแล้ว'); fetch()
  }

  const toggleActive = async (g: CustomerGroup) => {
    await supabase.from('customer_groups').update({ active: !g.active }).eq('id', g.id)
    fetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-rowa-text">กลุ่มลูกค้า & ส่วนลด</h1>
          <p className="text-rowa-muted text-sm">ตั้งค่าส่วนลดสำหรับลูกค้าแต่ละกลุ่ม</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> เพิ่มกลุ่ม</Button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-rowa-muted">กำลังโหลด...</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2 text-rowa-muted">
            <Users className="h-10 w-10 opacity-30" /><p>ยังไม่มีกลุ่มลูกค้า</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-rowa-bg/50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">ชื่อกลุ่ม</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">คำอธิบาย</th>
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">ส่วนลด</th>
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">สถานะ</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-rowa-bg/30 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rowa-pink/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-rowa-pink" />
                      </div>
                      <span className="font-medium text-sm">{g.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-rowa-muted">{g.description ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-rowa-blue/10 text-rowa-blue text-sm font-bold px-3 py-1 rounded-full">
                      -{g.discount_percent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(g)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${g.active ? 'bg-green-400' : 'bg-gray-200'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${g.active ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(g)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Preview card */}
      {groups.filter(g => g.active).length > 0 && (
        <div className="card">
          <p className="text-sm font-semibold text-rowa-text mb-3">ตัวอย่างการคำนวณส่วนลด (ราคา ฿1,000)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {groups.filter(g => g.active).map(g => {
              const after = Math.round(1000 * (1 - g.discount_percent / 100))
              return (
                <div key={g.id} className="bg-rowa-bg rounded-xl p-3">
                  <p className="text-xs text-rowa-muted">{g.name}</p>
                  <p className="text-lg font-bold text-rowa-blue mt-0.5">฿{after.toLocaleString()}</p>
                  <p className="text-xs text-green-600">ลด {g.discount_percent}% = ฿{(1000 - after).toLocaleString()}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editId ? 'แก้ไขกลุ่ม' : 'เพิ่มกลุ่มลูกค้า'}</h2>
              <button onClick={() => setShowForm(false)}><X className="h-5 w-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <Input label="ชื่อกลุ่ม *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น ลูกค้าโรงแรม" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">ส่วนลด (%)</label>
                <div className="relative">
                  <input type="number" min="0" max="100" step="0.5" className="input pr-8 w-full"
                    value={form.discount_percent} placeholder="0"
                    onChange={e => setForm(f => ({ ...f, discount_percent: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rowa-muted text-sm">%</span>
                </div>
                {form.discount_percent && (
                  <p className="text-xs text-rowa-muted">
                    ตัวอย่าง: ราคา ฿1,000 → ฿{Math.round(1000 * (1 - (parseFloat(form.discount_percent) || 0) / 100)).toLocaleString()}
                  </p>
                )}
              </div>
              <Input label="คำอธิบาย (ไม่บังคับ)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดเพิ่มเติม" />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="accent-rowa-blue w-4 h-4" />
                <span className="text-sm text-gray-700">เปิดใช้งาน</span>
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button className="flex-1 justify-center" loading={saving} onClick={save}>บันทึก</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
