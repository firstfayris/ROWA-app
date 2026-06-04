import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { supabase } from '@/lib/supabase'
import type { Platform, OrderStatus } from '@rowa/core'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

interface OrderRow {
  id: string
  platform: Platform
  platform_order_id: string | null
  status: OrderStatus
  total_amount: number
  created_at: string
}

const platformColor: Record<Platform, string> = { lazada: '#F97316', shopee: '#EF4444', store: '#4B5DB8' }
const platformLabel: Record<Platform, string> = { lazada: 'Lazada', shopee: 'Shopee', store: 'หน้าร้าน' }
const statusLabel: Record<OrderStatus, string> = {
  pending: 'รอดำเนินการ', confirmed: 'ยืนยันแล้ว',
  shipped: 'จัดส่งแล้ว', delivered: 'ส่งถึงแล้ว', cancelled: 'ยกเลิก',
}

export default function OrdersScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(50)
    setOrders(data ?? [])
  }

  const onRefresh = async () => { setRefreshing(true); await fetchOrders(); setRefreshing(false) }
  useEffect(() => { fetchOrders() }, [])

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4B5DB8" />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.platformBadge, { backgroundColor: platformColor[item.platform] + '20' }]}>
                <Text style={[styles.platformText, { color: platformColor[item.platform] }]}>{platformLabel[item.platform]}</Text>
              </View>
              <Text style={styles.amount}>฿{item.total_amount.toLocaleString()}</Text>
            </View>
            <Text style={styles.orderId}>
              #{item.platform_order_id || item.id.slice(0, 8).toUpperCase()}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.status}>{statusLabel[item.status]}</Text>
              <Text style={styles.date}>{format(new Date(item.created_at), 'd MMM yy HH:mm', { locale: th })}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>ยังไม่มีคำสั่งซื้อ</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  platformBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  platformText: { fontSize: 12, fontWeight: '600' },
  amount: { fontWeight: 'bold', fontSize: 16, color: '#1A1A2E' },
  orderId: { color: '#9CA3AF', fontSize: 12, marginBottom: 8 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  status: { color: '#6B7280', fontSize: 13 },
  date: { color: '#9CA3AF', fontSize: 12 },
  empty: { padding: 48, alignItems: 'center' },
  emptyText: { color: '#9CA3AF' },
})
