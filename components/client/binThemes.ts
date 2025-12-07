export type BinThemeKey = 'garbage' | 'recycling' | 'compost'

export const BIN_THEME: Record<BinThemeKey, { panel: string; pill: string }> = {
  garbage: {
    panel: 'border-red-400/40 bg-red-50',
    pill: 'border-red-400/60 bg-red-50 text-red-900',
  },
  recycling: {
    panel: 'border-amber-300/60 bg-amber-50',
    pill: 'border-amber-300/60 bg-amber-50 text-amber-900',
  },
  compost: {
    panel: 'border-emerald-400/50 bg-emerald-50',
    pill: 'border-emerald-400/40 bg-emerald-50 text-emerald-900',
  },
}

export const DEFAULT_BIN_PILL = 'border-slate-200 bg-slate-100 text-slate-700'
