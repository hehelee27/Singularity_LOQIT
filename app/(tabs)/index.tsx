import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

import { AadhaarVerifyModal } from '../../components/loqit/AadhaarVerifyModal'
import { DeviceCard } from '../../components/loqit/DeviceCard'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { useDevices } from '../../hooks/useDevices'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { bleService } from '../../services/ble.service'

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  is_read: boolean
  created_at: string
}

const quickActions = [
  {
    key: 'sync',
    icon: 'location-searching' as const,
    label: 'Sync Location',
    tint: Colors.primary,
  },
  {
    key: 'lost',
    icon: 'report-problem' as const,
    label: 'Report Lost',
    tint: Colors.error,
  },
  {
    key: 'scan',
    icon: 'bluetooth-searching' as const,
    label: 'Scan Nearby',
    tint: Colors.inversePrimary,
    route: '/(tabs)/scanner',
  },
  {
    key: 'verify',
    icon: 'verified-user' as const,
    label: 'Verify Phone',
    tint: Colors.secondary,
    route: '/verify',
  },
  {
    key: 'alerts',
    icon: 'notifications-active' as const,
    label: 'My Alerts',
    tint: Colors.tertiary,
    route: '/(tabs)/alerts',
  },
] as const

function getGreetingPrefix() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function getRelativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function getNotificationIcon(type: string): keyof typeof MaterialIcons.glyphMap {
  if (type.includes('lost')) return 'warning'
  if (type.includes('found')) return 'check-circle'
  return 'shield'
}

function getNotificationColor(type: string) {
  if (type.includes('lost')) return Colors.error
  if (type.includes('found')) return Colors.secondary
  return Colors.inversePrimary
}

