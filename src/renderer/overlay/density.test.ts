import { describe, expect, it } from 'vitest'
import { resolveDensity, smokeFill } from './density'

describe('overlay density', () => {
  it('forces a large TV floor even when a widget is compact', () => {
    expect(resolveDensity('tv', 'compact')).toBe('large')
    expect(resolveDensity('tv', 'inherit')).toBe('large')
    expect(resolveDensity('obs', 'inherit')).toBe('regular')
    expect(resolveDensity('desktop', 'compact')).toBe('compact')
  })

  it('raises TV smoke to at least 0.40', () => {
    expect(smokeFill('tv', 0.28)).toBe(0.4)
    expect(smokeFill('tv', 0.7)).toBe(0.7)
    expect(smokeFill('obs', 0.28)).toBe(0.28)
    expect(smokeFill('desktop', 0.28)).toBe(0.28)
  })
})
