# ROWA App — คู่มือติดตั้ง

## 1. ติดตั้ง Node.js

ดาวน์โหลดจาก: https://nodejs.org (แนะนำ LTS version)

ตรวจสอบการติดตั้ง:
```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

## 2. ติดตั้ง pnpm

```bash
npm install -g pnpm
```

## 3. สร้าง Supabase Project

1. ไปที่ https://supabase.com และสร้างบัญชี/project ใหม่
2. ไปที่ **Settings > API** และคัดลอก:
   - `Project URL`
   - `anon public` key
3. ไปที่ **SQL Editor** และรัน migration:
   - คัดลอกเนื้อหาจาก `supabase/migrations/001_initial_schema.sql`
   - วางและกด **Run**

## 4. ตั้งค่า Environment Variables

**Web App:**
```bash
cd apps/web
cp .env.example .env
# แก้ไขไฟล์ .env ใส่ค่า Supabase
```

**Mobile App:**
```bash
cd apps/mobile
cp .env.example .env
# แก้ไขไฟล์ .env ใส่ค่า Supabase
```

## 5. ติดตั้ง Dependencies และรัน

```bash
# จาก root folder
pnpm install

# รัน Web App
pnpm web          # เปิดที่ http://localhost:5173

# รัน Mobile App
pnpm mobile       # เปิด Expo Go บนมือถือแล้วสแกน QR code
```

## 6. สร้าง Admin User คนแรก

1. ไปที่ Supabase Dashboard > **Authentication > Users**
2. คลิก **Invite user** และใส่อีเมล
3. หลังจาก user ลงทะเบียนแล้ว รัน SQL:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'user-uuid-here';
```

## 7. เชื่อมต่อ Lazada & Shopee (Admin)

1. เข้าสู่ระบบด้วย Admin account
2. ไปที่ **ตั้งค่า > เชื่อมต่อ Platform**
3. ใส่ App Key, App Secret จาก Lazada/Shopee Seller Center
4. คลิก **เชื่อมต่อ** เพื่อเริ่ม OAuth flow

## Platform APIs

### Lazada
- สมัคร: https://open.lazada.com
- Documentation: https://open.lazada.com/doc/api.htm

### Shopee
- สมัคร: https://open.shopee.com
- Documentation: https://open.shopee.com/documents

---

## โครงสร้างโปรเจกต์

```
rowa-app/
├── apps/
│   ├── web/           # React + Vite Web App
│   └── mobile/        # Expo React Native Mobile App
├── packages/
│   └── core/          # Shared types & utilities
├── supabase/
│   ├── migrations/    # Database schema
│   └── functions/     # Edge Functions (API sync)
└── SETUP.md
```
