import { RotateCcw } from 'lucide-react'
import { useState, type FocusEvent, type JSX } from 'react'
import {
  EMPTY_HUD_TEXT_COLORS,
  HUD_FONT_SWATCHES,
  HUD_TEXT_ROLES,
  HUD_TEXT_ROLE_LABELS,
  hudColorIsFaint,
  hudTextColorsCustom,
  type HudTextColors,
  type HudTextHighlight,
  type HudTextRole
} from '@shared/overlayLayout'
import { ColorPicker, ColorWell } from './studio/ColorPicker'
import { SectionHeader, TextButton } from './studio/controls'

const ICE = '#F4F6F8'

/** Sunday Tape ink per role when nothing is set, so an "Auto" well still shows what paints. */
const ROLE_DEFAULT_INK: Record<HudTextRole, string> = {
  playerName: '#FFFFFF',
  teamName: '#B6FF3B',
  teamScore: '#F8FBFF',
  playerScore: '#FFFFFF'
}

export type TextColorChange = {
  /** Undo grouping. The same key inside a short window is one step. */
  key: string
  /** A settled choice worth remembering in Recent. */
  remember?: string
}

type PickerTarget = HudTextRole | 'all'

const ContrastHint = ({ id }: { id: string }): JSX.Element => (
  <span
    className="rounded-full bg-air/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-air/90 ring-1 ring-air/30"
    data-contrast-hint={id}
  >
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
    className={`studio-press grid cursor-pointer justify-items-center gap-1 rounded-lg px-1 pb-1 pt-1.5 ring-1 ${
      active ? 'bg-lime/10 text-lime ring-lime/70' : 'bg-white/[0.03] text-muted ring-white/[0.06] hover:text-text hover:ring-white/20'
    }`}
  >
    <span
      className={`h-5 w-5 rounded-full ring-1 ${active ? 'ring-lime' : 'ring-black/40'}`}
      style={{ background: color ?? `linear-gradient(135deg, ${ICE} 0 50%, #B6FF3B 50% 100%)` }}
    />
    <span className="font-cond text-[10px] font-bold uppercase tracking-wide">{label}</span>
  </button>
)

const RoleRow = ({
  role,
  colors,
  open,
  recent,
  onToggle,
  onPick,
  onHighlight
}: {
  role: HudTextRole
  colors: HudTextColors
  open: boolean
  recent: readonly string[]
  onToggle: () => void
  onPick: (value: string | null, change: TextColorChange) => void
  onHighlight: (role: HudTextHighlight) => void
}): JSX.Element => {
  const label = HUD_TEXT_ROLE_LABELS[role]
  const override = colors[role]
  const effective = override ?? colors.all
  return (
    <div
      className={`grid gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 ${
        open ? 'bg-white/[0.04] ring-1 ring-white/[0.08]' : 'hover:bg-white/[0.03]'
      }`}
      data-text-row={role}
      onMouseEnter={() => onHighlight(role)}
      onFocusCapture={() => onHighlight(role)}
    >
      <div className="flex items-center gap-2">
        <ColorWell
          color={override}
          fallback={effective ?? ROLE_DEFAULT_INK[role]}
          label={`${label} color`}
          open={open}
          onToggle={onToggle}
          size="sm"
          data={{ 'data-font-custom': role }}
        />
        <span className="grid min-w-0 flex-1">
          <span className="font-cond text-[12px] font-bold uppercase tracking-wide text-text">{label}</span>
          <span className="truncate text-[10px] uppercase tracking-wide text-muted" data-text-inherit={role}>
            {override ?? 'Same as All'}
          </span>
        </span>
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
                title={swatch.label}
                onClick={() => onPick(swatch.color, { key: `text:${role}`, remember: swatch.color ?? undefined })}
                className={`studio-press h-4 w-4 cursor-pointer rounded-full ring-1 ${
                  active ? 'ring-2 ring-lime' : 'ring-black/50 hover:ring-white/50'
                }`}
                style={{ background: swatch.color ?? ICE }}
              />
            )
          })}
        </div>
        <button
          type="button"
          data-text-reset={role}
          disabled={override == null}
          onClick={() => onPick(null, { key: `text:${role}:reset` })}
          aria-label={`Reset ${label}`}
          title="Back to All"
          className="studio-press inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-white/[0.06] hover:text-text disabled:opacity-25"
        >
          <RotateCcw size={12} />
        </button>
      </div>
      {hudColorIsFaint(override) ? <ContrastHint id={role} /> : null}
      {open ? (
        <ColorPicker
          name={role}
          value={override}
          fallback={effective ?? ROLE_DEFAULT_INK[role]}
          recent={recent}
          onChange={(hex, final) => onPick(hex, { key: `text:${role}`, remember: final ? hex : undefined })}
          onClear={() => onPick(null, { key: `text:${role}:reset` })}
          clearLabel="Same as All"
        />
      ) : null}
    </div>
  )
}

