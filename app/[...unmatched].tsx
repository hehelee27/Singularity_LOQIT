import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Colors } from '../constants/colors'

/**
 * Fallback route for unmatched paths.
 * Instead of showing an error, we redirect to the app root.
 */
export default function NotFoundScreen() {
  const router = useRouter()

  useEffect(() => {
    // Redirect immediately to the root
    router.replace('/')
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
