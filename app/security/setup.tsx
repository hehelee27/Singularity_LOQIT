import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, NativeModules, Alert, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../../lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'

import { useTheme } from '../../hooks/useTheme'
import { Header } from '../../components/ui/Header'
import { Card } from '../../components/ui/Card'
import { FontFamily } from '../../constants/typography'

const { LOQITSecurity } = NativeModules

export default function SecuritySetupScreen() {
    const router = useRouter()
    const { colors } = useTheme()
    const [isAdminActive, setIsAdminActive] = useState(false)
    const [isOverlayActive, setIsOverlayActive] = useState(false)
    const [isLockdownRunning, setIsLockdownRunning] = useState(false)

    const [myDeviceId, setMyDeviceId] = useState<string | null>(null)

    // Sync with local memory (Primary) and database (Secondary) on load
    useEffect(() => {
        const loadStatus = async () => {
            try {
                const myId = await AsyncStorage.getItem('loqit_my_active_device_id')
                if (!myId) return
                setMyDeviceId(myId)

                // 1. Check Local Memory first (guaranteed to work)
                const localAdmin = await AsyncStorage.getItem(`lockdown_admin_${myId}`)
                const localPower = await AsyncStorage.getItem(`lockdown_power_${myId}`)
                
                if (localAdmin !== null) setIsAdminActive(localAdmin === 'true')
                if (localPower !== null) setIsOverlayActive(localPower === 'true')

                // 2. Try to sync with DB for cloud availability
                const { data } = await supabase.from('devices').select('hardware_lockdown, power_protection').eq('id', myId).maybeSingle()
                if (data) {
                    // Update UI if DB has more recent data (optional)
                    if (localAdmin === null) setIsAdminActive(!!data.hardware_lockdown)
                    if (localPower === null) setIsOverlayActive(!!data.power_protection)
                    
                    if (data.hardware_lockdown || data.power_protection) setIsLockdownRunning(true)
                }
            } catch (e) {
                console.warn('[Lockdown-Init] DB fetch failed (likely missing columns), using local data.');
            }
        }
        loadStatus()
    }, [])

    const handleEnableAdmin = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert("Not Supported", "Device Administrator features are only available on Android.")
            return
        }

        // Optimistically set UI state
        setIsAdminActive(true)

        try {
            if (LOQITSecurity?.activateDeviceAdmin) {
                await LOQITSecurity.activateDeviceAdmin()
            }
            
            let targetId = myDeviceId;
            if (!targetId) targetId = await AsyncStorage.getItem('loqit_my_active_device_id');

            if (targetId) {
                // SAVE TO LOCAL FIRST (Guarantees persistence)
                await AsyncStorage.setItem(`lockdown_admin_${targetId}`, 'true')
                
                // TRY CLOUD SYNC
                const { error } = await supabase.from('devices').update({ hardware_lockdown: true }).eq('id', targetId)
                if (error) console.log('[Lockdown-Sync] DB skipped: Table columns likely missing.');
                else console.log('[Lockdown-Sync] Saved to cloud.');
            }
        } catch (e) {
            console.error('[Lockdown] Activation failed:', e)
        }
    }

    const handleEnableOverlay = async () => {
        if (Platform.OS !== 'android') {
            Alert.alert("Not Supported", "Power Menu blocking is only available on Android.")
            return
        }

        // Optimistically set UI state
        setIsOverlayActive(true)

        try {
            if (LOQITSecurity?.requestOverlayPermission) {
                const granted = await LOQITSecurity.requestOverlayPermission()
                if (!granted) {
                    setIsOverlayActive(false)
                    Alert.alert("Permission Required", "Please enable 'Appear on top' for LOQIT.")
                    return
                }
            }
            
            let targetId = myDeviceId;
            if (!targetId) targetId = await AsyncStorage.getItem('loqit_my_active_device_id');

            if (targetId) {
                // SAVE TO LOCAL FIRST
                await AsyncStorage.setItem(`lockdown_power_${targetId}`, 'true')

                // TRY CLOUD SYNC
                const { error } = await supabase.from('devices').update({ power_protection: true }).eq('id', targetId)
                if (error) console.log('[Lockdown-Sync] DB skipped: Table columns likely missing.');
            }
        } catch (e) {
            console.error('[Lockdown] Overlay failed:', e)
            setIsOverlayActive(false)
        }
    }

    const handleStartLockdown = async () => {
        if (!isAdminActive || !isOverlayActive) {
            Alert.alert("Setup Required", "Please enable both Hardware Lockdown and Power Protection first.")
            return
        }

        try {
            await LOQITSecurity.startLockdownService()
            setIsLockdownRunning(true)
            Alert.alert("Lockdown Active", "Professional Anti-Theft protection is now running in the background.")
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
            <Header title="Hard Lockdown" onBack={() => router.back()} />
            
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <View style={[styles.heroIcon, { backgroundColor: `${colors.primary}15` }]}>
                        <MaterialIcons name="security" size={48} color={colors.primary} />
                    </View>
                    <Text style={[styles.heroTitle, { color: colors.onSurface }]}>High-Security Mode</Text>
                    <Text style={[styles.heroSub, { color: colors.onSurfaceVariant }]}>
                        Prevent unauthorized device tampering and factory resets even if the device is stolen.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.outline }]}>CORE PROTECTION</Text>
                    
                    <Card style={styles.featureCard}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: `${colors.secondary}15` }]}>
                                <MaterialIcons name="phonelink-lock" size={24} color={colors.secondary} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Hardware Lockdown</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    Prevents factory reset from settings or recovery mode without your LOQIT credenatials.
                                </Text>
                            </View>
                        </View>
                        <Switch 
                            value={isAdminActive} 
                            onValueChange={handleEnableAdmin}
                            trackColor={{ false: colors.outlineVariant, true: colors.secondary }}
                        />
                    </Card>

                    <Card style={styles.featureCard}>
                        <View style={styles.featureInfo}>
                            <View style={[styles.iconBox, { backgroundColor: `${colors.tertiary}15` }]}>
                                <MaterialIcons name="power-settings-new" size={24} color={colors.tertiary} />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={[styles.featureTitle, { color: colors.onSurface }]}>Power Protection</Text>
                                <Text style={[styles.featureDesc, { color: colors.onSurfaceVariant }]}>
                                    Requests your passkey before allowing the device to be switched off or restarted.
                                </Text>
                            </View>
                        </View>
                        <Switch 
                            value={isOverlayActive} 
                            onValueChange={handleEnableOverlay}
                            trackColor={{ false: colors.outlineVariant, true: colors.tertiary }}
                        />
                    </Card>
                </View>

                <View style={styles.warningBox}>
                    <MaterialIcons name="info-outline" size={20} color={colors.primary} />
                    <Text style={[styles.warningText, { color: colors.onSurface }]}>
                        Enabling these features requires standard Android Device Administrator permissions. This is required for deep-level security.
                    </Text>
                </View>

                <Pressable 
                    onPress={handleStartLockdown}
                    disabled={isLockdownRunning}
                    style={({ pressed }) => [
                        styles.mainBtn,
                        { 
                            backgroundColor: isLockdownRunning ? colors.secondary : colors.primary,
                            opacity: pressed ? 0.9 : 1
                        }
                    ]}
                >
                    <MaterialIcons 
                        name={isLockdownRunning ? "verified" : "flash-on"} 
                        size={20} 
                        color="#fff" 
                    />
                    <Text style={styles.mainBtnText}>
                        {isLockdownRunning ? "Lockdown Operational" : "Activate Full Protection"}
                    </Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1 },
    content: { padding: 16 },
    hero: {
        alignItems: 'center',
        paddingVertical: 32,
        paddingHorizontal: 16,
        textAlign: 'center'
    },
    heroIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    heroTitle: {
        fontSize: 24,
        fontFamily: FontFamily.headingBold,
        marginBottom: 8
    },
    heroSub: {
        fontSize: 15,
        fontFamily: FontFamily.bodyRegular,
        textAlign: 'center',
        lineHeight: 22
    },
    section: {
        gap: 12,
        marginBottom: 24
    },
    sectionLabel: {
        fontSize: 12,
        fontFamily: FontFamily.headingBold,
        letterSpacing: 1,
        marginBottom: 4
    },
    featureCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16
    },
    featureInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
        gap: 16
    },
    iconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    featureText: {
        flex: 1,
        paddingRight: 8
    },
    featureTitle: {
        fontSize: 16,
        fontFamily: FontFamily.headingSemiBold,
        marginBottom: 4
    },
    featureDesc: {
        fontSize: 13,
        fontFamily: FontFamily.bodyRegular,
        lineHeight: 18
    },
    warningBox: {
        flexDirection: 'row',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#e3f2fd',
        gap: 12,
        marginBottom: 24
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        fontFamily: FontFamily.bodyRegular
    },
    mainBtn: {
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 40
    },
    mainBtnText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: FontFamily.headingBold
    }
})
