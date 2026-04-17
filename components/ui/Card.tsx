import { PropsWithChildren } from 'react'
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native'

import { Colors } from '../../constants/colors'

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>
}>

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: 24,
    padding: 20,
  },
})