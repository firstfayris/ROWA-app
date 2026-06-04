import { useEffect, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert
} from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

interface ProductStock {
  id: string
  sku: string
  name: string
  current_stock: number
  cost_price: number
}

export default function ProductsScreen() {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [products, setProducts] = useState<ProductStock[]>([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductStock | null>(null)
  const [qty, setQty] = useState('')
  const [moveType, setMoveType] = useState<'in' | 'out' | 'adjustment'>('in')

  const fetchProducts = async () => {
    const { data } = await supabase.from('product_stock').select('*').order('name')
    setProducts(data ?? [])
  }

  const onRefresh = async () => { setRefreshing(true); await fetchProducts(); setRefreshing(false) }
  useEffect(() => { fetchProducts() }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.includes(search)
  )

  const saveMovement = async () => {
    if (!selectedProduct || !qty) return
    const { error } = await supabase.from('stock_movements').insert({
      product_id: selectedProduct.id,
      type: moveType,
      quantity: Math.abs(parseInt(qty)),
      created_by: profile!.id,
    })
    if (error) { Alert.alert('ข้อผิดพลาด', error.message); return }
    setSelectedProduct(null)
    setQty('')
    fetchProducts()
  }

  const stockColor = (n: number) => n === 0 ? '#EF4444' : n <= 5 ? '#F97316' : '#22C55E'

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="ค้นหาสินค้า, SKU..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9CA3AF"
      />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4B5DB8" />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => setSelectedProduct(item)}>
            <View style={styles.rowLeft}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sku}>{item.sku}</Text>
            </View>
            <View style={styles.rowRight}>
              {isAdmin && <Text style={styles.cost}>฿{item.cost_price.toLocaleString()}</Text>}
              <View style={[styles.stockBadge, { backgroundColor: stockColor(item.current_stock) + '20' }]}>
                <Text style={[styles.stockText, { color: stockColor(item.current_stock) }]}>
                  {item.current_stock === 0 ? 'หมด' : `${item.current_stock} ชิ้น`}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selectedProduct} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>ปรับสต็อก</Text>
            <Text style={styles.modalSubtitle}>{selectedProduct?.name}</Text>
            <View style={styles.typeRow}>
              {(['in', 'out', 'adjustment'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, moveType === t && styles.typeBtnActive]}
                  onPress={() => setMoveType(t)}
                >
                  <Text style={[styles.typeBtnText, moveType === t && styles.typeBtnTextActive]}>
                    {t === 'in' ? 'รับเข้า' : t === 'out' ? 'ตัดออก' : 'ปรับยอด'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="จำนวน"
              keyboardType="number-pad"
              value={qty}
              onChangeText={setQty}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelectedProduct(null)}>
                <Text style={styles.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={saveMovement}>
                <Text style={styles.confirmBtnText}>บันทึก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF' },
  search: { margin: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', color: '#1A1A2E' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  rowLeft: { flex: 1 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  name: { fontWeight: '600', color: '#1A1A2E', fontSize: 14 },
  sku: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  cost: { color: '#6B7280', fontSize: 12 },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  stockText: { fontSize: 12, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A2E' },
  modalSubtitle: { color: '#6B7280', marginTop: 4, marginBottom: 16 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  typeBtnActive: { borderColor: '#4B5DB8', backgroundColor: '#EEF0FC' },
  typeBtnText: { color: '#6B7280', fontWeight: '500' },
  typeBtnTextActive: { color: '#4B5DB8' },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16, fontSize: 15 },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#4B5DB8', alignItems: 'center' },
  cancelBtnText: { color: '#4B5DB8', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4B5DB8', alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '600' },
})
