import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AadhaarVerifyModal } from '../../components/loqit/AadhaarVerifyModal'
import { Skeleton } from '../../components/ui/Skeleton'
import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { useDevices } from '../../hooks/useDevices'
import { supabase } from '../../lib/supabase'

function daysSince(dateIso?: string) {
  if (!dateIso) return 0
  const ms = Date.now() - new Date(dateIso).getTime()
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

type MenuItemProps = {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  onPress?: () => void
  tint?: string
  showArrow?: boolean
}

function MenuItem({ icon, label, onPress, tint, showArrow = true }: MenuItemProps) {
  const iconColor = tint || Colors.onSurfaceVariant
  const labelColor = tint || Colors.onSurface

  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${iconColor}1A` }]}>
        <MaterialIcons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.menuLabel, { color: labelColor }]}>{label}</Text>
      {showArrow && <MaterialIcons name="chevron-right" size={18} color={Colors.outline} />}
    </Pressable>
  )
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>
}

export default function ProfileScreen() {
  const router = useRouter()
  const { profile, signOut, user, loading } = useAuth()
  const { devices } = useDevices()

  const [reportsCount, setReportsCount] = useState(0)
  const [loadingReports, setLoadingReports] = useState(false)
  const [aadhaarModalVisible, setAadhaarModalVisible] = useState(false)

  useEffect(() => {
    const loadReportsCount = async () => {
      if (!user?.id) {
        setReportsCount(0)
        return
      }

      setLoadingReports(true)
      const { count } = await supabase
        .from('lost_reports')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)

      setReportsCount(count ?? 0)
      setLoadingReports(false)
    }

    void loadReportsCount()
  }, [user?.id])

  const initials = useMemo(() => {
    const source = profile?.full_name?.trim() || user?.email || 'LQ'
    return source
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  }, [profile?.full_name, user?.email])

  const signOutNow = async () => {
    await signOut()
    router.replace('/(auth)/onboarding')
  }

  const deleteAccountRequest = () => {
    Alert.alert(
      'Delete Account',
      'Account deletion requires a secure server flow and cannot be completed from this demo client yet.',
      [{ text: 'OK' }]
    )
  }

  const stats = [
    {
      label: 'Devices',
      value: devices.length,
      color: Colors.primary,
      loading: loading,
    },
    {
      label: 'Reports',
      value: reportsCount,
      color: Colors.tertiary,
      loading: loadingReports,
    },
    {
      label: 'Days Active',
      value: daysSince(profile?.created_at),
      color: Colors.secondary,
      loading: false,
    },
  ]

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>

          <Text style={styles.name}>{profile?.full_name || 'LOQIT User'}</Text>
          <Text style={styles.email}>{user?.email || 'No email linked'}</Text>

          <Pressable
            style={[styles.verifyBadge, {
              backgroundColor: profile?.aadhaar_verified
                ? `${Colors.secondary}1A`
                : `${Colors.tertiary}1A`,
            }]}
            onPress={() => {
              if (!profile?.aadhaar_verified) setAadhaarModalVisible(true)
            }}
          >
            <MaterialIcons
              name={profile?.aadhaar_verified ? 'verified' : 'shield'}
              size={14}
              color={profile?.aadhaar_verified ? Colors.secondary : Colors.tertiary}
            />
            <Text style={[styles.verifyText, {
              color: profile?.aadhaar_verified ? Colors.secondary : Colors.tertiary,
            }]}>
              {profile?.aadhaar_verified ? 'Identity Verified' : 'Verify Identity'}
            </Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCard}>
              {s.loading ? (
                <ActivityIndicator color={s.color} size="small" />
              ) : (
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              )}
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Account */}
        <SectionLabel label="ACCOUNT" />
        <View style={styles.menuGroup}>
          <MenuItem icon="person" label="Edit Profile" onPress={() => router.push('/edit-profile')} />
          <MenuItem icon="verified-user" label="Verify Aadhaar" onPress={() => setAadhaarModalVisible(true)} />
          <MenuItem icon="settings" label="Settings" onPress={() => router.push('/settings')} />
          <MenuItem icon="lock" label="Change Password" onPress={() => router.push('/change-password')} />
        </View>

        {/* Recovery */}
        <SectionLabel label="RECOVERY" />
        <View style={styles.menuGroup}>
          <MenuItem icon="chat" label="Anonymous Chat" onPress={() => router.push('/(tabs)/chat')} />
          <MenuItem icon="bluetooth-searching" label="Device Scanner" onPress={() => router.push('/(tabs)/scanner')} />
          <MenuItem icon="notifications" label="Alerts" onPress={() => router.push('/(tabs)/alerts')} />
        </View>

        {/* About */}
        <SectionLabel label="APP" />
        <View style={styles.menuGroup}>
          <MenuItem icon="info" label="About LOQIT" onPress={() => router.push('/about')} />
          <MenuItem icon="privacy-tip" label="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
          <MenuItem icon="bug-report" label="Report a Bug" onPress={() => router.push('/report-bug')} />
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <MaterialIcons name="info-outline" size={16} color={Colors.tertiary} />
          <Text style={styles.disclaimerText}>
            LOQIT is a device tracking aid and does not guarantee recovery. Always report theft to local authorities.
          </Text>
        </View>

        {/* Sign Out & Delete */}
        <View style={styles.menuGroup}>
          <Pressable
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
            onPress={() => void signOutNow()}
          >
            <LinearGradient
              colors={[Colors.error, '#c44444']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signOutGradient}
            >
              <MaterialIcons name="logout" size={20} color="#fff" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </LinearGradient>
          </Pressable>
          <MenuItem
            icon="delete-forever"
            label="Delete Account"
            onPress={deleteAccountRequest}
            tint={Colors.error}
          />
        </View>
      </ScrollView>

      <AadhaarVerifyModal visible={aadhaarModalVisible} onClose={() => setAadhaarModalVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 120,
    gap: 14,
  },

  /* Hero */
  heroCard: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.headingBold,
    fontSize: 24,
  },
  name: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
  },
  email: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  verifyBadge: {
    marginTop: 4,
    height: 30,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verifyText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
  },

  /* Stats */
  statsRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  statValue: {
    fontFamily: FontFamily.headingBold,
    fontSize: 22,
  },
  statLabel: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 10,
    textAlign: 'center',
  },

  /* Sections */
  sectionLabel: {
    marginTop: 4,
    marginLeft: 20,
    color: Colors.outline,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
  },

  /* Menu */
  menuGroup: {
    marginHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  menuItem: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  menuItemPressed: {
    backgroundColor: Colors.surfaceContainerHigh,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },

  /* Disclaimer */
  disclaimer: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${Colors.tertiary}0D`,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: `${Colors.tertiary}33`,
  },
  disclaimerText: {
    flex: 1,
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 11,
    lineHeight: 16,
  },

  /* Sign Out */
  signOutBtn: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  signOutBtnPressed: {
    opacity: 0.8,
  },
  signOutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 15,
  },
  signOutText: {
    color: '#fff',
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 15,
  },
})