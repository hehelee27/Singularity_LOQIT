import { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

type GradientButtonProps = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  style?: StyleProp<ViewStyle>
}

export function GradientButton({
  title,
  onPress,
  disabled,
  loading,
  leftIcon,
  rightIcon,
  style,
}: GradientButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.pressable, style, (disabled || loading) && styles.disabled]}
    >
      <LinearGradient colors={[Colors.primary, Colors.inversePrimary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.inner}>
          {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
          {loading ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <Text style={styles.label}>{title}</Text>
          )}
          {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.65,
  },
  gradient: {
    minHeight: 52,
    justifyContent: 'center',
  },
  inner: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  label: {
    color: Colors.onPrimary,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})