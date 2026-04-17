import { Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

import { Colors } from '../../constants/colors'
import { FontFamily } from '../../constants/typography'

type HeaderProps = {
  title?: string
  onBackPress?: () => void
  rightIcon?: keyof typeof MaterialIcons.glyphMap
  onRightPress?: () => void
}

export function Header({ title, onBackPress, rightIcon, onRightPress }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        {onBackPress ? (
          <Pressable onPress={onBackPress} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
          </Pressable>
        ) : (
          <View style={styles.brand}>
            <MaterialIcons name="shield" size={22} color={Colors.accent} />
            <Text style={styles.brandText}>LOQIT</Text>
          </View>
        )}

        {title ? <Text style={styles.title}>{title}</Text> : null}
      </View>

      {rightIcon ? (
        <Pressable onPress={onRightPress} style={styles.iconButton}>
          <MaterialIcons name={rightIcon} size={22} color={Colors.onSurface} />
        </Pressable>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    color: Colors.accent,
    fontFamily: FontFamily.headingBold,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  title: {
    color: Colors.onSurface,
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 21,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  placeholder: {
    width: 36,
    height: 36,
  },
})