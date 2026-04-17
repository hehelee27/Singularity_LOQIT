import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Colors } from '../../constants/colors'

/**
 * Empty route to handle the redirect URL from OAuth.
 * This prevents the "Unmatched Route" error in Expo Router.
 */
export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Just a safety redirect in case the user lands here directly
    const timer = setTimeout(() => {
      router.replace('/')
    }, 1000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