export default function HomeScreen() {
  const router = useRouter()
  const { profile, user, signOut } = useAuth()
  const { devices, loading: loadingDevices, error: devicesError, refetch } = useDevices()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const [aadhaarModalVisible, setAadhaarModalVisible] = useState(false)
  const [showReportPicker, setShowReportPicker] = useState(false)
  const [displayCounts, setDisplayCounts] = useState({ total: 0, alerts: 0, safe: 0 })
  const [isSyncing, setIsSyncing] = useState(false)

  const passiveScanRef = useRef<NodeJS.Timeout | null>(null)
  const appStateRef = useRef(AppState.currentState)

  // Passive BLE scanning - runs every 30 seconds while home screen is active
  useEffect(() => {
    const runPassiveScan = async () => {
      try {
        const isBroadcasting = await bleService.isBroadcastingMode()
        if (isBroadcasting) return

        await bleService.scanForLOQITDevices(() => {
          // Callback handles reporting to Supabase automatically
        })

        setTimeout(() => {
          bleService.stopScan()
        }, 10000)
      } catch {
        // Silent fail - permissions not granted or other issue
      }
    }

    const handleAppStateChange = (nextState: typeof AppState.currentState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        void runPassiveScan()
      }
      appStateRef.current = nextState
    }

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
    void runPassiveScan()

    passiveScanRef.current = setInterval(() => {
      void runPassiveScan()
    }, 30000)

    return () => {
      if (passiveScanRef.current) clearInterval(passiveScanRef.current)
      appStateSubscription.remove()
      bleService.stopScan()
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      return
    }

    setLoadingNotifications(true)
    const { data, error: fetchError } = await supabase
      .from('notifications')
      .select('id, title, body, type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (fetchError) {
      console.log('[LOQIT-HOME] Notification fetch error:', fetchError.message)
    }

    setNotifications((data as NotificationItem[]) ?? [])
    setLoadingNotifications(false)
  }, [user?.id])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const totalDevices = devices.length
  const safeDevices = useMemo(
    () => devices.filter((item) => item.status === 'registered' || item.status === 'recovered').length,
    [devices]
  )
  const activeAlerts = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  )

  useEffect(() => {
    const target = { total: totalDevices, alerts: activeAlerts, safe: safeDevices }
    const durationMs = 520
    const stepMs = 24
    const steps = Math.max(1, Math.floor(durationMs / stepMs))
    let step = 0

    const timer = setInterval(() => {
      step += 1
      const progress = Math.min(1, step / steps)

      setDisplayCounts({
        total: Math.round(target.total * progress),
        alerts: Math.round(target.alerts * progress),
        safe: Math.round(target.safe * progress),
      })

      if (progress >= 1) clearInterval(timer)
    }, stepMs)

    return () => clearInterval(timer)
  }, [activeAlerts, safeDevices, totalDevices])

  const initials = useMemo(() => {
    const name = profile?.full_name?.trim() || user?.email || 'LQ'
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  }, [profile?.full_name, user?.email])

  const handleQuickAction = async (key: (typeof quickActions)[number]['key']) => {
    if (key === 'sync') {
      await syncCurrentLocation()
      return
    }

    if (key === 'lost') {
      if (!devices.length) {
        router.push('/device/add')
        return
      }
      if (devices.length === 1) {
        router.push({ pathname: '/device/[id]', params: { id: devices[0].id } })
        return
      }
      setShowReportPicker(true)
      return
    }

    const action = quickActions.find((item) => item.key === key)
    if (action && 'route' in action) {
      router.push(action.route)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    router.replace('/(auth)/onboarding')
  }

  const syncCurrentLocation = async () => {
    if (!user?.id || !devices.length) return
    setIsSyncing(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        alert('Location permission denied')
        return
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      // Update the first device or all devices for this test
      const { error } = await supabase
        .from('devices')
        .update({
          last_seen_lat: location.coords.latitude,
          last_seen_lng: location.coords.longitude,
          last_seen_at: new Date().toISOString(),
          status: 'registered', // Ensure it shows up as safe/active
        })
        .eq('owner_id', user.id)

      if (error) throw error
      
      // Also add a beacon log for the tracker view
      await supabase.from('beacon_logs').insert({
        device_id: devices[0].id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy_meters: location.coords.accuracy,
        reported_at: new Date().toISOString(),
      })

      await refetch()
      alert('Location synced successfully!')
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const statItems = [
    { label: 'Devices', value: displayCounts.total, color: Colors.primary },
    { label: 'Safe', value: displayCounts.safe, color: Colors.secondary },
    { label: 'Alerts', value: displayCounts.alerts, color: Colors.tertiary },
  ]

  return (
    <SafeAreaView style={styles.safe}>
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

        <View style={styles.headerActions}>
          <Pressable style={styles.headerBtn} onPress={() => void handleSignOut()}>
            <MaterialIcons name="logout" size={20} color={Colors.onSurfaceVariant} />
          </Pressable>
          <Pressable style={styles.headerBtn} onPress={() => router.push('/(tabs)/alerts')}>
            <MaterialIcons name="notifications-none" size={20} color={Colors.onSurfaceVariant} />
            {activeAlerts > 0 && <View style={styles.badge} />}
          </Pressable>
          <Pressable style={styles.avatarBtn} onPress={() => router.push('/(tabs)/profile')}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting}>{`${getGreetingPrefix()},`}</Text>
          <Text style={styles.greetingName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.greetingSub}>Your secure network is active and monitoring.</Text>
        </View>

        {/* Identity banner */}
        {!profile?.aadhaar_verified && (
          <Pressable style={styles.banner} onPress={() => setAadhaarModalVisible(true)}>
            <View style={styles.bannerIcon}>
              <MaterialIcons name="verified-user" size={18} color={Colors.tertiary} />
            </View>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Complete Identity Verification</Text>
              <Text style={styles.bannerSub}>Verify Aadhaar to unlock all features</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </Pressable>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          {statItems.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* My Devices */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Devices</Text>
          <Pressable onPress={() => router.push('/device/add')} hitSlop={8}>
            <View style={styles.addBadge}>
              <MaterialIcons name="add" size={14} color={Colors.primary} />
              <Text style={styles.addText}>Add</Text>
            </View>
          </Pressable>
        </View>

        {loadingDevices ? (
          <View style={styles.deviceSkeletons}>
            <Skeleton width={200} height={170} borderRadius={20} />
            <Skeleton width={200} height={170} borderRadius={20} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.devicesScroll}
          >
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                id={device.id}
                make={device.make}
                model={device.model}
                imei={device.imei_primary}
                status={device.status}
                onPress={(deviceId) =>
                  router.push({ pathname: '/device/[id]', params: { id: deviceId } })
                }
              />
            ))}
            {!devices.length && (
              <Pressable
                style={styles.emptyCard}
                onPress={() => router.push('/device/add')}
              >
                <View style={styles.emptyIconWrap}>
                  <MaterialIcons name="add-circle-outline" size={32} color={Colors.outline} />
                </View>
                <Text style={styles.emptyTitle}>Register a Device</Text>
                <Text style={styles.emptySub}>Add your first device to start tracking</Text>
              </Pressable>
            )}
          </ScrollView>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((action) => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]}
              onPress={() => handleQuickAction(action.key)}
            >
              <View style={[styles.quickIconBg, { backgroundColor: `${action.tint}1A` }]}>
                <MaterialIcons name={action.icon} size={22} color={action.tint} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
              <MaterialIcons name="arrow-forward" size={14} color={Colors.outline} />
            </Pressable>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Pressable onPress={() => router.push('/(tabs)/alerts')} hitSlop={8}>
            <Text style={styles.seeAllText}>See All</Text>
          </Pressable>
        </View>

        <View style={styles.activityList}>
          {loadingNotifications && (
            <>
              <Skeleton height={64} borderRadius={14} />
              <Skeleton height={64} borderRadius={14} />
            </>
          )}
          {!loadingNotifications && !notifications.length && (
            <View style={styles.activityEmpty}>
              <MaterialIcons name="notifications-off" size={24} color={Colors.outline} />
              <Text style={styles.activityEmptyText}>No recent activity</Text>
            </View>
          )}
          {notifications.map((item) => (
            <View style={styles.activityCard} key={item.id}>
              <View style={[styles.activityIcon, { backgroundColor: `${getNotificationColor(item.type)}1A` }]}>
                <MaterialIcons
                  name={getNotificationIcon(item.type)}
                  color={getNotificationColor(item.type)}
                  size={16}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.activityBody} numberOfLines={1}>{item.body}</Text>
              </View>
              <Text style={styles.activityTime}>{getRelativeTime(item.created_at)}</Text>
            </View>
          ))}
        </View>

        {devicesError && <ErrorState message={devicesError} onRetry={() => void refetch()} />}

        {/* Refresh */}
        <Pressable
          style={styles.refreshBtn}
          onPress={() => { void refetch(); void fetchNotifications() }}
        >
          <MaterialIcons name="refresh" size={16} color={Colors.primary} />
          <Text style={styles.refreshText}>Refresh Data</Text>
        </Pressable>
      </ScrollView>

      {/* Report picker */}
      <Modal visible={showReportPicker} transparent animationType="slide" onRequestClose={() => setShowReportPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Device to Report</Text>
            <Text style={styles.sheetSub}>Choose the device you want to mark as lost.</Text>
            <View style={styles.sheetList}>
              {devices.map((device) => (
                <Pressable
                  key={device.id}
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                  onPress={() => {
                    setShowReportPicker(false)
                    router.push({ pathname: '/device/[id]', params: { id: device.id } })
                  }}
                >
                  <View>
                    <Text style={styles.sheetRowTitle}>{`${device.make} ${device.model}`}</Text>
                    <Text style={styles.sheetRowSub}>{`IMEI •••• ${device.imei_primary.slice(-4)}`}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.sheetCancel} onPress={() => setShowReportPicker(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <AadhaarVerifyModal visible={aadhaarModalVisible} onClose={() => setAadhaarModalVisible(false)} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
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

  /* Content */
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 20,
  },

  /* Greeting */
  greetingWrap: {
    gap: 2,
  },
  greeting: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
  },
  greetingName: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    marginBottom: 2,
  },
  greetingSub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.tertiary}1A`,
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  bannerSub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
  },
  statLabel: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
  },

  /* Sections */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
  },
  addBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}1A`,
  },
  addText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },
  seeAllText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },

  /* Devices */
  devicesScroll: {
    gap: 12,
    paddingRight: 8,
  },
  deviceSkeletons: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyCard: {
    width: 220,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  emptySub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
    textAlign: 'center',
  },

  /* Quick Actions */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickCardPressed: {
    opacity: 0.7,
  },
  quickIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    flex: 1,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },

  /* Activity */
  activityList: {
    gap: 8,
  },
  activityEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  activityEmptyText: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  activityCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
  activityBody: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 1,
  },
  activityTime: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
  },

  /* Refresh */
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  refreshText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 12,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 5,
    alignSelf: 'center',
    backgroundColor: Colors.outlineVariant,
  },
  sheetTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  sheetSub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  sheetList: {
    gap: 8,
  },
  sheetRow: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: Colors.surfaceContainerHigh,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowPressed: {
    opacity: 0.7,
  },
  sheetRowTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  sheetRowSub: {
    marginTop: 2,
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
  },
  sheetCancel: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  sheetCancelText: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
})