export const FontFamily = {
  headingBold: 'Sora_700Bold',
  headingSemiBold: 'Sora_600SemiBold',
  bodyRegular: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  monoMedium: 'JetBrainsMono_500Medium',
} as const

export const Typography = {
  display: {
    fontFamily: FontFamily.headingBold,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.5,
  },
  title: {
    fontFamily: FontFamily.headingBold,
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: FontFamily.bodyRegular,
    fontSize: 17,
    lineHeight: 25,
  },
  label: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
  },
  mono: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.4,
  },
} as const