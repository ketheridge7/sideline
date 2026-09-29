import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_THEMES } from '@shared/hudStyle'
import { layoutFromPreset, type OverlayLayout } from '@shared/overlayLayout'
import { emptyAppState, toOverlayHud } from '@shared/types'
import { hudWidgetFontClass } from '../overlay/fontColor'
import { HudCanvas } from './HudCanvas'

const hud = toOverlayHud(emptyAppState())

const paint = (layout: OverlayLayout): string =>
  renderToStaticMarkup(<HudCanvas layout={layout} hud={hud} surface="desktop" />)

const themed = (id: string): OverlayLayout => {
  const row = BUILT_IN_THEMES.find((theme) => theme.id === id)
  if (!row) throw new Error(`missing theme ${id}`)
  return { ...layoutFromPreset('1'), style: row.style, textColors: row.textColors }
}

describe('HudCanvas', () => {
  it('draws no plates for the default Sunday Tape look', () => {
    const html = paint(layoutFromPreset('1'))
    expect(html).toContain('data-hud-backdrop="none"')
    expect(html).not.toContain('data-hud-plate')
    expect(html).toContain('data-hud-typeface="broadcast"')
  })

  it('backs both team frames with plates when a theme has a backdrop', () => {
    const html = paint(themed('primetime'))
    expect(html).toContain('data-hud-plate="mine"')
    expect(html).toContain('data-hud-plate="opp"')
    expect(html).toContain('data-hud-typeface="stadium"')
    expect(html).toContain('--hud-font')
  })

  it('applies the Studio size to every widget except the ticker', () => {
    const layout = { ...layoutFromPreset('1'), display: { ...layoutFromPreset('1').display, size: 'large' as const } }
    const html = paint(layout)
    expect(html).toContain('data-density="large"')
  })

  it('drops the ticker when the display toggle is off', () => {
    const base = layoutFromPreset('1')
    const count = (html: string) => html.split('class="hud-widget ').length - 1
    const off = paint({ ...base, display: { ...base.display, ticker: false } })
    expect(count(off)).toBe(count(paint(base)) - 1)
  })
})

describe('hudWidgetFontClass', () => {
  it('only claims the roles that have their own color', () => {
    const only = hudWidgetFontClass({ all: null, playerName: null, teamName: null, teamScore: '#FFFFFF', playerScore: null })
    expect(only.split(' ')).toEqual(['hud-font-custom', 'hud-ink-team-score'])
    const all = hudWidgetFontClass({ all: '#FFFFFF', playerName: null, teamName: null, teamScore: null, playerScore: null })
    expect(all).toContain('hud-ink-team-name')
    expect(all).toContain('hud-ink-player-score')
    expect(hudWidgetFontClass({ all: null, playerName: null, teamName: null, teamScore: null, playerScore: null })).toBe('')
  })
})
