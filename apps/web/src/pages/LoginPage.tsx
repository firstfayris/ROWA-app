import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Heart, ShoppingBag } from 'lucide-react'

export function LoginPage() {
  const { signIn, user } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ'
      setError(message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col items-center justify-center w-1/2 bg-rowa-blue relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 80 + 20,
                height: Math.random() * 80 + 20,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.5,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center text-white px-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Heart className="h-8 w-8 text-rowa-pink fill-rowa-pink" />
            </div>
            <div className="text-left">
              <h1 className="text-5xl font-bold">ROWA</h1>
              <p className="text-white/70 text-sm">ระบบจัดการร้านค้า</p>
            </div>
          </div>
          <p className="text-white/80 text-lg leading-relaxed max-w-xs mx-auto">
            จัดการสต็อก ติดตามยอดขาย และวิเคราะห์กำไรจาก Lazada, Shopee และหน้าร้านได้ในที่เดียว
          </p>
          <div className="mt-8 flex items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold">Lazada</p>
              <p className="text-white/60 text-xs">เชื่อมต่อแล้ว</p>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-center">
              <p className="text-2xl font-bold">Shopee</p>
              <p className="text-white/60 text-xs">เชื่อมต่อแล้ว</p>
            </div>
            <div className="w-px h-8 bg-white/30" />
            <div className="text-center">
              <ShoppingBag className="h-6 w-6 mx-auto mb-1" />
              <p className="text-white/60 text-xs">หน้าร้าน</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-rowa-bg">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-rowa-blue flex items-center justify-center">
              <Heart className="h-5 w-5 text-rowa-pink fill-rowa-pink" />
            </div>
            <span className="text-2xl font-bold text-rowa-blue">ROWA</span>
          </div>

          <h2 className="text-2xl font-bold text-rowa-text mb-1">เข้าสู่ระบบ</h2>
          <p className="text-rowa-muted text-sm mb-8">ยินดีต้อนรับกลับ</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="อีเมล"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              label="รหัสผ่าน"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full justify-center mt-2">
              เข้าสู่ระบบ
            </Button>
          </form>

          <p className="text-center text-xs text-rowa-muted mt-8">
            ROWA Store Management System v1.0
          </p>
        </div>
      </div>
    </div>
  )
}
