"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function ScoreTick({
  rest,
  delta,
  className,
  delayMs = 0,
}: {
  rest: string;
  delta: string;
  className?: string;
  delayMs?: number;
}) {
  const [ticking, setTicking] = useState(false);
  const down = delta.startsWith("-");

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return undefined;

    let restTimer = 0;
    let tickTimer = 0;
    let startTimer = 0;

    const loop = () => {
      tickTimer = window.setTimeout(() => {
        setTicking(true);
        restTimer = window.setTimeout(() => {
          setTicking(false);
          loop();
        }, 1100);
      }, 2600);
    };

    startTimer = window.setTimeout(loop, delayMs + 900);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(tickTimer);
      window.clearTimeout(restTimer);
    };
  }, [delayMs]);

  return (
    <span
      className={cn(
        "inline-block font-cond font-extrabold tabular-nums",
        ticking ? (down ? "text-air tick-live" : "text-lime tick-live") : className,
      )}
    >
      {ticking ? delta : rest}
    </span>
  );
}