export const StudioTextColors = ({
  colors,
  recent = [],
  onChange,
  onHighlight
}: {
  colors: HudTextColors
  recent?: readonly string[]
  onChange: (next: HudTextColors, change?: TextColorChange) => void
  onHighlight: (role: HudTextHighlight | null) => void
}): JSX.Element => {
  const [open, setOpen] = useState<PickerTarget | null>(null)
  const toggle = (target: PickerTarget): void => setOpen((prev) => (prev === target ? null : target))

  const leaveSection = (event: FocusEvent<HTMLElement>): void => {
    const next = event.relatedTarget
    if (next instanceof Node && event.currentTarget.contains(next)) return
    onHighlight(null)
  }

  return (
    <section
      className="grid grid-cols-1 gap-3"
      data-studio-section="text"
      onMouseLeave={() => onHighlight(null)}
      onBlurCapture={leaveSection}
    >
      <SectionHeader title="Text colors" hint="Hover a row to spotlight that text in the preview." />
      <div
        className="studio-card grid gap-2 p-2.5"
        data-studio-font={colors.all ?? 'default'}
        onMouseEnter={() => onHighlight('all')}
        onFocusCapture={() => onHighlight('all')}
      >
        <span className="flex items-center justify-between gap-2 font-cond text-[12px] font-bold uppercase tracking-[0.12em] text-text">
          All text
          {hudColorIsFaint(colors.all) ? <ContrastHint id="all" /> : null}
        </span>
        <div className="grid grid-cols-5 gap-1.5">
          {HUD_FONT_SWATCHES.map((swatch) => (
            <SwatchChip
              key={swatch.id}
              label={swatch.label}
              color={swatch.color}
              active={(colors.all ?? null) === swatch.color}
              onPick={() =>
                onChange({ ...colors, all: swatch.color }, { key: 'text:all', remember: swatch.color ?? undefined })
              }
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ColorWell
              color={colors.all}
              fallback={ICE}
              label="Custom font color"
              open={open === 'all'}
              onToggle={() => toggle('all')}
              data={{ 'data-font-custom': '' }}
            />
            <span className="grid">
              <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Custom</span>
              <span className="font-mono text-[11px] uppercase text-text">{colors.all ?? 'Ice (default)'}</span>
            </span>
          </div>
          <TextButton
            data={{ 'data-font-reset': '' }}
            disabled={colors.all == null}
            onClick={() => onChange({ ...colors, all: null }, { key: 'text:all:reset' })}
          >
            <RotateCcw size={11} />
            Reset
          </TextButton>
        </div>
        {open === 'all' ? (
          <ColorPicker
            name="all"
            value={colors.all}
            fallback={ICE}
            recent={recent}
            onChange={(hex, final) => onChange({ ...colors, all: hex }, { key: 'text:all', remember: final ? hex : undefined })}
            onClear={() => onChange({ ...colors, all: null }, { key: 'text:all:reset' })}
            clearLabel="Ice"
          />
        ) : null}
      </div>
      <div className="studio-card grid gap-1 p-1.5" data-studio-customize="">
        <span className="px-1.5 pt-1 font-cond text-[12px] font-bold uppercase tracking-[0.12em] text-text">
          Customize each
        </span>
        {HUD_TEXT_ROLES.map((role) => (
          <RoleRow
            key={role}
            role={role}
            colors={colors}
            open={open === role}
            recent={recent}
            onToggle={() => toggle(role)}
            onHighlight={onHighlight}
            onPick={(value, change) => onChange({ ...colors, [role]: value }, change)}
          />
        ))}
      </div>
      <TextButton
        data={{ 'data-font-reset-all': '' }}
        disabled={!hudTextColorsCustom(colors)}
        onClick={() => onChange({ ...EMPTY_HUD_TEXT_COLORS }, { key: 'text:reset-all' })}
      >
        Reset all colors
      </TextButton>
    </section>
  )
}
