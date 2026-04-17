const palette = {
  // Dark Theme (Onyx)
  dark: {
    background: '#111318',
    surface: '#111318',
    surfaceDim: '#111318',
    surfaceContainerLowest: '#0c0e13',
    surfaceContainerLow: '#1a1b21',
    surfaceContainer: '#1e2025',
    surfaceContainerHigh: '#282a2f',
    surfaceContainerHighest: '#33353a',
    surfaceBright: '#37393f',
    surfaceVariant: '#33353a',
    onSurface: '#e2e2e9',
    onSurfaceVariant: '#c1c6d6',
    primary: '#aac7ff',
    primaryContainer: '#7491c6',
    inversePrimary: '#418fff',
    accent: '#3D8EFF',
    onPrimary: '#0c305f',
    secondary: '#46f1bb',
    secondaryContainer: '#06d4a1',
    onSecondary: '#003828',
    tertiary: '#ffb95f',
    tertiaryContainer: '#ca8100',
    error: '#FF4E4E',
    errorContainer: '#93000a',
    outline: '#8b919f',
    outlineVariant: '#414753',
  },
  // Light Theme (Clean White)
  light: {
    background: '#FFFFFF',
    surface: '#F8F9FF',
    surfaceDim: '#EDF1FF',
    surfaceContainerLowest: '#FFFFFF',
    surfaceContainerLow: '#F1F3F9',
    surfaceContainer: '#EBEFF7',
    surfaceContainerHigh: '#E1E6F0',
    surfaceContainerHighest: '#D5DCE9',
    surfaceBright: '#F8F9FF',
    surfaceVariant: '#E0E2EC',
    onSurface: '#191C20',
    onSurfaceVariant: '#44474E',
    primary: '#005AC1',
    primaryContainer: '#D8E2FF',
    inversePrimary: '#ADC6FF',
    accent: '#005AC1',
    onPrimary: '#FFFFFF',
    secondary: '#006B54',
    secondaryContainer: '#6EF9D3',
    onSecondary: '#FFFFFF',
    tertiary: '#855400',
    tertiaryContainer: '#FFDDB1',
    error: '#BA1A1A',
    errorContainer: '#FFDAD6',
    outline: '#74777F',
    outlineVariant: '#C4C6D0',
  }
}

// We'll export the individual palettes and a reactive hook pattern later
export const DarkColors = palette.dark
export const LightColors = palette.light

// Default to dark for consistency with current style
export const Colors = DarkColors

export type ColorPalette = typeof DarkColors
export type ColorKey = keyof ColorPalette