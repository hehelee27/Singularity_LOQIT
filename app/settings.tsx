import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Toast } from '../components/ui/Toast'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'
import {
  disableBackgroundBleScanTask,
  enableBackgroundBleScanTask,
} from '../services/backgroundBleTask'

const BLE_KEY = '@loqit/ble_scan_enabled'
const SHARE_LOCATION_KEY = '@loqit/location_share_enabled'
const ANON_CHAT_KEY = '@loqit/anonymous_chat_enabled'

function SettingToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string
  subtitle: string
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <View style={styles.settingRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{subtitle}</Text>
      </View>

      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: '#414753', true: 'rgba(61,142,255,0.42)' }}
        thumbColor={value ? Colors.primary : '#a1a7b3'}
      />
    </View>
  )
}

export default function SettingsScreen() {
  const router = useRouter()

  const [bleEnabled, setBleEnabled] = useState(false)
  const [locationEnabled, setLocationEnabled] = useState(true)
  const [anonymousChatEnabled, setAnonymousChatEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    const load = async () => {
      const [ble, location, anonymous] = await Promise.all([
        AsyncStorage.getItem(BLE_KEY),
        AsyncStorage.getItem(SHARE_LOCATION_KEY),
        AsyncStorage.getItem(ANON_CHAT_KEY),
      ])

      const blePref = ble === 'true'
      setBleEnabled(blePref)
      setLocationEnabled(location !== 'false')
      setAnonymousChatEnabled(anonymous !== 'false')

      if (blePref) {
        await enableBackgroundBleScanTask()
      }
    }

    void load()
  }, [])

  const toggleBleBackground = async (next: boolean) => {
    setSaving(true)
    try {
      if (next) {
        const enabled = await enableBackgroundBleScanTask()
        if (!enabled) {
          throw new Error('Background scan is restricted on this device.')
        }
      } else {
        await disableBackgroundBleScanTask()
      }

      await AsyncStorage.setItem(BLE_KEY, String(next))
      setBleEnabled(next)
      setToast({
        message: next ? 'Background BLE scan enabled' : 'Background BLE scan disabled',
        type: 'success',
      })
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : 'Unable to update BLE background setting.',
        type: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleSimplePreference = async (
    key: string,
    value: boolean,
    setter: (next: boolean) => void,
    label: string
  ) => {
    setter(value)
    await AsyncStorage.setItem(key, String(value))
    setToast({ message: `${label} ${value ? 'enabled' : 'disabled'}`, type: 'info' })
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" onBackPress={() => router.back()} rightIcon="settings" />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <MaterialIcons name="info-outline" size={18} color={Colors.primary} />
          <Text style={styles.infoText}>
            Background BLE scan runs approximately every 15 minutes. Actual cadence depends on OS battery policy.
          </Text>
        </View>

        <SettingToggleRow
          title="BLE Background Scanning"
          subtitle="Continue periodic BLE scans and lost-device location updates in the background."
          value={bleEnabled}
          disabled={saving}
          onChange={(next) => {
            void toggleBleBackground(next)
          }}
        />

        <SettingToggleRow
          title="Location Sharing"
          subtitle="Allow secure location updates when helping with device recovery."
          value={locationEnabled}
          onChange={(next) => {
            void toggleSimplePreference(SHARE_LOCATION_KEY, next, setLocationEnabled, 'Location sharing')
          }}
        />

        <SettingToggleRow
          title="Anonymous Chat"
          subtitle="Enable private finder-owner messaging without exposing identity details."
          value={anonymousChatEnabled}
          onChange={(next) => {
            void toggleSimplePreference(ANON_CHAT_KEY, next, setAnonymousChatEnabled, 'Anonymous chat')
          }}
        />

        <Pressable
          style={styles.legalRow}
          onPress={() => {
            Alert.alert('Privacy', 'Policy viewer will be added in a future release.')
          }}
        >
          <Text style={styles.legalTitle}>Privacy Policy</Text>
          <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
        </Pressable>
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
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
    gap: 10,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(170,199,255,0.28)',
    backgroundColor: 'rgba(170,199,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  settingRow: {
    borderRadius: 14,
    backgroundColor: '#282a2f',
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
  settingSub: {
    marginTop: 3,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  legalRow: {
    borderRadius: 14,
    backgroundColor: '#282a2f',
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
})
