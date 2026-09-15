import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { HeroHudRow } from "@/lib/demo";
import { HERO_HUD } from "@/lib/demo";
import { ScoreTick } from "@/components/score-tick";

function HudRowView({ row, index }: { row: HeroHudRow; index: number }) {
  switch (row.kind) {
    case "team":
      return (
        <div className="grid gap-0.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-cond text-[15px] font-extrabold tracking-[0.08em] text-frost">
              {row.abbr}
            </span>
            <span className="font-cond text-[22px] font-extrabold leading-none text-frost">
              {row.score}
            </span>
          </div>
          <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
            <span>{row.player}</span>
            <span className="tabular-nums">{row.pts}</span>
          </div>
        </div>
      );
    case "tick": {
      const down = row.delta.startsWith("-");
      return (
        <div className="grid gap-0.5">
          <div className="flex items-baseline justify-between">
            <span className={`font-cond text-[22px] font-extrabold leading-none ${down ? "text-air" : "text-lime"}`}>
              <ScoreTick rest={row.delta} delta={row.delta} delayMs={index * 420} />
            </span>
          </div>
          <div className="flex items-baseline justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
            <span>{row.player}</span>
            <span className="tabular-nums">{row.pts}</span>
          </div>
        </div>
      );
    }
    default: {
      const _never: never = row;
      return _never;
    }
  }
}

export function HeroHudRail({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass-rail hud-frost w-[148px] px-3 py-4 sm:w-[168px] sm:px-4 sm:py-5",
        className,
      )}
      aria-hidden="true"
    >
      <div className="grid gap-3">
        {HERO_HUD.map((row, index) => (
          <HudRowView
            key={row.kind === "team" ? row.abbr : `${row.player}-${row.delta}`}
            row={row}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

export function TvBezel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div className="rounded-[18px] border border-white/10 bg-black p-2 shadow-[0_40px_80px_rgba(0,0,0,0.55)] sm:p-2.5">
        <div className="relative aspect-video overflow-hidden rounded-[10px] bg-[#0c2418]">
          {children}
        </div>
      </div>
      <div className="mx-auto h-8 w-[38%] bg-gradient-to-b from-[#1a1c22] to-[#0c0d10]" />
      <div className="mx-auto h-1.5 w-[52%] rounded-b-sm bg-[#14161c]" />
    </div>
  );
}
