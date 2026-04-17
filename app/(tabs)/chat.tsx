import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorState } from '../../components/ui/ErrorState'
import { Header } from '../../components/ui/Header'
import { Skeleton } from '../../components/ui/Skeleton'
import { Toast } from '../../components/ui/Toast'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { getFinderRooms } from '../../services/finderRooms'

type RoomRecord = {
  id: string
  owner_id: string
  device_id: string
  is_active: boolean
  created_at: string
  devices:
    | {
        make: string
        model: string
        imei_primary: string
        status: string
      }
    | {
        make: string
        model: string
        imei_primary: string
        status: string
      }[]
    | null
}

type ChatMessage = {
  id: string
  room_id: string
  sender_role: 'owner' | 'finder'
  message_text?: string | null
  content?: string | null
  is_read: boolean
  sent_at: string
}

type RoomItem = {
  id: string
  deviceId: string
  isActive: boolean
  createdAt: string
  ownerId: string
  role: 'owner' | 'finder'
  finderToken?: string
  make: string
  model: string
  imeiTail: string
  status: string
  lastMessage: string
  lastSentAt: string
  unreadCount: number
}

function getRelativeTime(dateIso: string) {
  const diffMs = Date.now() - new Date(dateIso).getTime()
  const mins = Math.max(1, Math.floor(diffMs / 60000))
  if (mins < 60) {
    return `${mins}m`
  }
  const hours = Math.floor(mins / 60)
  if (hours < 24) {
    return `${hours}h`
  }
  return `${Math.floor(hours / 24)}d`
}

function normalizeDevice(
  device: RoomRecord['devices']
): { make: string; model: string; imei_primary: string; status: string } | null {
  if (!device) {
    return null
  }

  if (Array.isArray(device)) {
    return device[0] ?? null
  }

  return device
}

function ChatCardSkeleton() {
  return (
    <View style={styles.roomCard}>
      <View style={styles.roomTop}>
        <Skeleton width={36} height={36} borderRadius={10} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="62%" height={13} borderRadius={8} />
          <Skeleton width="36%" height={10} borderRadius={8} />
        </View>
      </View>
      <Skeleton width="74%" height={11} borderRadius={8} />
    </View>
  )
}

