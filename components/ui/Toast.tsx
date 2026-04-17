import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

type ToastType = 'success' | 'error' | 'info'

type ToastProps = {
  visible: boolean
  message: string
  type?: ToastType
  onHide?: () => void
}

const tone = {
  success: {
    bg: Colors.secondary,
    text: Colors.onSecondary,
  },
  error: {
    bg: Colors.error,
    text: '#ffffff',
  },
  info: {
    bg: Colors.primary,
    text: Colors.onPrimary,
  },
} as const

export function Toast({ visible, message, type = 'info', onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(-90)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible || !message) {
      return
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start()

    const hideTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -90,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => onHide?.())
    }, 3000)

    return () => clearTimeout(hideTimer)
  }, [message, onHide, opacity, translateY, visible])

  if (!visible || !message) {
    return null
  }

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: tone[type].bg,
        },
      ]}
    >
      <Text style={[styles.text, { color: tone[type].text }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    zIndex: 80,
    elevation: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  text: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
})
