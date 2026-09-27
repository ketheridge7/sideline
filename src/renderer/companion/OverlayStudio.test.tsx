import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { applyPreset, layoutFromPreset, overwritePreset } from '@shared/overlayLayout'
import { applyStudioSlider, studioBlockBox } from '@shared/overlayStudioBlocks'
import { emptyAppState, type Matchup } from '@shared/types'
import { OverlayStudio } from './OverlayStudio'

const renderStudio = (
  overlayLayout = layoutFromPreset('1'),
  selected: 'mine' | 'opp' | 'ticker' | null = null,
  matchup: Matchup | null = null
): string => {
  const state = emptyAppState()
  state.overlayLayout = overlayLayout
  state.matchup = matchup
  state.nflTicker = [
    { id: 'g1', away: 'KC', awayScore: 14, home: 'SF', homeScore: 10, clock: 'Q2 4:12', final: false }
  ]
  return renderToStaticMarkup(
    <OverlayStudio state={state} initialSelectedBlock={selected} />
  )
}

const leadChipTag = (html: string): string =>
  html.match(/<div class="[^"]*" data-hud="lead-chip">/)?.[0] ?? ''

const pressedPreset = (html: string): string | null => {
  const match = html.match(/data-preset="([1-5])"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-preset="([1-5])"/)
  return match?.[1] ?? match?.[2] ?? null
}

const pressedBlock = (html: string): string | null => {
  const match = html.match(
    /data-studio-block="(mine|opp|ticker)"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-studio-block="(mine|opp|ticker)"/
  )
  return match?.[1] ?? match?.[2] ?? null
}

describe('OverlayStudio preset highlight', () => {
  it('puts the green selected box on the preset that is actually applied', () => {
    expect(pressedPreset(renderStudio(applyPreset('1')))).toBe('1')
    expect(pressedPreset(renderStudio(applyPreset('3')))).toBe('3')
    const four = renderStudio(applyPreset('4'))
    expect(pressedPreset(four)).toBe('4')
    expect(four).toContain('data-active-preset="4"')
    expect(four).toContain('studio-preset-active')
    expect(four).toContain('border-lime')
    expect(four).toContain('bg-lime/15')
    expect(four).toContain('text-lime')
    expect(four).not.toContain('border-you bg-you/15 text-you')
    expect(four).toContain('Same-side stack')
    expect(four).not.toContain('stacked one above the other')
    expect(four).not.toContain('You left, them right.')
  })

  it('keeps the highlight on the saved slot after overwrite + re-apply', () => {
    const base = layoutFromPreset('2')
    const mine = studioBlockBox(base, 'mine')
    const shifted = applyStudioSlider(base, 'mine', { y: mine.y + 6 })
    const saved = overwritePreset(shifted, '2')
    const restored = applyPreset('2', applyPreset('5', saved))
    const html = renderStudio(restored)
    expect(restored.presetId).toBe('2')
    expect(pressedPreset(html)).toBe('2')
    expect(html).toContain('data-active-preset="2"')
    expect(studioBlockBox(restored, 'mine').y).toBeCloseTo(mine.y + 6, 5)
  })
})

