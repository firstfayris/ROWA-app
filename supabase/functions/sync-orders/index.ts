import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ============================================================
// Lazada API helper
// ============================================================
async function syncLazada(cred: { app_key: string; app_secret: string; access_token: string }) {
  const { app_key, access_token } = cred

  // Fetch orders from last 2 hours
  const timeFrom = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)
  const timeTo = Math.floor(Date.now() / 1000)

  const url = new URL('https://api.lazada.co.th/rest/orders/get')
  url.searchParams.set('app_key', app_key)
  url.searchParams.set('access_token', access_token)
  url.searchParams.set('created_after', new Date(timeFrom * 1000).toISOString())
  url.searchParams.set('created_before', new Date(timeTo * 1000).toISOString())
  url.searchParams.set('status', 'pending')

  // NOTE: Real implementation requires HMAC signature
  const res = await fetch(url.toString())
  const json = await res.json()

  const orders = json?.data?.orders ?? []
  for (const order of orders) {
    // Upsert order
    await supabase.from('orders').upsert({
      platform: 'lazada',
      platform_order_id: String(order.order_id),
      status: mapLazadaStatus(order.statuses?.[0]),
      total_amount: parseFloat(order.price),
    }, { onConflict: 'platform_order_id' })
  }

  return orders.length
}

// ============================================================
// Shopee API helper
// ============================================================
async function syncShopee(cred: { app_key: string; app_secret: string; access_token: string; shop_id: string }) {
  const { access_token, shop_id } = cred
  const baseUrl = 'https://partner.shopeemobile.com/api/v2'

  // Fetch orders updated in last 2 hours
  const timeFrom = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)
  const timeTo = Math.floor(Date.now() / 1000)

  const path = '/order/get_order_list'
  const res = await fetch(`${baseUrl}${path}?time_from=${timeFrom}&time_to=${timeTo}&time_range_field=create_time&page_size=50`, {
    headers: { Authorization: `Bearer ${access_token}`, 'x-shop-id': shop_id },
  })
  const json = await res.json()
  const orders = json?.response?.order_list ?? []

  for (const order of orders) {
    await supabase.from('orders').upsert({
      platform: 'shopee',
      platform_order_id: order.order_sn,
      status: mapShopeeStatus(order.order_status),
      total_amount: parseFloat(order.total_amount ?? '0'),
    }, { onConflict: 'platform_order_id' })
  }

  return orders.length
}

function mapLazadaStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'pending', ready_to_ship: 'confirmed',
    shipped: 'shipped', delivered: 'delivered', canceled: 'cancelled',
  }
  return map[s?.toLowerCase()] ?? 'pending'
}

function mapShopeeStatus(s: string): string {
  const map: Record<string, string> = {
    UNPAID: 'pending', READY_TO_SHIP: 'confirmed',
    SHIPPED: 'shipped', COMPLETED: 'delivered', CANCELLED: 'cancelled',
  }
  return map[s] ?? 'pending'
}

// ============================================================
// Main handler
// ============================================================
Deno.serve(async () => {
  const { data: creds } = await supabase.from('platform_credentials').select('*')
  const results: Record<string, number> = {}

  for (const cred of creds ?? []) {
    if (!cred.access_token) continue
    try {
      if (cred.platform === 'lazada') results.lazada = await syncLazada(cred)
      if (cred.platform === 'shopee') results.shopee = await syncShopee(cred)
    } catch (err) {
      console.error(`Sync ${cred.platform} failed:`, err)
      results[cred.platform] = -1
    }
  }

  return new Response(JSON.stringify({ ok: true, synced: results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
