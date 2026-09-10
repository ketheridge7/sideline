import { describe, expect, it } from 'vitest'
import { resolveDensity, smokeFill, hudWidgetFill } from './density'

describe('overlay density', () => {
  it('forces a large TV floor even when a widget is compact', () => {
    expect(resolveDensity('tv', 'compact')).toBe('large')
    expect(resolveDensity('tv', 'inherit')).toBe('large')
    expect(resolveDensity('obs', 'inherit')).toBe('regular')
    expect(resolveDensity('desktop', 'compact')).toBe('compact')
  })

  it('never invents a smoke pane — fill is exactly the saved opacity', () => {
    expect(smokeFill('tv', 0)).toBe(0)
    expect(smokeFill('tv', 0.7)).toBe(0.7)
    expect(smokeFill('obs', 0)).toBe(0)
    expect(smokeFill('desktop', 0.28)).toBe(0.28)
  })

  it('stays fully transparent at the Tape rails default fill', () => {
    expect(hudWidgetFill(0)).toBe('transparent')
    expect(hudWidgetFill(0.02)).toBe('transparent')
    expect(hudWidgetFill(0.2).startsWith('linear-gradient')).toBe(true)
  })
})
