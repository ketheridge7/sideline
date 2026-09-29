import { Check, Pipette, RotateCcw } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from '@shared/color'
import { hudColorIsFaint } from '@shared/overlayLayout'

export const STUDIO_PALETTE = [
  '#FFFFFF',
  '#F8FBFF',
  '#E8E4DC',
  '#94A3B8',
  '#B6FF3B',
  '#A6E6A0',
  '#6EF3C5',
  '#8ECAFF',
  '#5AC8FA',
  '#B79CFF',
  '#FF8FB1',
  '#FF6B5B',
  '#FFB547',
  '#FFD84D'
] as const

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

const eyeDropper = (): EyeDropperCtor | null => {
  if (typeof window === 'undefined') return null
  const ctor = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper
  return ctor ?? null
}

export const ColorWell = ({
  color,
  fallback,
  label,
  open,
  onToggle,
  data,
  size = 'md'
}: {
  color: string | null
  fallback: string
  label: string
  open: boolean
  onToggle: () => void
  data?: Record<`data-${string}`, string>
  size?: 'sm' | 'md'
}): JSX.Element => (
  <button
    type="button"
    aria-label={label}
    aria-expanded={open}
    title={label}
    onClick={onToggle}
    {...data}
    className={`studio-press relative shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ${
      open ? 'ring-2 ring-lime' : 'ring-white/15 hover:ring-white/40'
    } ${size === 'sm' ? 'h-6 w-6' : 'h-7 w-9'}`}
  >
    <span className="studio-checker absolute inset-0" aria-hidden="true" />
    <span className="absolute inset-0" style={{ background: color ?? fallback }} aria-hidden="true" />
    {color == null ? (
      <span
        className="absolute inset-x-0 bottom-0 bg-black/55 text-center font-cond text-[8px] font-bold uppercase leading-[11px] tracking-wider text-muted"
        aria-hidden="true"
      >
        Auto
      </span>
    ) : null}
  </button>
)

const padHandler = (
  onMove: (x: number, y: number) => void,
  onEnd: () => void
): ((event: ReactPointerEvent<HTMLDivElement>) => void) => {
  return (event) => {
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    const read = (clientX: number, clientY: number): void => {
      const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
      const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0
      onMove(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)))
    }
    el.setPointerCapture(event.pointerId)
    read(event.clientX, event.clientY)
    const move = (next: PointerEvent): void => read(next.clientX, next.clientY)
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      onEnd()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
}

/**
 * Inline picker. `onChange(hex, final)` fires live while dragging (`final: false`)
 * and once when a choice settles (swatch, hex entry, eyedropper, pointer up).
 */
