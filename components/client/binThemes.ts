export type BinThemeKey = 'garbage' | 'recycling' | 'compost'

export const BIN_THEME: Record<BinThemeKey, { panel: string; pill: string }> = {
  garbage: {
    panel: 'border-red-500/30 bg-red-500/5',
    pill: 'border-red-500/40 bg-red-500/15 text-white',
  },
  recycling: {
    panel: 'border-yellow-400/40 bg-yellow-400/10',
    pill: 'border-yellow-300/50 bg-yellow-300/20 text-white',
  },
  compost: {
    panel: 'border-green-500/30 bg-green-500/10',
    pill: 'border-emerald-400/40 bg-emerald-400/15 text-white',
  },
}

export const DEFAULT_BIN_PILL = 'border-white/25 bg-white/10 text-white/80'
