import { useState, type JSX } from 'react'
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react'
import {
  applyPreset,
  DEFAULT_OVERLAY_PRESET,
  OVERLAY_PRESET_IDS,
  OVERLAY_WIDGET_IDS,
  patchWidget,
  PRESET_LABELS,
  WIDGET_LABELS,
  type OverlayLayout,
  type OverlayPresetId,
  type OverlayWidgetId
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

export const OverlayStudio = ({
  state,
  onClose
}: {
  state: AppState
  onClose: () => void
}): JSX.Element => {
  const layout = state.overlayLayout
  const hud = toOverlayHud(state)
  const [selected, setSelected] = useState<OverlayWidgetId>('score.mine')
  const current = layout.widgets.find((row) => row.id === selected)

  const save = (next: OverlayLayout): void => {
    void api().setOverlayLayout(next)
  }

  const handlePreset = (presetId: OverlayPresetId): void => {
    save(applyPreset(presetId))
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void api().toggleOverlay()}
            className={`flex-1 cursor-pointer border px-2 py-1.5 text-xs font-semibold uppercase ${
              state.overlayVisible ? 'border-lime text-lime' : 'border-line text-muted'
            }`}
            aria-pressed={state.overlayVisible}
          >
            HUD {state.overlayVisible ? 'on' : 'off'}
          </button>
          <button
            type="button"
            onClick={() => void api().setOverlayEditMode(!state.overlayEditMode)}
            className={`flex-1 cursor-pointer border px-2 py-1.5 text-xs font-semibold uppercase ${
              state.overlayEditMode ? 'border-you text-you' : 'border-line text-muted'
            }`}
            aria-pressed={state.overlayEditMode}
            disabled={!state.overlayVisible}
          >
            Edit {state.overlayEditMode ? 'on' : 'off'}
          </button>
        </div>

        {!state.overlayVisible ? (
          <p className="text-xs text-muted">HUD is off — layout still applies when you turn it on.</p>
        ) : null}

        <label className="grid gap-1 text-xs uppercase tracking-wide text-muted">
          Preset
          <select
            value={layout.presetId}
            onChange={(event) => handlePreset(event.target.value as OverlayPresetId)}
            className="cursor-pointer border border-line bg-bg px-2 py-1.5 text-sm text-text"
            aria-label="Overlay preset"
          >
            {OVERLAY_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {PRESET_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted">
          Default is Tape rails: you left, them right. Centered names and totals; signed +/- under each
          score. Frosted type only — no wash, no card, no ice hash. Saved layouts keep old geometry until
          Revert preset.
        </p>

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
          {layout.widgets.map((widget) =>
            widget.hidden ? null : (
              <button
                key={widget.id}
                type="button"
                onClick={() => setSelected(widget.id)}
                className={`absolute cursor-pointer ${
                  selected === widget.id ? 'outline outline-1 outline-you' : ''
                }`}
                style={{
                  left: `${widget.x}%`,
                  top: `${widget.y}%`,
                  width: `${widget.w}%`,
                  height: `${widget.h}%`
                }}
                aria-label={WIDGET_LABELS[widget.id]}
                aria-pressed={selected === widget.id}
              />
            )
          )}
        </div>

        <div className="grid gap-1">
          {OVERLAY_WIDGET_IDS.map((id) => {
            const widget = layout.widgets.find((row) => row.id === id)
            if (!widget) return null
            return (
              <div key={id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => save(patchWidget(layout, id, { hidden: !widget.hidden }))}
                  className="cursor-pointer text-muted hover:text-text"
                  aria-label={widget.hidden ? `Show ${WIDGET_LABELS[id]}` : `Hide ${WIDGET_LABELS[id]}`}
                >
                  {widget.hidden ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => save(patchWidget(layout, id, { locked: !widget.locked }))}
                  className="cursor-pointer text-muted hover:text-text"
                  aria-label={widget.locked ? `Unlock ${WIDGET_LABELS[id]}` : `Lock ${WIDGET_LABELS[id]}`}
                >
                  {widget.locked ? (
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Unlock className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(id)}
                  className={`min-w-0 flex-1 truncate text-left text-xs ${
                    selected === id ? 'text-you' : 'text-text'
                  }`}
                >
                  {WIDGET_LABELS[id]}
                </button>
              </div>
            )
          })}
        </div>

        {current ? (
          <label className="grid gap-1 text-xs uppercase tracking-wide text-muted">
            Fill opacity
            <input
              type="range"
              min={0}
              max={85}
              value={Math.round(current.opacity * 100)}
              onChange={(event) =>
                save(patchWidget(layout, current.id, { opacity: Number(event.target.value) / 100 }))
              }
              className="accent-you"
              aria-label="Widget fill opacity"
            />
          </label>
        ) : null}

        <div className="grid gap-1 text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={layout.groupedRails.mine}
              onChange={(event) =>
                save({
                  ...layout,
                  presetId: 'user.1',
                  groupedRails: { ...layout.groupedRails, mine: event.target.checked }
                })
              }
            />
            Group your rail
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={layout.groupedRails.opp}
              onChange={(event) =>
                save({
                  ...layout,
                  presetId: 'user.1',
                  groupedRails: { ...layout.groupedRails, opp: event.target.checked }
                })
              }
            />
            Group their rail
          </label>
        </div>

        <button
          type="button"
          onClick={() => handlePreset(layout.presetId === 'user.1' ? DEFAULT_OVERLAY_PRESET : layout.presetId)}
          className="cursor-pointer border border-line px-2 py-1.5 text-xs uppercase tracking-wide text-muted hover:text-text"
        >
          Revert preset
        </button>
      </div>
    </aside>
  )
}
