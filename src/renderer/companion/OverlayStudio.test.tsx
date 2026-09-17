import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { applyPreset, layoutFromPreset, overwritePreset } from '@shared/overlayLayout'
import { applyStudioSlider, studioBlockBox } from '@shared/overlayStudioBlocks'
import { emptyAppState } from '@shared/types'
import { OverlayStudio } from './OverlayStudio'

const renderStudio = (
  overlayLayout = layoutFromPreset('1'),
  selected: 'mine' | 'opp' | 'ticker' | null = null
): string => {
  const state = emptyAppState()
  state.overlayLayout = overlayLayout
  state.nflTicker = [
    { id: 'g1', away: 'KC', awayScore: 14, home: 'SF', homeScore: 10, clock: 'Q2 4:12', final: false }
  ]
  return renderToStaticMarkup(
    <OverlayStudio state={state} onClose={() => undefined} initialSelectedBlock={selected} />
  )
}

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
    expect(four).toContain('stacked one above the other')
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
    expect(html).toContain('text-lime">Overlay Studio</h2>')
    expect(html).toContain('data-studio-preview="hud"')
    expect(html).toContain('border-lime')
    expect(html).toContain('bg-lime/15')
    expect(html).not.toContain('border-you bg-you/15 text-you')
  })
})
