import { useEffect, useState, type JSX, type ReactNode } from 'react'
import { submitBugReport } from '@shared/bugReport'
import type { AppState, League, Provider } from '@shared/types'
import { chromeFillPillClass, chromePillClass } from './chrome'
import { ShortcutSettings } from './ShortcutSettings'
import { UpdateSettings } from './UpdateSettings'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const reportBugFromConnect = async (
  sideline: Pick<NonNullable<Window['sideline']>, 'getRuntimeInfo' | 'openExternal'>,
  activeView: string
): Promise<string> => {
  const runtime = await sideline.getRuntimeInfo()
  return submitBugReport({ ...runtime, activeView }, async (url) => {
    const result = await sideline.openExternal(url)
    if (!result.ok) throw new Error(result.error ?? 'Could not open GitHub')
    return result
  })
}

export const copyDiagnosticsFromConnect = async (
  sideline: Pick<NonNullable<Window['sideline']>, 'copyDiagnostics'>
): Promise<void> => {
  const result = await sideline.copyDiagnostics()
  if (!result.ok) throw new Error(result.error ?? 'Could not copy diagnostics')
}

export type ConnectPath = 'hub' | 'espn' | 'sleeper' | 'tv'

const HowTo = ({
  id,
  defaultOpen,
  children
}: {
  id: string
  defaultOpen: boolean
  children: ReactNode
}): JSX.Element => {
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])

  return (
    <details
      className="connect-howto mt-4 border-t border-line pt-3"
      data-howto={id}
      data-howto-default={defaultOpen ? 'open' : 'closed'}
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open
        if (next !== open) setOpen(next)
      }}
    >
      <summary className="text-xs font-semibold uppercase tracking-wide text-muted">How to</summary>
      <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-sm text-muted select-text">{children}</ol>
    </details>
  )
}

const connectedLabel = (count: number): string =>
  count === 0 ? 'Connected · pick leagues' : `Connected · ${count} league${count === 1 ? '' : 's'}`

const replayLeaguesLabel = (count: number): string => `Replay · ${count} fake league${count === 1 ? '' : 's'}`

const espnHubStatus = (state: AppState): { label: string; kind: 'off' | 'on' | 'warn' } => {
  if (state.replay) return { label: replayLeaguesLabel(state.leagues.filter((row) => row.provider === 'espn').length), kind: 'on' }
  if (state.espnNeedsRelogin) return { label: 'Needs re-login', kind: 'warn' }
  if (!state.espnConnected) return { label: 'Not connected', kind: 'off' }
  return { label: connectedLabel(state.leagues.filter((row) => row.provider === 'espn').length), kind: 'on' }
}

const sleeperHubStatus = (state: AppState): { label: string; kind: 'off' | 'on' | 'warn' } => {
  if (state.replay) return { label: replayLeaguesLabel(state.leagues.filter((row) => row.provider === 'sleeper').length), kind: 'on' }
  if (!state.sleeperConnected) return { label: 'Not connected', kind: 'off' }
  return { label: connectedLabel(state.leagues.filter((row) => row.provider === 'sleeper').length), kind: 'on' }
}

const tvHubStatus = (state: AppState): { label: string; kind: 'off' | 'on' | 'warn' } => {
  if (!state.lanOverlayEnabled) return { label: state.replay ? 'Ready to pair' : 'Not connected', kind: 'off' }
  return { label: state.overlayPairingCode ? 'On · pairing ready' : 'On', kind: 'on' }
}

export const LeagueChecklist = ({
  leagues,
  checkedIds,
  onToggle,
  onAdd,
  busy,
  message
}: {
  leagues: League[]
  checkedIds: ReadonlySet<string>
  onToggle: (id: string) => void
  onAdd: () => void
  busy: boolean
  message: string | null
}): JSX.Element => (
  <div data-connect-checklist="leagues">
    <fieldset className="mt-4 grid gap-2" disabled={busy}>
      <legend className="sr-only">Leagues to add</legend>
      {leagues.map((league) => (
        <label
          key={league.id}
          className="flex cursor-pointer items-center gap-3 rounded-sm border border-line bg-bg px-3 py-2 text-sm"
          data-league-check={league.id}
        >
          <input
            type="checkbox"
            checked={checkedIds.has(league.id)}
            onChange={() => onToggle(league.id)}
            className="h-4 w-4 accent-lime"
          />
          <span className="min-w-0 flex-1 truncate">{league.name}</span>
        </label>
      ))}
    </fieldset>
    <button
      type="button"
      onClick={onAdd}
      disabled={busy || checkedIds.size === 0}
      className={`${chromeFillPillClass('you')} mt-4 disabled:opacity-40`}
    >
      Add selected
    </button>
    {message ? <p className="mt-2 text-sm text-muted">{message}</p> : null}
  </div>
)

