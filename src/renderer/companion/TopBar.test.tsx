import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { TopBar } from './TopBar'

describe('TopBar', () => {
  it('keeps HUD and Studio in the top bar without SL/ES pips', () => {
    const state = emptyAppState()
    state.espnConnected = true
    const html = renderToStaticMarkup(
      <TopBar state={state} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).toContain('HUD')
    expect(html).toContain('Studio')
    expect(html).not.toContain('data-espn-health')
    expect(html).not.toContain('data-provider-health')
    expect(html).not.toContain('>SL<')
    expect(html).not.toContain('>ES<')
  })

  it('mirrors overlayVisible on the HUD switch', () => {
    const off = renderToStaticMarkup(
      <TopBar
        state={emptyAppState()}
        screen="board"
        studioOpen={false}
        onScreen={() => undefined}
        onStudio={() => undefined}
      />
    )
    expect(off).toContain('aria-checked="false"')
    const onState = emptyAppState()
    onState.overlayVisible = true
    const on = renderToStaticMarkup(
      <TopBar state={onState} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(on).toContain('aria-checked="true"')
  })

  it('paints the locked packaging mark plus SIDELINE wordmark', () => {
    const html = renderToStaticMarkup(
      <TopBar
        state={emptyAppState()}
        screen="board"
        studioOpen={false}
        onScreen={() => undefined}
        onStudio={() => undefined}
      />
    )
    expect(html).toContain('data-wordmark="sideline"')
    expect(html).toContain('SIDELINE')
    expect(html).toMatch(/<img[^>]+src="/)
    expect(html).toContain('sideline-mark.svg')
  })

  it('keeps the renderer mark identical to build/icon.svg', () => {
    const packaging = readFileSync(resolve(process.cwd(), 'build/icon.svg'), 'utf8')
    const renderer = readFileSync(resolve(process.cwd(), 'src/renderer/assets/sideline-mark.svg'), 'utf8')
    expect(renderer).toBe(packaging)
  })

  it('does not paint a decorative Live pip when polling', () => {
    const state = emptyAppState()
    state.pollingLive = true
    const html = renderToStaticMarkup(
      <TopBar state={state} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).not.toContain('live-dot')
    expect(html).not.toContain('>Live<')
  })
})
