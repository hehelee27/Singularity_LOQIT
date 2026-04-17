import { useMemo, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { GradientButton } from '../../components/ui/GradientButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { DeviceCard } from '../../components/loqit/DeviceCard'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useDevices } from '../../hooks/useDevices'
import { useAuth } from '../../hooks/useAuth'

export default function DevicesScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { devices, loading, error, refetch } = useDevices()

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim() || 'LQ'
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  }, [profile?.full_name])

  const counts = useMemo(() => {
    const safe = devices.filter((d) => d.status === 'registered' || d.status === 'recovered').length
    const atRisk = devices.length - safe
    return { total: devices.length, safe, atRisk }
  }, [devices])

  return (
    <SafeAreaView style={styles.safe}>
      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandIcon}
          >
            <MaterialIcons name="shield" size={16} color={Colors.onPrimary} />
          </LinearGradient>
          <Text style={styles.brandText}>LOQIT</Text>
        </View>

        <Pressable style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.avatarText}>{initials}</Text>
        </Pressable>
      </View>

      {/* Title bar */}
      <View style={styles.titleBar}>
        <View>
          <Text style={styles.title}>My Devices</Text>
          <Text style={styles.titleSub}>
            {counts.total} registered · {counts.safe} safe
          </Text>
        </View>
        <View style={styles.addBtnWrap}>
          <GradientButton title="+ Register" onPress={() => router.push('/device/add')} />
        </View>
      </View>

      {/* Loading skeletons */}
      {loading && (
        <View style={styles.skeletons}>
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
          <Skeleton height={80} borderRadius={16} />
        </View>
      )}

      {/* Device list */}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            tintColor={Colors.primary}
            refreshing={loading}
            onRefresh={() => void refetch()}
          />
        }
        renderItem={({ item }) => (
          <DeviceCard
            id={item.id}
            make={item.make}
            model={item.model}
            imei={item.imei_primary}
            status={item.status}
            width="100%"
            onPress={(deviceId) =>
              router.push({ pathname: '/device/[id]', params: { id: deviceId } })
            }
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <Pressable style={styles.emptyCard} onPress={() => router.push('/device/add')}>
              <View style={styles.emptyIconWrap}>
                <MaterialIcons name="phone-android" size={36} color={Colors.outline} />
              </View>
              <Text style={styles.emptyTitle}>No devices registered</Text>
              <Text style={styles.emptySub}>
                Add your first device to start protection
              </Text>
              <View style={styles.emptyAction}>
                <MaterialIcons name="add" size={16} color={Colors.primary} />
                <Text style={styles.emptyActionText}>Register Device</Text>
              </View>
            </Pressable>
          ) : null
        }
      />

      {!loading && error && <ErrorState message={error} onRetry={() => void refetch()} />}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    height: 60,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: Colors.primary,
    fontFamily: FontFamily.headingBold,
    fontSize: 16,
    letterSpacing: 1,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },

  /* Title bar */
  titleBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
  },
  titleSub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  addBtnWrap: {
    minWidth: 130,
  },

  /* Skeletons */
  skeletons: {
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 4,
  },

  /* List */
  list: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    paddingTop: 4,
    gap: 10,
  },

  /* Empty */
  emptyCard: {
    marginTop: 24,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 16,
  },
  emptySub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}1A`,
  },
  emptyActionText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
})