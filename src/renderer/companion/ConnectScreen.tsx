import { useEffect, useState, type JSX, type ReactNode } from 'react'
import type { AppState } from '@shared/types'
import { ShortcutSettings } from './ShortcutSettings'
import { UpdateSettings } from './UpdateSettings'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

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

export const ConnectScreen = ({ state }: { state: AppState }): JSX.Element => {
  const [username, setUsername] = useState(state.sleeperUsername ?? '')
  const [leagueId, setLeagueId] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (state.sleeperUsername) setUsername(state.sleeperUsername)
  }, [state.sleeperUsername])

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
    if (result.ok) setLeagueId('')
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-4 p-6">
      <section className="rounded-sm border border-line bg-card p-5">
        <h2 className="text-base font-semibold">Getting started</h2>
        <p className="mt-1 text-sm text-muted">
          Sideline is a companion for live fantasy while you watch. Connect Sleeper and/or ESPN, pick a
          league on Boards, then show the HUD on this PC — or share it to a phone/TV on your Wi-Fi.
        </p>
      </section>

      <section className="rounded-sm border border-line bg-card p-5">
        <h2 className="text-base font-semibold">Sleeper</h2>
        <p className="mt-1 text-sm text-muted">Username only. No password. Production API.</p>
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
          <button
            type="button"
            onClick={() => void handleSleeper()}
            className="cursor-pointer bg-you px-4 py-2 text-sm font-medium text-bg"
          >
            Connect
          </button>
          {state.sleeperConnected ? (
            <button
              type="button"
              onClick={() => void api().disconnectSleeper()}
              className="cursor-pointer rounded-sm border border-line px-3 py-2 text-sm text-muted"
            >
              Disconnect
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted">
          {state.sleeperConnected ? `Connected as ${state.sleeperUsername}` : 'Not connected'}
        </p>
        <HowTo id="sleeper" defaultOpen={!state.sleeperConnected}>
          <li>
            In the Sleeper app or on sleeper.com, find your{' '}
            <strong className="font-medium text-text">username</strong> (the handle you connect with — not
            your password).
          </li>
          <li>
            Type that username here and press Connect. Sideline uses Sleeper’s public API; no password.
          </li>
          <li>
            After connect, your leagues appear under{' '}
            <strong className="font-medium text-text">Boards → My leagues</strong>.
          </li>
          <li>Select a Sleeper league there to drive the live HUD.</li>
        </HowTo>
      </section>

      <section className="rounded-sm border border-line bg-card p-5">
        <h2 className="text-base font-semibold">ESPN</h2>
        <p className="mt-1 text-sm text-muted">
          Sign in through ESPN&apos;s own login window. Sideline never sees your password.
        </p>
        <p className="mt-2 text-xs text-muted">
          ESPN access is unofficial, uses your own login, and is for personal companion use only.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleEspn()}
            className="cursor-pointer bg-espn px-4 py-2 text-sm font-medium text-white"
          >
            Sign in with ESPN
          </button>
          {state.espnConnected ? (
            <button
              type="button"
              onClick={() => void api().disconnectEspn()}
              className="cursor-pointer rounded-sm border border-line px-3 py-2 text-sm text-muted"
            >
              Disconnect
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
        <div className="mt-4 flex gap-2">
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
          <button
            type="button"
            onClick={() => void handlePaste()}
            className="cursor-pointer border border-line px-4 py-2 text-sm"
          >
            Add league
          </button>
        </div>
        <HowTo id="espn" defaultOpen={!state.espnConnected || state.espnNeedsRelogin}>
          <li>
            Click <strong className="font-medium text-text">Sign in with ESPN</strong>. Log in in ESPN’s own
            window. Sideline never sees your password; it only keeps session cookies on this PC.
          </li>
          <li>
            When status shows the session is saved, open your league on fantasy.espn.com.
          </li>
          <li>
            Copy the <strong className="font-medium text-text">league ID</strong> from the URL (
            <code className="font-mono text-xs text-text">leagueId=</code> followed by numbers).
          </li>
          <li>
            Paste that ID here and <strong className="font-medium text-text">Add league</strong>, then select
            it under Boards.
          </li>
          <li>
            If cookies expire later, sign in again. ESPN access is unofficial, uses your login, and is for
            personal companion use only.
          </li>
        </HowTo>
      </section>

      <section className="rounded-sm border border-line bg-card p-5">
        <h2 className="text-base font-semibold">TV overlay</h2>
        <p className="mt-1 text-sm text-muted">
          Share the HUD on your LAN so a phone or Google TV app can load it. Off by default — only
          derived scores are served, never cookies. Edit chrome never mounts on TV or OBS. Google TV
          pairs with a 6-digit code; you do not type the IP or hex token.
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
                  On the Google TV app, enter this 6-digit code. Same Wi-Fi. The code refreshes every 10
                  minutes; the HUD token stays valid until you toggle LAN overlay off.
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
                No LAN IPv4 address found. Connect to Wi-Fi, then toggle this off and on. The pairing code
                still works if the TV can see this PC on the subnet.
              </p>
            )}
          </div>
        ) : null}
        <HowTo id="overlay" defaultOpen={!state.lanOverlayEnabled}>
          <li>
            <strong className="font-medium text-text">This PC:</strong> use the companion HUD / shortcuts — no
            LAN toggle required.
          </li>
          <li>
            <strong className="font-medium text-text">Phone or browser on the same Wi-Fi:</strong> turn on
            “Allow devices on this Wi-Fi to load the overlay”, then open the{' '}
            <strong className="font-medium text-text">Phone / browser URL</strong> shown.
          </li>
          <li>
            <strong className="font-medium text-text">OBS on this PC:</strong> browser source at{' '}
            <code className="font-mono text-xs text-text">127.0.0.1</code> on the overlay port. When LAN is
            on, copy the OBS URL shown (<code className="font-mono text-xs text-text">127.0.0.1</code> +
            token).
          </li>
          <li>
            <strong className="font-medium text-text">Google TV Sideline app (if already installed):</strong>{' '}
            enter the <strong className="font-medium text-text">6-digit pairing code</strong> on the same
            Wi-Fi. Code refreshes about every 10 minutes; you do not type the IP or hex token by hand.
          </li>
          <li>
            LAN only serves derived scores, never cookies. Studio edit chrome never mounts on TV or OBS.
          </li>
        </HowTo>
      </section>

      <UpdateSettings />

      <ShortcutSettings state={state} />

      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {state.error ? <p className="text-sm text-air">{state.error}</p> : null}
      {state.replay ? (
        <p className="text-sm text-lime">Replay mode is on — jittered 2025 fixtures, both providers loaded.</p>
      ) : null}
    </div>
  )
}
