import { LayoutGrid, Maximize2, Minimize2, Paintbrush, Redo2, Sparkles, Type, Undo2 } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react'
import { pushRecentColor } from '@shared/hudStyle'
import { parseOverlayLayout, type HudTextHighlight, type OverlayLayout } from '@shared/overlayLayout'
import {
  nudgeStudioBlock,
  setStudioBlockBox,
  STUDIO_BLOCK_LABELS,
  translateStudioBlock,
  type StudioBlockId
} from '@shared/overlayStudioBlocks'
import {
  canRedo,
  canUndo,
  commitHistory,
  createHistory,
  redoHistory,
  syncHistory,
  undoHistory
} from '@shared/studioHistory'
import type { AppState } from '@shared/types'
import { toOverlayHud } from '@shared/types'
import { StudioTextColors, type TextColorChange } from './StudioTextColors'
import { IconButton, Segmented } from './studio/controls'
import { StudioLayoutTab } from './studio/StudioLayoutTab'
import {
  PREVIEW_PLATE_LABELS,
  PREVIEW_PLATES,
  StudioPreview,
  type PreviewGesture,
  type PreviewPlate
} from './studio/StudioPreview'
import { StudioStyleTab } from './studio/StudioStyleTab'
import { StudioThemesTab } from './studio/StudioThemesTab'

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

export const STUDIO_TABS = ['layout', 'style', 'text', 'themes'] as const
export type StudioTab = (typeof STUDIO_TABS)[number]

const TAB_LABELS: Record<StudioTab, string> = {
  layout: 'Layout',
  style: 'Style',
  text: 'Text',
  themes: 'Themes'
}

const tabIcon = (tab: StudioTab): ReactNode => {
  switch (tab) {
    case 'layout':
      return <LayoutGrid size={13} />
    case 'style':
      return <Paintbrush size={13} />
    case 'text':
      return <Type size={13} />
    case 'themes':
      return <Sparkles size={13} />
    default: {
      const _never: never = tab
      return _never
    }
  }
}

const PANEL_W = { normal: 300, wide: 560 } as const
const COLLAPSED_W = 44
/** Wide never takes more than this share of the window, so the board keeps room for its scores. */
const WIDE_MAX_SHARE = 0.3

const widePanelWidth = (windowWidth: number): number =>
  Math.round(Math.max(PANEL_W.normal, Math.min(PANEL_W.wide, windowWidth * WIDE_MAX_SHARE)))

const windowWidth = (): number => (typeof window === 'undefined' ? 1920 : window.innerWidth)
const PANEL_PAD = 12
/** Main echoes every save back as a new state. Ignore echoes this soon after a local edit. */
const ECHO_GRACE_MS = 700
const SEND_THROTTLE_MS = 40
const NOTICE_MS = 1800

const sameLayoutJson = (left: OverlayLayout, right: OverlayLayout): boolean =>
  left === right || JSON.stringify(left) === JSON.stringify(right)

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement && target.type !== 'range' && target.type !== 'checkbox'

