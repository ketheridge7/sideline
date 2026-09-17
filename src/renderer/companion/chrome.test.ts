import { describe, expect, it } from 'vitest'
import { chromeFillPillClass, chromePillClass } from './chrome'

describe('chrome pills', () => {
  it('keeps nav and control pills rounded-full with lime active ring', () => {
    expect(chromePillClass(false, 'nav')).toContain('rounded-full')
    expect(chromePillClass(true, 'nav')).toContain('ring-lime')
    expect(chromePillClass(false, 'control')).toContain('rounded-full')
    expect(chromeFillPillClass('you')).toContain('rounded-full')
    expect(chromeFillPillClass('espn', 'compact')).toContain('bg-espn')
    expect(chromePillClass(false, 'nav')).not.toMatch(/(?:^|\s)border(?:\s|$)/)
  })
})
