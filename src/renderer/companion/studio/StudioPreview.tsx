import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { HudGroupBox, HudTextHighlight, OverlayLayout } from '@shared/overlayLayout'
import { STUDIO_BLOCK_IDS, STUDIO_BLOCK_LABELS, studioBlockBox, type StudioBlockId } from '@shared/overlayStudioBlocks'
import type { OverlayHudState } from '@shared/types'
import studioPlateUrl from '../../assets/studio-plate.jpg'
import { HudCanvas } from '../../shared/HudCanvas'

export const PREVIEW_W = 1280
export const PREVIEW_H = 720

export const PREVIEW_PLATES = ['game', 'bright', 'dark'] as const
export type PreviewPlate = (typeof PREVIEW_PLATES)[number]

export const PREVIEW_PLATE_LABELS: Record<PreviewPlate, string> = {
  game: 'Game',
  bright: 'Day',
  dark: 'Dark'
}

const plateFilter = (plate: PreviewPlate): string | null => {
  switch (plate) {
    case 'game':
      return 'saturate(0.8) brightness(0.72)'
    case 'bright':
      return 'saturate(1.05) brightness(1.12)'
    case 'dark':
      return null
    default: {
      const _never: never = plate
      return _never
    }
  }
}

/** Live-video rectangle from the HUD spec. Blocks should stay off it. */
const LIVE_ZONE = { x: 22, y: 22, w: 56, h: 64 } as const

type Gesture = {
  id: StudioBlockId
  mode: 'move' | 'resize'
  startX: number
  startY: number
  from: HudGroupBox
  moved: boolean
}

export type PreviewGesture = {
  id: StudioBlockId
  mode: 'move' | 'resize'
  from: HudGroupBox
  dx: number
  dy: number
}

