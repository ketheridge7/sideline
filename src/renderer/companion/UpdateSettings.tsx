import { useEffect, useState, type JSX } from 'react'
import type { UpdateSnapshot } from '@shared/updater'
import { chromeFillPillClass, chromePillClass } from './chrome'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const idleSnapshot = (): UpdateSnapshot => ({ state: 'idle', currentVersion: '' })

const versionOf = (snapshot: UpdateSnapshot): string | null =>
  snapshot.state === 'available' || snapshot.state === 'not-available' || snapshot.state === 'downloaded'
    ? snapshot.version
    : null

export const UpdateSettings = ({ framed = true }: { framed?: boolean }): JSX.Element => {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot>(idleSnapshot)
  const [latest, setLatest] = useState<string | null>(null)

  useEffect(() => {
    if (!window.sideline) return
    void window.sideline.getUpdateStatus().then((next) => {
      setSnapshot(next)
      const version = versionOf(next)
      if (version) setLatest(version)
    })
    return window.sideline.onUpdate((next) => {
      setSnapshot(next)
      const version = versionOf(next)
      if (version) setLatest(version)
    })
  }, [])

  const shownLatest = versionOf(snapshot) ?? (snapshot.state === 'downloading' ? latest : null)
  const canDownload = snapshot.state === 'available' || snapshot.state === 'downloading' || snapshot.state === 'downloaded'
  const busy = snapshot.state === 'checking' || snapshot.state === 'downloading'

  const body = (
    <div data-update-state={snapshot.state}>
      {framed ? <h2 className="text-base font-semibold">Updates</h2> : null}
      {snapshot.currentVersion ? (
        <p className={`${framed ? 'mt-3' : ''} text-sm text-text`} data-update-current={snapshot.currentVersion}>
          {snapshot.currentVersion}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void api().checkForUpdates()}
          disabled={busy}
          className={`${chromePillClass(false, 'control')} disabled:opacity-40`}
        >
          Check for updates
        </button>
        {canDownload ? (
          <button
            type="button"
            onClick={() => void (snapshot.state === 'downloaded' ? api().installUpdate() : api().downloadUpdate())}
            disabled={snapshot.state === 'downloading'}
            className={`${chromeFillPillClass('you')} disabled:opacity-40`}
            data-update-download={snapshot.state === 'downloaded' ? 'install' : 'fetch'}
          >
            Download
          </button>
        ) : null}
      </div>
      {shownLatest ? (
        <p className="mt-3 text-sm text-text" data-update-latest={shownLatest}>
          {shownLatest}
        </p>
      ) : null}
    </div>
  )

  if (!framed) return body
  return <section className="rounded-sm border border-line bg-card p-5">{body}</section>
}
