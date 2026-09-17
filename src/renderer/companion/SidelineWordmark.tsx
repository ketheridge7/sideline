import type { JSX } from 'react'
import markUrl from '../assets/broadcast-s.svg?url'

/**
 * Companion brand lock (2026-09-16): broadcast S v2 + SIDELINE.
 * Swap `src/renderer/assets/broadcast-s.svg` (and `broadcast-wordmark.svg`) when Designer drops a polish pass.
 */
export const SidelineWordmark = (): JSX.Element => (
  <span className="flex items-center gap-2" data-wordmark="sideline" data-mark="broadcast-s">
    <img
      src={markUrl}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 shrink-0"
      draggable={false}
      aria-hidden="true"
    />
    <span className="font-cond text-xl font-extrabold uppercase leading-none tracking-[0.11em] text-ice">
      SIDELINE
    </span>
  </span>
)
