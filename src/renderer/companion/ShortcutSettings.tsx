import { useEffect, useState, type JSX } from 'react'
import type { AppState } from '@shared/types'
import {
  acceleratorFromEvent,
  DEFAULT_SHORTCUTS,
  formatAccelerator,
  SHORTCUT_ACTIONS,
  SHORTCUT_LABELS,
  shortcutMapFromSettings,
  type ShortcutAction
} from '@shared/shortcuts'
import { chromePillClass } from './chrome'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const ShortcutSettings = ({ state }: { state: AppState }): JSX.Element => {
  const shortcuts = shortcutMapFromSettings(state)
  const [listening, setListening] = useState<ShortcutAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!listening) return
    void api().setShortcutCapture(true)
    const onKey = (event: KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === 'Escape') {
        setListening(null)
        return
      }
      const accelerator = acceleratorFromEvent(event)
      if (!accelerator) return
      void api()
        .setShortcut(listening, accelerator)
        .then((result) => {
          if (!result.ok) {
            setError(result.error ?? 'Could not set shortcut')
            return
          }
          setError(null)
          setListening(null)
        })
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      void api().setShortcutCapture(false)
    }
  }, [listening])

  const handleReset = (action: ShortcutAction): void => {
    setError(null)
    void api()
      .resetShortcut(action)
      .then((result) => {
        if (!result.ok) setError(result.error ?? 'Could not reset shortcut')
      })
  }

  return (
    <section className="rounded-sm border border-line bg-card p-5">
      <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
      <p className="mt-1 text-sm text-muted">
        Chorded shortcuts (Ctrl+Shift+…) work globally, including while a game is focused. Single keys like [ and ]
        work in the companion when you are not typing in a field. Change captures the next key; Esc cancels.
      </p>
      <ul className="mt-4 grid gap-2">
        {SHORTCUT_ACTIONS.map((action) => (
          <li
            key={action}
            className="flex flex-wrap items-center gap-2 border border-line bg-bg px-3 py-2"
            data-shortcut-action={action}
          >
            <span className="min-w-0 flex-1 text-sm">{SHORTCUT_LABELS[action]}</span>
            <kbd className="font-mono text-xs text-you">
              {listening === action ? 'Press a key…' : formatAccelerator(shortcuts[action])}
            </kbd>
            <button
              type="button"
              onClick={() => {
                setError(null)
                void api().setShortcutCapture(true)
                setListening(action)
              }}
              className={chromePillClass(false, 'compact')}
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => handleReset(action)}
              disabled={shortcuts[action] === DEFAULT_SHORTCUTS[action]}
              className={`${chromePillClass(false, 'compact')} disabled:opacity-40`}
            >
              Reset
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="mt-3 text-sm text-air">{error}</p> : null}
    </section>
  )
}
