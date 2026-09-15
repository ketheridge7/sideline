import type { JSX } from 'react'
import markUrl from '../assets/sideline-mark.svg?url'

/** Packaging mark + SIDELINE. Mark is a renderer copy of `build/icon.svg`. */
export const SidelineWordmark = (): JSX.Element => (
  <span className="flex items-center gap-2.5" data-wordmark="sideline">
    <img
      src={markUrl}
      alt=""
      width={22}
      height={22}
      className="h-[22px] w-[22px] shrink-0 rounded-[22%]"
      draggable={false}
      aria-hidden="true"
    />
    <span className="relative pb-1">
      <span className="font-cond text-xl font-extrabold uppercase leading-none tracking-[0.16em]">SIDELINE</span>
      <span
        className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#7DFFB0] via-[#A6E6A0] to-[#D6F34A]"
        data-wordmark="underline"
        aria-hidden="true"
      />
    </span>
  </span>
)
