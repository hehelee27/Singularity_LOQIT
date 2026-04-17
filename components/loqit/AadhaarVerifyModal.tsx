import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as Crypto from 'expo-crypto'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { GradientButton } from '../ui/GradientButton'

type AadhaarVerifyModalProps = {
  visible: boolean
  onClose: () => void
}

export function AadhaarVerifyModal({ visible, onClose }: AadhaarVerifyModalProps) {
  const { refreshProfile, user } = useAuth()

  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [aadhaarMessage, setAadhaarMessage] = useState<string | null>(null)
  const [savingAadhaar, setSavingAadhaar] = useState(false)

  const resetAndClose = () => {
    setAadhaarNumber('')
    setOtp('')
    setOtpStep(false)
    setAadhaarMessage(null)
    onClose()
  }

  const sendOtp = () => {
    const digits = aadhaarNumber.replace(/\D/g, '')
    if (digits.length !== 12) {
      setAadhaarMessage('Enter a valid 12-digit Aadhaar number.')
      return
    }

    setAadhaarMessage('Dev OTP sent. Use 123456')
    setOtpStep(true)
  }

  const verifyAadhaar = async () => {
    const digits = aadhaarNumber.replace(/\D/g, '')
    if (digits.length !== 12) {
      setAadhaarMessage('Aadhaar number must be 12 digits.')
      return
    }

    if (otp !== '123456') {
      setAadhaarMessage('Invalid OTP. Use 123456 for dev.')
      return
    }

    if (!user?.id) {
      setAadhaarMessage('Session expired. Please sign in again.')
      return
    }

    setSavingAadhaar(true)
    setAadhaarMessage(null)

    try {
      const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digits)
      const { error } = await supabase
        .from('profiles')
        .update({
          aadhaar_verified: true,
          aadhaar_hash: hash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) {
        setAadhaarMessage(error.message)
        return
      }

      await refreshProfile?.()
      resetAndClose()
    } finally {
      setSavingAadhaar(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Aadhaar Verification</Text>

          <TextInput
            style={styles.modalInput}
            keyboardType="number-pad"
            placeholder="Enter 12-digit Aadhaar"
            placeholderTextColor={Colors.outline}
            value={aadhaarNumber}
            onChangeText={(value) => setAadhaarNumber(value.replace(/\D/g, '').slice(0, 12))}
          />

          {otpStep ? (
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="Enter OTP"
              placeholderTextColor={Colors.outline}
              value={otp}
              onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            />
          ) : null}

          {aadhaarMessage ? <Text style={styles.modalMessage}>{aadhaarMessage}</Text> : null}

          {!otpStep ? (
            <GradientButton title="Send OTP" onPress={sendOtp} />
          ) : (
            <GradientButton title="Verify Aadhaar" onPress={() => void verifyAadhaar()} loading={savingAadhaar} />
          )}

          <Pressable onPress={resetAndClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: Colors.surfaceContainerLow,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    gap: 14,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 4,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
  },
  modalTitle: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
  },
  modalInput: {
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    color: Colors.onSurface,
    paddingHorizontal: 14,
    fontFamily: FontFamily.monoMedium,
    fontSize: 15,
  },
  modalMessage: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 12,
  },
  modalCancel: {
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
  },
})
