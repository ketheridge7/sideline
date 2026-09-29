import type { JSX, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { OverlayLayout, OverlayWidgetId, OverlayWidgetInstance } from '@shared/overlayLayout'
import { displayWidgets, hudPlateBoxes } from '@shared/overlayStudioBlocks'
import type { OverlayHudState } from '@shared/types'
import { hudWidgetFill, resolveDensity, smokeFill } from '../overlay/density'
import { hudWidgetFontClass, hudWidgetFontStyle } from '../overlay/fontColor'
import { hudCanvasVars, hudPlateStyle, hudTextShadow } from '../overlay/look'
import type { OverlaySurface } from '../overlay/subscribe'
import { OverlayWidgetView } from '../overlay/Widgets'

const widgetDensity = (layout: OverlayLayout, widget: OverlayWidgetInstance): OverlayWidgetInstance['density'] =>
  layout.display.size === 'auto' || widget.id === 'ticker.nfl' ? widget.density : layout.display.size

/**
 * The HUD as it paints: team plates, then widgets. Shared by the desktop overlay,
 * TV / OBS surfaces, and the Studio preview so the preview cannot drift from the real thing.
 * The parent positions a box; the canvas fills it.
 */
export const HudCanvas = ({
  layout,
  hud,
  surface,
  widgetClassName = 'overflow-visible',
  activeWidgetId = null,
  onWidgetPointerDown,
  renderWidgetChrome,
  renderWidget
}: {
  layout: OverlayLayout
  hud: OverlayHudState
  surface: OverlaySurface
  widgetClassName?: string
  activeWidgetId?: OverlayWidgetId | null
  onWidgetPointerDown?: (event: ReactPointerEvent<HTMLDivElement>, id: OverlayWidgetId) => void
  renderWidgetChrome?: (widget: OverlayWidgetInstance) => ReactNode
  /** Replaces the widget body (Studio uses it for an empty-ticker placeholder). */
  renderWidget?: (widget: OverlayWidgetInstance) => ReactNode | null
}): JSX.Element => {
  const fontClass = hudWidgetFontClass(layout.textColors)
  const shadow = hudTextShadow(layout.style)
  return (
    <div
      className="hud-canvas pointer-events-none absolute inset-0"
      data-hud-backdrop={layout.style.backdrop}
      data-hud-typeface={layout.style.font}
      style={hudCanvasVars(layout.style)}
    >
      {hudPlateBoxes(layout).map(({ side, box }) => {
        const paint = hudPlateStyle(layout.style, box.x + box.w / 2 < 50 ? 'left' : 'right')
        if (!paint) return null
        return (
          <div
            key={`plate:${side}`}
            className="hud-plate absolute"
            data-hud-plate={side}
            aria-hidden="true"
            style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, ...paint }}
          />
        )
      })}
      {displayWidgets(layout).map((widget) => {
        if (widget.hidden) return null
        const fill = smokeFill(surface, widget.opacity)
        const density = widgetDensity(layout, widget)
        const active = activeWidgetId === widget.id
        const custom = renderWidget?.(widget)
        return (
          <div
            key={widget.id}
            className={`hud-widget hud-frost absolute ${fontClass} ${widgetClassName} ${
              onWidgetPointerDown ? 'pointer-events-auto' : ''
            }`}
            data-density={resolveDensity(surface, density)}
            data-hud-font={layout.textColors.all ?? 'default'}
            style={{
              left: `${widget.x}%`,
              top: `${widget.y}%`,
              width: `${widget.w}%`,
              height: `${widget.h}%`,
              background: hudWidgetFill(fill),
              outline: active ? '1px dashed #A6E6A0' : undefined,
              textShadow: shadow,
              ...hudWidgetFontStyle(layout.textColors)
            }}
            onPointerDown={onWidgetPointerDown ? (event) => onWidgetPointerDown(event, widget.id) : undefined}
          >
            {custom ?? (
              <OverlayWidgetView
                id={widget.id}
                hud={hud}
                surface={surface}
                density={density}
                showCrawler={layout.showCrawler}
                textColors={layout.textColors}
              />
            )}
            {renderWidgetChrome?.(widget)}
          </div>
        )
      })}
    </div>
  )
}
