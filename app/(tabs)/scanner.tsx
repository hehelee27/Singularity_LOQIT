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
import { FontFamily } from '../../constants/typography'
import { bleService } from '../../services/ble.service'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../hooks/useTheme'

type DetectedDevice = { beaconId: string; rssi: number; distanceMeters: number | null; deviceId: string | null; ownerId: string | null; make: string | null; model: string | null; status: string; seenAt: string }

export default function ScannerScreen() {
  const router = useRouter(); const { colors } = useTheme()
  const [isScanning, setIsScanning] = useState(false)
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([])
  const [lostAlertDevice, setLostAlertDevice] = useState<DetectedDevice | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const ringOne = useRef(new Animated.Value(0)).current
  const ringTwo = useRef(new Animated.Value(0)).current
  const ringThree = useRef(new Animated.Value(0)).current

  const startPulse = useCallback((v: Animated.Value, d: number) => {
    v.setValue(0)
    return Animated.loop(Animated.sequence([Animated.delay(d), Animated.timing(v, { toValue: 1, duration: 2000, useNativeDriver: true })]))
  }, [])

  useEffect(() => {
    if (!isScanning) {
      ringOne.setValue(0); ringTwo.setValue(0); ringThree.setValue(0)
      return
    }
    const anims = [startPulse(ringOne, 0), startPulse(ringTwo, 700), startPulse(ringThree, 1400)]
    anims.forEach(a => a.start()); return () => anims.forEach(a => a.stop())
  }, [isScanning, ringOne, ringTwo, ringThree, startPulse])

  const upsertDevice = useCallback(async (beaconId: string, rssi: number) => {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(beaconId)
    const { data } = await supabase.from('devices').select('*').eq('status', 'lost').eq(isUuid ? 'ble_device_uuid' : 'ble_beacon_id', isUuid ? beaconId.toLowerCase() : beaconId.replace(/^LOQIT-/i, '').trim()).limit(1)
    if (!data?.[0]) return
    const matched = data[0]
    const next = { beaconId: matched.ble_beacon_id || beaconId, rssi, distanceMeters: Math.pow(10, (-59 - rssi) / 22), deviceId: matched.id, ownerId: matched.owner_id, make: matched.make, model: matched.model, status: matched.status, seenAt: new Date().toISOString() }
    setDetectedDevices(curr => [next, ...curr.filter(i => i.beaconId !== next.beaconId)])
    if (next.status === 'lost') setLostAlertDevice(next)
  }, [])

  const toggle = () => {
    if (isScanning) { bleService.stopScan(); setIsScanning(false) } else {
      bleService.scanForLOQITDevices((b, r) => void upsertDevice(b, r)).then(() => setIsScanning(true)).catch(e => Alert.alert('Error', e.message))
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title="Scanner" rightIcon="bluetooth-searching" />
      <Toast visible={!!toast} message={toast?.message || ''} type={toast?.type || 'info'} onHide={() => setToast(null)} />
      
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.radarCard, { backgroundColor: colors.surfaceContainerLow }]}>
          {isScanning && [ringOne, ringTwo, ringThree].map((v, i) => (
            <Animated.View key={i} style={[styles.pulseRing, { borderColor: `${colors.primary}B3`, backgroundColor: `${colors.primary}1A`, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1.38] }) }] }]} />
          ))}
          <View style={[styles.centerIconWrap, { backgroundColor: `${colors.onSurface}12` }]}><MaterialIcons name={isScanning ? "bluetooth-searching" : "bluetooth"} size={40} color={colors.primary} /></View>
          <Text style={[styles.protocolText, { color: colors.outline }]}>Protocol: BLE 5.2 Active</Text>
          <Text style={[styles.scanStatus, { color: colors.onSurface }]}>{isScanning ? 'Scanner active' : 'Scanner paused'}</Text>
        </View>

        <GradientButton title={isScanning ? 'Stop Scanning' : 'Start Scanning'} onPress={toggle} />
        
        {detectedDevices.map(item => (
          <View key={item.beaconId} style={[styles.deviceCard, { backgroundColor: colors.surfaceContainerLow }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.deviceIconWrap, { backgroundColor: `${colors.primary}24` }]}><MaterialIcons name="bluetooth-searching" size={18} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.deviceName, { color: colors.onSurface }]}>{item.make ? `${item.make} ${item.model}` : 'Unknown Device'}</Text><Text style={[styles.beaconIdText, { color: colors.outline }]}>{`Beacon: ${item.beaconId}`}</Text></View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>{[1, 2, 3, 4].map(b => <View key={b} style={[styles.signalBar, { height: 3 + b * 3, backgroundColor: b <= 2 ? colors.secondary : colors.outlineVariant }]} />)}</View>
                <Text style={[styles.rssiText, { color: colors.outline }]}>{item.rssi > -60 ? 'Excellent' : 'Fair'}</Text>
              </View>
            </View>
            <Pressable style={[styles.helpButton, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]} onPress={() => router.push({ pathname: '/chat/[roomId]', params: { roomId: item.deviceId || '' } })}><Text style={[styles.helpButtonText, { color: colors.primary }]}>Help Return</Text></Pressable>
          </View>
        ))}

        <View style={[styles.footerInfoCard, { backgroundColor: `${colors.secondary}1A`, borderColor: `${colors.secondary}33` }]}>
          <MaterialIcons name="verified-user" size={16} color={colors.secondary} />
          <Text style={[styles.footerInfoText, { color: colors.secondary }]}>Scanner helps detect lost devices securely.</Text>
        </View>
      </ScrollView>

      <Modal visible={!!lostAlertDevice} transparent animationType="slide">
        <View style={styles.modalBackdrop}><View style={[styles.modalSheet, { backgroundColor: colors.surfaceContainer }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.outlineVariant }]} /><Text style={[styles.modalTitle, { color: colors.onSurface }]}>Lost device found nearby!</Text>
            <GradientButton title="Contact Owner" onPress={() => setLostAlertDevice(null)} /><Pressable onPress={() => setLostAlertDevice(null)}><Text style={[styles.cancelActionText, { color: colors.onSurfaceVariant }]}>Close</Text></Pressable>
          </View></View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 120, gap: 14 },
  radarCard: { width: '100%', height: 280, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: 10 },
  pulseRing: { position: 'absolute', width: 188, height: 188, borderRadius: 94, borderWidth: 1 },
  centerIconWrap: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  protocolText: { fontFamily: FontFamily.monoMedium, fontSize: 11 },
  scanStatus: { fontFamily: FontFamily.headingSemiBold, fontSize: 17 },
  deviceCard: { borderRadius: 12, padding: 12, gap: 10 },
  deviceIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontFamily: FontFamily.bodyMedium, fontSize: 14 },
  beaconIdText: { fontFamily: FontFamily.monoMedium, fontSize: 10, marginTop: 1 },
  signalBar: { width: 3, borderRadius: 2 },
  rssiText: { fontFamily: FontFamily.monoMedium, fontSize: 10 },
  helpButton: { minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  helpButtonText: { fontFamily: FontFamily.bodyMedium, fontSize: 13 },
  footerInfoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  footerInfoText: { flex: 1, fontFamily: FontFamily.bodyRegular, fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingBottom: 24, paddingTop: 10, gap: 12 },
  sheetHandle: { width: 48, height: 5, borderRadius: 999, alignSelf: 'center' },
  modalTitle: { fontFamily: FontFamily.headingSemiBold, fontSize: 19 },
  cancelActionText: { textAlign: 'center', fontFamily: FontFamily.bodyMedium, fontSize: 13 }
})