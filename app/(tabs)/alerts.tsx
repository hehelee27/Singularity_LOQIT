import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler'

import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

type NotificationItem = {
  id: string
  title: string
  body: string
  type: string
  reference_id: string | null
  is_read: boolean
  created_at: string
}

function getRelativeTime(date: string) {
  const ms = Date.now() - new Date(date).getTime()
  const mins = Math.max(1, Math.floor(ms / 60000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function getVisualsByType(type: string) {
  const lc = type.toLowerCase()
  if (lc.includes('message') || lc.includes('chat')) {
    return { icon: 'chat-bubble' as const, tint: Colors.secondary }
  }
  if (lc.includes('case') || lc.includes('legal')) {
    return { icon: 'gavel' as const, tint: Colors.tertiary }
  }
  if (lc.includes('lost') || lc.includes('stolen')) {
    return { icon: 'warning' as const, tint: Colors.error }
  }
  return { icon: 'shield' as const, tint: Colors.primary }
}

function SwipeableNotificationCard({
  item,
  onPress,
  onDismiss,
}: {
  item: NotificationItem
  onPress: () => void
  onDismiss: (id: string) => void
}) {
  const swipeableRef = useRef<Swipeable>(null)
  const visuals = getVisualsByType(item.type)

  const renderRightActions = useCallback(
    (
      _progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
    ) => {
      const scale = dragX.interpolate({
        inputRange: [-100, 0],
        outputRange: [1, 0.5],
        extrapolate: 'clamp',
      })

      return (
        <Pressable
          style={styles.deleteAction}
          onPress={() => {
            swipeableRef.current?.close()
            onDismiss(item.id)
          }}
        >
          <Animated.View style={[styles.deleteContent, { transform: [{ scale }] }]}>
            <MaterialIcons name="delete-outline" size={22} color={Colors.onPrimary} />
            <Text style={styles.deleteText}>Dismiss</Text>
          </Animated.View>
        </Pressable>
      )
    },
    [item.id, onDismiss]
  )

  const handleSwipeOpen = useCallback(() => {
    setTimeout(() => onDismiss(item.id), 200)
  }, [item.id, onDismiss])

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      onSwipeableOpen={handleSwipeOpen}
      rightThreshold={100}
      friction={2}
      overshootRight={false}
    >
      <Pressable
        style={[styles.card, !item.is_read && styles.cardUnread]}
        onPress={onPress}
      >
        {/* Unread accent line */}
        {!item.is_read && <View style={[styles.unreadBar, { backgroundColor: visuals.tint }]} />}

        <View style={[styles.iconWrap, { backgroundColor: `${visuals.tint}1A` }]}>
          <MaterialIcons name={visuals.icon} size={18} color={visuals.tint} />
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.cardTitle, !item.is_read && styles.cardTitleUnread]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
        </View>

        <Text style={styles.timeText}>{getRelativeTime(item.created_at)}</Text>
      </Pressable>
    </Swipeable>
  )
}

export default function AlertsScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, reference_id, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!data) {
      setNotifications([])
      setError('Unable to fetch alerts right now.')
      setLoading(false)
      return
    }

    setNotifications((data as NotificationItem[]) ?? [])
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  )

  const markAllAsRead = useCallback(async () => {
    if (!user?.id || !unreadCount) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
    setToastMessage('All alerts marked as read')
  }, [unreadCount, user?.id])

  const dismissNotification = useCallback(
    async (notificationId: string) => {
      setNotifications((current) => current.filter((item) => item.id !== notificationId))
      if (user?.id) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', user.id)
      }
    },
    [user?.id]
  )

  const openNotification = useCallback(
    async (item: NotificationItem) => {
      if (!item.is_read) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', item.id)
          .eq('user_id', user?.id ?? '')
        setNotifications((current) =>
          current.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        )
      }

      const lc = item.type.toLowerCase()
      if (item.reference_id && (lc.includes('beacon') || lc.includes('lost'))) {
        router.push({ pathname: '/tracker/[deviceId]', params: { deviceId: item.reference_id } })
        return
      }
      if (item.reference_id && lc.includes('device')) {
        router.push({ pathname: '/device/[id]', params: { id: item.reference_id } })
        return
      }
      if (lc.includes('message') || lc.includes('chat')) {
        if (item.reference_id) {
          router.push({ pathname: '/chat/[roomId]', params: { roomId: item.reference_id } })
        } else {
          router.push('/(tabs)/chat')
        }
        return
      }
      router.push('/(tabs)/devices')
    },
    [router, user?.id]
  )

  return (
    <GestureHandlerRootView style={styles.safe}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>Alerts</Text>
            {unreadCount > 0 && (
              <Text style={styles.unreadSub}>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
            <Pressable
              style={[styles.markAllBtn, !unreadCount && styles.markAllBtnDisabled]}
              onPress={() => void markAllAsRead()}
              disabled={!unreadCount}
            >
              <MaterialIcons name="done-all" size={16} color={unreadCount ? Colors.primary : Colors.outline} />
              <Text style={[styles.markAllText, !unreadCount && styles.markAllDisabled]}>
                Mark all read
              </Text>
            </Pressable>
          </View>
        </View>

        <Toast
          visible={!!toastMessage}
          message={toastMessage}
          type="info"
          onHide={() => setToastMessage('')}
        />

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Loading skeletons */}
          {loading && (
            <View style={styles.skeletons}>
              <Skeleton height={72} borderRadius={16} />
              <Skeleton height={72} borderRadius={16} />
              <Skeleton height={72} borderRadius={16} />
            </View>
          )}

          {/* Error */}
          {!loading && error && (
            <ErrorState message={error} onRetry={() => void fetchNotifications()} />
          )}

          {/* Empty */}
          {!loading && !error && !notifications.length && (
            <View style={styles.emptyCard}>
              <LinearGradient
                colors={[Colors.primary, Colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyIconWrap}
              >
                <MaterialIcons name="shield" size={28} color={Colors.onPrimary} />
              </LinearGradient>
              <Text style={styles.emptyTitle}>All clear!</Text>
              <Text style={styles.emptySub}>No alerts. Your devices are safe.</Text>
              <Text style={styles.emptyHint}>Swipe left on alerts to dismiss them</Text>
            </View>
          )}

          {/* Notification cards */}
          {!error &&
            notifications.map((item) => (
              <View key={item.id} style={styles.cardWrapper}>
                <SwipeableNotificationCard
                  item={item}
                  onPress={() => void openNotification(item)}
                  onDismiss={(id) => void dismissNotification(id)}
                />
              </View>
            ))}
        </Animated.ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pageTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
  },
  unreadSub: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unreadBadgeText: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  markAllBtnDisabled: {
    opacity: 0.5,
  },
  markAllText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
  },
  markAllDisabled: {
    color: Colors.outline,
  },

  /* Content */
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 8,
  },
  skeletons: {
    gap: 10,
  },

  /* Empty */
  emptyCard: {
    marginTop: 32,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
  },
  emptySub: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyHint: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 4,
  },

  /* Card wrapper */
  cardWrapper: {
    overflow: 'hidden',
    borderRadius: 16,
  },

  /* Swipeable card */
  card: {
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  cardTitleUnread: {
    fontFamily: FontFamily.headingSemiBold,
  },
  cardBody: {
    marginTop: 2,
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  timeText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
  },

  /* Delete action */
  deleteAction: {
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: 100,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  deleteContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  deleteText: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    marginTop: 2,
  },
})