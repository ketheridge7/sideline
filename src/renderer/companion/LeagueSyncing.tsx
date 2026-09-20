import type { JSX } from 'react'

export const LeagueSyncingBanner = (): JSX.Element => (
  <div
    className="flex flex-wrap items-center gap-3 border-b border-lime/30 bg-lime/5 px-5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-muted"
    data-league-sync="refreshing"
    aria-busy="true"
    aria-live="polite"
  >
    <span className="font-cond font-bold text-lime">Refreshing</span>
    <span>Updating this week&apos;s scores</span>
  </div>
)

export const LeagueSyncingMark = (): JSX.Element => (
  <span
    className="font-cond text-[10px] font-bold uppercase tracking-wide text-lime"
    data-league-sync="refreshing"
    aria-busy="true"
  >
    Syncing
  </span>
)
