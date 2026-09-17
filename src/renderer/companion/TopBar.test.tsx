import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { TopBar, type Screen } from './TopBar'

const renderTop = (state = emptyAppState(), screen: Screen = 'board'): string =>
  renderToStaticMarkup(<TopBar state={state} screen={screen} onScreen={() => undefined} />)

describe('TopBar', () => {
  it('keeps HUD in the top bar without Studio, SL, or ES pips', () => {
    const state = emptyAppState()
    state.espnConnected = true
    state.overlayVisible = true
    const html = renderTop(state)
    expect(html).toContain('HUD')
    expect(html).not.toContain('Studio')
    expect(html).not.toContain('Edit layout')
    expect(html).not.toContain('data-espn-health')
    expect(html).not.toContain('data-provider-health')
    expect(html).not.toContain('>SL<')
    expect(html).not.toContain('>ES<')
    expect(html.match(/data-chrome="pill"/g)?.length).toBe(4)
  })

  it('never mounts Studio in the top bar, even when HUD is on', () => {
    const off = renderTop()
    expect(off).toContain('HUD')
    expect(off).not.toContain('Studio')
    expect(off.match(/data-chrome="pill"/g)?.length).toBe(4)
    const onState = emptyAppState()
    onState.overlayVisible = true
    const on = renderTop(onState)
    expect(on).toContain('HUD')
    expect(on).not.toContain('Studio')
    expect(on).not.toContain('aria-label="Open overlay studio"')
    expect(on.match(/data-chrome="pill"/g)?.length).toBe(4)
  })

  it('mirrors overlayVisible on the HUD switch', () => {
    expect(renderTop()).toContain('aria-checked="false"')
    const onState = emptyAppState()
    onState.overlayVisible = true
    expect(renderTop(onState)).toContain('aria-checked="true"')
  })

  it('paints the locked broadcast S mark plus ice SIDELINE wordmark', () => {
    const html = renderTop()
    expect(html).toContain('data-wordmark="sideline"')
    expect(html).toContain('data-mark="broadcast-s"')
    expect(html).toContain('SIDELINE')
    expect(html).toContain('text-ice')
    expect(html).toContain('gap-2')
    expect(html).not.toContain('gap-6')
    expect(html).toContain('tracking-[0.11em]')
    expect(html).not.toContain('data-wordmark="underline"')
    expect(html).not.toMatch(/class="[^"]*\bitalic\b/)
    expect(html).toMatch(/<img[^>]+src="data:image\/svg\+xml/)
    expect(html).toContain('%23D6F34A')
    expect(html).toContain('%23B6FF3B')
    expect(html).toContain('%237DFFB0')
    expect(html).not.toContain('%2312141A')
  })

  it('uses the designer v2 continuous S, not two disconnected bars or the packaging stripe', () => {
    const packaging = readFileSync(resolve(process.cwd(), 'build/icon.svg'), 'utf8')
    const renderer = readFileSync(resolve(process.cwd(), 'src/renderer/assets/broadcast-s.svg'), 'utf8')
    const buildCopy = readFileSync(resolve(process.cwd(), 'build/broadcast-s.svg'), 'utf8')
    const wordmark = readFileSync(resolve(process.cwd(), 'src/renderer/assets/broadcast-wordmark.svg'), 'utf8')
    expect(renderer).toBe(buildCopy)
    expect(renderer).toContain('skewX(-10)')
    expect(renderer).toContain('M -28 22')
    expect(renderer).toContain('#D6F34A')
    expect(renderer).toContain('#B6FF3B')
    expect(renderer).toContain('#7DFFB0')
    expect(renderer).not.toContain('rotate(-32')
    expect(renderer).not.toContain('clipPath')
    expect(wordmark).toContain('SIDELINE')
    expect(wordmark).toContain('#F4F7F2')
    expect(wordmark).toContain('skewX(-10)')
    expect(packaging).not.toBe(renderer)
    expect(packaging).toContain('#12141A')
  })

  it('uses D soft-pill nav and HUD with lime outlines instead of hard-rect buttons', () => {
    const html = renderTop()
    expect(html).toContain('data-chrome="pill"')
    expect(html).toContain('rounded-full')
    expect(html).toContain('ring-lime/40')
    expect(html).toContain('ring-lime')
    expect(html).not.toContain('border-you')
    expect(html).not.toMatch(/border px-/)
    expect(html).not.toContain('h-5 w-9')
  })

  it('keeps a titleBarOverlay safe right inset so HUD cannot sit under Windows caption buttons', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    expect(css).toContain('--titlebar-overlay-right:')
    expect(css).toContain('138px')
    expect(css).toContain('env(titlebar-area-width')
    expect(renderTop()).toContain('companion-titlebar')
  })

  it('does not paint a decorative Live pip when polling', () => {
    const state = emptyAppState()
    state.pollingLive = true
    const html = renderTop(state)
    expect(html).not.toContain('live-dot')
    expect(html).not.toContain('>Live<')
  })
})
