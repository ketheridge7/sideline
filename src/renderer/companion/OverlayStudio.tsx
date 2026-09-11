import { type JSX } from 'react'
import {
  applyPreset,
  hudGroupBox,
  overwritePreset,
  PRESET_LABELS,
  PRESET_PLACEMENTS,
  setHudGroupBox,
  OVERLAY_PRESET_IDS,
  type OverlayLayout,
  type OverlayPresetId
} from '@shared/overlayLayout'
import type { AppState } from '@shared/types'
import { toOverlayHud } from '@shared/types'
import { HUD_TEXT_SHADOW, hudWidgetFill, resolveDensity, smokeFill } from '../overlay/density'
import { OverlayWidgetView } from '../overlay/Widgets'
import { NflTicker } from './NflTicker'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const PREVIEW_W = 1280
const PREVIEW_H = 720

const Slider = ({
  label,
  value,
  min,
  max,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
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
      onChange={(event) => onChange(Number(event.target.value))}
      className="accent-you"
      aria-label={label}
    />
  </label>
)

export const OverlayStudio = ({
  state,
  onClose
}: {
  state: AppState
  onClose: () => void
}): JSX.Element => {
  const layout = state.overlayLayout
  const hud = toOverlayHud(state)
  const box = hudGroupBox(layout)

  const save = (next: OverlayLayout): void => {
    void api().setOverlayLayout(next)
  }

  const handlePreset = (presetId: OverlayPresetId): void => {
    save(applyPreset(presetId, layout))
  }

  const handleBox = (next: Partial<typeof box>): void => {
    save(setHudGroupBox(layout, { ...box, ...next }))
  }

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-l border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="font-cond text-sm font-bold uppercase tracking-[0.16em]">Overlay Studio</h2>
        <button type="button" onClick={onClose} className="cursor-pointer text-xs text-muted hover:text-text">
          Close
        </button>
      </div>

      <div className="grid gap-3 overflow-auto p-3 text-sm">
        <button
          type="button"
          onClick={() => void api().toggleOverlay()}
          className={`cursor-pointer border px-2 py-1.5 text-xs font-semibold uppercase ${
            state.overlayVisible ? 'border-lime text-lime' : 'border-line text-muted'
          }`}
          aria-pressed={state.overlayVisible}
        >
          HUD {state.overlayVisible ? 'on' : 'off'}
        </button>

        {!state.overlayVisible ? (
          <p className="text-xs text-muted">HUD is off — layout still applies when you turn it on.</p>
        ) : null}

        <div className="grid gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">Preset</span>
          <div className="grid grid-cols-5 gap-1">
            {OVERLAY_PRESET_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => handlePreset(id)}
                className={`cursor-pointer border px-1 py-1.5 font-cond text-sm font-bold ${
                  layout.presetId === id ? 'border-you text-you' : 'border-line text-muted'
                }`}
                aria-pressed={layout.presetId === id}
                aria-label={`${PRESET_LABELS[id]}, ${PRESET_PLACEMENTS[id]}`}
              >
                {id}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {PRESET_LABELS[layout.presetId]} · {PRESET_PLACEMENTS[layout.presetId]}. You left, them right.
          </p>
        </div>

        <div className="relative aspect-video overflow-hidden bg-[#0c2418]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(34,90,52,0.9) 0%, rgba(12,36,24,0.95) 52%, #07080a 100%)'
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-0 top-0 origin-top-left"
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              transform: 'scale(0.2)'
            }}
          >
            {layout.widgets.map((widget) => {
              if (widget.hidden) return null
              const fill = smokeFill('desktop', widget.opacity)
              return (
                <div
                  key={widget.id}
                  className="hud-widget hud-frost absolute overflow-visible"
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
                  <OverlayWidgetView
                    id={widget.id}
                    hud={hud}
                    surface="desktop"
                    density={widget.density}
                    showCrawler={layout.showCrawler}
                  />
                </div>
              )
            })}
            {hud.nflTicker.length > 0 ? (
              <div className="absolute bottom-0 left-0 right-0">
                <NflTicker games={hud.nflTicker} variant="overlay" />
              </div>
            ) : null}
          </div>
        </div>

        <Slider label="Position X" value={box.x} min={0} max={80} onChange={(x) => handleBox({ x })} />
        <Slider label="Position Y" value={box.y} min={0} max={70} onChange={(y) => handleBox({ y })} />
        <Slider label="Width" value={box.w} min={20} max={100} onChange={(w) => handleBox({ w })} />
        <Slider label="Height" value={box.h} min={20} max={90} onChange={(h) => handleBox({ h })} />

        <button
          type="button"
          onClick={() => save(overwritePreset(layout))}
          className="cursor-pointer border border-line px-2 py-1.5 text-xs uppercase tracking-wide text-muted hover:text-text"
        >
          Save over {PRESET_LABELS[layout.presetId]}
        </button>
      </div>
    </aside>
  )
}
