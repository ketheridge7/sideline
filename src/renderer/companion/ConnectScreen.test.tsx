import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { emptyAppState, type League } from '@shared/types'
import {
  ConnectScreen,
  LeagueChecklist,
  copyDiagnosticsFromConnect,
  leaguesToAdd,
  reportBugFromConnect,
  type ConnectPath
} from './ConnectScreen'

const htmlOf = (
  overrides: Partial<ReturnType<typeof emptyAppState>> = {},
  opts: { path?: ConnectPath; discoverable?: League[] } = {}
): string =>
  renderToStaticMarkup(
    <ConnectScreen
      state={{ ...emptyAppState(), ...overrides }}
      initialPath={opts.path}
      discoverable={opts.discoverable}
    />
  )

const howtoTag = (html: string, id: string): string => {
  const match = html.match(new RegExp(`<details[^>]*data-howto="${id}"[^>]*>`))
  return match?.[0] ?? ''
}

const howtoDefault = (html: string, id: string): string | null => {
  const match = howtoTag(html, id).match(/data-howto-default="(open|closed)"/)
  return match?.[1] ?? null
}

const howtoIsOpen = (html: string, id: string): boolean => /\sopen(?:=""|>|\s)/.test(howtoTag(html, id))

const espnLeagues: League[] = [
  { id: '111', name: 'Gridiron Gurus', provider: 'espn', season: '2026', week: 1 },
  { id: '222', name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }
]

const sleeperLeagues: League[] = [
  { id: '11', name: 'Friday Night', provider: 'sleeper', season: '2026', week: 1 },
  { id: '22', name: 'Fourth & Drunken', provider: 'sleeper', season: '2026', week: 1 }
]

