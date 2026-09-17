import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { chromeFillPillClass, chromePillClass } from './chrome'

describe('chrome pills', () => {
  it('keeps nav and control pills rounded-full with lime outline, fuller when active', () => {
    const inactive = chromePillClass(false, 'nav')
    const active = chromePillClass(true, 'nav')
    expect(inactive).toContain('rounded-full')
    expect(inactive).toContain('ring-lime/40')
    expect(active).toContain('ring-lime')
    expect(active).not.toContain('ring-lime/40')
    expect(chromePillClass(false, 'control')).toContain('rounded-full')
    expect(chromeFillPillClass('you')).toContain('rounded-full')
    expect(chromeFillPillClass('espn', 'compact')).toContain('bg-espn')
    expect(inactive).not.toMatch(/(?:^|\s)border(?:\s|$)/)
  })

  it('keeps ice --you distinct from lime chrome #B6FF3B', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/renderer/styles.css'), 'utf8')
    expect(css).toContain('--color-you: #a6e6a0')
    expect(css).toContain('--color-lime: #b6ff3b')
    expect(css).toContain('--color-air: #ff4d4d')
  })
})
