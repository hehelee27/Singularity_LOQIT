import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Header } from '../components/ui/Header'
import { Toast } from '../components/ui/Toast'
import { Colors } from '../constants/colors'
import { FontFamily } from '../constants/typography'
import { useAuth } from '../hooks/useAuth'

export default function ReportBugScreen() {
  const router = useRouter()
  const { user } = useAuth()

  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const sendReport = async () => {
    if (!subject.trim() || !description.trim()) {
      setToast({ message: 'Please fill in all fields.', type: 'error' })
      return
    }

    setSending(true)

    const email = 'support@loqit.app'
    const emailSubject = `[Bug Report] ${subject}`
    const body = `${description}\n\n---\nUser: ${user?.email ?? 'Anonymous'}\nApp Version: 1.0.0\nPlatform: ${Platform.OS}`

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`

    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl)
      if (canOpen) {
        await Linking.openURL(mailtoUrl)
        setToast({ message: 'Opening email client...', type: 'success' })
        setSubject('')
        setDescription('')
      } else {
        setToast({ message: 'No email client available. Please email support@loqit.app directly.', type: 'error' })
      }
    } catch {
      setToast({ message: 'Unable to open email client.', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Report a Bug" onBackPress={() => router.back()} rightIcon="bug-report" />

      <Toast
        visible={!!toast}
        message={toast?.message ?? ''}
        type={toast?.type ?? 'info'}
        onHide={() => setToast(null)}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <MaterialIcons name="bug-report" size={20} color={Colors.error} />
            <Text style={styles.infoText}>
              Found a bug? Let us know! Describe what happened and we'll look into it.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief description of the issue"
              placeholderTextColor={Colors.outline}
              editable={!sending}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the bug in detail. What were you doing? What happened? What did you expect?"
              placeholderTextColor={Colors.outline}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              editable={!sending}
            />
          </View>

          <Pressable
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={() => void sendReport()}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={Colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color={Colors.onPrimary} />
                <Text style={styles.sendButtonText}>Send Report</Text>
              </>
            )}
          </Pressable>

          <View style={styles.alternativeCard}>
            <Text style={styles.alternativeTitle}>Prefer email?</Text>
            <Text style={styles.alternativeText}>
              Send directly to support@loqit.app
            </Text>
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
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,78,78,0.28)',
    backgroundColor: 'rgba(255,78,78,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 15,
  },
  textArea: {
    minHeight: 140,
    paddingTop: 14,
  },
  sendButton: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
  alternativeCard: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  alternativeTitle: {
    color: Colors.onSurfaceVariant,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
  },
  alternativeText: {
    color: Colors.primary,
    fontFamily: FontFamily.bodyRegular,
    fontSize: 13,
  },
})