export const StudioPreview = ({
  layout,
  hud,
  selected,
  highlight,
  plate,
  initialWidth,
  onSelect,
  onGesture,
  onGestureEnd,
  onNudge
}: {
  layout: OverlayLayout
  hud: OverlayHudState
  selected: StudioBlockId | null
  highlight: HudTextHighlight | null
  plate: PreviewPlate
  initialWidth: number
  onSelect: (id: StudioBlockId | null) => void
  onGesture: (gesture: PreviewGesture) => void
  onGestureEnd: () => void
  onNudge: (id: StudioBlockId, dx: number, dy: number) => void
}): JSX.Element => {
  const frameRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [width, setWidth] = useState(initialWidth)
  const [dragging, setDragging] = useState(false)
  const scale = width / PREVIEW_W

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const begin = (event: ReactPointerEvent<HTMLElement>, id: StudioBlockId, mode: Gesture['mode']): void => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(id)
    gesture.current = {
      id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      from: studioBlockBox(layout, id),
      moved: false
    }
  }

  const move = (event: ReactPointerEvent<HTMLElement>): void => {
    const session = gesture.current
    const frame = frameRef.current
    if (!session || !frame) return
    const rect = frame.getBoundingClientRect()
    const px = event.clientX - session.startX
    const py = event.clientY - session.startY
    if (!session.moved && Math.hypot(px, py) < 3) return
    if (!session.moved) {
      session.moved = true
      setDragging(true)
    }
    const rawDx = (px / Math.max(1, rect.width)) * 100
    const rawDy = (py / Math.max(1, rect.height)) * 100
    const dx = event.altKey ? rawDx : Math.round(rawDx)
    const dy = event.altKey ? rawDy : Math.round(rawDy)
    onGesture({ id: session.id, mode: session.mode, from: session.from, dx, dy })
  }

  const end = (): void => {
    const session = gesture.current
    gesture.current = null
    if (!session) return
    setDragging(false)
    if (session.moved) onGestureEnd()
  }

  const keyNudge = (event: ReactKeyboardEvent<HTMLElement>, id: StudioBlockId): void => {
    const step = event.shiftKey ? 5 : 1
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    }
    const delta = moves[event.key]
    if (!delta) return
    event.preventDefault()
    event.stopPropagation()
    onNudge(id, delta[0], delta[1])
  }

  const filter = plateFilter(plate)
  const outline = Math.max(2, 2.5 / Math.max(scale, 0.01))

  return (
    <div
      ref={frameRef}
      className="studio-preview relative aspect-video overflow-hidden rounded-xl bg-[#07080a]"
      data-studio-preview="hud"
      data-studio-highlight={highlight ?? 'none'}
      data-studio-dragging={dragging ? 'true' : 'false'}
      onClick={() => onSelect(null)}
    >
      {filter ? (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center transition-[filter] duration-300"
          style={{ backgroundImage: `url(${studioPlateUrl})`, filter }}
          data-studio-plate={plate}
          aria-hidden="true"
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[#07080a]" data-studio-plate={plate} aria-hidden="true" />
      )}
      {plate === 'game' ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(7,8,10,0.6) 100%)' }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${scale})` }}
      >
        <HudCanvas
          layout={layout}
          hud={hud}
          surface="desktop"
          renderWidget={(widget) =>
            widget.id === 'ticker.nfl' && hud.nflTicker.length === 0 ? (
              <div className="flex h-full w-full flex-col justify-end">
                <div className="hud-type-ticker flex w-full items-center bg-black/55 px-[0.75em] text-muted">Ticker</div>
              </div>
            ) : null
          }
        />
        {dragging ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true" data-studio-guides="">
            <div
              className="absolute rounded-[18px] border-[3px] border-dashed border-white/35 bg-white/[0.04]"
              style={{ left: `${LIVE_ZONE.x}%`, top: `${LIVE_ZONE.y}%`, width: `${LIVE_ZONE.w}%`, height: `${LIVE_ZONE.h}%` }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-cond text-[44px] font-bold uppercase tracking-[0.3em] text-white/45">
                Live video
              </span>
            </div>
            <div className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-lime/40" />
          </div>
        ) : null}
        {STUDIO_BLOCK_IDS.map((id) => {
          const box = studioBlockBox(layout, id)
          const active = selected === id
          const labelRoom = (10 * 1.8) / Math.max(scale, 0.01) + outline * 3
          const labelBelow = (box.y / 100) * PREVIEW_H < labelRoom
          return (
            <button
              key={id}
              type="button"
              data-studio-block={id}
              aria-pressed={active}
              aria-label={`Select ${STUDIO_BLOCK_LABELS[id]}`}
              className={`studio-block absolute bg-transparent ${
                active ? `studio-block-active cursor-grab ${dragging ? 'studio-block-dragging' : ''}` : 'studio-block-idle cursor-pointer'
              }`}
              style={{
                left: `${box.x}%`,
                top: `${box.y}%`,
                width: `${box.w}%`,
                height: `${box.h}%`,
                zIndex: active ? 3 : 2,
                ['--studio-outline' as string]: `${outline}px`
              }}
              onClick={(event) => {
                event.stopPropagation()
                onSelect(id)
              }}
              onPointerDown={(event) => begin(event, id, 'move')}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onKeyDown={(event) => keyNudge(event, id)}
            >
              {active ? (
                <>
                  <span
                    className="pointer-events-none absolute left-0 whitespace-nowrap rounded-md bg-lime px-[0.6em] py-[0.15em] font-cond font-bold uppercase tracking-[0.14em] text-bg"
                    style={{
                      fontSize: 10 / Math.max(scale, 0.01),
                      ...(labelBelow ? { top: `calc(100% + ${outline * 2}px)` } : { bottom: `calc(100% + ${outline * 2}px)` })
                    }}
                  >
                    {STUDIO_BLOCK_LABELS[id]}
                  </span>
                  <span
                    role="presentation"
                    data-studio-resize={id}
                    className="absolute rounded-full bg-lime ring-bg"
                    style={{
                      width: 12 / Math.max(scale, 0.01),
                      height: 12 / Math.max(scale, 0.01),
                      right: -6 / Math.max(scale, 0.01),
                      bottom: -6 / Math.max(scale, 0.01),
                      boxShadow: `0 0 0 ${outline}px #07080a`,
                      cursor: 'nwse-resize'
                    }}
                    onPointerDown={(event) => begin(event, id, 'resize')}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerCancel={end}
                  />
                </>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
