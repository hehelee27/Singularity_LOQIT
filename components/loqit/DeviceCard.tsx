import { useRef } from 'react'
import {
  Animated,
  DimensionValue,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

type DeviceCardProps = {
  id: string
  make: string
  model: string
  imei: string
  status: 'registered' | 'lost' | 'found' | 'recovered' | 'stolen'
  onPress?: (id: string) => void
  style?: StyleProp<ViewStyle>
  width?: DimensionValue
}

const statusConfig = {
  registered: { label: 'SAFE', color: Colors.secondary },
  recovered: { label: 'RECOVERED', color: Colors.secondary },
  found: { label: 'FOUND', color: Colors.tertiary },
  lost: { label: 'LOST', color: Colors.error },
  stolen: { label: 'STOLEN', color: Colors.error },
} as const

export function DeviceCard({
  id,
  make,
  model,
  imei,
  status,
  onPress,
  style,
  width = 200,
}: DeviceCardProps) {
  const cfg = statusConfig[status] || statusConfig.registered
  const imeiTail = imei.length > 4 ? imei.slice(-4) : imei
  const scale = useRef(new Animated.Value(1)).current

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      damping: 18,
      stiffness: 240,
      mass: 0.6,
    }).start()
  }

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        style={[styles.card, { width }]}
        onPress={() => onPress?.(id)}
        onPressIn={() => animateTo(0.96)}
        onPressOut={() => animateTo(1)}
      >
        {/* Gradient icon area */}
        <LinearGradient
          colors={[Colors.primary, Colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <MaterialIcons name="smartphone" size={22} color={Colors.onPrimary} />
        </LinearGradient>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: `${cfg.color}1A` }]}>
          <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.deviceName} numberOfLines={1}>{`${make} ${model}`}</Text>
          <Text style={styles.imeiText}>{`IMEI •••• ${imeiTail}`}</Text>
        </View>

        {/* Arrow */}
        <View style={styles.arrow}>
          <MaterialIcons name="arrow-forward-ios" size={12} color={Colors.outline} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 16,
    gap: 10,
  },
  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  info: {
    marginTop: 2,
    gap: 3,
  },
  deviceName: {
    color: Colors.onSurface,
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
  },
  imeiText: {
    color: Colors.outline,
    fontFamily: FontFamily.monoMedium,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  arrow: {
    position: 'absolute',
    bottom: 14,
    right: 14,
  },
})
