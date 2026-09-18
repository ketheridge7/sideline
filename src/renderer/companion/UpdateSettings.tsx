import { useEffect, useState, type JSX } from 'react'
import { updateStatusCopy, type UpdateSnapshot } from '@shared/updater'
import { chromeFillPillClass, chromePillClass } from './chrome'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

const idleSnapshot = (): UpdateSnapshot => ({ state: 'idle', currentVersion: '' })

export const UpdateSettings = ({ framed = true }: { framed?: boolean }): JSX.Element => {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot>(idleSnapshot)

  useEffect(() => {
    if (!window.sideline) return
    void window.sideline.getUpdateStatus().then(setSnapshot)
    return window.sideline.onUpdate(setSnapshot)
  }, [])

  const copy = updateStatusCopy(snapshot, snapshot.currentVersion)
  const busy = snapshot.state === 'checking' || snapshot.state === 'downloading'

  const body = (
    <>
      {framed ? <h2 className="text-base font-semibold">Updates</h2> : null}
      <p className={`${framed ? 'mt-1' : ''} text-sm text-muted`}>
        Installed Windows builds check public GitHub Releases. <code className="text-xs">npm start</code> does not.
      </p>
      <p className="mt-3 text-sm text-muted" data-update-state={snapshot.state}>
        {copy.body}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void api().checkForUpdates()}
          disabled={busy}
          className={`${chromePillClass(false, 'control')} disabled:opacity-40`}
        >
          Check for updates
        </button>
        {snapshot.state === 'downloaded' ? (
          <button
            type="button"
            onClick={() => void api().installUpdate()}
            className={chromeFillPillClass('you')}
          >
            Restart to install
          </button>
        ) : null}
      </div>
    </>
  )

  if (!framed) return <div>{body}</div>
  return <section className="rounded-sm border border-line bg-card p-5">{body}</section>
}