export default function ChatListScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const [rooms, setRooms] = useState<RoomItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState('')

  const fetchRooms = useCallback(async () => {
    if (!user?.id) {
      setRooms([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [finderEntries, ownerResponse] = await Promise.all([
        getFinderRooms(),
        supabase
          .from('chat_rooms')
          .select(
            'id, owner_id, device_id, is_active, created_at, devices(make, model, imei_primary, status)'
          )
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      if (ownerResponse.error) {
        throw ownerResponse.error
      }

      const ownerRooms = (ownerResponse.data as RoomRecord[]) ?? []
      const ownerRoomIds = new Set(ownerRooms.map((room) => room.id))
      const finderRoomIds = finderEntries
        .map((item) => item.roomId)
        .filter((roomId) => !ownerRoomIds.has(roomId))

      let finderRooms: RoomRecord[] = []
      if (finderRoomIds.length) {
        const finderResponse = await supabase
          .from('chat_rooms')
          .select('id, owner_id, device_id, is_active, created_at, devices(make, model, imei_primary, status)')
          .in('id', finderRoomIds)

        if (!finderResponse.error) {
          finderRooms = (finderResponse.data as RoomRecord[]) ?? []
        }
      }

      const mergedRooms = [...ownerRooms, ...finderRooms]
      const roomIds = mergedRooms.map((room) => room.id)

      let messageRows: ChatMessage[] = []
      if (roomIds.length) {
        const messageResponse = await supabase
          .from('chat_messages')
          .select('id, room_id, sender_role, message_text, is_read, sent_at')
          .in('room_id', roomIds)
          .order('sent_at', { ascending: false })

        if (!messageResponse.error) {
          messageRows = (messageResponse.data as ChatMessage[]) ?? []
        } else if (messageResponse.error.message?.toLowerCase().includes('message_text')) {
          const legacyMessageResponse = await supabase
            .from('chat_messages')
            .select('id, room_id, sender_role, content, is_read, sent_at')
            .in('room_id', roomIds)
            .order('sent_at', { ascending: false })

          if (!legacyMessageResponse.error) {
            messageRows = (legacyMessageResponse.data as ChatMessage[]) ?? []
          }
        }
      }

      const tokenByRoom = new Map(finderEntries.map((entry) => [entry.roomId, entry.finderToken]))

      const unreadByRoom = new Map<string, number>()
      const latestByRoom = new Map<string, ChatMessage>()

      for (const message of messageRows) {
        if (!latestByRoom.has(message.room_id)) {
          latestByRoom.set(message.room_id, message)
        }
      }

      for (const room of mergedRooms) {
        const role = room.owner_id === user.id ? 'owner' : 'finder'
        const unread = messageRows.filter(
          (message) =>
            message.room_id === room.id &&
            !message.is_read &&
            message.sender_role !== role
        ).length
        unreadByRoom.set(room.id, unread)
      }

      const nextRooms = mergedRooms
        .map((room) => {
          const role = room.owner_id === user.id ? 'owner' : 'finder'
          const device = normalizeDevice(room.devices)
          const latest = latestByRoom.get(room.id)

          return {
            id: room.id,
            deviceId: room.device_id,
            ownerId: room.owner_id,
            isActive: room.is_active,
            createdAt: room.created_at,
            role,
            finderToken: tokenByRoom.get(room.id),
            make: device?.make ?? 'Unknown',
            model: device?.model ?? 'Device',
            imeiTail: device?.imei_primary?.slice(-4) ?? '----',
            status: device?.status ?? 'registered',
            lastMessage: latest?.message_text ?? latest?.content ?? 'Tap to start chat securely.',
            lastSentAt: latest?.sent_at ?? room.created_at,
            unreadCount: unreadByRoom.get(room.id) ?? 0,
          } satisfies RoomItem
        })
        .sort((a, b) => new Date(b.lastSentAt).getTime() - new Date(a.lastSentAt).getTime())

      setRooms(nextRooms)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load chat rooms.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void fetchRooms()
  }, [fetchRooms])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    const channel = supabase
      .channel(`chat-list-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          void fetchRooms()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fetchRooms, user?.id])

  const activeRooms = useMemo(() => rooms.filter((room) => room.isActive).length, [rooms])

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Anonymous Chat" rightIcon="forum" />

      <Toast
        visible={!!toastMessage}
        message={toastMessage}
        type="info"
        onHide={() => setToastMessage('')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.privacyBanner}>
          <MaterialIcons name="security" size={18} color={Colors.secondary} />
          <Text style={styles.privacyText}>
            Identity is hidden. Only secure chat handles are used between finder and owner.
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaTitle}>Active rooms: {activeRooms}</Text>
          <Pressable
            onPress={() => {
              void fetchRooms()
              setToastMessage('Chat list refreshed')
            }}
          >
            <Text style={styles.metaLink}>Refresh</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.roomWrap}>
            <ChatCardSkeleton />
            <ChatCardSkeleton />
            <ChatCardSkeleton />
          </View>
        ) : null}

        {!loading && error ? <ErrorState message={error} onRetry={() => void fetchRooms()} /> : null}

        {!loading && !error && !rooms.length ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <MaterialIcons name="chat-bubble-outline" size={26} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyBody}>Use Scanner to contact a nearby owner and start an anonymous room.</Text>
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.roomWrap}>
            {rooms.map((room) => (
              <Pressable
                key={room.id}
                style={styles.roomCard}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[roomId]',
                    params: {
                      roomId: room.id,
                      finderToken: room.finderToken ?? '',
                    },
                  })
                }
              >
                <View style={styles.roomTop}>
                  <View style={styles.roomIconWrap}>
                    <MaterialIcons name={room.role === 'owner' ? 'manage-accounts' : 'person-search'} size={17} color={Colors.primary} />
                  </View>

                  <View style={styles.roomTitleWrap}>
                    <Text style={styles.roomTitle}>{`${room.make} ${room.model}`}</Text>
                    <Text style={styles.roomSub}>{`IMEI •••• ${room.imeiTail}`}</Text>
                  </View>

                  <Text style={styles.timeText}>{getRelativeTime(room.lastSentAt)}</Text>
                </View>

                <View style={styles.roomBottom}>
                  <Text style={styles.previewText} numberOfLines={2}>
                    {room.lastMessage}
                  </Text>

                  <View style={styles.roomPills}>
                    {!room.isActive ? (
                      <View style={styles.closedPill}>
                        <Text style={styles.closedPillText}>Closed</Text>
                      </View>
                    ) : null}

                    {room.unreadCount ? (
                      <View style={styles.unreadPill}>
                        <Text style={styles.unreadPillText}>{room.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 118,
    gap: 12,
  },
  privacyBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.secondary}50`,
    backgroundColor: `${Colors.secondary}1A`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  privacyText: {
    flex: 1,
    color: Colors.secondary,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  metaTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  metaLink: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
  roomWrap: {
    gap: 10,
  },
  roomCard: {
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 14,
    gap: 10,
  },
  roomTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}1A`,
  },
  roomTitleWrap: {
    flex: 1,
  },
  roomTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  roomSub: {
    marginTop: 2,
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
  },
  timeText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
  },
  roomBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  roomPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
  },
  unreadPillText: {
    color: Colors.onSecondary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },
  closedPill: {
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.error}1A`,
    borderWidth: 1,
    borderColor: `${Colors.error}40`,
  },
  closedPillText: {
    color: Colors.error,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
  },
  emptyWrap: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: Colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingVertical: 32,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${Colors.primary}1A`,
    marginBottom: 4,
  },
  emptyTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
  },
  emptyBody: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
})
