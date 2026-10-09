import { RotateCcw } from 'lucide-react'
import { useState, type JSX } from 'react'
import {
  DEFAULT_HUD_STYLE,
  HUD_BACKDROP_LABELS,
  HUD_BACKDROPS,
  HUD_EDGE_LABELS,
  HUD_EDGES,
  HUD_FONT_LABELS,
  HUD_FONT_STACKS,
  HUD_FONTS,
  HUD_OPACITY_RANGE,
  HUD_RADIUS_RANGE,
  HUD_SHADOW_CSS,
  HUD_SHADOW_LABELS,
  HUD_SHADOWS,
  HUD_SIZE_LABELS,
  HUD_SIZES,
  pushRecentColor,
  sameHudStyle,
  type HudBackdrop,
  type HudStyle
} from '@shared/hudStyle'
import type { OverlayLayout } from '@shared/overlayLayout'
import { hudPlateStyle } from '../../overlay/look'
import studioPlateUrl from '../../assets/studio-plate.jpg'
import { ColorPicker, ColorWell } from './ColorPicker'
import { SectionHeader, Segmented, StudioSlider, TextButton } from './controls'
import type { Commit } from './StudioLayoutTab'

type ColorTarget = 'tint' | 'accent'

const BackdropTile = ({
  backdrop,
  style,
  active,
  onPick
}: {
  backdrop: HudBackdrop
  style: HudStyle
  active: boolean
  onPick: () => void
}): JSX.Element => {
  const paint = hudPlateStyle({ ...style, backdrop, opacity: backdrop === 'none' ? style.opacity : Math.max(style.opacity, 45) }, 'left')
  return (
    <button
      type="button"
      data-style-backdrop={backdrop}
      aria-pressed={active}
      onClick={onPick}
      className={`studio-preset-card grid cursor-pointer gap-1 rounded-lg border p-1 ${
        active ? 'studio-preset-active' : 'border-white/[0.07] bg-white/[0.02] text-muted hover:border-white/20 hover:text-text'
      }`}
    >
      <span
        className="relative block aspect-[4/3] overflow-hidden rounded-md bg-cover bg-center [container-type:size]"
        style={{ backgroundImage: `url(${studioPlateUrl})`, filter: 'saturate(0.85)' }}
        aria-hidden="true"
      >
        <span className="absolute inset-[18%_22%] block" style={paint ?? undefined}>
          <span className="absolute inset-x-[14%] top-[18%] block h-[14%] rounded-sm bg-lime/90" />
          <span className="absolute inset-x-[14%] top-[42%] block h-[10%] rounded-sm bg-white/85" />
          <span className="absolute inset-x-[14%] top-[62%] block h-[10%] rounded-sm bg-white/70" />
        </span>
      </span>
      <span className="text-center font-cond text-[10px] font-bold uppercase tracking-[0.1em]">{HUD_BACKDROP_LABELS[backdrop]}</span>
    </button>
  )
}

