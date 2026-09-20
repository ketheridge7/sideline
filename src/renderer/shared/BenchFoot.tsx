import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent,
  type ReactNode,
  type RefObject
} from 'react'
import {
  BENCH_CLOSE_MS,
  BENCH_HAIRLINE_PX,
  benchPopoverMaxHeightPx,
  canOpenBench,
  prefersBenchReducedMotion,
  type BenchFootCopy,
  type BenchSide
} from './benchPopover'

export const useColumnBodyHeight = (): { ref: RefObject<HTMLDivElement | null>; height: number } => {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = (): void => setHeight(el.getBoundingClientRect().height)
    const observer = new ResizeObserver(update)
    observer.observe(el)
    update()
    return () => observer.disconnect()
  }, [])

  return { ref, height }
}

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
    ? 'rounded-none bg-transparent'
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
  maxHeight,
  state,
  foot,
  children
}: {
  you?: boolean
  maxHeight: number
  state: 'open' | 'closing'
  foot?: ReactNode
  children: ReactNode
}): JSX.Element => {
  const side: BenchSide = you ? 'mine' : 'opp'
  return (
    <div
      className="bench-social-popover absolute bottom-0 left-0 right-0 z-20 overflow-hidden rounded-3xl border border-ice/10 bg-[#12141A] shadow-[0_22px_64px_rgba(0,0,0,0.8)]"
      data-bench-popover={side}
      data-bench-card="joined"
      data-state={state}
      role="region"
      aria-label="Bench"
    >
      <div className="relative overflow-hidden" style={{ maxHeight }}>
        <div
          className={`pointer-events-none absolute bottom-3 left-0 top-3 ${you ? 'bg-lime' : 'bg-them'}`}
          style={{ width: BENCH_HAIRLINE_PX }}
          aria-hidden="true"
        />
        <div className="max-h-full overflow-y-auto overscroll-contain py-1 pl-1.5 pr-1">{children}</div>
      </div>
      {foot}
    </div>
  )
}

export const BenchFootStack = ({
  you,
  open,
  copy,
  columnBodyHeight,
  onToggle,
  onFocus,
  children
}: {
  you?: boolean
  open: boolean
  copy: BenchFootCopy
  columnBodyHeight: number
  onToggle: () => void
  onFocus?: () => void
  children: ReactNode
}): JSX.Element => {
  const allowed = canOpenBench(copy)
  const phase = useBenchPresence(open && allowed)
  const maxHeight = benchPopoverMaxHeightPx(columnBodyHeight)
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
    <div className="relative z-20 mt-auto shrink-0" data-bench-stack={you ? 'mine' : 'opp'}>
      {phase ? (
        <BenchSocialCard you={you} maxHeight={maxHeight} state={phase} foot={foot}>
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
