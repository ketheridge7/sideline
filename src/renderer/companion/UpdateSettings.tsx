import type { JSX } from 'react'
import { updateSettingsLabel, type UpdateSnapshot } from '@shared/updater'
import { chromePillClass } from './chrome'
import { useUpdateStatus } from './useUpdateStatus'

const api = (): NonNullable<Window['sideline']> => {
  if (!window.sideline) throw new Error('Sideline preload missing')
  return window.sideline
}

export const UpdateSettings = ({
  framed = true,
  initialSnapshot
}: {
  framed?: boolean
  initialSnapshot?: UpdateSnapshot
}): JSX.Element => {
  const live = useUpdateStatus()
  const snapshot = initialSnapshot ?? live
  const label = updateSettingsLabel(snapshot)
  const busy =
    snapshot.state === 'checking' ||
    snapshot.state === 'downloading' ||
    snapshot.state === 'countdown' ||
    snapshot.state === 'installing'

  const body = (
    <div data-update-state={snapshot.state}>
      {framed ? <h2 className="text-base font-semibold">Updates</h2> : null}
      {snapshot.currentVersion ? (
        <p className={`${framed ? 'mt-3' : ''} text-sm text-text`} data-update-current={snapshot.currentVersion}>
          v{snapshot.currentVersion}
        </p>
      ) : null}
      <div className={`${snapshot.currentVersion || framed ? 'mt-4' : ''} flex flex-wrap items-center gap-3`}>
        <button
          type="button"
          onClick={() => void api().checkForUpdates()}
          disabled={busy || snapshot.state === 'disabled'}
          className={`${chromePillClass(false, 'control')} disabled:opacity-40`}
        >
          Check for updates
        </button>
        {snapshot.state === 'disabled' ? (
          <p className="text-sm text-muted" data-update-note="dev">
            {label}
          </p>
        ) : null}
      </div>
      {snapshot.state !== 'disabled' && label ? (
        snapshot.state === 'downloaded' ? (
          <button
            type="button"
            onClick={() => void api().installUpdate()}
            className="no-drag mt-3 cursor-pointer rounded-full bg-lime/10 px-3 py-1 text-sm text-lime ring-1 ring-lime"
            data-update-status="downloaded"
          >
            {label}
          </button>
        ) : (
          <p className="mt-3 text-sm text-text" data-update-status={snapshot.state}>
            {label}
          </p>
        )
      ) : null}
    </div>
  )

  if (!framed) return body
  return <section className="rounded-sm border border-line bg-card p-5">{body}</section>
}