export const OverlayStudio = ({
  state,
  initialSelectedBlock = null,
  initialTab = 'layout',
  initialWide = false
}: {
  state: AppState
  initialSelectedBlock?: StudioBlockId | null
  initialTab?: StudioTab
  initialWide?: boolean
}): JSX.Element => {
  const [history, setHistory] = useState(() => createHistory(parseOverlayLayout(state.overlayLayout)))
  const [selected, setSelected] = useState<StudioBlockId | null>(initialSelectedBlock)
  const [collapsed, setCollapsed] = useState(false)
  const [highlight, setHighlight] = useState<HudTextHighlight | null>(null)
  const [tab, setTab] = useState<StudioTab>(initialTab)
  const [plate, setPlate] = useState<PreviewPlate>('game')
  const [wide, setWide] = useState(initialWide)
  const [viewportW, setViewportW] = useState(windowWidth)
  const [notice, setNotice] = useState<string | null>(null)
  const lastLocalAt = useRef(0)
  const pending = useRef<OverlayLayout | null>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gestureSeq = useRef(0)
  const layout = history.present
  const hud = toOverlayHud(state)
  const panelW = wide ? widePanelWidth(viewportW) : PANEL_W.normal

  useEffect(() => {
    if (!wide) return
    const onResize = (): void => setViewportW(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [wide])

  useEffect(() => {
    if (Date.now() - lastLocalAt.current < ECHO_GRACE_MS) return
    setHistory((prev) => syncHistory(prev, parseOverlayLayout(state.overlayLayout), sameLayoutJson))
  }, [state.overlayLayout])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const flush = (): void => {
    sendTimer.current = null
    const next = pending.current
    pending.current = null
    if (next) void api().setOverlayLayout(next)
  }

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current)
      if (pending.current) flush()
    },
    []
  )

  const send = (next: OverlayLayout): void => {
    lastLocalAt.current = Date.now()
    pending.current = next
    if (!sendTimer.current) sendTimer.current = setTimeout(flush, SEND_THROTTLE_MS)
  }

  const commit = (next: OverlayLayout, key?: string): void => {
    setHistory((prev) => commitHistory(prev, next, { key }))
    send(next)
  }

  const undo = (): void => {
    if (!canUndo(history)) return
    const next = undoHistory(history)
    setHistory(next)
    send(next.present)
  }

  const redo = (): void => {
    if (!canRedo(history)) return
    const next = redoHistory(history)
    setHistory(next)
    send(next.present)
  }

  const handleGesture = ({ id, mode, from, dx, dy }: PreviewGesture): void => {
    const next =
      mode === 'move'
        ? translateStudioBlock(layout, id, from, dx, dy)
        : setStudioBlockBox(layout, id, { ...from, w: from.w + dx, h: from.h + dy })
    commit(next, `drag:${id}:${mode}:${gestureSeq.current}`)
  }

  const handleTextColors = (textColors: OverlayLayout['textColors'], change?: TextColorChange): void => {
    const library = change?.remember
      ? { ...layout.library, recentColors: pushRecentColor(layout.library.recentColors, change.remember) }
      : layout.library
    commit({ ...layout, textColors, library }, change?.key)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const mod = event.ctrlKey || event.metaKey
    if (!mod || isTypingTarget(event.target)) return
    const key = event.key.toLowerCase()
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      undo()
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault()
      event.stopPropagation()
      redo()
    }
  }

  const panel = (id: StudioTab, body: ReactNode): JSX.Element => (
    <div
      key={id}
      role="tabpanel"
      id={`studio-panel-${id}`}
      aria-labelledby={`studio-tab-${id}`}
      hidden={tab !== id}
      data-studio-panel={id}
      className={tab === id ? 'studio-panel-enter' : undefined}
    >
      {body}
    </div>
  )

  const tabIndex = STUDIO_TABS.indexOf(tab)

  return (
    <aside
      className={`studio-shell relative flex h-full shrink-0 flex-col overflow-hidden border-l border-line transition-[width] duration-300 ease-in-out`}
      style={{ width: collapsed ? COLLAPSED_W : panelW }}
      data-studio-collapsed={collapsed ? 'true' : 'false'}
      data-studio-wide={wide ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label="Expand overlay studio"
          data-studio-edge=""
          className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center gap-3 pt-2 text-text transition-colors hover:text-lime"
        >
          <EdgeChevrons direction="left" />
          <span className="font-cond text-base font-bold uppercase tracking-[0.14em] [writing-mode:vertical-rl]">
            Overlay Studio
          </span>
        </button>
      ) : null}
      <div
        className="flex h-full flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: panelW,
          minWidth: panelW,
          transform: collapsed ? `translateX(${panelW - COLLAPSED_W}px)` : 'translateX(0)'
        }}
        inert={collapsed}
        aria-hidden={collapsed}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-lime shadow-[0_0_10px_#b6ff3b]" aria-hidden="true" />
            <h2 className="truncate font-cond text-base font-bold uppercase tracking-[0.14em] text-text">Overlay Studio</h2>
          </div>
          <div className="flex items-center gap-0.5">
            <IconButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo(history)} data={{ 'data-studio-undo': '' }}>
              <Undo2 size={15} />
            </IconButton>
            <IconButton label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo(history)} data={{ 'data-studio-redo': '' }}>
              <Redo2 size={15} />
            </IconButton>
            <IconButton
              label={wide ? 'Narrow studio' : 'Widen studio'}
              onClick={() => setWide((prev) => !prev)}
              active={wide}
              data={{ 'data-studio-wide-toggle': '' }}
            >
              {wide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </IconButton>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-expanded
              aria-label="Collapse overlay studio"
              data-studio-edge=""
              className="ml-1 flex cursor-pointer items-center justify-center text-text transition-colors hover:text-lime"
            >
              <EdgeChevrons direction="right" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 border-b border-line/70 px-3 pb-2.5 pt-2.5">
          <StudioPreview
            layout={layout}
            hud={hud}
            selected={selected}
            highlight={highlight}
            plate={plate}
            initialWidth={panelW - PANEL_PAD * 2}
            onSelect={setSelected}
            onGesture={handleGesture}
            onGestureEnd={() => {
              gestureSeq.current += 1
            }}
            onNudge={(id, dx, dy) => commit(nudgeStudioBlock(layout, id, dx, dy), `nudge:${id}`)}
          />
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[11px] text-muted" data-studio-preview-hint="">
              {selected ? (
                <>
                  <span className="text-lime">{STUDIO_BLOCK_LABELS[selected]}</span> · drag to move, corner to resize
                </>
              ) : (
                'Click a block to select it'
              )}
            </span>
            <div className="w-[140px] shrink-0">
              <Segmented
                name="plate"
                label="Preview backdrop"
                value={plate}
                options={PREVIEW_PLATES.map((id) => ({ id, label: PREVIEW_PLATE_LABELS[id] }))}
                onChange={setPlate}
              />
            </div>
          </div>
        </div>

        <div className="relative grid border-b border-line px-2" role="tablist" aria-label="Studio sections" style={{ gridTemplateColumns: `repeat(${STUDIO_TABS.length}, minmax(0, 1fr))` }}>
          {STUDIO_TABS.map((id) => {
            const active = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`studio-tab-${id}`}
                aria-selected={active}
                aria-controls={`studio-panel-${id}`}
                data-studio-tab={id}
                onClick={() => setTab(id)}
                className={`studio-tab flex cursor-pointer items-center justify-center gap-1 py-2.5 font-cond text-[12px] font-bold uppercase tracking-[0.1em] ${
                  active ? 'text-lime' : 'text-muted hover:text-text'
                }`}
              >
                {tabIcon(id)}
                {TAB_LABELS[id]}
              </button>
            )
          })}
          <span
            aria-hidden="true"
            className="studio-tab-indicator pointer-events-none absolute bottom-[-1px] left-2 h-[2px] rounded-full bg-lime shadow-[0_0_12px_rgba(182,255,59,0.8)]"
            style={{
              width: `calc((100% - 16px) / ${STUDIO_TABS.length})`,
              transform: `translateX(${tabIndex * 100}%)`
            }}
          />
        </div>

        <div className="studio-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3 text-sm">
          {panel('layout', <StudioLayoutTab layout={layout} selected={selected} onSelect={setSelected} commit={commit} />)}
          {panel('style', <StudioStyleTab layout={layout} commit={commit} />)}
          {panel(
            'text',
            <StudioTextColors
              colors={layout.textColors}
              recent={layout.library.recentColors}
              onChange={handleTextColors}
              onHighlight={setHighlight}
            />
          )}
          {panel('themes', <StudioThemesTab layout={layout} commit={commit} onNotice={setNotice} />)}
        </div>

        {notice ? (
          <div
            className="studio-toast pointer-events-none absolute bottom-4 left-1/2 z-20 rounded-full bg-lime px-3 py-1.5 font-cond text-[12px] font-bold uppercase tracking-[0.12em] text-bg shadow-[0_8px_24px_-8px_rgba(182,255,59,0.7)]"
            role="status"
          >
            {notice}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
