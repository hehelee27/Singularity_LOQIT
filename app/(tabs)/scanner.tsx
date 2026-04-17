import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../../components/ui/Header'
import { GradientButton } from '../../components/ui/GradientButton'
import { Toast } from '../../components/ui/Toast'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { bleService } from '../../services/ble.service'
import { upsertFinderRoom } from '../../services/finderRooms'
import { supabase } from '../../lib/supabase'

type DetectedDevice = {
  beaconId: string
  rssi: number
  distanceMeters: number | null
  deviceId: string | null
  ownerId: string | null
  make: string | null
  model: string | null
  status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen' | 'unknown'
  seenAt: string
}

type ChatRoomInsertResult = {
  id: string
  finder_token: string
}

function signalBarsFromRssi(rssi: number) {
  if (rssi >= -67) {
    return 4
  }
  if (rssi >= -76) {
    return 3
  }
  if (rssi >= -87) {
    return 2
  }
  return 1
}

function estimateDistanceMeters(rssi: number) {
  if (!Number.isFinite(rssi)) {
    return null
  }

  const txPower = -59
  const pathLossExponent = 2.2
  const meters = Math.pow(10, (txPower - rssi) / (10 * pathLossExponent))

  if (!Number.isFinite(meters) || meters <= 0) {
    return null
  }

  return Number(meters.toFixed(1))
}

