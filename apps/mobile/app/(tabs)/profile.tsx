import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useAuthStore } from '@/store/authStore'
import { router } from 'expo-router'

export default function ProfileScreen() {
  const { profile, signOut } = useAuthStore()

  const handleSignOut = async () => {
    Alert.alert('ออกจากระบบ', 'ต้องการออกจากระบบหรือไม่?', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ออกจากระบบ', style: 'destructive',
        onPress: async () => { await signOut(); router.replace('/login') }
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.full_name?.[0]?.toUpperCase() ?? 'U'}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{profile?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>แอพ</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>เวอร์ชัน</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ร้านค้า</Text>
          <Text style={styles.infoValue}>ROWA</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>ออกจากระบบ</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FF', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#4B5DB8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  name: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E' },
  roleBadge: { marginTop: 8, backgroundColor: '#EEF0FC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { color: '#4B5DB8', fontWeight: '600', fontSize: 13 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontWeight: '600', color: '#6B7280', fontSize: 13, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { color: '#6B7280' },
  infoValue: { fontWeight: '500', color: '#1A1A2E' },
  signOutBtn: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, alignItems: 'center' },
  signOutText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
})
