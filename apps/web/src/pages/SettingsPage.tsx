import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { RefreshCw, Link2, Users, Tag, Plus, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Platform } from '../lib/types'

interface Brand {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
  brand: string
  color: string
  description: string | null
}

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
  const [tab, setTab] = useState<'platforms' | 'users' | 'pricing' | 'categories'>('platforms')

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
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<'staff' | 'admin'>('staff')
  const [inviting, setInviting] = useState(false)

  // Pricing
  const [pricingRows, setPricingRows] = useState<ProductPlatformRow[]>([])

  // Brands
  const [brands, setBrands] = useState<Brand[]>([])
  const [newBrandName, setNewBrandName] = useState('')
  const [savingBrand, setSavingBrand] = useState(false)

  // Categories
  const [categories, setCategories] = useState<Category[]>([])
  const [showCatForm, setShowCatForm] = useState(false)
  const [editCatId, setEditCatId] = useState<string | null>(null)
  const [catForm, setCatForm] = useState({ name: '', brand: '', color: '#4B5DB8', description: '' })
  const [savingCat, setSavingCat] = useState(false)

  const fetchAll = async () => {
    const [credsRes, usersRes, pricingRes, catsRes, brandsRes] = await Promise.all([
      supabase.from('platform_credentials').select('*'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('product_platforms').select('*, product:products(name,sku)').order('platform'),
      supabase.from('categories').select('*').order('brand,name'),
      supabase.from('brands').select('*').order('name'),
    ])
    if (credsRes.data) {
      for (const c of credsRes.data) {
        setCreds(prev => ({ ...prev, [c.platform]: c }))
      }
    }
    setUsers(usersRes.data ?? [])
    setPricingRows(pricingRes.data ?? [])
    setCategories(catsRes.data ?? [])
    setBrands(brandsRes.data ?? [])
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
    if (!inviteEmail || !invitePassword) return toast.error('กรุณาใส่ชื่อผู้ใช้และรหัสผ่าน')
    if (invitePassword.length < 6) return toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    setInviting(true)
    const email = `${inviteEmail.trim().toLowerCase()}@rowa.internal`
    const { data, error } = await supabase.auth.signUp({ email, password: invitePassword })
    if (error) { toast.error(error.message); setInviting(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: inviteName || inviteEmail,
        role: inviteRole,
      })
    }
    toast.success('เพิ่มผู้ใช้แล้ว')
    setInviteEmail(''); setInvitePassword(''); setInviteName('')
    fetchAll()
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

  const saveBrand = async () => {
    if (!newBrandName.trim()) return
    setSavingBrand(true)
    const { error } = await supabase.from('brands').insert({ name: newBrandName.trim() })
    if (error) toast.error(error.message)
    else { toast.success('เพิ่มแบรนด์แล้ว'); setNewBrandName(''); fetchAll() }
    setSavingBrand(false)
  }

  const deleteBrand = async (id: string, name: string) => {
    if (categories.some(c => c.brand === name)) {
      return toast.error('ไม่สามารถลบแบรนด์ที่มีหมวดหมู่อยู่ได้')
    }
    if (!confirm(`ลบแบรนด์ "${name}"?`)) return
    const { error } = await supabase.from('brands').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('ลบแบรนด์แล้ว'); fetchAll() }
  }

  const saveCategory = async () => {
    if (!catForm.name || !catForm.brand) return toast.error('กรุณาใส่ชื่อและแบรนด์')
    setSavingCat(true)
    const payload = { name: catForm.name, brand: catForm.brand, color: catForm.color, description: catForm.description || null }
    const { error } = editCatId
      ? await supabase.from('categories').update(payload).eq('id', editCatId)
      : await supabase.from('categories').insert(payload)
    if (error) { toast.error(error.message); setSavingCat(false); return }
    toast.success(editCatId ? 'แก้ไขหมวดหมู่แล้ว' : 'เพิ่มหมวดหมู่แล้ว')
    setShowCatForm(false); fetchAll(); setSavingCat(false)
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('ต้องการลบหมวดหมู่นี้?')) return
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('ลบหมวดหมู่แล้ว'); fetchAll()
  }

  const tabs = [
    { key: 'platforms', label: 'เชื่อมต่อ Platform', icon: Link2 },
    { key: 'categories', label: 'หมวดหมู่', icon: Tag },
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
            <h2 className="font-semibold mb-4">เพิ่มผู้ใช้ใหม่</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <Input label="ชื่อ-นามสกุล" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="เช่น สมฤทัย" />
              <Input label="ชื่อผู้ใช้ (ใช้ login)" type="text" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="เช่น somruthai" />
              <Input label="รหัสผ่าน" type="password" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">สิทธิ์</label>
                <select className="input" value={inviteRole} onChange={e => setInviteRole(e.target.value as 'staff' | 'admin')}>
                  <option value="staff">พนักงาน (Staff)</option>
                  <option value="admin">ผู้ดูแล (Admin)</option>
                </select>
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={inviteUser} loading={inviting}>เพิ่มผู้ใช้</Button>
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

      {/* Categories */}
      {tab === 'categories' && (
        <div className="space-y-4">
          {/* Brand management */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-rowa-text">แบรนด์</h2>
            <div className="flex flex-wrap gap-2">
              {brands.map(b => (
                <div key={b.id} className="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm">
                  <span>{b.name}</span>
                  <button onClick={() => deleteBrand(b.id, b.name)} className="ml-1 text-gray-400 hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="input flex-1"
                placeholder="ชื่อแบรนด์ใหม่ เช่น เฟอร์นิเจอร์"
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveBrand()}
              />
              <Button size="sm" loading={savingBrand} onClick={saveBrand}>
                <Plus className="h-4 w-4" /> เพิ่มแบรนด์
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-rowa-text">หมวดหมู่สินค้า</h2>
            <Button size="sm" onClick={() => { setEditCatId(null); setCatForm({ name: '', brand: brands[0]?.name ?? '', color: '#4B5DB8', description: '' }); setShowCatForm(true) }}>
              <Plus className="h-4 w-4" /> เพิ่มหมวดหมู่
            </Button>
          </div>

          {showCatForm && (
            <div className="card border-rowa-blue/30 border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{editCatId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h3>
                <button onClick={() => setShowCatForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="ชื่อหมวดหมู่" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="เช่น กระเป๋า eye theme" />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">แบรนด์</label>
                  <select className="input" value={catForm.brand} onChange={e => setCatForm(f => ({ ...f, brand: e.target.value }))}>
                    {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">สี</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                    <span className="text-sm text-rowa-muted">{catForm.color}</span>
                  </div>
                </div>
                <Input label="คำอธิบาย (ไม่บังคับ)" value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="รายละเอียดเพิ่มเติม" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowCatForm(false)}>ยกเลิก</Button>
                <Button size="sm" loading={savingCat} onClick={saveCategory}>บันทึก</Button>
              </div>
            </div>
          )}

          {(() => {
            const brands = [...new Set(categories.map(c => c.brand))]
            return brands.map(brand => (
              <div key={brand} className="card space-y-2">
                <h3 className="font-medium text-rowa-text text-sm uppercase tracking-wide text-rowa-muted">{brand}</h3>
                {categories.filter(c => c.brand === brand).map(cat => (
                  <div key={cat.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="h-4 w-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-rowa-text">{cat.name}</p>
                      {cat.description && <p className="text-xs text-rowa-muted">{cat.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded hover:bg-gray-100" onClick={() => { setEditCatId(cat.id); setCatForm({ name: cat.name, brand: cat.brand, color: cat.color, description: cat.description ?? '' }); setShowCatForm(true) }}>
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-red-50" onClick={() => deleteCategory(cat.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          })()}

          {categories.length === 0 && (
            <div className="card text-center text-rowa-muted text-sm py-8">ยังไม่มีหมวดหมู่ กดปุ่ม "เพิ่มหมวดหมู่" เพื่อเริ่มต้น</div>
          )}
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