export default function ScannerScreen() {
  const router = useRouter()

  const [isScanning, setIsScanning] = useState(false)
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([])
  const [lostAlertDevice, setLostAlertDevice] = useState<DetectedDevice | null>(null)
  const [processingDeviceId, setProcessingDeviceId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(
    null
  )

  const ringOne = useRef(new Animated.Value(0)).current
  const ringTwo = useRef(new Animated.Value(0)).current
  const ringThree = useRef(new Animated.Value(0)).current

  const startRadarPulse = useCallback((animValue: Animated.Value, delayMs: number) => {
    animValue.setValue(0)
    return Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(animValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    )
  }, [])

  useEffect(() => {
    const ringAnimations = [
      startRadarPulse(ringOne, 0),
      startRadarPulse(ringTwo, 700),
      startRadarPulse(ringThree, 1400),
    ]

    ringAnimations.forEach((anim) => anim.start())
    return () => ringAnimations.forEach((anim) => anim.stop())
  }, [ringOne, ringThree, ringTwo, startRadarPulse])

  const upsertDetectedDevice = useCallback(
    async (beaconId: string, rssi: number) => {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(beaconId)

      let matched:
        | {
            id: string
            owner_id: string
            make: string
            model: string
            status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
            ble_beacon_id: string | null
          }
        | undefined

      if (isUuid) {
        const { data } = await supabase
          .from('devices')
          .select('id, owner_id, make, model, status, ble_beacon_id')
          .eq('status', 'lost')
          .eq('ble_device_uuid', beaconId.toLowerCase())
          .limit(1)

        matched = data?.[0] as
          | {
              id: string
              owner_id: string
              make: string
              model: string
              status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
              ble_beacon_id: string | null
            }
          | undefined
      }

      if (!matched) {
        const normalizedBeacon = beaconId.replace(/^LOQIT-/i, '').trim()
        const identifierCandidates = Array.from(new Set([beaconId, normalizedBeacon])).filter(Boolean)
        const { data } = await supabase
          .from('devices')
          .select('id, owner_id, make, model, status, ble_beacon_id')
          .eq('status', 'lost')
          .in('ble_beacon_id', identifierCandidates)
          .limit(1)

        matched = data?.[0] as
          | {
              id: string
              owner_id: string
              make: string
              model: string
              status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
              ble_beacon_id: string | null
            }
          | undefined
      }

      if (!matched) {
        return
      }

      const normalizedBeacon = beaconId.replace(/^LOQIT-/i, '').trim()
      const finalBeaconId = matched?.ble_beacon_id || normalizedBeacon || beaconId
      const nextDevice: DetectedDevice = {
        beaconId: finalBeaconId,
        rssi,
        distanceMeters: estimateDistanceMeters(rssi),
        deviceId: matched?.id ?? null,
        ownerId: matched?.owner_id ?? null,
        make: matched?.make ?? null,
        model: matched?.model ?? null,
        status: matched?.status ?? 'lost',
        seenAt: new Date().toISOString(),
      }

      setDetectedDevices((current) => {
        const next = current.filter((item) => item.beaconId !== nextDevice.beaconId)
        return [nextDevice, ...next]
      })

      if (nextDevice.status === 'lost') {
        setLostAlertDevice(nextDevice)
      }
    },
    []
  )

  const startScanning = useCallback(async () => {
    try {
      setDetectedDevices([])
      await bleService.scanForLOQITDevices((beaconId, rssi) => {
        void upsertDetectedDevice(beaconId, rssi)
      })
      setIsScanning(true)
    } catch (error) {
      Alert.alert('Permissions required', error instanceof Error ? error.message : 'Unable to start scan.')
      setIsScanning(false)
    }
  }, [upsertDetectedDevice])

  const stopScanning = useCallback(() => {
    bleService.stopScan()
    setIsScanning(false)
  }, [])

  const toggleScanning = useCallback(() => {
    if (isScanning) {
      stopScanning()
      return
    }

    void startScanning()
  }, [isScanning, startScanning, stopScanning])

  useEffect(() => {
    return () => {
      bleService.stopScan()
    }
  }, [])

  const startAnonymousChat = useCallback(async (device: DetectedDevice) => {
    if (!device.deviceId || !device.ownerId) {
      Alert.alert('Unavailable', 'This nearby beacon is not linked to a registered account yet.')
      return
    }

    setProcessingDeviceId(device.deviceId)
    try {
      const existingRoomResponse = await supabase
        .from('chat_rooms')
        .select('id, finder_token')
        .eq('device_id', device.deviceId)
        .eq('owner_id', device.ownerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      const existingRoom = (existingRoomResponse.data?.[0] ?? null) as ChatRoomInsertResult | null

      if (existingRoom) {
        await upsertFinderRoom({
          roomId: existingRoom.id,
          finderToken: existingRoom.finder_token,
          deviceId: device.deviceId,
        })

        setLostAlertDevice(null)
        router.push({
          pathname: '/chat/[roomId]',
          params: {
            roomId: existingRoom.id,
            finderToken: existingRoom.finder_token,
          },
        })
        return
      }

      const { data, error } = await supabase
        .from('chat_rooms')
        .insert({
          device_id: device.deviceId,
          owner_id: device.ownerId,
          is_active: true,
        })
        .select('id, finder_token')
        .single()

      if (error || !data) {
        setToast({
          message: error?.message ?? 'Unable to open secure chat room right now.',
          type: 'error',
        })
        return
      }

      const room = data as ChatRoomInsertResult
      await upsertFinderRoom({
        roomId: room.id,
        finderToken: room.finder_token,
        deviceId: device.deviceId,
      })

      setLostAlertDevice(null)
      router.push({
        pathname: '/chat/[roomId]',
        params: {
          roomId: room.id,
          finderToken: room.finder_token,
        },
      })
    } finally {
      setProcessingDeviceId(null)
    }
  }, [router])

  const reportLocation = useCallback(async (device: DetectedDevice) => {
    if (!device.deviceId) {
      Alert.alert('Unavailable', 'No registered device mapping found for this beacon.')
      return
    }

    setProcessingDeviceId(device.deviceId)
    try {
      await bleService.reportLocationForDevice(device.deviceId, device.rssi)
      Alert.alert('Location reported', 'Current GPS location has been sent to the owner securely.')
    } catch (error) {
      Alert.alert('Failed', error instanceof Error ? error.message : 'Could not report location.')
    } finally {
      setProcessingDeviceId(null)
    }
  }, [])

  const nearbyCount = useMemo(
    () => detectedDevices.filter((item) => typeof item.distanceMeters === 'number' && item.distanceMeters <= 15).length,
    [detectedDevices]
  )

  const statusLabel = isScanning ? 'Scanner active' : 'Scanner paused'

  const protectedCount = useMemo(() => {
    const unique = new Set(
      detectedDevices
        .filter((item) => item.status === 'lost')
        .map((item) => item.deviceId ?? item.beaconId)
    )
    return unique.size
  }, [detectedDevices])

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Scanner" rightIcon="bluetooth-searching" />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.radarCard}>
          {[ringOne, ringTwo, ringThree].map((value, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.pulseRing,
                {
                  opacity: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0],
                  }),
                  transform: [
                    {
                      scale: value.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.28, 1.38],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}

          <View style={styles.centerIconWrap}>
            <MaterialIcons name="bluetooth" size={40} color={Colors.primary} />
          </View>

          <Text style={styles.protocolText}>Protocol: BLE 5.2 Active</Text>
          <Text style={styles.scanStatus}>{statusLabel}</Text>
        </View>

        <GradientButton
          title={isScanning ? 'Stop Scanning' : 'Start Scanning'}
          onPress={toggleScanning}
        />

        {detectedDevices.length > 0 ? (
          <View style={styles.nearbyWrap}>
            <Text style={styles.sectionTitle}>Nearby LOQIT Devices</Text>

            {detectedDevices.map((item) => {
              const signalBars = signalBarsFromRssi(item.rssi)
              const isLost = item.status === 'lost'

              return (
                <View style={styles.deviceCard} key={`${item.beaconId}-${item.seenAt}`}>
                  <View style={styles.deviceInfoRow}>
                    <View style={styles.deviceIconWrap}>
                      <MaterialIcons name="bluetooth-searching" size={18} color={Colors.primary} />
                    </View>

                    <View style={styles.deviceTextWrap}>
                      <Text style={styles.deviceName}>
                        {item.make && item.model ? `${item.make} ${item.model}` : 'Unknown Device'}
                      </Text>
                      <Text style={styles.beaconIdText}>{`Beacon: ${item.beaconId}`}</Text>
                    </View>

                    <View style={styles.signalWrap}>
                      <View style={styles.signalBarsRow}>
                        {[1, 2, 3, 4].map((bar) => (
                          <View
                            key={bar}
                            style={[
                              styles.signalBar,
                              { height: 3 + bar * 3 },
                              bar <= signalBars ? styles.signalBarActive : null,
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={styles.rssiText}>{item.rssi > -50 ? 'Excellent' : item.rssi > -70 ? 'Good' : item.rssi > -85 ? 'Fair' : item.rssi > -95 ? 'Weak' : 'Very Weak'}</Text>
                      {typeof item.distanceMeters === 'number' ? (
                        <Text style={styles.distanceText}>{`~${item.distanceMeters} m`}</Text>
                      ) : null}
                    </View>
                  </View>

                  {isLost ? (
                    <View style={styles.lostBadge}>
                      <Text style={styles.lostBadgeText}>LOST DEVICE</Text>
                    </View>
                  ) : null}

                  <Pressable
                    style={styles.helpButton}
                    onPress={() => void startAnonymousChat(item)}
                    disabled={processingDeviceId === item.deviceId}
                  >
                    <Text style={styles.helpButtonText}>
                      {processingDeviceId === item.deviceId ? 'Starting...' : 'Help Return'}
                    </Text>
                  </Pressable>
                </View>
              )
            })}
          </View>
        ) : null}

        <View style={styles.footerInfoCard}>
          <MaterialIcons name="verified-user" size={16} color={Colors.secondary} />
          <Text style={styles.footerInfoText}>{`You are helping protect ${protectedCount} devices in your area`}</Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!lostAlertDevice}
        transparent
        animationType="slide"
        onRequestClose={() => setLostAlertDevice(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>You've detected a lost device nearby</Text>
            <Text style={styles.modalSubTitle}>
              {lostAlertDevice?.make && lostAlertDevice?.model
                ? `Device: ${lostAlertDevice.make} ${lostAlertDevice.model}`
                : 'Device: Unknown model'}
            </Text>

            <GradientButton
              title="Contact Owner Anonymously"
              onPress={() => {
                if (!lostAlertDevice) {
                  return
                }

                void startAnonymousChat(lostAlertDevice)
              }}
            />

            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                if (!lostAlertDevice) {
                  return
                }

                void reportLocation(lostAlertDevice)
              }}
            >
              <Text style={styles.secondaryActionText}>Report Location</Text>
            </Pressable>

            <Pressable onPress={() => setLostAlertDevice(null)}>
              <Text style={styles.cancelActionText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingTop: 8,
    paddingBottom: 120,
    gap: 14,
  },
  radarCard: {
    width: '100%',
    height: 280,
    borderRadius: 24,
    backgroundColor: '#282a2f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 10,
  },
  pulseRing: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
    borderWidth: 1,
    borderColor: 'rgba(170,199,255,0.7)',
    backgroundColor: 'rgba(170,199,255,0.1)',
  },
  centerIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12,14,19,0.72)',
  },
  protocolText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 11,
  },
  scanStatus: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 17,
  },
  nearbyWrap: {
    gap: 10,
  },
  sectionTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  deviceCard: {
    backgroundColor: '#282a2f',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  deviceInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deviceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(170,199,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceTextWrap: {
    flex: 1,
  },
  deviceName: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  beaconIdText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    marginTop: 1,
  },
  signalWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    minHeight: 16,
  },
  signalBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#4d535f',
  },
  signalBarActive: {
    backgroundColor: Colors.secondary,
  },
  rssiText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
  },
  distanceText: {
    color: Colors.secondary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
  },
  lostBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(255,78,78,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lostBadgeText: {
    color: Colors.error,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  helpButton: {
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(61,142,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(61,142,255,0.45)',
  },
  helpButtonText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
  footerInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(70,241,187,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(70,241,187,0.24)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footerInfoText: {
    flex: 1,
    color: Colors.secondary,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 18,
    paddingBottom: 24,
    paddingTop: 10,
    gap: 12,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
  },
  modalTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 19,
  },
  modalSubTitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  secondaryAction: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  cancelActionText: {
    textAlign: 'center',
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
})