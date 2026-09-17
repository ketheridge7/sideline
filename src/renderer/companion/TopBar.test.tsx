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

  it('paints the locked broadcast S mark plus ice SIDELINE wordmark', () => {
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
    expect(html).toContain('data-mark="broadcast-s"')
    expect(html).toContain('SIDELINE')
    expect(html).toContain('text-ice')
    expect(html).toContain('tracking-[0.11em]')
    expect(html).not.toContain('data-wordmark="underline"')
    expect(html).not.toContain('italic')
    expect(html).toMatch(/<img[^>]+src="data:image\/svg\+xml/)
    expect(html).toContain('%23D6F34A')
    expect(html).toContain('%23B6FF3B')
    expect(html).toContain('%237DFFB0')
    expect(html).not.toContain('%2312141A')
  })

  it('uses the designer broadcast-s mark, not the packaging stripe square', () => {
    const packaging = readFileSync(resolve(process.cwd(), 'build/icon.svg'), 'utf8')
    const renderer = readFileSync(resolve(process.cwd(), 'src/renderer/assets/broadcast-s.svg'), 'utf8')
    const buildCopy = readFileSync(resolve(process.cwd(), 'build/broadcast-s.svg'), 'utf8')
    const wordmark = readFileSync(resolve(process.cwd(), 'src/renderer/assets/broadcast-wordmark.svg'), 'utf8')
    expect(renderer).toBe(buildCopy)
    expect(renderer).toContain('rotate(-32')
    expect(renderer).toContain('#D6F34A')
    expect(renderer).toContain('#B6FF3B')
    expect(renderer).toContain('#7DFFB0')
    expect(renderer).not.toContain('clipPath')
    expect(wordmark).toContain('SIDELINE')
    expect(wordmark).toContain('#F4F7F2')
    expect(packaging).not.toBe(renderer)
    expect(packaging).toContain('#12141A')
  })

  it('uses D soft-pill nav, HUD, and Studio instead of hard-rect buttons', () => {
    const html = renderToStaticMarkup(
      <TopBar state={emptyAppState()} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).toContain('data-chrome="pill"')
    expect(html).toContain('rounded-full')
    expect(html).toContain('ring-lime')
    expect(html.match(/data-chrome="pill"/g)?.length).toBe(5)
    expect(html).not.toContain('border-you')
    expect(html).not.toMatch(/border px-/)
    expect(html).not.toContain('h-5 w-9')
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
