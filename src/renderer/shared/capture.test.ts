import { describe, expect, it } from 'vitest'
import { captureSurface } from './capture'

describe('captureSurface', () => {
  it('reads capture=1 from the window query only', () => {
    expect(captureSurface('?capture=1')).toBe(true)
    expect(captureSurface('?surface=obs&capture=1')).toBe(true)
    expect(captureSurface('?capture=0')).toBe(false)
    expect(captureSurface('')).toBe(false)
    expect(captureSurface(undefined)).toBe(false)
  })
})