describe('OverlayStudio block selection', () => {
  it('outlines the selected big block and aims sliders at that box', () => {
    const layout = layoutFromPreset('1')
    const mine = studioBlockBox(layout, 'mine')
    const html = renderStudio(layout, 'mine')
    expect(html).toContain('data-studio-block="mine"')
    expect(html).toContain('data-studio-block="opp"')
    expect(html).toContain('data-studio-block="ticker"')
    expect(pressedBlock(html)).toBe('mine')
    expect(html).toContain('data-studio-slider-target="mine"')
    expect(html).toContain('Moving Your team')
    expect(html).toContain(`value="${Math.round(mine.x)}"`)
    expect(html).toContain('studio-block-active')
  })

  it('does not aim sliders at the whole HUD when a block is selected', () => {
    const layout = layoutFromPreset('1')
    const opp = studioBlockBox(layout, 'opp')
    const html = renderStudio(layout, 'opp')
    expect(html).toContain('data-studio-slider-target="opp"')
    expect(html).toContain(`value="${Math.round(opp.x)}"`)
    expect(html).toContain(`value="${Math.round(opp.y)}"`)
    expect(pressedBlock(html)).toBe('opp')
  })

  it('leaves sliders idle until a block is clicked', () => {
    const html = renderStudio(layoutFromPreset('1'), null)
    expect(html).toContain('data-studio-slider-target="none"')
    expect(html).toContain('Sliders move that block only')
    expect(pressedBlock(html)).toBeNull()
  })

  it('does not host a HUD on/off control or HUD-is-off copy', () => {
    const html = renderStudio(layoutFromPreset('1'), null)
    expect(html).not.toContain('HUD on')
    expect(html).not.toContain('HUD off')
    expect(html).not.toContain('HUD is off')
    expect(html).toContain('Overlay Studio')
    expect(html).not.toContain('>Close<')
    expect(html).toContain('data-studio-edge')
    expect(html).toContain('data-studio-collapsed="false"')
    expect(html).toContain('aria-label="Collapse overlay studio"')
    expect(html).toContain('text-text">Overlay Studio</h2>')
    expect(html).toContain('stroke-width="1"')
    expect(html.indexOf('Overlay Studio')).toBeLessThan(html.indexOf('aria-label="Collapse overlay studio"'))
    expect(html).toContain('data-studio-preview="hud"')
    expect(html).toContain('data-studio-plate="game"')
    expect(html).toContain('studio-plate.jpg')
    expect(html).toContain('border-lime')
    expect(html).toContain('bg-lime/15')
    expect(html).not.toContain('border-you bg-you/15 text-you')
  })
})

describe('OverlayStudio font color', () => {
  it('offers Ice as the default and a reset that is idle until a color is chosen', () => {
    const html = renderStudio(layoutFromPreset('1'))
    expect(html).toContain('Font color')
    expect(html).toContain('data-studio-font="default"')
    expect(html).toContain('data-font-swatch="ice"')
    expect(html).toContain('data-font-swatch="lime"')
    expect(html).toContain('aria-label="Lime"')
    expect(html).toContain('data-font-custom=""')
    expect(html).toContain('Reset to default')
    expect(html).toContain('data-font-reset=""')
    expect(html).toMatch(/data-font-swatch="ice"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-font-swatch="ice"/)
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('hud-delta-chip')
  })

  it('marks Lime selected and keeps the lead chip on its own color in the preview', () => {
    const tied = renderStudio({ ...layoutFromPreset('1'), fontColor: '#B6FF3B' })
    expect(tied).toContain('data-studio-font="#B6FF3B"')
    expect(tied).toMatch(/data-font-swatch="lime"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-font-swatch="lime"/)
    expect(tied).toContain('data-hud-font="#B6FF3B"')
    expect(tied).toContain('style="color:#B6FF3B"')
    const tiedChip = leadChipTag(tied)
    expect(tiedChip).toContain('text-muted')
    expect(tiedChip).not.toContain('#B6FF3B')
    expect(tied).toContain('hud-delta-chip')

    const leading = renderStudio({ ...layoutFromPreset('1'), fontColor: '#B6FF3B' }, null, {
      myTeam: { id: '1', name: 'Ice Box', owner: 'me', record: '1-0' },
      oppTeam: { id: '2', name: 'Them', owner: 'them', record: '0-1' },
      myPoints: 98.4,
      oppPoints: 91.2,
      starters: [],
      bench: [],
      oppStarters: [],
      oppBench: []
    })
    const lead = leadChipTag(leading)
    expect(lead).toContain('text-lime')
    expect(lead).not.toContain('style=')
    expect(lead).not.toContain('#B6FF3B')
    expect(leading).toContain('hud-delta-chip')
  })
})
