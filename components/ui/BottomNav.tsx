import { StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'

import { Colors } from '../../constants/colors'

export function BottomNav() {
  return (
    <View style={styles.wrapper}>
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17,19,24,0.6)',
  },
})