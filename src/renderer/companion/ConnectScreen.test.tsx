import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { ConnectScreen } from './ConnectScreen'

const htmlOf = (overrides: Partial<ReturnType<typeof emptyAppState>> = {}): string =>
  renderToStaticMarkup(<ConnectScreen state={{ ...emptyAppState(), ...overrides }} />)

const howtoTag = (html: string, id: string): string => {
  const match = html.match(new RegExp(`<details[^>]*data-howto="${id}"[^>]*>`))
  return match?.[0] ?? ''
}

const howtoDefault = (html: string, id: string): string | null => {
  const match = howtoTag(html, id).match(/data-howto-default="(open|closed)"/)
  return match?.[1] ?? null
}

const howtoIsOpen = (html: string, id: string): boolean => /\sopen(?:=""|>|\s)/.test(howtoTag(html, id))

describe('ConnectScreen updates', () => {
  it('puts Check for updates on Connect next to other settings', () => {
    const html = htmlOf()
    expect(html).toContain('Check for updates')
    expect(html).toContain('data-update-state="idle"')
  })

  it('uses soft-pill actions on Connect instead of hard-rect buttons', () => {
    const html = htmlOf({ sleeperConnected: true, espnConnected: true })
    expect(html).toContain('rounded-full')
    expect(html).toContain('Disconnect')
    expect(html).toContain('Add league')
    expect(html).not.toContain('cursor-pointer border border-line px-4 py-2')
    expect(html).not.toContain('cursor-pointer rounded-sm border border-line px-3 py-2')
  })
})

describe('ConnectScreen shortcuts', () => {
  it('lists the HUD, display, league, and Studio accelerators with change/reset', () => {
    const html = htmlOf()
    expect(html).toContain('Keyboard shortcuts')
    expect(html).toContain('data-shortcut-action="overlay"')
    expect(html).toContain('data-shortcut-action="overlayDisplay"')
    expect(html).toContain('data-shortcut-action="nextLeague"')
    expect(html).toContain('data-shortcut-action="prevLeague"')
    expect(html).toContain('Ctrl+Shift+O')
    expect(html).toContain('Ctrl+Shift+M')
    expect(html).toContain('Ctrl+Shift+E')
    expect(html).toContain('Change')
    expect(html).toContain('Reset')
  })
})

describe('ConnectScreen first-run help', () => {
  it('covers the real connect and overlay paths without APK install steps', () => {
    const html = htmlOf()
    expect(html).toContain('Getting started')
    expect(html).toContain('companion for live fantasy')
    expect(html.indexOf('Getting started')).toBeLessThan(html.indexOf('>Sleeper<'))
    expect(html.indexOf('Getting started')).toBeLessThan(html.indexOf('>ESPN<'))
    expect(html.indexOf('Getting started')).toBeLessThan(html.indexOf('>TV overlay<'))
  })

  it('adds How to disclosures under Sleeper, ESPN, and TV overlay', () => {
    const html = htmlOf()
    expect(html).toContain('data-howto="sleeper"')
    expect(html).toContain('data-howto="espn"')
    expect(html).toContain('data-howto="overlay"')
    expect(html.match(/How to/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html.indexOf('data-howto="sleeper"')).toBeGreaterThan(html.indexOf('>Sleeper<'))
    expect(html.indexOf('data-howto="espn"')).toBeGreaterThan(html.indexOf('>ESPN<'))
    expect(html.indexOf('data-howto="overlay"')).toBeGreaterThan(html.indexOf('>TV overlay<'))
    expect(html.indexOf('Keyboard shortcuts')).toBeGreaterThan(html.indexOf('data-howto="overlay"'))
  })

  it('defaults How to open for first-time connect, closed once connected or LAN is on', () => {
    const fresh = htmlOf()
    expect(howtoDefault(fresh, 'sleeper')).toBe('open')
    expect(howtoDefault(fresh, 'espn')).toBe('open')
    expect(howtoDefault(fresh, 'overlay')).toBe('open')
    expect(howtoIsOpen(fresh, 'sleeper')).toBe(true)
    expect(howtoIsOpen(fresh, 'espn')).toBe(true)
    expect(howtoIsOpen(fresh, 'overlay')).toBe(true)

    const connected = htmlOf({
      sleeperConnected: true,
      sleeperUsername: 'ke',
      espnConnected: true,
      lanOverlayEnabled: true
    })
    expect(howtoDefault(connected, 'sleeper')).toBe('closed')
    expect(howtoDefault(connected, 'espn')).toBe('closed')
    expect(howtoDefault(connected, 'overlay')).toBe('closed')
    expect(connected).toContain('data-howto="sleeper"')
    expect(connected).toContain('How to')
    expect(howtoIsOpen(connected, 'sleeper')).toBe(false)
    expect(howtoIsOpen(connected, 'espn')).toBe(false)
    expect(howtoIsOpen(connected, 'overlay')).toBe(false)
  })

  it('reopens ESPN How to when cookies expired so sign-in steps stay visible', () => {
    const html = htmlOf({ espnConnected: true, espnNeedsRelogin: true })
    expect(howtoDefault(html, 'espn')).toBe('open')
    expect(howtoIsOpen(html, 'espn')).toBe(true)
  })

  it('covers the real connect and overlay paths without APK install steps', () => {
    const html = htmlOf()
    expect(html).toContain('Boards → My leagues')
    expect(html).toContain('public API')
    expect(html).toContain('Sign in with ESPN')
    expect(html).toContain('leagueId=')
    expect(html).toContain('This PC')
    expect(html).toContain('Phone / browser URL')
    expect(html).toContain('127.0.0.1')
    expect(html).toContain('6-digit pairing code')
    expect(html).toContain('derived scores')
    expect(html).not.toContain('Wireless debugging')
    expect(html).not.toContain('sideload')
    expect(html).not.toContain('adb ')
    expect(html).not.toContain('APK')
  })
})
