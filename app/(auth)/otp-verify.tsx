import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'

import { Colors, DarkColors, LightColors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { GradientButton } from '../../components/ui/GradientButton'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'

const OTP_LENGTH = 6

export default function OtpVerifyScreen() {
  const router = useRouter()
  const { theme } = useTheme()
  const activeColors = theme === 'dark' ? DarkColors : LightColors
  const params = useLocalSearchParams<{ email?: string }>()
  const email = params.email ?? ''
  const { resendOtp, verifyOtp } = useAuth()

  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ''))
  const [timer, setTimer] = useState(30)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const inputRefs = useRef<Array<TextInput | null>>([])

  useEffect(() => {
    if (timer <= 0) {
      return
    }

    const interval = setInterval(() => {
      setTimer((current) => current - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [timer])

  const token = useMemo(() => digits.join(''), [digits])

  const updateDigit = (index: number, value: string) => {
    const normalized = value.replace(/[^0-9]/g, '').slice(-1)

    setDigits((current) => {
      const next = [...current]
      next[index] = normalized
      return next
    })

    if (normalized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    if (normalized && index === OTP_LENGTH - 1) {
      Keyboard.dismiss()
    }
  }

  const onBackspace = (index: number, key: string) => {
    if (key !== 'Backspace') {
      return
    }

    if (!digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const onResend = async () => {
    if (!email || timer > 0) {
      return
    }

    setErrorMessage('')
    const { error } = await resendOtp(email)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setDigits(Array.from({ length: OTP_LENGTH }, () => ''))
    inputRefs.current[0]?.focus()
    setTimer(30)
  }

  const onVerify = async () => {
    if (!email) {
      setErrorMessage('Missing email. Please return to sign up.')
      return
    }

    if (token.length !== OTP_LENGTH) {
      setErrorMessage('Enter the 6-digit code.')
      return
    }

    setLoading(true)
    setErrorMessage('')

    const { error } = await verifyOtp(email, token)

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.replace('/(tabs)')
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: activeColors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable 
            style={[styles.backButton, { backgroundColor: activeColors.surfaceContainerLow }]} 
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/sign-in')}
          >
            <MaterialIcons name="arrow-back" size={22} color={activeColors.onSurface} />
          </Pressable>

          <View style={styles.hero}>
            <LinearGradient
              colors={[activeColors.primary, activeColors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroIcon}
            >
              <MaterialIcons name="mark-email-read" size={32} color={activeColors.onPrimary} />
            </LinearGradient>
            <Text style={[styles.title, { color: activeColors.onSurface }]}>Verify Your Email</Text>
            <Text style={[styles.subtitle, { color: activeColors.onSurfaceVariant }]}>We sent a 6-digit code to</Text>
            <Text style={[styles.email, { color: activeColors.primary }]}>{email}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: activeColors.surfaceContainerLow, borderColor: activeColors.outlineVariant }]}>
            <View style={styles.otpRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref
                  }}
                  style={[
                    styles.otpInput, 
                    { 
                      color: activeColors.onSurface,
                      backgroundColor: activeColors.surfaceContainerLowest,
                      borderColor: activeColors.outlineVariant,
                    },
                    digit && {
                      borderColor: activeColors.primary,
                      backgroundColor: activeColors.surfaceContainerHigh,
                    },
                  ]}
                  value={digit}
                  onChangeText={(value) => updateDigit(index, value)}
                  onKeyPress={({ nativeEvent }) => onBackspace(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                  selectionColor={activeColors.primary}
                  autoFocus={index === 0}
                />
              ))}
            </View>

            <View style={styles.timerRow}>
              {timer > 0 ? (
                <Text style={[styles.timerText, { color: activeColors.outline }]}>
                  <MaterialIcons name="schedule" size={13} color={activeColors.outline} /> Resend code in {timer}s
                </Text>
              ) : (
                <Pressable onPress={onResend}>
                  <Text style={[styles.resendText, { color: activeColors.primary }]}>Resend Code</Text>
                </Pressable>
              )}
            </View>

            {errorMessage ? (
              <View style={[styles.errorBanner, { backgroundColor: theme === 'dark' ? 'rgba(255, 61, 0, 0.1)' : '#FFF1F0' }]}>
                <MaterialIcons name="error-outline" size={15} color={activeColors.error} />
                <Text style={[styles.errorText, { color: activeColors.error }]}>{errorMessage}</Text>
              </View>
            ) : null}

            <GradientButton
              title="Verify Code"
              loading={loading}
              onPress={onVerify}
              disabled={token.length !== OTP_LENGTH || loading}
              style={styles.verifyButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    marginTop: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 6,
    gap: 8,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingBold,
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 14,
    textAlign: 'center',
  },
  email: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 58,
    borderRadius: 14,
    color: Colors.onSurface,
    fontFamily: FontFamily.monoMedium,
    fontSize: 24,
    borderWidth: 1,
  },
  timerRow: {
    alignItems: 'center',
  },
  timerText: {
    color: Colors.outline,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  resendText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorContainer,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
  verifyButton: {
    marginTop: 4,
  },
})