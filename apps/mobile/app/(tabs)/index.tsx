import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface StatCardProps {
  title: string
  value: string
  color: string
  subtitle?: string
}

function StatCard({ title, value, color, subtitle }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  )
}

export default function HomeScreen() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [refreshing, setRefreshing] = useState(false)
  const [todayOrders, setTodayOrders] = useState(0)
  const [lowStock, setLowStock] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const [ordRes, stockRes] = await Promise.all([
      supabase.from('orders').select('total_amount').gte('created_at', today).neq('status', 'cancelled'),
      supabase.from('product_stock').select('current_stock').lte('current_stock', 5),
    ])
    setTodayOrders(ordRes.data?.length ?? 0)
    const rev = ordRes.data?.reduce((s, o) => s + o.total_amount, 0) ?? 0
    setTotalRevenue(rev)
    setLowStock(stockRes.data?.length ?? 0)
  }

  const onRefresh = async () => { setRefreshing(true); await fetchStats(); setRefreshing(false) }
  useEffect(() => { fetchStats() }, [])

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4B5DB8" />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>สวัสดี, {profile?.full_name?.split(' ')[0]} 👋</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })}</Text>
      </View>

      <View style={styles.grid}>
        <StatCard title="ออเดอร์วันนี้" value={todayOrders.toString()} color="#4B5DB8" />
        {isAdmin && (
          <StatCard
            title="รายได้วันนี้"
            value={`฿${totalRevenue.toLocaleString()}`}
            color="#22C55E"
          />
        )}
        <StatCard
          title="สินค้าใกล้หมด"
          value={lowStock.toString()}
          color={lowStock > 0 ? '#F97316' : '#22C55E'}
          subtitle="สต็อก ≤ 5"
        />
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>ทำรายการด่วน</Text>
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionText}>+ บันทึกขายหน้าร้าน</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F8F9FF', borderColor: '#4B5DB8', borderWidth: 1 }]}>
          <Text style={[styles.actionText, { color: '#4B5DB8' }]}>ปรับสต็อก</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  header: { backgroundColor: '#4B5DB8', padding: 24, paddingTop: 40 },
  greeting: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  date: { color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 13 },
  grid: { padding: 16, gap: 12 },
  statCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statTitle: { color: '#6B7280', fontSize: 13 },
  statValue: { fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  statSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  quickActions: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  actionBtn: { backgroundColor: '#4B5DB8', borderRadius: 12, padding: 16, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 15 },
})