describe('ConnectScreen hub', () => {
  it('puts Check for updates and shortcuts on a quiet hub footer', () => {
    const html = htmlOf()
    expect(html).toContain('data-connect-path="hub"')
    expect(html).toContain('Check for updates')
    expect(html).toContain('data-update-state="idle"')
    expect(html).toContain('data-connect-footer="settings"')
    expect(html.indexOf('data-connect-footer="settings"')).toBeGreaterThan(html.indexOf('data-connect-card="tv"'))
  })

  it('puts a text Report a bug control under Updates and shortcuts', () => {
    const html = htmlOf()
    expect(html).toContain('Report a bug')
    expect(html).toContain('data-connect-report="bug"')
    expect(html.indexOf('data-connect-report="bug"')).toBeGreaterThan(html.indexOf('Keyboard shortcuts'))
    expect(html.indexOf('data-connect-report="bug"')).toBeGreaterThan(html.indexOf('data-connect-card="tv"'))
    const marker = 'data-connect-report="bug"'
    const start = html.lastIndexOf('<button', html.indexOf(marker))
    const end = html.indexOf('</button>', start)
    const button = html.slice(start, end)
    expect(button).toContain('text-muted')
    expect(button).toContain('hover:text-lime')
    expect(button).not.toContain('bg-espn')
    expect(html).toContain('Copy diagnostics')
    expect(html).toContain('data-connect-report="diagnostics"')
    expect(html.indexOf('data-connect-report="diagnostics"')).toBeGreaterThan(html.indexOf('data-connect-report="bug"'))
  })

  it('copies diagnostics from the control next to Report a bug', async () => {
    const copyDiagnostics = vi.fn(async () => ({ ok: true as const }))
    await copyDiagnosticsFromConnect({ copyDiagnostics })
    expect(copyDiagnostics).toHaveBeenCalledTimes(1)
  })

  it('builds a GitHub new-issue URL with version and platform and opens it', async () => {
    const openExternal = vi.fn(async (url: string) => {
      expect(url).toContain('github.com/ketheridge7/sideline/issues/new')
      return { ok: true as const }
    })
    const url = await reportBugFromConnect(
      {
        getRuntimeInfo: async () => ({
          appVersion: '1.0.0',
          electron: '38.0.0',
          chrome: '140.0.7339.0',
          platform: 'win32',
          osRelease: '10.0.22631'
        }),
        openExternal
      },
      'Connect'
    )
    expect(openExternal).toHaveBeenCalledTimes(1)
    expect(url).toContain('github.com/ketheridge7/sideline/issues/new')
    expect(url).toContain('template=bug_report.yml')
    expect(url).toContain('labels=bug')
    expect(url).toContain('assignees=ketheridge7')
    expect(url).toContain('body=')
    const decoded = decodeURIComponent(url.replace(/\+/g, '%20'))
    expect(decoded).toContain('1.0.0')
    expect(decoded).toContain('win32')
    expect(decoded).toContain('Active view: Connect')
  })

  it('uses soft-pill actions on Connect instead of hard-rect buttons', () => {
    const html = htmlOf({
      sleeperConnected: true,
      espnConnected: true,
      leagues: [
        { id: '111', name: 'Gridiron Gurus', provider: 'espn', season: '2026', week: 1 },
        { id: '11', name: 'Friday Night', provider: 'sleeper', season: '2026', week: 1 }
      ]
    })
    expect(html).toContain('rounded-full')
    expect(html).toContain('Sign out')
    expect(html).toContain('Remove')
    expect(html).not.toContain('cursor-pointer border border-line px-4 py-2')
    expect(html).not.toContain('cursor-pointer rounded-sm border border-line px-3 py-2')
  })

  it('shows ESPN, Sleeper, and TV as peer hub cards with status', () => {
    const html = htmlOf()
    expect(html).toContain('data-connect-card="espn"')
    expect(html).toContain('data-connect-card="sleeper"')
    expect(html).toContain('data-connect-card="tv"')
    expect(html.indexOf('data-connect-card="espn"')).toBeLessThan(html.indexOf('data-connect-card="sleeper"'))
    expect(html.indexOf('data-connect-card="sleeper"')).toBeLessThan(html.indexOf('data-connect-card="tv"'))
    expect(html).toContain('Not connected')
    expect(html).not.toContain('id="sleeper-username"')
    expect(html).not.toContain('id="espn-league-id"')
  })

  it('paints ESPN, Sleeper, and TV hub actions with the ESPN red fill', () => {
    const html = htmlOf({
      espnConnected: true,
      sleeperConnected: true,
      lanOverlayEnabled: true
    })
    const card = (id: string): string => {
      const marker = `data-connect-card="${id}"`
      const start = html.indexOf(marker)
      const articleStart = html.lastIndexOf('<article', start)
      const end = html.indexOf('</article>', start)
      return html.slice(articleStart, end)
    }
    expect(card('espn')).toContain('bg-espn')
    expect(card('sleeper')).toContain('bg-espn')
    expect(card('sleeper')).toContain('Add leagues')
    expect(card('sleeper')).not.toContain('bg-you')
    expect(card('tv')).toContain('bg-espn')
    expect(card('tv')).toContain('Manage')
    expect(card('tv')).not.toContain('bg-you')
  })

  it('reports connected league counts and needs re-login on hub cards', () => {
    const connected = htmlOf({
      sleeperConnected: true,
      sleeperUsername: 'ke',
      espnConnected: true,
      leagues: [
        { id: '111', name: 'Gridiron Gurus', provider: 'espn', season: '2026', week: 1 },
        { id: '222', name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 },
        { id: '11', name: 'Friday Night', provider: 'sleeper', season: '2026', week: 1 }
      ]
    })
    expect(connected).toContain('Connected · 2 leagues')
    expect(connected).toContain('Connected · 1 league')
    expect(connected).toContain('Add leagues')

    const relogin = htmlOf({ espnConnected: true, espnNeedsRelogin: true })
    expect(relogin).toContain('Needs re-login')
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
  it('keeps Getting started collapsed on the hub instead of blocking the cards', () => {
    const html = htmlOf()
    expect(html).toContain('Getting started')
    expect(html).toContain('companion for live fantasy')
    expect(howtoDefault(html, 'getting-started')).toBe('closed')
    expect(html.indexOf('Getting started')).toBeLessThan(html.indexOf('data-connect-card="espn"'))
    expect(html).not.toContain('data-howto="sleeper"')
    expect(html).not.toContain('data-howto="espn"')
    expect(html).not.toContain('data-howto="overlay"')
  })

  it('adds How to disclosures on ESPN, Sleeper, and TV paths', () => {
    const sleeper = htmlOf({}, { path: 'sleeper' })
    const espn = htmlOf({}, { path: 'espn' })
    const tv = htmlOf({}, { path: 'tv' })
    expect(sleeper).toContain('data-howto="sleeper"')
    expect(espn).toContain('data-howto="espn"')
    expect(tv).toContain('data-howto="overlay"')
    expect(sleeper).toContain('data-connect-back="hub"')
    expect(espn).toContain('data-connect-back="hub"')
    expect(tv).toContain('data-connect-back="hub"')
    expect(htmlOf().indexOf('Keyboard shortcuts')).toBeGreaterThan(htmlOf().indexOf('data-connect-card="tv"'))
  })

  it('defaults How to open for first-time connect, closed once connected or LAN is on', () => {
    expect(howtoDefault(htmlOf({}, { path: 'sleeper' }), 'sleeper')).toBe('open')
    expect(howtoDefault(htmlOf({}, { path: 'espn' }), 'espn')).toBe('open')
    expect(howtoDefault(htmlOf({}, { path: 'tv' }), 'overlay')).toBe('open')
    expect(howtoIsOpen(htmlOf({}, { path: 'sleeper' }), 'sleeper')).toBe(true)
    expect(howtoIsOpen(htmlOf({}, { path: 'espn' }), 'espn')).toBe(true)
    expect(howtoIsOpen(htmlOf({}, { path: 'tv' }), 'overlay')).toBe(true)

    const sleeper = htmlOf({ sleeperConnected: true, sleeperUsername: 'ke' }, { path: 'sleeper' })
    const espn = htmlOf({ espnConnected: true }, { path: 'espn' })
    const tv = htmlOf({ lanOverlayEnabled: true }, { path: 'tv' })
    expect(howtoDefault(sleeper, 'sleeper')).toBe('closed')
    expect(howtoDefault(espn, 'espn')).toBe('closed')
    expect(howtoDefault(tv, 'overlay')).toBe('closed')
    expect(howtoIsOpen(sleeper, 'sleeper')).toBe(false)
    expect(howtoIsOpen(espn, 'espn')).toBe(false)
    expect(howtoIsOpen(tv, 'overlay')).toBe(false)
  })

  it('reopens ESPN How to when cookies expired so sign-in steps stay visible', () => {
    const html = htmlOf({ espnConnected: true, espnNeedsRelogin: true }, { path: 'espn' })
    expect(howtoDefault(html, 'espn')).toBe('open')
    expect(howtoIsOpen(html, 'espn')).toBe(true)
  })

  it('covers the real connect and overlay paths without APK install steps', () => {
    const sleeper = htmlOf({}, { path: 'sleeper' })
    const espn = htmlOf({}, { path: 'espn' })
    const tv = htmlOf({}, { path: 'tv' })
    expect(sleeper).toContain('Add selected')
    expect(sleeper).toContain('public API')
    expect(espn).toContain('Sign in with ESPN')
    expect(espn).toContain('leagueId=')
    expect(espn).toContain('data-connect-advanced="espn"')
    expect(espn).toContain('Advanced')
    expect(tv).toContain('This PC')
    expect(tv).toContain('Phone / browser URL')
    expect(tv).toContain('127.0.0.1')
    expect(tv).toContain('6-digit pairing code')
    expect(tv).toContain('derived scores')
    expect(sleeper).not.toContain('Wireless debugging')
    expect(tv).not.toContain('sideload')
    expect(tv).not.toContain('adb ')
    expect(tv).not.toContain('APK')
  })
})

describe('ConnectScreen fantasy paths', () => {
  it('lists ESPN leagues all checked by default and keeps paste behind Advanced', () => {
    const html = htmlOf({ espnConnected: true }, { path: 'espn', discoverable: espnLeagues })
    expect(html).toContain('data-connect-checklist="leagues"')
    expect(html).toContain('Gridiron Gurus')
    expect(html).toContain('Dawg Pound')
    expect(html).toContain('Add selected')
    expect(html).toContain('data-league-check="111"')
    expect(html).toContain('checked=""')
    expect(html.indexOf('data-connect-advanced="espn"')).toBeGreaterThan(html.indexOf('Add selected'))
    expect(html).toContain('id="espn-league-id"')
  })

  it('lists Sleeper leagues as the same all-on checklist after connect', () => {
    const html = htmlOf(
      { sleeperConnected: true, sleeperUsername: 'ke' },
      { path: 'sleeper', discoverable: sleeperLeagues }
    )
    expect(html).toContain('data-connect-checklist="leagues"')
    expect(html).toContain('Friday Night')
    expect(html).toContain('Fourth &amp; Drunken')
    expect(html).toContain('Add selected')
    expect(html).toContain('data-league-check="11"')
    expect(html).not.toContain('id="espn-league-id"')
  })

  it('keeps already-connected leagues off the add checklist', () => {
    const html = htmlOf(
      {
        espnConnected: true,
        leagues: [{ id: '222', name: 'Dawg Pound', provider: 'espn', season: '2026', week: 1 }]
      },
      { path: 'espn', discoverable: espnLeagues }
    )
    expect(html).toContain('data-league-check="111"')
    expect(html).toContain('Gridiron Gurus')
    expect(html).not.toContain('data-league-check="222"')
    expect(html).toContain('Add selected')
  })

  it('says all discovered leagues are already connected when none are net-new', () => {
    const html = htmlOf(
      {
        sleeperConnected: true,
        sleeperUsername: 'ke',
        leagues: sleeperLeagues
      },
      { path: 'sleeper', discoverable: sleeperLeagues }
    )
    expect(html).toContain('data-connect-empty="all-connected"')
    expect(html).toContain('All discovered leagues are already connected.')
    expect(html).not.toContain('data-connect-checklist="leagues"')
    expect(html).not.toContain('data-league-check="11"')
  })
})

describe('Connect Replay arming', () => {
  const replayLeagues: League[] = [
    { id: 'friday-night-gridiron', name: 'Friday Night Gridiron', provider: 'sleeper', season: '2026', week: 3 },
    { id: 'gridiron-gurus', name: 'Gridiron Gurus', provider: 'espn', season: '2026', week: 3 }
  ]
  const armed = { replay: true, sleeperConnected: true, espnConnected: true, sleeperUsername: 'sideline-demo', leagues: replayLeagues }

  it('does not offer Replay on the hub', () => {
    const html = htmlOf()
    expect(html).not.toContain('data-connect-replay')
    expect(html).not.toContain('Arm Replay')
    expect(html).not.toContain('Disarm Replay')
    expect(html).toContain('data-connect-updates="static"')
    expect(html).not.toContain('<summary class="text-sm font-semibold text-muted">Updates</summary>')
  })

  it('labels armed cards as fake leagues without a Replay section', () => {
    const html = htmlOf(armed)
    expect(html).not.toContain('data-connect-replay')
    expect(html).not.toContain('Arm Replay')
    expect(html).not.toContain('Disarm Replay')
    expect(html).toContain('Replay · 1 fake league')
    expect(html).toContain('Ready to pair')
  })

  it('never offers Sign out, Add leagues, or Remove on real accounts while Replay is armed', () => {
    const html = htmlOf(armed)
    expect(html).not.toContain('Sign out')
    expect(html).not.toContain('Add leagues')
    expect(html).not.toContain('>Remove<')
    expect(html).toContain('Friday Night Gridiron')
    expect(html).toContain('Gridiron Gurus')
  })
})

describe('leaguesToAdd', () => {
  it('drops ids already on the hub and keeps net-new rows', () => {
    expect(leaguesToAdd(espnLeagues, ['222']).map((row) => row.id)).toEqual(['111'])
    expect(leaguesToAdd(espnLeagues, ['111', '222'])).toEqual([])
    expect(leaguesToAdd(espnLeagues, []).map((row) => row.id)).toEqual(['111', '222'])
  })
})

describe('LeagueChecklist', () => {
  it('renders every league checked so the user unchecks unwanted rows', () => {
    const html = renderToStaticMarkup(
      <LeagueChecklist
        leagues={sleeperLeagues}
        checkedIds={new Set(['11', '22'])}
        onToggle={() => undefined}
        onAdd={() => undefined}
        busy={false}
        message={null}
      />
    )
    expect(html).toContain('data-league-check="11"')
    expect(html).toContain('data-league-check="22"')
    expect(html.match(/checked=""/g)?.length).toBe(2)
    expect(html).toContain('Add selected')
  })
})
