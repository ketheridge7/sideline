import { useEffect, useState, type CSSProperties, type JSX, type ReactNode } from 'react'

export const SectionHeader = ({
  title,
  hint,
  action
}: {
  title: string
  hint?: ReactNode
  action?: ReactNode
}): JSX.Element => (
  <div className="flex items-end justify-between gap-2">
    <div className="grid min-w-0 gap-0.5">
      <h3 className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{title}</h3>
      {hint ? <p className="text-[11px] leading-snug text-muted/80">{hint}</p> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
)

export const IconButton = ({
  label,
  onClick,
  disabled,
  active,
  children,
  data
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: ReactNode
  data?: Record<`data-${string}`, string>
}): JSX.Element => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    {...data}
    className={`studio-press inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-text disabled:opacity-30 disabled:hover:bg-transparent ${
      active ? 'bg-lime/10 text-lime' : ''
    }`}
  >
    {children}
  </button>
)

export const TextButton = ({
  children,
  onClick,
  disabled,
  tone = 'quiet',
  data,
  title
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'quiet' | 'accent'
  data?: Record<`data-${string}`, string>
  title?: string
}): JSX.Element => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    {...data}
    className={`studio-press inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] disabled:opacity-35 ${
      tone === 'accent'
        ? 'bg-lime/12 text-lime ring-1 ring-lime/50 hover:bg-lime/20'
        : 'bg-white/[0.04] text-muted ring-1 ring-white/[0.07] hover:bg-white/[0.08] hover:text-text'
    }`}
  >
    {children}
  </button>
)

export type SegmentOption<T extends string> = { id: T; label: string; icon?: ReactNode }

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  label,
  name
}: {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (next: T) => void
  label: string
  name: string
}): JSX.Element => {
  const index = Math.max(0, options.findIndex((row) => row.id === value))
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-studio-segment={name}
      className="relative grid rounded-lg bg-black/40 p-0.5 ring-1 ring-white/[0.06]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="studio-tab-indicator pointer-events-none absolute bottom-0.5 left-0.5 top-0.5 rounded-md bg-white/[0.09] ring-1 ring-lime/40"
        style={{
          width: `calc((100% - 4px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`
        }}
      />
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-segment-option={`${name}-${option.id}`}
            onClick={() => onChange(option.id)}
            className={`studio-press relative z-[1] flex min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md px-1 py-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] ${
              active ? 'text-lime' : 'text-muted hover:text-text'
            }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export const Toggle = ({
  label,
  hint,
  checked,
  onChange,
  name
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (next: boolean) => void
  name: string
}): JSX.Element => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    data-studio-toggle={name}
    onClick={() => onChange(!checked)}
    className="studio-press group flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]"
  >
    <span className="grid min-w-0">
      <span className="font-cond text-[12px] font-bold uppercase tracking-[0.1em] text-text">{label}</span>
      {hint ? <span className="truncate text-[11px] text-muted">{hint}</span> : null}
    </span>
    <span
      aria-hidden="true"
      className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-lime' : 'bg-white/[0.12]'
      }`}
    >
      <span
        className={`absolute top-[3px] h-3 w-3 rounded-full shadow transition-transform duration-200 ${
          checked ? 'translate-x-[17px] bg-bg' : 'translate-x-[3px] bg-muted'
        }`}
      />
    </span>
  </button>
)

/** Range + typed value. The number field commits on blur or Enter so half-typed values don't jump the HUD. */
export const StudioSlider = ({
  label,
  value,
  min,
  max,
  unit = '%',
  disabled,
  onChange,
  name
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  disabled?: boolean
  onChange: (value: number) => void
  name?: string
}): JSX.Element => {
  const rounded = Math.round(value)
  const [typed, setTyped] = useState<string | null>(null)
  useEffect(() => setTyped(null), [rounded])
  const fill = max > min ? ((Math.min(max, Math.max(min, rounded)) - min) / (max - min)) * 100 : 0
  const commitTyped = (): void => {
    if (typed == null) return
    const next = Number(typed)
    setTyped(null)
    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <div className="grid gap-0.5" data-studio-slider={name ?? label}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate whitespace-nowrap font-cond text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
          {label}
        </span>
        <label className="flex shrink-0 items-center gap-0.5 rounded-md bg-black/40 px-1.5 py-0.5 ring-1 ring-white/[0.06] focus-within:ring-lime/60">
          <input
            type="number"
            className="studio-number w-7 bg-transparent text-right font-cond text-[12px] font-bold tabular-nums text-text outline-none disabled:opacity-40"
            aria-label={`${label} value`}
            min={min}
            max={max}
            value={typed ?? String(rounded)}
            disabled={disabled}
            onChange={(event) => setTyped(event.target.value)}
            onBlur={commitTyped}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitTyped()
              if (event.key === 'Escape') setTyped(null)
            }}
          />
          <span className="text-[10px] text-muted">{unit}</span>
        </label>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={rounded}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="studio-range"
        style={{ '--fill': `${fill}%` } as CSSProperties}
        aria-label={label}
      />
    </div>
  )
}
