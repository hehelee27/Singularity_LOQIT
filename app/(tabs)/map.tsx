import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps'

import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { useDevices } from '../../hooks/useDevices'
import { useTheme } from '../../hooks/useTheme'

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#12141a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7c838f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#12141a' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3138' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f223d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1a1f2a' }] },
]

export default function GlobalMapScreen() {
  const router = useRouter()
  const { colors, isDark } = useTheme()
  const { devices, loading, refetch } = useDevices()
  const mapRef = useRef<any>(null)
  const pulse = useRef(new Animated.Value(0)).current
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [pulse])

  const devicesWithLocation = useMemo(() => 
    devices.filter(d => d.last_seen_lat && d.last_seen_lng),
    [devices]
  )

  const focusDevice = (device: any) => {
    setSelectedId(device.id)
    mapRef.current?.animateToRegion({
      latitude: device.last_seen_lat,
      longitude: device.last_seen_lng,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 1000)
  }

  const selectedDevice = useMemo(() => 
    devices.find(d => d.id === selectedId),
    [devices, selectedId]
  )

  // Map markers and logic to look like Police Map
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 20.5937,
          longitude: 78.9629,
          latitudeDelta: 15,
          longitudeDelta: 15
        }}
        customMapStyle={isDark ? darkMapStyle : []}
        showsUserLocation
        loadingEnabled
      >
        {devicesWithLocation.map(d => {
          const isLost = d.status === 'lost' || d.status === 'stolen'
          const color = isLost ? colors.error : colors.primary
          
          return (
            <View key={d.id}>
              {isLost && (
                <Circle
                  center={{ latitude: d.last_seen_lat!, longitude: d.last_seen_lng! }}
                  radius={100}
                  fillColor={`${color}15`}
                  strokeColor={`${color}40`}
                  strokeWidth={1}
                />
              )}
              <Marker
                coordinate={{ latitude: d.last_seen_lat!, longitude: d.last_seen_lng! }}
                onPress={() => setSelectedId(d.id)}
              >
                <View style={styles.markerWrap}>
                  {isLost && (
                    <Animated.View 
                      style={[
                        styles.markerPulse, 
                        { 
                          borderColor: `${color}80`, 
                          backgroundColor: `${color}20`,
                          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.5] }) }]
                        }
                      ]} 
                    />
                  )}
                  <View style={[
                    styles.markerCore, 
                    { 
                      backgroundColor: colors.surfaceContainerHighest, 
                      borderColor: color,
                      shadowColor: color,
                      shadowOpacity: isSelected(d.id) ? 0.8 : 0.4
                    },
                    selectedId === d.id && { borderWidth: 3 }
                  ]}>
                    <MaterialIcons 
                      name={isLost ? "warning" : "smartphone"} 
                      size={14} 
                      color={color} 
                    />
                  </View>
                </View>
              </Marker>
            </View>
          )
        })}
      </MapView>

      {/* Top Floating Sidebar (Web Style) */}
      <View style={styles.topOverlay}>
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? 'dark' : 'light'} style={styles.topBar}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{devices.length}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>DEVICES</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.outlineVariant }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.error }]}>
              {devices.filter(d => d.status === 'lost').length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>LOST</Text>
          </View>
          <Pressable onPress={() => refetch()} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={20} color={colors.primary} />
          </Pressable>
        </BlurView>
      </View>

      {/* Bottom Horizontal Device List */}
      <View style={styles.bottomListWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={devicesWithLocation}
          keyExtractor={d => d.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isLost = item.status === 'lost';
            const isActive = selectedId === item.id;
            return (
              <Pressable 
                onPress={() => focusDevice(item)}
                style={[
                  styles.deviceCard, 
                  { 
                    backgroundColor: colors.surfaceContainer,
                    borderColor: isActive ? colors.primary : colors.outlineVariant
                  }
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: isLost ? `${colors.error}20` : `${colors.primary}20` }]}>
                  <MaterialIcons name="smartphone" size={20} color={isLost ? colors.error : colors.primary} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
                    {item.make} {item.model}
                  </Text>
                  <Text style={[styles.cardStatus, { color: isLost ? colors.error : colors.secondary }]}>
                    {item.status.toUpperCase()}
                  </Text>
                </View>
                {isActive && (
                  <Pressable 
                    style={styles.detailsBtn} 
                    onPress={() => router.push({ pathname: '/device/[id]', params: { id: item.id } })}
                  >
                    <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
                  </Pressable>
                )}
              </Pressable>
            )
          }}
        />
      </View>
    </View>
  )
}

const isSelected = (id: string | null) => false; // Placeholder for shadow logic

const styles = StyleSheet.create({
  container: { flex: 1 },
  markerWrap: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  markerPulse: { position: 'absolute', width: 44, height: 44, borderRadius: 22, borderWidth: 1.5 },
  markerCore: { 
    width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, 
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6
  },
  topOverlay: { position: 'absolute', top: 50, left: 20, right: 20, zIndex: 10 },
  topBar: { 
    height: 64, borderRadius: 20, flexDirection: 'row', 
    alignItems: 'center', paddingHorizontal: 20, gap: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: FontFamily.headingBold, fontSize: 18 },
  statLabel: { fontFamily: FontFamily.bodyMedium, fontSize: 9, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 24 },
  refreshBtn: { padding: 8 },
  bottomListWrap: { position: 'absolute', bottom: 20, left: 0, right: 0 },
  listContent: { paddingHorizontal: 20, gap: 12 },
  deviceCard: { 
    width: 200, height: 72, borderRadius: 18, borderWidth: 1, 
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 13, maxWidth: 90 },
  cardStatus: { fontFamily: FontFamily.bodyMedium, fontSize: 10, letterSpacing: 0.2 },
  detailsBtn: { marginLeft: 'auto', padding: 4 }
})