const PathHeader = ({
  title,
  onBack
}: {
  title: string
  onBack: () => void
}): JSX.Element => (
  <div className="mb-4 flex items-center gap-3">
    <button type="button" onClick={onBack} className={chromePillClass(false, 'control')} data-connect-back="hub">
      Back
    </button>
    <h2 className="text-base font-semibold">{title}</h2>
  </div>
)

const useLeaguePicker = (
  leagues: League[]
): {
  checkedIds: Set<string>
  toggle: (id: string) => void
  selectedIds: string[]
} => {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set(leagues.map((row) => row.id)))
  const [seedKey, setSeedKey] = useState(() => leagues.map((row) => row.id).join('\0'))

  useEffect(() => {
    const nextKey = leagues.map((row) => row.id).join('\0')
    if (nextKey === seedKey) return
    setSeedKey(nextKey)
    setCheckedIds(new Set(leagues.map((row) => row.id)))
  }, [leagues, seedKey])

  const toggle = (id: string): void => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return { checkedIds, toggle, selectedIds: leagues.map((row) => row.id).filter((id) => checkedIds.has(id)) }
}

export const leaguesToAdd = (discovered: League[], connectedIds: readonly string[]): League[] => {
  const connected = new Set(connectedIds)
  return discovered.filter((row) => !connected.has(row.id))
}

const ProviderLeagues = ({
  provider,
  leagues,
  connectedIds,
  discoveredCount,
  loading,
  onAdded
}: {
  provider: Provider
  leagues: League[]
  connectedIds: readonly string[]
  discoveredCount: number
  loading: boolean
  onAdded?: () => void
}): JSX.Element => {
  const picker = useLeaguePicker(leagues)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleAdd = async (): Promise<void> => {
    if (picker.selectedIds.length === 0) {
      setMessage('Select at least one league.')
      return
    }
    setBusy(true)
    const result = await api().setSelectedLeagueIds(provider, [...connectedIds, ...picker.selectedIds])
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error ?? 'Could not add leagues')
      return
    }
    setMessage('Leagues added.')
    onAdded?.()
  }

  if (loading) {
    return <p className="mt-4 text-sm text-muted">Detecting leagues…</p>
  }
  if (discoveredCount === 0) {
    return (
      <p className="mt-4 text-sm text-muted" data-connect-empty="none">
        No leagues found yet.
      </p>
    )
  }
  if (leagues.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted" data-connect-empty="all-connected">
        All discovered leagues are already connected.
      </p>
    )
  }
  return (
    <LeagueChecklist
      leagues={leagues}
      checkedIds={picker.checkedIds}
      onToggle={picker.toggle}
      onAdd={() => void handleAdd()}
      busy={busy}
      message={message}
    />
  )
}

