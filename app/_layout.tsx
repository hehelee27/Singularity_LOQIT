import 'expo-dev-client'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { DMSans_400Regular, DMSans_500Medium } from '@expo-google-fonts/dm-sans'
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono'
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { Colors } from '../constants/colors'
import { AuthProvider, useAuth } from '../hooks/useAuth'
import { disableBackgroundBleScanTask, enableBackgroundBleScanTask } from '../services/backgroundBleTask'
import { bleService } from '../services/ble.service'
import { enableProtectionTask } from '../services/protectionTask'
import '../services/backgroundBleTask'
import '../services/protectionTask'
import { startLostTracking, stopLostTracking } from '../services/lostTrackingTask'
import '../services/lostTrackingTask'
import { supabase } from '../lib/supabase'
import { ThemeProvider } from '../hooks/useTheme'

function AuthGate() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!session) {
      return
    }

    let cancelled = false
    const bootstrapBleBackground = async () => {
      try {
        await bleService.requestScanPermissions()
        const broadcasting = await bleService.isBroadcastingMode()
        if (cancelled) {
          return
        }

        if (broadcasting) {
          await bleService.restoreBroadcastingFromStorage().catch(() => {
            // Ignore restore failures here; manual restart can still occur from registration flow.
          })
          await disableBackgroundBleScanTask()
        } else {
          await enableBackgroundBleScanTask()
        }

        // Run the background heartbeat and tamper detection
        const myActiveDeviceId = await AsyncStorage.getItem('loqit_my_active_device_id')
        if (myActiveDeviceId) {
          await enableProtectionTask(myActiveDeviceId)
        }

        // Start lost tracking if any devices are lost
        const { data: lostDevices } = await supabase
          .from('devices')
          .select('id')
          .eq('owner_id', session.user.id)
          .eq('status', 'lost')

        if (lostDevices && lostDevices.length > 0) {
          await startLostTracking()
        }
      } catch (error) {
        // Log error but allow app to render - background service failures should not crash the UI
        console.error('[LOQIT] BLE bootstrap failed (non-fatal):', error)
      }
    }

    void bootstrapBleBackground()

    // Listen for device status changes (e.g. marked lost from web)
    const channel = supabase
      .channel('device-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `owner_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newStatus = payload.new.status
          const oldStatus = payload.old.status

          if (newStatus === 'lost' && oldStatus !== 'lost') {
            void startLostTracking()
          } else if (oldStatus === 'lost' && newStatus !== 'lost') {
            // Check if any other devices are still lost
            void supabase
              .from('devices')
              .select('id')
              .eq('owner_id', session.user.id)
              .eq('status', 'lost')
              .then(({ data }) => {
                if (!data || data.length === 0) {
                  void stopLostTracking()
                }
              })
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [session])

  useEffect(() => {
    if (loading) {
      return
    }

    const currentGroup = segments[0]
    const inAuthGroup = currentGroup === '(auth)'
    const inCallbackGroup = currentGroup === 'auth'
    const inTabsGroup = currentGroup === '(tabs)'
    const inDeviceGroup = currentGroup === 'device'
    const inTrackerGroup = currentGroup === 'tracker'
    const inChatGroup = currentGroup === 'chat'
    const inVerifyScreen = currentGroup === 'verify'
    const inSettingsScreen = currentGroup === 'settings'

    if (
      (inTabsGroup || inDeviceGroup || inTrackerGroup || inChatGroup || inVerifyScreen || inSettingsScreen) &&
      !session
    ) {
      router.replace('/(auth)/onboarding')
      return
    }

    if ((inAuthGroup || inCallbackGroup) && session) {
      router.replace('/(tabs)')
    }
  }, [loading, router, segments, session])

  return <Slot />
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_700Bold,
    Sora_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    JetBrainsMono_500Medium,
  })

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <ActivityIndicator color={Colors.inversePrimary} size="large" />
      </View>
    )
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <StatusBar style="auto" />
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})