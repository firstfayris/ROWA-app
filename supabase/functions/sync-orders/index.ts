import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// ============================================================
// Lazada API
// ============================================================
async function syncLazada(cred: { app_key: string; app_secret: string; access_token: string }) {
  const { app_key, access_token } = cred
  const timeFrom = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  // NOTE: Real Lazada API requires HMAC-SHA256 signature — simplified here
  const url = new URL('https://api.lazada.co.th/rest/orders/get')
  url.searchParams.set('app_key', app_key)
  url.searchParams.set('access_token', access_token)
  url.searchParams.set('created_after', timeFrom)
  url.searchParams.set('status', 'pending')

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Lazada API error: ${res.status}`)
  const json = await res.json()

  let synced = 0
  for (const order of json?.data?.orders ?? []) {
    // Upsert order
    const { data: dbOrder, error: orderErr } = await supabase
      .from('orders')
      .upsert({
        platform: 'lazada',
        platform_order_id: String(order.order_id),
        status: mapLazadaStatus(order.statuses?.[0]),
        total_amount: parseFloat(order.price ?? '0'),
      }, { onConflict: 'platform_order_id' })
      .select()
      .single()

    if (orderErr || !dbOrder) continue

    // Only insert items for new orders (to avoid duplicate stock deductions)
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', dbOrder.id)

    if (count === 0 && order.items?.length) {
      for (const item of order.items) {
        // Find product by Lazada item_id
        const { data: pp } = await supabase
          .from('product_platforms')
          .select('product_id, selling_price')
          .eq('platform', 'lazada')
          .eq('platform_product_id', String(item.item_id))
          .single()

        if (!pp) continue

        const { data: product } = await supabase
          .from('products')
          .select('cost_price')
          .eq('id', pp.product_id)
          .single()

        await supabase.from('order_items').insert({
          order_id: dbOrder.id,
          product_id: pp.product_id,
          quantity: item.quantity ?? 1,
          unit_price: parseFloat(item.paid_price ?? pp.selling_price ?? '0'),
          cost_price_at_sale: product?.cost_price ?? 0,
        })
        // Trigger trg_auto_deduct_stock fires automatically here ✅
      }
    }
    synced++
  }
  return synced
}

// ============================================================
// Shopee API
// ============================================================
async function syncShopee(cred: {
  app_key: string
  app_secret: string
  access_token: string
  shop_id: string
}) {
  const { access_token, shop_id } = cred
  const baseUrl = 'https://partner.shopeemobile.com/api/v2'
  const timeFrom = Math.floor((Date.now() - 2 * 60 * 60 * 1000) / 1000)
  const timeTo = Math.floor(Date.now() / 1000)

  // Fetch order list
  const listRes = await fetch(
    `${baseUrl}/order/get_order_list?time_from=${timeFrom}&time_to=${timeTo}&time_range_field=create_time&page_size=50`,
    { headers: { Authorization: `Bearer ${access_token}`, 'x-shop-id': shop_id } }
  )
  const listJson = await listRes.json()
  const orderSns: string[] = (listJson?.response?.order_list ?? []).map((o: { order_sn: string }) => o.order_sn)

  if (!orderSns.length) return 0

  // Fetch order details (with items)
  const detailRes = await fetch(
    `${baseUrl}/order/get_order_detail?order_sn_list=${orderSns.join(',')}&response_optional_fields=item_list,total_amount`,
    { headers: { Authorization: `Bearer ${access_token}`, 'x-shop-id': shop_id } }
  )
  const detailJson = await detailRes.json()

  let synced = 0
  for (const order of detailJson?.response?.order_list ?? []) {
    const { data: dbOrder, error: orderErr } = await supabase
      .from('orders')
      .upsert({
        platform: 'shopee',
        platform_order_id: order.order_sn,
        status: mapShopeeStatus(order.order_status),
        total_amount: parseFloat(order.total_amount ?? '0'),
      }, { onConflict: 'platform_order_id' })
      .select()
      .single()

    if (orderErr || !dbOrder) continue

    // Only insert items for new orders
    const { count } = await supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', dbOrder.id)

    if (count === 0 && order.item_list?.length) {
      for (const item of order.item_list) {
        const { data: pp } = await supabase
          .from('product_platforms')
          .select('product_id, selling_price')
          .eq('platform', 'shopee')
          .eq('platform_product_id', String(item.item_id))
          .single()

        if (!pp) continue

        const { data: product } = await supabase
          .from('products')
          .select('cost_price')
          .eq('id', pp.product_id)
          .single()

        await supabase.from('order_items').insert({
          order_id: dbOrder.id,
          product_id: pp.product_id,
          quantity: item.model_quantity_purchased ?? 1,
          unit_price: parseFloat(item.discounted_price ?? pp.selling_price ?? '0'),
          cost_price_at_sale: product?.cost_price ?? 0,
        })
        // Trigger trg_auto_deduct_stock fires automatically here ✅
      }
    }
    synced++
  }
  return synced
}

// ============================================================
// Status mapping
// ============================================================
function mapLazadaStatus(s: string): string {
  const map: Record<string, string> = {
    pending: 'pending',
    ready_to_ship: 'confirmed',
    shipped: 'shipped',
    delivered: 'delivered',
    canceled: 'cancelled',
  }
  return map[s?.toLowerCase()] ?? 'pending'
}

function mapShopeeStatus(s: string): string {
  const map: Record<string, string> = {
    UNPAID: 'pending',
    READY_TO_SHIP: 'confirmed',
    SHIPPED: 'shipped',
    COMPLETED: 'delivered',
    CANCELLED: 'cancelled',
  }
  return map[s] ?? 'pending'
}

// ============================================================
// Main handler — รับ webhook หรือ cron trigger
// ============================================================
Deno.serve(async (req) => {
  const { data: creds } = await supabase.from('platform_credentials').select('*')
  const results: Record<string, number | string> = {}

  for (const cred of creds ?? []) {
    if (!cred.access_token) {
      results[cred.platform] = 'no token'
      continue
    }
    try {
      if (cred.platform === 'lazada') results.lazada = await syncLazada(cred)
      if (cred.platform === 'shopee') results.shopee = await syncShopee(cred)
    } catch (err) {
      console.error(`Sync ${cred.platform} error:`, err)
      results[cred.platform] = `error: ${err}`
    }
  }

  return new Response(JSON.stringify({ ok: true, synced: results, ts: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
