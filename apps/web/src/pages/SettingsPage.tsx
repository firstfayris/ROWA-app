import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { RefreshCw, Link2, Users, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Platform } from '@rowa/core'

interface PlatformCred {
  id?: string
  platform: Platform
  app_key: string
  app_secret: string
  shop_id: string
  access_token?: string | null
  expires_at?: string | null
}

interface ProfileRow {
  id: string
  full_name: string
  role: string
  created_at: string
}

interface ProductPlatformRow {
  id: string
  product_id: string
  platform: Platform
  selling_price: number
  discount_percent: number
  active: boolean
  product?: { name: string; sku: string }
}

const PLATFORMS: Platform[] = ['lazada', 'shopee']
const platformLabelTh: Record<Platform, string> = {
  lazada: 'Lazada', shopee: 'Shopee', store: 'หน้าร้าน',
}

export function SettingsPage() {
  const [tab, setTab] = useState<'platforms' | 'users' | 'pricing'>('platforms')

  // Platform credentials
  const [creds, setCreds] = useState<Record<Platform, PlatformCred>>({
    lazada: { platform: 'lazada', app_key: '', app_secret: '', shop_id: '' },
    shopee: { platform: 'shopee', app_key: '', app_secret: '', shop_id: '' },
    store: { platform: 'store', app_key: '', app_secret: '', shop_id: '' },
  })
  const [savingPlatform, setSavingPlatform] = useState<Platform | null>(null)

  // Users
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff')
  const [inviting, setInviting] = useState(false)

  // Pricing
  const [pricingRows, setPricingRows] = useState<ProductPlatformRow[]>([])

  const fetchAll = async () => {
    const [credsRes, usersRes, pricingRes] = await Promise.all([
      supabase.from('platform_credentials').select('*'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('product_platforms').select('*, product:products(name,sku)').order('platform'),
    ])
    if (credsRes.data) {
      for (const c of credsRes.data) {
        setCreds(prev => ({ ...prev, [c.platform]: c }))
      }
    }
    setUsers(usersRes.data ?? [])
    setPricingRows(pricingRes.data ?? [])
  }

  useEffect(() => { fetchAll() }, [])

  const saveCred = async (platform: Platform) => {
    const cred = creds[platform]
    setSavingPlatform(platform)
    const { error } = await supabase.from('platform_credentials').upsert({
      ...cred,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform' })
    if (error) toast.error(error.message)
    else toast.success(`บันทึก ${platformLabelTh[platform]} แล้ว`)
    setSavingPlatform(null)
  }

  const updateCred = (platform: Platform, field: keyof PlatformCred, value: string) => {
    setCreds(prev => ({ ...prev, [platform]: { ...prev[platform], [field]: value } }))
  }

  const inviteUser = async () => {
    if (!inviteEmail) return
    setInviting(true)
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
      data: { role: inviteRole },
    })
    if (error) toast.error(error.message)
    else { toast.success('ส่งอีเมลเชิญแล้ว'); setInviteEmail('') }
    setInviting(false)
  }

  const updatePricing = async (row: ProductPlatformRow) => {
    const { error } = await supabase.from('product_platforms').update({
      selling_price: row.selling_price,
      discount_percent: row.discount_percent,
      active: row.active,
    }).eq('id', row.id)
    if (error) toast.error(error.message)
    else toast.success('อัปเดตราคาแล้ว')
  }

  const tabs = [
    { key: 'platforms', label: 'เชื่อมต่อ Platform', icon: Link2 },
    { key: 'pricing', label: 'ราคา & ส่วนลด', icon: Tag },
    { key: 'users', label: 'จัดการผู้ใช้', icon: Users },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-rowa-text">ตั้งค่า</h1>
        <p className="text-rowa-muted text-sm">เฉพาะ Admin เท่านั้น</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-rowa-blue text-white' : 'text-gray-500 hover:text-rowa-blue'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Platform Credentials */}
      {tab === 'platforms' && (
        <div className="grid md:grid-cols-2 gap-4">
          {PLATFORMS.map(platform => (
            <div key={platform} className="card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-rowa-text">{platformLabelTh[platform]}</h2>
                <Badge variant={creds[platform].access_token ? 'success' : 'default'}>
                  {creds[platform].access_token ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}
                </Badge>
              </div>
              <Input label="App Key" value={creds[platform].app_key} onChange={e => updateCred(platform, 'app_key', e.target.value)} placeholder="App Key" />
              <Input label="App Secret" type="password" value={creds[platform].app_secret} onChange={e => updateCred(platform, 'app_secret', e.target.value)} placeholder="App Secret" />
              <Input label="Shop ID" value={creds[platform].shop_id} onChange={e => updateCred(platform, 'shop_id', e.target.value)} placeholder="Shop ID" />
              <div className="flex gap-2">
                <Button className="flex-1 justify-center" loading={savingPlatform === platform} onClick={() => saveCred(platform)}>
                  บันทึก
                </Button>
                <Button variant="secondary" size="md" onClick={() => toast('เร็วๆ นี้: OAuth redirect')}>
                  <Link2 className="h-4 w-4" /> เชื่อมต่อ
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing */}
      {tab === 'pricing' && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-rowa-bg/50 border-b border-gray-100">
                <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">สินค้า</th>
                <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">Platform</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">ราคาขาย</th>
                <th className="text-right text-xs font-medium text-rowa-muted px-4 py-3">ส่วนลด %</th>
                <th className="text-center text-xs font-medium text-rowa-muted px-4 py-3">เปิดใช้</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {pricingRows.map((row, i) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="px-6 py-3 text-sm">
                    <p className="font-medium">{row.product?.name}</p>
                    <p className="text-xs text-rowa-muted">{row.product?.sku}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.platform as 'lazada' | 'shopee' | 'store'}>{platformLabelTh[row.platform]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="input text-right w-24 ml-auto"
                      value={row.selling_price}
                      onChange={e => setPricingRows(rows => rows.map((r, j) => j === i ? { ...r, selling_price: parseFloat(e.target.value) || 0 } : r))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="input text-right w-16 ml-auto"
                      value={row.discount_percent}
                      onChange={e => setPricingRows(rows => rows.map((r, j) => j === i ? { ...r, discount_percent: parseFloat(e.target.value) || 0 } : r))}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={row.active}
                      onChange={e => setPricingRows(rows => rows.map((r, j) => j === i ? { ...r, active: e.target.checked } : r))}
                      className="accent-rowa-blue"
                    />
                  </td>
                  <td className="px-6 py-3">
                    <Button size="sm" variant="secondary" onClick={() => updatePricing(row)}>บันทึก</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold mb-4">เชิญผู้ใช้ใหม่</h2>
            <div className="flex gap-3 flex-wrap items-end">
              <Input label="อีเมล" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@example.com" className="w-64" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'staff' | 'admin')}>
                  <option value="staff">พนักงาน (Staff)</option>
                  <option value="admin">ผู้ดูแล (Admin)</option>
                </select>
              </div>
              <Button onClick={inviteUser} loading={inviting}>ส่งคำเชิญ</Button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-rowa-bg/50 border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-rowa-muted px-6 py-3">ชื่อ</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">Role</th>
                  <th className="text-left text-xs font-medium text-rowa-muted px-4 py-3">วันที่เพิ่ม</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-50">
                    <td className="px-6 py-3 font-medium text-sm">{u.full_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'default' : 'success'}>
                        {u.role === 'admin' ? 'Admin' : 'Staff'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-rowa-muted">
                      {new Date(u.created_at).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-6 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          const newRole = u.role === 'admin' ? 'staff' : 'admin'
                          await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
                          toast.success('เปลี่ยน role แล้ว')
                          fetchAll()
                        }}
                      >
                        เปลี่ยน Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card border-rowa-blue/20 border">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-rowa-blue" />
          <div>
            <p className="font-medium text-rowa-blue">ซิงค์ข้อมูลจาก Lazada & Shopee</p>
            <p className="text-xs text-rowa-muted">ระบบจะซิงค์ orders อัตโนมัติทุก 15 นาที</p>
          </div>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => toast('กำลังซิงค์...')}>
            ซิงค์ตอนนี้
          </Button>
        </div>
      </div>
    </div>
  )
}
