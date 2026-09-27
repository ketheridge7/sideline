import { type FocusEvent, type JSX } from 'react'
import {
  EMPTY_HUD_TEXT_COLORS,
  HUD_FONT_SWATCHES,
  HUD_TEXT_ROLES,
  HUD_TEXT_ROLE_LABELS,
  hudColorIsFaint,
  hudTextColorsCustom,
  parseHudFontColor,
  type HudTextColors,
  type HudTextHighlight,
  type HudTextRole
} from '@shared/overlayLayout'

const ICE = '#F4F6F8'

const ContrastHint = ({ id }: { id: string }): JSX.Element => (
  <span className="text-[10px] normal-case tracking-normal text-muted" data-contrast-hint={id}>
    Hard to see on the HUD
  </span>
)

const SwatchChip = ({
  label,
  color,
  active,
  onPick
}: {
  label: string
  color: string | null
  active: boolean
  onPick: () => void
}): JSX.Element => (
  <button
    type="button"
    data-font-swatch={label.toLowerCase()}
    aria-pressed={active}
    aria-label={label}
    onClick={onPick}
    className={`grid cursor-pointer justify-items-center gap-0.5 border px-0.5 py-0.5 ${
      active ? 'border-lime text-lime' : 'border-line text-muted'
    }`}
  >
    <span className="h-3.5 w-full border border-line" style={{ background: color ?? ICE }} />
    <span className="font-cond text-[10px] font-bold uppercase tracking-wide">{label}</span>
  </button>
)

const RoleRow = ({
  role,
  colors,
  onPick,
  onHighlight
}: {
  role: HudTextRole
  colors: HudTextColors
  onPick: (value: string | null) => void
  onHighlight: (role: HudTextHighlight) => void
}): JSX.Element => {
  const label = HUD_TEXT_ROLE_LABELS[role]
  const override = colors[role]
  return (
    <div
      className="grid gap-0.5 border border-line px-1.5 py-1"
      data-text-row={role}
      onMouseEnter={() => onHighlight(role)}
      onFocusCapture={() => onHighlight(role)}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-cond text-[11px] font-bold uppercase tracking-wide text-text">{label}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted" data-text-inherit={role}>
          {override ?? 'Same as All'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {HUD_FONT_SWATCHES.filter((swatch) => swatch.color).map((swatch) => {
          const active = override === swatch.color
          return (
            <button
              key={swatch.id}
              type="button"
              data-role-swatch={`${role}-${swatch.id}`}
              aria-pressed={active}
              aria-label={`${label} ${swatch.label}`}
              onClick={() => onPick(swatch.color)}
              className={`h-4 w-4 cursor-pointer border ${active ? 'border-lime' : 'border-line'}`}
              style={{ background: swatch.color ?? ICE }}
            />
          )
        })}
        <input
          type="color"
          aria-label={`${label} custom color`}
          data-font-custom={role}
          value={override ?? colors.all ?? ICE}
          onChange={(event) => {
            const next = parseHudFontColor(event.target.value)
            if (next) onPick(next)
          }}
          className="h-5 w-7 cursor-pointer border border-line bg-transparent p-0"
        />
        <button
          type="button"
          data-text-reset={role}
          disabled={override == null}
          onClick={() => onPick(null)}
          className="ml-auto cursor-pointer border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted hover:text-text disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {hudColorIsFaint(override) ? <ContrastHint id={role} /> : null}
    </div>
  )
}

export const StudioTextColors = ({
  colors,
  onChange,
  onHighlight
}: {
  colors: HudTextColors
  onChange: (next: HudTextColors) => void
  onHighlight: (role: HudTextHighlight | null) => void
}): JSX.Element => {
  const leaveSection = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    onHighlight(null)
  }

  return (
    <section
      className="grid gap-1.5"
      data-studio-section="text"
      onMouseLeave={() => onHighlight(null)}
      onBlurCapture={leaveSection}
    >
      <h3 className="font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Text colors</h3>
      <div
        className="grid gap-1"
        data-studio-font={colors.all ?? 'default'}
        onMouseEnter={() => onHighlight('all')}
        onFocusCapture={() => onHighlight('all')}
      >
        <span className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted">
          All text
          {hudColorIsFaint(colors.all) ? <ContrastHint id="all" /> : null}
        </span>
        <div className="grid grid-cols-5 gap-1">
          {HUD_FONT_SWATCHES.map((swatch) => (
            <SwatchChip
              key={swatch.id}
              label={swatch.label}
              color={swatch.color}
              active={(colors.all ?? null) === swatch.color}
              onPick={() => onChange({ ...colors, all: swatch.color })}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted">
            Custom
            <input
              type="color"
              aria-label="Custom font color"
              data-font-custom=""
              value={colors.all ?? ICE}
              onChange={(event) => {
                const next = parseHudFontColor(event.target.value)
                if (next) onChange({ ...colors, all: next })
              }}
              className="h-5 w-8 cursor-pointer border border-line bg-transparent p-0"
            />
          </label>
          <button
            type="button"
            data-font-reset=""
            disabled={colors.all == null}
            onClick={() => onChange({ ...colors, all: null })}
            className="cursor-pointer border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted hover:text-text disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
      <details className="studio-customize" data-studio-customize="">
        <summary className="font-cond text-[11px] font-bold uppercase tracking-wide text-text">Customize each</summary>
        <div className="mt-1 grid gap-1">
          {HUD_TEXT_ROLES.map((role) => (
            <RoleRow
              key={role}
              role={role}
              colors={colors}
              onHighlight={onHighlight}
              onPick={(value) => onChange({ ...colors, [role]: value })}
            />
          ))}
        </div>
      </details>
      <button
        type="button"
        data-font-reset-all=""
        disabled={!hudTextColorsCustom(colors)}
        onClick={() => onChange({ ...EMPTY_HUD_TEXT_COLORS })}
        className="cursor-pointer border border-line px-2 py-1 text-[10px] uppercase tracking-wide text-muted hover:text-text disabled:opacity-40"
      >
        Reset all colors
      </button>
    </section>
  )
}
