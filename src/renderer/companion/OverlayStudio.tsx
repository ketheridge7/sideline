import { useEffect, useState, type JSX, type MouseEvent } from 'react'
import {
  applyPreset,
  overwritePreset,
  PRESET_LABELS,
  PRESET_PLACEMENTS,
  OVERLAY_PRESET_IDS,
  type OverlayLayout,
  type OverlayPresetId
} from '@shared/overlayLayout'
import {
  applyStudioSlider,
  STUDIO_BLOCK_IDS,
  STUDIO_BLOCK_LABELS,
  studioBlockBox,
  type StudioBlockId
} from '@shared/overlayStudioBlocks'
import type { AppState } from '@shared/types'
import { toOverlayHud } from '@shared/types'
import { HUD_TEXT_SHADOW, hudWidgetFill, resolveDensity, smokeFill } from '../overlay/density'
import { OverlayWidgetView } from '../overlay/Widgets'
import studioPlateUrl from '../assets/studio-plate.jpg'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const EdgeChevrons = ({ direction }: { direction: 'left' | 'right' }): JSX.Element => (
  <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true" className="block">
    {[0, 1, 2].map((index) => {
      const x = 1 + index * 8.5
      const path =
        direction === 'right' ? `M${x} 0.75 L${x + 4.5} 8 L${x} 15.25` : `M${x + 4.5} 0.75 L${x} 8 L${x + 4.5} 15.25`
      return (
        <path
          key={index}
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    })}
  </svg>
)

const PREVIEW_W = 1280
const PREVIEW_H = 720
const PREVIEW_SCALE = 0.2
const BLOCK_OUTLINE_PX = 12
const BLOCK_OUTLINE_OFFSET_PX = 8

const Slider = ({
  label,
  value,
  min,
  max,
  disabled,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
}): JSX.Element => (
  <label className="grid gap-1 text-xs uppercase tracking-wide text-muted">
    <span className="flex items-center justify-between">
      {label}
      <span className="tabular-nums text-text">{Math.round(value)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      value={Math.round(value)}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="accent-you disabled:opacity-40"
      aria-label={label}
    />
  </label>
)

export const OverlayStudio = ({
  state,
  initialSelectedBlock = null
}: {
  state: AppState
  initialSelectedBlock?: StudioBlockId | null
}): JSX.Element => {
  const [draft, setDraft] = useState<OverlayLayout | null>(null)
  const [selected, setSelected] = useState<StudioBlockId | null>(initialSelectedBlock)
  const [collapsed, setCollapsed] = useState(false)
  const layout = draft ?? state.overlayLayout
  const hud = toOverlayHud(state)
  const target = selected ? studioBlockBox(layout, selected) : null

  useEffect(() => {
    setDraft(null)
  }, [state.overlayLayout])

  const save = (next: OverlayLayout): void => {
    setDraft(next)
    void api().setOverlayLayout(next)
  }

  const handlePreset = (presetId: OverlayPresetId): void => {
    save(applyPreset(presetId, layout))
  }

  const handleBox = (next: Partial<ReturnType<typeof studioBlockBox>>): void => {
    save(applyStudioSlider(layout, selected, next))
  }

  const handlePreviewClick = (): void => {
    setSelected(null)
  }

  const handleBlockClick = (event: MouseEvent<HTMLButtonElement>, id: StudioBlockId): void => {
    event.stopPropagation()
    setSelected(id)
  }

  const handleEdge = (): void => {
    setCollapsed((open) => !open)
  }

  return (
    <aside
      className={`relative flex h-full shrink-0 flex-col overflow-hidden border-l border-line bg-card transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-11' : 'w-[280px]'
      }`}
      data-studio-collapsed={collapsed ? 'true' : 'false'}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={handleEdge}
          aria-expanded={false}
          aria-label="Expand overlay studio"
          data-studio-edge=""
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center gap-3 pt-2 text-text hover:text-lime"
        >
          <EdgeChevrons direction="left" />
          <span className="font-cond text-base font-bold uppercase tracking-[0.14em] [writing-mode:vertical-rl]">
            Overlay Studio
          </span>
        </button>
      ) : null}
      <div
        className={`flex h-full w-[280px] min-w-[280px] flex-col transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-x-[236px]' : 'translate-x-0'
        }`}
        inert={collapsed}
        aria-hidden={collapsed}
      >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="font-cond text-base font-bold uppercase tracking-[0.14em] text-text">Overlay Studio</h2>
        <button
          type="button"
          onClick={handleEdge}
          aria-expanded
          aria-label="Collapse overlay studio"
          data-studio-edge=""
          className="flex cursor-pointer items-center justify-center text-text hover:text-lime"
        >
          <EdgeChevrons direction="right" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 text-sm">
        <div className="grid gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">Preset</span>
          <div className="studio-presets" data-active-preset={layout.presetId}>
            {OVERLAY_PRESET_IDS.map((id) => {
              const active = layout.presetId === id
              return (
                <button
                  key={id}
                  type="button"
                  data-preset={id}
                  onClick={() => handlePreset(id)}
                  className={`cursor-pointer border px-1 py-1.5 font-cond text-sm font-bold ${
                    active ? 'studio-preset-active border-lime bg-lime/15 text-lime' : 'border-line text-muted'
                  }`}
                  aria-pressed={active}
                  aria-label={`${PRESET_LABELS[id]}, ${PRESET_PLACEMENTS[id]}`}
                >
                  {id}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className="relative aspect-video overflow-hidden bg-[#0c2418]"
          data-studio-preview="hud"
          onClick={handlePreviewClick}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${studioPlateUrl})`, filter: 'saturate(0.8) brightness(0.72)' }}
            data-studio-plate="game"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(7,8,10,0.6) 100%)' }}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              transform: `scale(${PREVIEW_SCALE})`
            }}
          >
            {layout.widgets.map((widget) => {
              if (widget.hidden) return null
              const fill = smokeFill('desktop', widget.opacity)
              return (
                <div
                  key={widget.id}
                  className="hud-widget hud-frost pointer-events-none absolute overflow-visible"
                  data-density={resolveDensity('desktop', widget.density)}
                  style={{
                    left: `${widget.x}%`,
                    top: `${widget.y}%`,
                    width: `${widget.w}%`,
                    height: `${widget.h}%`,
                    background: hudWidgetFill(fill),
                    color: '#F4F6F8',
                    textShadow: HUD_TEXT_SHADOW
                  }}
                >
                  {widget.id === 'ticker.nfl' && hud.nflTicker.length === 0 ? (
                    <div className="flex h-full w-full flex-col justify-end">
                      <div className="hud-type-ticker flex w-full items-center bg-black/55 px-[0.75em] text-muted">
                        Ticker
                      </div>
                    </div>
                  ) : (
                    <OverlayWidgetView
                      id={widget.id}
                      hud={hud}
                      surface="desktop"
                      density={widget.density}
                      showCrawler={layout.showCrawler}
                    />
                  )}
                </div>
              )
            })}
            {STUDIO_BLOCK_IDS.map((id) => {
              const box = studioBlockBox(layout, id)
              const active = selected === id
              return (
                <button
                  key={id}
                  type="button"
                  data-studio-block={id}
                  aria-pressed={active}
                  aria-label={`Select ${STUDIO_BLOCK_LABELS[id]}`}
                  className={`absolute cursor-pointer bg-transparent ${
                    active ? 'studio-block-active' : 'studio-block-idle'
                  }`}
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.w}%`,
                    height: `${box.h}%`,
                    outline: active ? `${BLOCK_OUTLINE_PX}px solid #A6E6A0` : '4px solid transparent',
                    outlineOffset: BLOCK_OUTLINE_OFFSET_PX,
                    zIndex: 2
                  }}
                  onClick={(event) => handleBlockClick(event, id)}
                />
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted" data-studio-slider-target={selected ?? 'none'}>
          {selected
            ? `Moving ${STUDIO_BLOCK_LABELS[selected]}`
            : 'Click your team, their team, or the ticker. Sliders move that block only.'}
        </p>

        <Slider
          label="Position X"
          value={target?.x ?? 0}
          min={0}
          max={96}
          disabled={!selected}
          onChange={(x) => handleBox({ x })}
        />
        <Slider
          label="Position Y"
          value={target?.y ?? 0}
          min={0}
          max={96}
          disabled={!selected}
          onChange={(y) => handleBox({ y })}
        />
        <Slider
          label="Width"
          value={target?.w ?? 0}
          min={selected === 'ticker' ? 24 : 8}
          max={100}
          disabled={!selected}
          onChange={(w) => handleBox({ w })}
        />
        <Slider
          label="Height"
          value={target?.h ?? 0}
          min={selected === 'ticker' ? 4 : 12}
          max={90}
          disabled={!selected}
          onChange={(h) => handleBox({ h })}
        />

        <button
          type="button"
          onClick={() => save(overwritePreset(layout))}
          className="cursor-pointer border border-line px-2 py-1.5 text-xs uppercase tracking-wide text-muted hover:text-text"
        >
          Save over {PRESET_LABELS[layout.presetId]}
        </button>
      </div>
      </div>
    </aside>
  )
}
