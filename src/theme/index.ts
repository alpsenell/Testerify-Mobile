import { TextStyle } from 'react-native'

export const colors = {
  paper: '#f4f1ea', card: '#fcfbf7', border: '#e7e0d3', hairline: '#efe9de',
  ink: '#211e1a', secondary: '#5d564b', muted: '#968d7e', faint: '#b3aa99',
  track: '#ece6da',
  accent: '#5b54e0', accentSoft: '#eae9f4', accentBorder: '#c5bed6',
  pos: '#2f8f5b', posSoft: '#e1ede3', posBorder: '#b7cbb4',
  neg: '#c2553c', warn: '#b9842a', warnSoft: '#f2e9d8',
  tabBar: '#faf8f2', handle: '#d4ccbc',
}

export const fonts = {
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemi: 'IBMPlexMono_600SemiBold',
}

export const radius = { chip: 11, control: 13, card: 15, cardLg: 16, hero: 18, sheet: 24 }

export const type = {
  kicker: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted },
  h1: { fontFamily: fonts.sans, fontSize: 26, color: colors.ink },
  h2: { fontFamily: fonts.sans, fontSize: 22, color: colors.ink },
  title: { fontFamily: fonts.sansSemi, fontSize: 14.5, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 13, color: colors.secondary, lineHeight: 19 },
  small: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },
  monoSmall: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted },
  monoStat: { fontFamily: fonts.monoSemi, fontSize: 16, color: colors.ink },
} satisfies Record<string, TextStyle>
