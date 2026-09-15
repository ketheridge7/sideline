import type { JSX } from 'react'
import markUrl from '../assets/sideline-mark.svg?url'

/** Compact packaging mark + SIDELINE. The SVG is a renderer copy of `build/icon.svg`. */
export const SidelineWordmark = (): JSX.Element => (
  <span className="flex items-center gap-2" data-wordmark="sideline">
    <img
      src={markUrl}
      alt=""
      width={22}
      height={22}
      className="h-[22px] w-[22px] shrink-0 rounded-[5px]"
      draggable={false}
      aria-hidden="true"
    />
    <span className="font-cond text-2xl font-extrabold uppercase italic tracking-[0.14em]">SIDELINE</span>
  </span>
)