export const StudioStyleTab = ({ layout, commit }: { layout: OverlayLayout; commit: Commit }): JSX.Element => {
  const [open, setOpen] = useState<ColorTarget | null>(null)
  const style = layout.style
  const setStyle = (patch: Partial<HudStyle>, key: string, remember?: string): void => {
    const library = remember ? { ...layout.library, recentColors: pushRecentColor(layout.library.recentColors, remember) } : layout.library
    commit({ ...layout, style: { ...style, ...patch }, library }, key)
  }
  const plated = style.backdrop !== 'none'

  return (
    <div className="grid grid-cols-1 gap-5" data-studio-section="style">
      <section className="grid gap-2">
        <SectionHeader
          title="Backdrop"
          hint="A plate behind each team frame. None keeps the frosted Sunday Tape look."
          action={
            <TextButton
              disabled={sameHudStyle(style, DEFAULT_HUD_STYLE)}
              onClick={() => commit({ ...layout, style: { ...DEFAULT_HUD_STYLE } }, 'style:reset')}
              data={{ 'data-style-reset': '' }}
              title="Back to the Sunday Tape look"
            >
              <RotateCcw size={11} />
              Reset
            </TextButton>
          }
        />
        <div className="grid grid-cols-4 gap-1.5">
          {HUD_BACKDROPS.map((backdrop) => (
            <BackdropTile
              key={backdrop}
              backdrop={backdrop}
              style={style}
              active={style.backdrop === backdrop}
              onPick={() => setStyle({ backdrop }, `style:backdrop:${backdrop}`)}
            />
          ))}
        </div>
        <div className={`studio-card grid gap-2.5 p-2.5 transition-opacity duration-200 ${plated ? '' : 'opacity-60'}`}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <StudioSlider
              name="opacity"
              label="Strength"
              value={style.opacity}
              min={HUD_OPACITY_RANGE.min}
              max={HUD_OPACITY_RANGE.max}
              disabled={!plated}
              onChange={(opacity) => setStyle({ opacity }, 'style:opacity')}
            />
            <StudioSlider
              name="radius"
              label="Corners"
              unit="px"
              value={style.radius}
              min={HUD_RADIUS_RANGE.min}
              max={HUD_RADIUS_RANGE.max}
              disabled={!plated && style.edge !== 'outline'}
              onChange={(radius) => setStyle({ radius }, 'style:radius')}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="grid">
              <span className="font-cond text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Tint</span>
              <span className="font-mono text-[11px] uppercase text-text">{style.tint}</span>
            </span>
            <ColorWell
              color={style.tint}
              fallback={style.tint}
              label="Plate tint"
              open={open === 'tint'}
              onToggle={() => setOpen((prev) => (prev === 'tint' ? null : 'tint'))}
              data={{ 'data-style-tint': '' }}
            />
          </div>
          {open === 'tint' ? (
            <ColorPicker
              name="tint"
              value={style.tint}
              fallback={DEFAULT_HUD_STYLE.tint}
              recent={layout.library.recentColors}
              onChange={(tint, final) => setStyle({ tint }, 'style:tint', final ? tint : undefined)}
              onClear={() => setStyle({ tint: DEFAULT_HUD_STYLE.tint }, 'style:tint:reset')}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="Edge" hint="A broadcast rule on the outside edge, or a thin outline." />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Segmented
              name="edge"
              label="Edge"
              value={style.edge}
              options={HUD_EDGES.map((id) => ({ id, label: HUD_EDGE_LABELS[id] }))}
              onChange={(edge) => setStyle({ edge }, `style:edge:${edge}`)}
            />
          </div>
          <ColorWell
            color={style.accent}
            fallback={style.accent}
            label="Edge accent color"
            open={open === 'accent'}
            onToggle={() => setOpen((prev) => (prev === 'accent' ? null : 'accent'))}
            data={{ 'data-style-accent': '' }}
          />
        </div>
        {open === 'accent' ? (
          <ColorPicker
            name="accent"
            value={style.accent}
            fallback={DEFAULT_HUD_STYLE.accent}
            recent={layout.library.recentColors}
            onChange={(accent, final) => setStyle({ accent }, 'style:accent', final ? accent : undefined)}
            onClear={() => setStyle({ accent: DEFAULT_HUD_STYLE.accent }, 'style:accent:reset')}
            clearLabel="Lime"
          />
        ) : null}
      </section>

      <section className="grid gap-2">
        <SectionHeader title="Typeface" />
        <div className="grid grid-cols-3 gap-1.5" data-studio-typefaces="">
          {HUD_FONTS.map((font) => {
            const active = style.font === font
            return (
              <button
                key={font}
                type="button"
                data-style-font={font}
                aria-pressed={active}
                onClick={() => setStyle({ font }, `style:font:${font}`)}
                className={`studio-preset-card grid cursor-pointer justify-items-center gap-0.5 rounded-lg border px-0.5 py-1.5 ${
                  active ? 'studio-preset-active' : 'border-white/[0.07] bg-white/[0.02] text-muted hover:border-white/20 hover:text-text'
                }`}
              >
                <span
                  className="text-[22px] font-extrabold leading-none tabular-nums text-text"
                  style={{ fontFamily: HUD_FONT_STACKS[font], textShadow: HUD_SHADOW_CSS[style.shadow] }}
                >
                  98.4
                </span>
                <span className="max-w-full truncate font-cond text-[10px] font-bold uppercase tracking-[0.1em]">
                  {HUD_FONT_LABELS[font]}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="grid gap-2">
        <SectionHeader title="Text size" hint="Auto follows each preset." />
        <Segmented
          name="size"
          label="Text size"
          value={layout.display.size}
          options={HUD_SIZES.map((id) => ({ id, label: HUD_SIZE_LABELS[id] }))}
          onChange={(size) => commit({ ...layout, display: { ...layout.display, size } }, `display:size:${size}`)}
        />
      </section>

      <section className="grid gap-2">
        <SectionHeader title="Legibility" hint="Glyph shadow. Bold helps on bright day games." />
        <Segmented
          name="shadow"
          label="Glyph shadow"
          value={style.shadow}
          options={HUD_SHADOWS.map((id) => ({ id, label: HUD_SHADOW_LABELS[id] }))}
          onChange={(shadow) => setStyle({ shadow }, `style:shadow:${shadow}`)}
        />
      </section>
    </div>
  )
}
