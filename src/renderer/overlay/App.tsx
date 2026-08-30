import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import {
  dragIdsFor,
  parseOverlayLayout,
  resizeWidget,
  translateWidgets,
  type OverlayLayout,
  type OverlayWidgetId
} from '@shared/overlayLayout'
import type { OverlayHudState } from '@shared/types'
import { emptyAppState, toOverlayHud } from '@shared/types'
import { OverlayWidgetView } from './Widgets'
import { smokeFill } from './density'
import { canvasInsetPct, overlayAllowsEdit, overlaySurface, subscribeHud } from './subscribe'

type DragSession = {
  ids: OverlayWidgetId[]
  startX: number
  startY: number
  origin: OverlayLayout
  resize: { id: OverlayWidgetId; startW: number; startH: number } | null
}

const persistLayout = (layout: OverlayLayout): void => {
  void window.sideline?.setOverlayLayout(layout)
}

export const OverlayApp = (): JSX.Element => {
  const [hud, setHud] = useState<OverlayHudState>(toOverlayHud(emptyAppState()))
  const [layout, setLayout] = useState<OverlayLayout>(hud.layout)
  const [selected, setSelected] = useState<OverlayWidgetId | null>(null)
  const drag = useRef<DragSession | null>(null)
  const layoutRef = useRef(layout)
  const rootRef = useRef<HTMLDivElement>(null)
  layoutRef.current = layout
  const surface = overlaySurface(window.location.search)
  const inset = canvasInsetPct(surface)
  const canEdit = overlayAllowsEdit(window.location.search, Boolean(window.sideline)) && hud.overlayEditMode

  useEffect(() => subscribeHud(setHud), [])

  useEffect(() => {
    if (drag.current) return
    setLayout(parseOverlayLayout(hud.layout))
  }, [hud.layout])

  const applyLocal = (next: OverlayLayout): void => {
    layoutRef.current = next
    setLayout(next)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const session = drag.current
    const root = rootRef.current
    if (!session || !root) return
    const width = root.clientWidth || 1
    const height = root.clientHeight || 1
    const rawDx = ((event.clientX - session.startX) / width) * 100
    const rawDy = ((event.clientY - session.startY) / height) * 100
    const dx = event.altKey ? rawDx : Math.round(rawDx)
    const dy = event.altKey ? rawDy : Math.round(rawDy)
    if (session.resize) {
      applyLocal(
        resizeWidget(
          session.origin,
          session.resize.id,
          session.resize.startW + dx,
          session.resize.startH + dy
        )
      )
      return
    }
    applyLocal(translateWidgets(session.origin, session.ids, dx, dy))
  }

  const handlePointerUp = (): void => {
    if (!drag.current) return
    drag.current = null
    persistLayout(layoutRef.current)
  }

  const startDrag = (
    event: ReactPointerEvent<HTMLElement>,
    id: OverlayWidgetId,
    resize: boolean
  ): void => {
    if (!canEdit) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const widget = layout.widgets.find((row) => row.id === id)
    if (!widget || widget.locked) return
    setSelected(id)
    drag.current = {
      ids: dragIdsFor(layout, id),
      startX: event.clientX,
      startY: event.clientY,
      origin: layout,
      resize: resize ? { id, startW: widget.w, startH: widget.h } : null
    }
  }

  return (
    <div
      ref={rootRef}
      className={`relative h-full w-full overflow-hidden bg-transparent ${canEdit ? 'bg-black/10' : ''}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerDown={() => {
        if (canEdit) setSelected(null)
      }}
    >
      {canEdit ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(125,211,252,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(125,211,252,0.12) 1px, transparent 1px)',
            backgroundSize: '12.5% 12.5%'
          }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${inset}%`,
          top: `${inset}%`,
          right: `${inset}%`,
          bottom: `${inset}%`
        }}
      >
      {layout.widgets.map((widget) => {
        if (widget.hidden) return null
        const fill = smokeFill(surface, widget.opacity)
        const active = canEdit && selected === widget.id
        return (
          <div
            key={widget.id}
            className={`absolute overflow-hidden ${canEdit ? 'cursor-pointer' : ''}`}
            style={{
              left: `${widget.x}%`,
              top: `${widget.y}%`,
              width: `${widget.w}%`,
              height: `${widget.h}%`,
              background: `rgba(7, 8, 10, ${fill})`,
              outline: active ? '1px dashed #7DD3FC' : 'none',
              color: '#F4F6F8',
              textShadow: fill < 0.2 ? '0 0 2px #07080A' : undefined
            }}
            onPointerDown={(event) => startDrag(event, widget.id, false)}
          >
            <OverlayWidgetView
              id={widget.id}
              hud={hud}
              surface={surface}
              density={widget.density}
            />
            {active ? (
              <button
                type="button"
                className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-you"
                aria-label={`Resize ${widget.id}`}
                onPointerDown={(event) => startDrag(event, widget.id, true)}
              />
            ) : null}
          </div>
        )
      })}
      </div>
    </div>
  )
}
