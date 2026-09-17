export type ChromePillSize = 'nav' | 'compact' | 'control'

const PILL_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-full cursor-pointer no-drag'

const sizeClass = (size: ChromePillSize): string => {
  switch (size) {
    case 'nav':
      return 'px-3.5 py-1.5 font-cond text-xs font-bold uppercase tracking-[0.16em]'
    case 'compact':
      return 'px-2.5 py-1 font-cond text-[10px] font-bold uppercase tracking-[0.16em]'
    case 'control':
      return 'px-3.5 py-2 text-sm font-medium'
    default: {
      const _never: never = size
      return _never
    }
  }
}

export const chromePillClass = (active = false, size: ChromePillSize = 'nav'): string =>
  `${PILL_BASE} ${sizeClass(size)} ${
    active
      ? 'bg-lime/10 text-lime shadow-[0_0_18px_rgba(182,255,59,0.28)] ring-1 ring-lime'
      : 'bg-white/[0.06] text-muted hover:text-text hover:bg-white/[0.09]'
  }`

export type ChromeFillTone = 'you' | 'espn'

export const chromeFillPillClass = (tone: ChromeFillTone, size: ChromePillSize = 'control'): string => {
  const toneClass = ((): string => {
    switch (tone) {
      case 'you':
        return 'bg-you text-bg'
      case 'espn':
        return 'bg-espn text-white'
      default: {
        const _never: never = tone
        return _never
      }
    }
  })()
  return `${PILL_BASE} ${sizeClass(size)} ${toneClass}`
}

export const chromeDotClass = 'h-1.5 w-1.5 shrink-0 rounded-full bg-lime'
