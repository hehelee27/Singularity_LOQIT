import { Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { FontFamily } from '../../constants/typography'
import { useTheme } from '../../hooks/useTheme'

type HeaderProps = {
  title?: string
  onBack?: () => void
  onBackPress?: () => void
  rightIcon?: keyof typeof MaterialIcons.glyphMap
  onRightPress?: () => void
}

export function Header({ title, onBack, onBackPress, rightIcon, onRightPress }: HeaderProps) {
  const handleBack = onBack || onBackPress
  const { colors } = useTheme()
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.leftGroup}>
        {handleBack ? (
          <Pressable onPress={handleBack} style={[styles.iconButton, { backgroundColor: colors.surfaceContainerLow }]}>
            <MaterialIcons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <MaterialIcons name="shield" size={22} color={colors.accent} />
            <Text style={[styles.brandText, { color: colors.accent }]}>LOQIT</Text>
          </View>
        )}
        {title ? <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text> : null}
      </View>
      {rightIcon ? (
        <Pressable onPress={onRightPress} style={[styles.iconButton, { backgroundColor: colors.surfaceContainerLow }]}>
          <MaterialIcons name={rightIcon} size={22} color={colors.onSurface} />
        </Pressable>
      ) : <View style={styles.placeholder} />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: FontFamily.headingBold, fontSize: 18, lineHeight: 22, letterSpacing: 0.2 },
  title: { fontFamily: FontFamily.headingSemiBold, fontSize: 21 },
  iconButton: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  placeholder: { width: 36, height: 36 }
})