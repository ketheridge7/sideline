import type { JSX } from 'react'
import { updateBannerText } from '@shared/updater'

export const UpdateCountdownBanner = ({
  version,
  seconds,
  onRestart,
  onLater
}: {
  version: string
  seconds: number
  onRestart: () => void
  onLater: () => void
}): JSX.Element => (
  <div
    className="pointer-events-auto absolute bottom-5 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-lime/50 bg-card px-4 py-2 shadow-[0_0_24px_rgba(182,255,59,0.2)]"
    role="status"
    data-update-banner="countdown"
  >
    <p className="text-sm text-text">{updateBannerText(version, seconds)}</p>
    <button
      type="button"
      onClick={onRestart}
      className="no-drag cursor-pointer rounded-full bg-lime px-3 py-1 text-sm font-medium text-bg"
      data-update-restart="now"
    >
      Restart now
    </button>
    <button
      type="button"
      onClick={onLater}
      className="no-drag cursor-pointer rounded-full bg-white/[0.06] px-3 py-1 text-sm text-muted ring-1 ring-lime/40 hover:text-text"
      data-update-restart="later"
    >
      Later
    </button>
  </div>
)
