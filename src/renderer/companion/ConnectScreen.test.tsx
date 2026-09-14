import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { ConnectScreen } from './ConnectScreen'

describe('ConnectScreen updates', () => {
  it('puts Check for updates on Connect next to other settings', () => {
    const html = renderToStaticMarkup(<ConnectScreen state={emptyAppState()} />)
    expect(html).toContain('Check for updates')
    expect(html).toContain('data-update-state="idle"')
  })
})

describe('ConnectScreen shortcuts', () => {
  it('lists the HUD, display, league, and Studio accelerators with change/reset', () => {
    const html = renderToStaticMarkup(<ConnectScreen state={emptyAppState()} />)
    expect(html).toContain('Keyboard shortcuts')
    expect(html).toContain('data-shortcut-action="overlay"')
    expect(html).toContain('data-shortcut-action="overlayDisplay"')
    expect(html).toContain('data-shortcut-action="nextLeague"')
    expect(html).toContain('data-shortcut-action="prevLeague"')
    expect(html).toContain('Ctrl+Shift+O')
    expect(html).toContain('Ctrl+Shift+M')
    expect(html).toContain('Ctrl+Shift+E')
    expect(html).toContain('Change')
    expect(html).toContain('Reset')
  })
})