export const ColorPicker = ({
  value,
  fallback,
  recent,
  onChange,
  onClear,
  clearLabel = 'Default',
  name
}: {
  value: string | null
  fallback: string
  recent: readonly string[]
  onChange: (hex: string, final: boolean) => void
  onClear?: () => void
  clearLabel?: string
  name: string
}): JSX.Element => {
  const shown = value ?? fallback
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(shown) ?? { h: 0, s: 0, v: 1 })
  const [hex, setHex] = useState(shown)
  const live = useRef(shown)

  useEffect(() => {
    if (live.current === shown) return
    live.current = shown
    const next = hexToHsv(shown)
    if (next) setHsv((prev) => ({ ...next, h: next.s === 0 ? prev.h : next.h }))
    setHex(shown)
  }, [shown])

  const emit = (next: Hsv, final: boolean): void => {
    setHsv(next)
    const out = hsvToHex(next)
    live.current = out
    setHex(out)
    onChange(out, final)
  }

  const pick = (color: string): void => {
    const parsed = normalizeHex(color)
    if (!parsed) return
    const next = hexToHsv(parsed)
    if (next) setHsv(next)
    live.current = parsed
    setHex(parsed)
    onChange(parsed, true)
  }

  const sv = padHandler(
    (x, y) => emit({ h: hsv.h, s: x, v: 1 - y }, false),
    () => onChange(live.current, true)
  )
  const hue = padHandler(
    (x) => emit({ ...hsv, h: x * 359.9 }, false),
    () => onChange(live.current, true)
  )

  const Dropper = eyeDropper()
  const commitHex = (): void => {
    const parsed = normalizeHex(hex)
    if (parsed) pick(parsed)
    else setHex(shown)
  }

  return (
    <div
      className="studio-pop grid gap-2.5 rounded-xl bg-black/50 p-2.5 ring-1 ring-white/[0.08]"
      data-color-picker={name}
    >
      <div
        className="studio-sv relative h-28 cursor-crosshair touch-none rounded-lg"
        style={{ backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
        onPointerDown={sv}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={shown}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.02
          const moves: Record<string, Partial<Hsv>> = {
            ArrowLeft: { s: hsv.s - step },
            ArrowRight: { s: hsv.s + step },
            ArrowUp: { v: hsv.v + step },
            ArrowDown: { v: hsv.v - step }
          }
          const move = moves[event.key]
          if (!move) return
          event.preventDefault()
          event.stopPropagation()
          emit(
            {
              h: hsv.h,
              s: Math.min(1, Math.max(0, move.s ?? hsv.s)),
              v: Math.min(1, Math.max(0, move.v ?? hsv.v))
            },
            true
          )
        }}
      >
        <span
          className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-[0_0_0_1px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: shown }}
          aria-hidden="true"
        />
      </div>
      <div
        className="studio-hue relative h-3 cursor-ew-resize touch-none rounded-full"
        onPointerDown={hue}
        role="slider"
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 20 : 4
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          event.stopPropagation()
          emit({ ...hsv, h: (hsv.h + (event.key === 'ArrowLeft' ? -step : step) + 360) % 360 }, true)
        }}
      >
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, background: hsvToHex({ h: hsv.h, s: 1, v: 1 }) }}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-black/50 px-2 ring-1 ring-white/[0.08] focus-within:ring-lime/60">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-white/20" style={{ background: shown }} aria-hidden="true" />
          <input
            type="text"
            value={hex}
            spellCheck={false}
            maxLength={7}
            aria-label="Hex color"
            data-color-hex={name}
            onChange={(event) => setHex(event.target.value.toUpperCase())}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitHex()
            }}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] uppercase text-text outline-none"
          />
        </label>
        {Dropper ? (
          <button
            type="button"
            aria-label="Pick a color from the screen"
            title="Eyedropper"
            data-color-eyedropper={name}
            onClick={() => {
              void new Dropper()
                .open()
                .then((result) => pick(result.sRGBHex))
                .catch(() => undefined)
            }}
            className="studio-press inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.05] text-muted ring-1 ring-white/[0.08] hover:text-lime"
          >
            <Pipette size={14} />
          </button>
        ) : null}
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            disabled={value == null}
            data-color-clear={name}
            title={`Reset to ${clearLabel}`}
            aria-label={`Reset to ${clearLabel}`}
            className="studio-press inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white/[0.05] text-muted ring-1 ring-white/[0.08] hover:text-text disabled:opacity-35"
          >
            <RotateCcw size={13} />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-7 gap-1" data-color-palette={name}>
        {STUDIO_PALETTE.map((swatch) => {
          const active = value === swatch
          return (
            <button
              key={swatch}
              type="button"
              aria-label={`Use ${swatch}`}
              aria-pressed={active}
              onClick={() => pick(swatch)}
              className={`studio-press relative aspect-square cursor-pointer rounded-md ring-1 ${
                active ? 'ring-2 ring-lime' : 'ring-white/10 hover:ring-white/40'
              }`}
              style={{ background: swatch }}
            >
              {active ? <Check size={12} className="absolute inset-0 m-auto text-bg" /> : null}
            </button>
          )
        })}
      </div>
      {recent.length > 0 ? (
        <div className="grid gap-1" data-color-recent={name}>
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Recent</span>
          <div className="flex flex-wrap gap-1">
            {recent.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use recent ${swatch}`}
                onClick={() => pick(swatch)}
                className="studio-press h-5 w-5 cursor-pointer rounded-md ring-1 ring-white/10 hover:ring-white/40"
                style={{ background: swatch }}
              />
            ))}
          </div>
        </div>
      ) : null}
      {hudColorIsFaint(value) ? (
        <p className="text-[11px] text-air/90">Low contrast against dark video — may be hard to read.</p>
      ) : null}
    </div>
  )
}
