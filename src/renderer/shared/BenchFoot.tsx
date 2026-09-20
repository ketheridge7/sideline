import {
  useEffect,
  useState,
  type JSX,
  type PointerEvent,
  type ReactNode
} from 'react'
import {
  BENCH_CARD_FILL,
  BENCH_CLOSE_MS,
  BENCH_HAIRLINE_PX,
  BENCH_PAGE_FILL,
  BOARD_ROSTER_PAD_X,
  BOARD_ROSTER_PAD_Y,
  canOpenBench,
  prefersBenchReducedMotion,
  type BenchFootCopy,
  type BenchSide
} from './benchPopover'

export const useBenchPresence = (open: boolean): 'open' | 'closing' | null => {
  const [phase, setPhase] = useState<'open' | 'closing' | null>(open ? 'open' : null)

  useEffect(() => {
    if (open) {
      setPhase('open')
      return
    }
    if (prefersBenchReducedMotion()) {
      setPhase(null)
      return
    }
    setPhase((current) => (current == null ? null : 'closing'))
    if (typeof window === 'undefined') {
      setPhase(null)
      return
    }
    const id = window.setTimeout(() => setPhase(null), BENCH_CLOSE_MS)
    return () => window.clearTimeout(id)
  }, [open])

  return phase
}

export const dismissBenchPointer = (event: PointerEvent<HTMLElement>, open: boolean): boolean => {
  if (!open) return false
  const target = event.target
  if (!(target instanceof Element)) return false
  if (target.closest('[data-bench-popover]')) return false
  if (target.closest('[data-bench-foot]')) return false
  return true
}

export const BenchFootButton = ({
  you,
  open,
  copy,
  onToggle,
  onFocus,
  joined
}: {
  you?: boolean
  open: boolean
  copy: BenchFootCopy
  onToggle: () => void
  onFocus?: () => void
  joined?: boolean
}): JSX.Element => {
  const allowed = canOpenBench(copy)
  const side: BenchSide = you ? 'mine' : 'opp'
  const tone = you ? 'text-lime' : 'text-them'
  const border = joined
    ? you
      ? 'border-t border-lime/25'
      : 'border-t border-them/20'
    : you
      ? 'border border-lime/45 hover:border-lime/70'
      : 'border border-them/35 hover:border-them/55'
  const shape = joined
    ? 'rounded-none bg-card'
    : 'rounded-full bg-white/[0.03]'
  let suffix: string
  switch (copy.kind) {
    case 'count':
      suffix = String(copy.count)
      break
    case 'empty':
      suffix = 'Empty'
      break
    case 'missing':
      suffix = '—'
      break
    default: {
      const _never: never = copy
      return _never
    }
  }
  return (
    <button
      type="button"
      data-bench-foot={side}
      data-bench-open={open ? 'true' : 'false'}
      data-bench-joined={joined ? 'true' : 'false'}
      aria-expanded={allowed && open}
      aria-disabled={!allowed}
      disabled={!allowed}
      onFocus={onFocus}
      onClick={() => {
        if (!allowed) return
        onToggle()
      }}
      className={`relative z-30 flex h-10 w-full shrink-0 cursor-pointer items-center justify-center gap-2 font-cond text-[11px] font-bold uppercase tracking-[0.18em] ${tone} ${border} ${shape} hover:brightness-110 disabled:cursor-default disabled:opacity-70`}
    >
      <span>Bench</span>
      <span aria-hidden="true">·</span>
      <span>{suffix}</span>
      {allowed ? <span aria-hidden="true">{open ? '▼' : '▲'}</span> : null}
    </button>
  )
}

export const BenchSocialCard = ({
  you,
  state,
  foot,
  children
}: {
  you?: boolean
  state: 'open' | 'closing'
  foot?: ReactNode
  children: ReactNode
}): JSX.Element => {
  const side: BenchSide = you ? 'mine' : 'opp'
  return (
    <div
      className={`bench-social-popover absolute inset-0 z-20 bg-bg ${BOARD_ROSTER_PAD_X} ${BOARD_ROSTER_PAD_Y}`}
      style={{ backgroundColor: BENCH_PAGE_FILL }}
      data-bench-popover={side}
      data-bench-card="joined"
      data-bench-fill="opaque"
      data-bench-align="starters"
      data-state={state}
      role="region"
      aria-label="Bench"
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-line bg-card"
        style={{ backgroundColor: BENCH_CARD_FILL }}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-card"
          style={{ backgroundColor: BENCH_CARD_FILL }}
          aria-hidden="true"
          data-bench-occluder=""
        />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            className={`pointer-events-none absolute bottom-3 left-0 top-3 ${you ? 'bg-lime' : 'bg-them'}`}
            style={{ width: BENCH_HAIRLINE_PX }}
            aria-hidden="true"
          />
          <div className="max-h-full overflow-y-auto overscroll-contain py-1">
            {children}
          </div>
        </div>
        {foot}
      </div>
    </div>
  )
}

export const BenchFootStack = ({
  you,
  open,
  copy,
  onToggle,
  onFocus,
  children
}: {
  you?: boolean
  open: boolean
  copy: BenchFootCopy
  onToggle: () => void
  onFocus?: () => void
  children: ReactNode
}): JSX.Element => {
  const allowed = canOpenBench(copy)
  const phase = useBenchPresence(open && allowed)
  const foot = (
    <BenchFootButton
      you={you}
      open={open && allowed}
      copy={copy}
      onToggle={onToggle}
      onFocus={onFocus}
      joined={Boolean(phase)}
    />
  )
  return (
    <div className="z-20 mt-auto w-full shrink-0" data-bench-stack={you ? 'mine' : 'opp'}>
      {phase ? (
        <BenchSocialCard you={you} state={phase} foot={foot}>
          {children}
        </BenchSocialCard>
      ) : (
        foot
      )}
      {phase ? (
        <div className="h-10 w-full shrink-0" aria-hidden="true" data-bench-foot-slot="" />
      ) : null}
    </div>
  )
}
