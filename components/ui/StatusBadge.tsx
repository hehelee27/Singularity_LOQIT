import { StyleSheet, Text, View } from 'react-native'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

type BadgeType = 'safe' | 'lost' | 'warning'

type StatusBadgeProps = {
  type: BadgeType
  label?: string
}

const badgeColors: Record<BadgeType, string> = {
  safe: Colors.secondary,
  lost: Colors.error,
  warning: Colors.tertiary,
}

export function StatusBadge({ type, label }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${badgeColors[type]}22` }]}>
      <Text style={[styles.text, { color: badgeColors[type] }]}>{label ?? type.toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.8,
  },
})