const HubCard = ({
  id,
  title,
  status,
  onOpen,
  openLabel,
  leagues,
  onRemove,
  onSignOut
}: {
  id: 'espn' | 'sleeper' | 'tv'
  title: string
  status: { label: string; kind: 'off' | 'on' | 'warn' }
  onOpen?: () => void
  openLabel: string
  leagues: League[]
  onRemove?: (league: League) => void
  onSignOut?: () => void
}): JSX.Element => {
  const statusClass =
    status.kind === 'on' ? 'text-lime' : status.kind === 'warn' ? 'text-air' : 'text-muted'
  return (
    <article
      className="rounded-sm border border-line bg-card p-5 ring-1 ring-lime/40"
      data-connect-card={id}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className={`mt-1 text-sm ${statusClass}`} data-connect-status={status.kind}>
            {status.label}
          </p>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className={chromeFillPillClass('espn')}
          >
            {openLabel}
          </button>
        ) : null}
      </div>
      {leagues.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {leagues.map((league) => (
            <li
              key={league.id}
              className="flex items-center gap-2 border border-line bg-bg px-3 py-2 text-sm"
              data-connect-league={league.id}
            >
              <span className="min-w-0 flex-1 truncate">{league.name}</span>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(league)}
                  className={`${chromePillClass(false, 'compact')} text-muted`}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {onSignOut ? (
        <button type="button" onClick={onSignOut} className={`${chromePillClass(false, 'control')} mt-4`}>
          Sign out
        </button>
      ) : null}
    </article>
  )
}

const TvPath = ({ state, onBack }: { state: AppState; onBack: () => void }): JSX.Element => (
  <section className="rounded-sm border border-line bg-card p-5">
    <PathHeader title="TV" onBack={onBack} />
    <p className="text-sm text-muted">
      Share the HUD on your LAN so a phone or Google TV app can load it. Off by default — only derived scores are
      served, never cookies. Edit chrome never mounts on TV or OBS. Google TV pairs with a 6-digit code; you do not
      type the IP or hex token.
    </p>
    <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={state.lanOverlayEnabled}
        onChange={(event) => void api().setLanOverlay(event.currentTarget.checked)}
        className="h-4 w-4 accent-you"
      />
      Allow devices on this Wi-Fi to load the overlay
    </label>
    {state.lanOverlayEnabled ? (
      <div className="mt-4 grid gap-3 text-sm">
        {state.overlayPairingCode ? (
          <div className="rounded-sm border border-line bg-bg px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">TV pairing code</p>
            <p className="mt-2 font-mono text-4xl tracking-[0.28em] text-you" aria-label="LAN overlay pairing code">
              {`${state.overlayPairingCode.slice(0, 3)} ${state.overlayPairingCode.slice(3)}`}
            </p>
            <p className="mt-2 text-sm text-muted">
              On the Google TV app, enter this 6-digit code. Same Wi-Fi. The code refreshes every 10 minutes; the HUD
              token stays valid until you toggle LAN overlay off.
            </p>
          </div>
        ) : null}
        {state.lanOverlayHost && state.overlayToken ? (
          <>
            <label className="grid gap-1">
              <span className="text-xs uppercase tracking-wide text-muted">Phone / browser URL</span>
              <input
                readOnly
                value={`http://${state.lanOverlayHost}:${state.overlayPort}/overlay?k=${state.overlayToken}&tv=1`}
                className="border border-line bg-bg px-3 py-2 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
                aria-label="LAN overlay URL"
              />
            </label>
            <p className="text-xs text-muted">
              OBS: http://127.0.0.1:{state.overlayPort}/overlay?surface=obs&k={state.overlayToken} — Port{' '}
              {state.overlayPort} · same network only.
            </p>
          </>
        ) : (
          <p className="text-xs text-air">
            No LAN IPv4 address found. Connect to Wi-Fi, then toggle this off and on. The pairing code still works if
            the TV can see this PC on the subnet.
          </p>
        )}
      </div>
    ) : null}
    <HowTo id="overlay" defaultOpen={!state.lanOverlayEnabled}>
      <li>
        <strong className="font-medium text-text">This PC:</strong> use the companion HUD / shortcuts — no LAN toggle
        required.
      </li>
      <li>
        <strong className="font-medium text-text">Phone or browser on the same Wi-Fi:</strong> turn on “Allow devices on
        this Wi-Fi to load the overlay”, then open the <strong className="font-medium text-text">Phone / browser URL</strong>{' '}
        shown.
      </li>
      <li>
        <strong className="font-medium text-text">OBS on this PC:</strong> browser source at{' '}
        <code className="font-mono text-xs text-text">127.0.0.1</code> on the overlay port. When LAN is on, copy the OBS
        URL shown (<code className="font-mono text-xs text-text">127.0.0.1</code> + token).
      </li>
      <li>
        <strong className="font-medium text-text">Google TV Sideline app (if already installed):</strong> enter the{' '}
        <strong className="font-medium text-text">6-digit pairing code</strong> on the same Wi-Fi. Code refreshes about
        every 10 minutes; you do not type the IP or hex token by hand.
      </li>
      <li>LAN only serves derived scores, never cookies. Studio edit chrome never mounts on TV or OBS.</li>
    </HowTo>
  </section>
)

export const ConnectScreen = ({
  state,
  onOpenBoards,
  initialPath = 'hub',
  discoverable,
  activeView = 'Connect'
}: {
  state: AppState
  onOpenBoards?: () => void
  initialPath?: ConnectPath
  discoverable?: League[]
  activeView?: string
}): JSX.Element => {
  const [path, setPath] = useState<ConnectPath>(initialPath)
  const [username, setUsername] = useState(state.sleeperUsername ?? '')
  const [leagueId, setLeagueId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [discovered, setDiscovered] = useState<League[]>(discoverable ?? [])
  const [discovering, setDiscovering] = useState(false)

  useEffect(() => {
    if (state.sleeperUsername) setUsername(state.sleeperUsername)
  }, [state.sleeperUsername])

  useEffect(() => {
    setPath(initialPath)
  }, [initialPath])

  useEffect(() => {
    if (discoverable) {
      setDiscovered(discoverable)
      setDiscovering(false)
    }
  }, [discoverable])

  const espnReady = state.espnConnected && !state.espnNeedsRelogin
  const sleeperReady = state.sleeperConnected
  const needsDiscovery =
    discoverable == null &&
    ((path === 'espn' && espnReady) || (path === 'sleeper' && sleeperReady))

  useEffect(() => {
    if (!needsDiscovery) return
    if (!window.sideline) return
    const provider: Provider = path === 'espn' ? 'espn' : 'sleeper'
    let cancelled = false
    setDiscovering(true)
    void window.sideline
      .listDiscoverableLeagues(provider)
      .then((result) => {
        if (cancelled) return
        setDiscovered(result.leagues)
        setDiscovering(false)
        if (!result.ok) setMessage(result.error ?? 'Could not list leagues')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setDiscovering(false)
        setMessage(error instanceof Error ? error.message : 'Could not list leagues')
      })
    return () => {
      cancelled = true
    }
  }, [needsDiscovery, path])

  const pathProvider: Provider | null = path === 'espn' || path === 'sleeper' ? path : null
  const connectedIds = pathProvider
    ? state.leagues.filter((row) => row.provider === pathProvider).map((row) => row.id)
    : []
  const discoveredForPath = (discoverable ?? discovered).filter((row) =>
    pathProvider != null && row.provider === pathProvider
  )
  const pathLeagues = leaguesToAdd(discoveredForPath, connectedIds)

  const handleSleeper = async (): Promise<void> => {
    const result = await api().connectSleeper(username)
    setMessage(result.ok ? 'Sleeper connected.' : result.error ?? 'Sleeper failed')
  }

  const handleEspn = async (): Promise<void> => {
    const result = await api().signInEspn()
    setMessage(result.ok ? 'ESPN session saved.' : 'ESPN sign-in closed before cookies were found.')
  }

  const handlePaste = async (): Promise<void> => {
    const result = await api().addEspnLeague(leagueId)
    setMessage(result.ok ? 'ESPN league added.' : result.error ?? 'Could not add league')
    if (result.ok) {
      setLeagueId('')
      onOpenBoards?.()
    }
  }

  const handleReportBug = async (): Promise<void> => {
    if (!window.sideline) return
    try {
      await reportBugFromConnect(window.sideline, activeView)
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not open GitHub')
    }
  }

  const handleCopyDiagnostics = async (): Promise<void> => {
    if (!window.sideline) return
    try {
      await copyDiagnosticsFromConnect(window.sideline)
      setMessage('Diagnostics copied.')
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Could not copy diagnostics')
    }
  }

  const hub = (
    <>
      <details
        className="connect-howto rounded-sm border border-line bg-card p-5"
        data-howto="getting-started"
        data-howto-default="closed"
      >
        <summary className="text-base font-semibold">Getting started</summary>
        <p className="mt-2 text-sm text-muted">
          Sideline is a companion for live fantasy while you watch. Connect ESPN and/or Sleeper, pick leagues, then
          show the HUD on this PC — or share it to a phone/TV on your Wi-Fi.
        </p>
      </details>

      <div className="grid gap-4 md:grid-cols-3">
        <HubCard
          id="espn"
          title="ESPN"
          status={espnHubStatus(state)}
          onOpen={state.replay ? undefined : () => setPath('espn')}
          openLabel={espnReady ? 'Add leagues' : 'Connect'}
          leagues={state.leagues.filter((row) => row.provider === 'espn')}
          onRemove={
            state.replay
              ? undefined
              : (league) => {
                  void api().removeEspnLeague(league.id)
                }
          }
          onSignOut={
            !state.replay && (state.espnConnected || state.espnNeedsRelogin)
              ? () => {
                  void api().disconnectEspn()
                }
              : undefined
          }
        />
        <HubCard
          id="sleeper"
          title="Sleeper"
          status={sleeperHubStatus(state)}
          onOpen={state.replay ? undefined : () => setPath('sleeper')}
          openLabel={sleeperReady ? 'Add leagues' : 'Connect'}
          leagues={state.leagues.filter((row) => row.provider === 'sleeper')}
          onRemove={
            state.replay
              ? undefined
              : (league) => {
                  void api().removeSleeperLeague(league.id)
                }
          }
          onSignOut={
            !state.replay && state.sleeperConnected
              ? () => {
                  void api().disconnectSleeper()
                }
              : undefined
          }
        />
        <HubCard
          id="tv"
          title="TV"
          status={tvHubStatus(state)}
          onOpen={() => setPath('tv')}
          openLabel={state.lanOverlayEnabled ? 'Manage' : 'Connect'}
          leagues={[]}
        />
      </div>

      <footer className="grid gap-2" data-connect-footer="settings">
        <section className="rounded-sm border border-line bg-card p-5" data-connect-updates="static">
          <h2 className="text-sm font-semibold text-muted">Updates</h2>
          <div className="mt-3">
            <UpdateSettings framed={false} />
          </div>
        </section>
        <details className="connect-howto rounded-sm border border-line bg-card p-5">
          <summary className="text-sm font-semibold text-muted">Keyboard shortcuts</summary>
          <div className="mt-3">
            <ShortcutSettings state={state} framed={false} />
          </div>
        </details>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            onClick={() => void handleReportBug()}
            className="w-fit cursor-pointer text-left text-sm text-muted hover:text-lime"
            data-connect-report="bug"
          >
            Report a bug
          </button>
          <button
            type="button"
            onClick={() => void handleCopyDiagnostics()}
            className="w-fit cursor-pointer text-left text-sm text-muted hover:text-lime"
            data-connect-report="diagnostics"
          >
            Copy diagnostics
          </button>
        </div>
      </footer>
    </>
  )

  const espnPath = (
    <section className="rounded-sm border border-line bg-card p-5">
      <PathHeader title="ESPN" onBack={() => setPath('hub')} />
      <p className="text-sm text-muted">
        Sign in through ESPN&apos;s own login window. Sideline never sees your password.
      </p>
      <p className="mt-2 text-xs text-muted">
        ESPN access is unofficial, uses your own login, and is for personal companion use only.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void handleEspn()} className={chromeFillPillClass('espn')}>
          Sign in with ESPN
        </button>
        {state.espnConnected || state.espnNeedsRelogin ? (
          <button type="button" onClick={() => void api().disconnectEspn()} className={chromePillClass(false, 'control')}>
            Sign out
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        {state.espnNeedsRelogin
          ? 'Cookies expired — sign in again.'
          : state.espnConnected
            ? 'Session cookies present on this machine.'
            : 'Not connected'}
      </p>
      {espnReady ? (
        <ProviderLeagues
          provider="espn"
          leagues={pathLeagues}
          connectedIds={connectedIds}
          discoveredCount={discoveredForPath.length}
          loading={discovering && discoveredForPath.length === 0}
          onAdded={onOpenBoards}
        />
      ) : null}
      <details className="connect-howto mt-4 border-t border-line pt-3" data-connect-advanced="espn">
        <summary className="text-xs font-semibold uppercase tracking-wide text-muted">Advanced</summary>
        <p className="mt-2 text-sm text-muted">Paste a numeric league ID from the ESPN fantasy URL if discovery misses it.</p>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="espn-league-id">
            ESPN league ID
          </label>
          <input
            id="espn-league-id"
            value={leagueId}
            onChange={(event) => setLeagueId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handlePaste()
            }}
            placeholder="paste ESPN league ID"
            className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => void handlePaste()} className={chromePillClass(false, 'control')}>
            Add league
          </button>
        </div>
      </details>
      <HowTo id="espn" defaultOpen={!state.espnConnected || state.espnNeedsRelogin}>
        <li>
          Click <strong className="font-medium text-text">Sign in with ESPN</strong>. Log in in ESPN’s own window.
          Sideline never sees your password; it only keeps session cookies on this PC.
        </li>
        <li>
          After the session is saved, Sideline lists your leagues. Leave them checked, uncheck any you do not want, then{' '}
          <strong className="font-medium text-text">Add selected</strong>. You land on Boards.
        </li>
        <li>
          If a league is missing, open <strong className="font-medium text-text">Advanced</strong> and paste the{' '}
          <strong className="font-medium text-text">league ID</strong> from the URL (
          <code className="font-mono text-xs text-text">leagueId=</code> followed by numbers).
        </li>
        <li>
          Remove a league from the hub, or <strong className="font-medium text-text">Sign out</strong> of ESPN. If
          cookies expire later, sign in again. ESPN access is unofficial, uses your login, and is for personal companion
          use only.
        </li>
      </HowTo>
    </section>
  )

  const sleeperPath = (
    <section className="rounded-sm border border-line bg-card p-5">
      <PathHeader title="Sleeper" onBack={() => setPath('hub')} />
      <p className="text-sm text-muted">Username only. No password. Production API.</p>
      <div className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="sleeper-username">
          Sleeper username
        </label>
        <input
          id="sleeper-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleSleeper()
          }}
          placeholder="sleeper username"
          className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-3 py-2 text-sm"
        />
        <button type="button" onClick={() => void handleSleeper()} className={chromeFillPillClass('you')}>
          Connect
        </button>
        {state.sleeperConnected ? (
          <button
            type="button"
            onClick={() => void api().disconnectSleeper()}
            className={chromePillClass(false, 'control')}
          >
            Sign out
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted">
        {state.sleeperConnected ? `Connected as ${state.sleeperUsername}` : 'Not connected'}
      </p>
      {sleeperReady ? (
        <ProviderLeagues
          provider="sleeper"
          leagues={pathLeagues}
          connectedIds={connectedIds}
          discoveredCount={discoveredForPath.length}
          loading={discovering && discoveredForPath.length === 0}
          onAdded={onOpenBoards}
        />
      ) : null}
      <HowTo id="sleeper" defaultOpen={!state.sleeperConnected}>
        <li>
          In the Sleeper app or on sleeper.com, find your <strong className="font-medium text-text">username</strong>{' '}
          (the handle you connect with — not your password).
        </li>
        <li>
          Type that username here and press Connect. Sideline uses Sleeper’s public API; no password.
        </li>
        <li>
          Your leagues appear as a checklist, all on. Uncheck any you do not want, then{' '}
          <strong className="font-medium text-text">Add selected</strong>. You land on Boards.
        </li>
        <li>
          Remove a league from the hub, or <strong className="font-medium text-text">Sign out</strong> of Sleeper.
        </li>
      </HowTo>
    </section>
  )

  let body: JSX.Element
  switch (path) {
    case 'hub':
      body = hub
      break
    case 'espn':
      body = espnPath
      break
    case 'sleeper':
      body = sleeperPath
      break
    case 'tv':
      body = <TvPath state={state} onBack={() => setPath('hub')} />
      break
    default: {
      const _never: never = path
      throw new Error(`Unhandled connect path: ${String(_never)}`)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-6" data-connect-path={path}>
      {body}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {state.error ? <p className="text-sm text-air">{state.error}</p> : null}
    </div>
  )
}
