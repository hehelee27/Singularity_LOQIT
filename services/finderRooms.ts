import AsyncStorage from '@react-native-async-storage/async-storage'

export type FinderRoomEntry = {
  roomId: string
  finderToken: string
  deviceId: string
  createdAt: string
}

const FINDER_ROOMS_KEY = '@loqit/finder_rooms'

export async function getFinderRooms() {
  const raw = await AsyncStorage.getItem(FINDER_ROOMS_KEY)
  if (!raw) {
    return [] as FinderRoomEntry[]
  }

  try {
    const parsed = JSON.parse(raw) as FinderRoomEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function upsertFinderRoom(entry: Omit<FinderRoomEntry, 'createdAt'>) {
  const current = await getFinderRooms()
  const next = [
    {
      ...entry,
      createdAt: new Date().toISOString(),
    },
    ...current.filter((item) => item.roomId !== entry.roomId),
  ].slice(0, 40)

  await AsyncStorage.setItem(FINDER_ROOMS_KEY, JSON.stringify(next))
}

export async function getFinderTokenForRoom(roomId: string) {
  const rooms = await getFinderRooms()
  return rooms.find((item) => item.roomId === roomId)?.finderToken ?? null
}
