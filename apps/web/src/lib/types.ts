export type Role = 'admin' | 'staff'
export type Platform = 'lazada' | 'shopee' | 'store'
export type StockMovementType = 'in' | 'out' | 'adjustment'
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface Profile {
  id: string
  full_name: string
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  image_url: string | null
  cost_price: number
  created_at: string
  updated_at: string
  current_stock?: number
}

export interface ProductPlatform {
  id: string
  product_id: string
  platform: Platform
  selling_price: number
  discount_percent: number
  platform_product_id: string | null
  active: boolean
}

export interface StockMovement {
  id: string
  product_id: string
  type: StockMovementType
  quantity: number
  note: string | null
  created_by: string
  created_at: string
  product?: Product
  profile?: Profile
}

export interface Order {
  id: string
  platform: Platform
  platform_order_id: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantity: number
  unit_price: number
  cost_price_at_sale: number
  product?: Product
}

export interface PlatformCredential {
  id: string
  platform: Platform
  app_key: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | null
  shop_id: string | null
}

export interface DashboardStats {
  total_revenue: number
  total_cost: number
  gross_profit: number
  total_orders: number
  low_stock_count: number
  revenue_by_platform: { platform: Platform; amount: number }[]
  daily_revenue: { date: string; amount: number }[]
}
