import { cn } from "@/lib/cn";
import { THEM_STARTERS, YOU_STARTERS, type DemoStarter } from "@/lib/demo";
import { ScoreTick } from "@/components/score-tick";

function Rail({
  team,
  score,
  tone,
  starters,
  align = "left",
}: {
  team: string;
  score: string;
  tone: "you" | "them";
  starters: DemoStarter[];
  align?: "left" | "right";
}) {
  const nameClass = tone === "you" ? "text-you" : "text-them";
  return (
    <div className={cn("hud-frost w-[148px] sm:w-[168px]", align === "right" && "text-right")}>
      <div className={cn("font-cond text-[11px] font-bold uppercase tracking-[0.22em] text-muted")}>
        {tone === "you" ? "Your team" : "Them"}
      </div>
      <div className={cn("mt-1 font-cond text-2xl font-extrabold uppercase tracking-[0.08em]", nameClass)}>
        {team}
      </div>
      <div className="font-cond text-4xl font-extrabold leading-none text-frost">{score}</div>
      <div className="mt-3 grid gap-1">
        {starters.slice(0, 6).map((row, index) => (
          <div
            key={`${row.pos}-${row.name}`}
            className="grid grid-cols-[1.6rem_1fr_auto] items-baseline gap-1.5 text-left"
          >
            <span className="font-cond text-[10px] font-bold uppercase tracking-wide text-muted">{row.pos}</span>
            <span className="truncate font-cond text-[13px] font-bold uppercase tracking-[0.04em] text-frost">
              {row.name}
            </span>
            <span className="font-cond text-[13px] font-extrabold text-frost">
              {row.tick ? (
                <ScoreTick rest={row.pts} delta={row.tick} delayMs={index * 320} />
              ) : (
                row.pts
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HashmarkOverlay({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0", className)} aria-hidden="true">
      <span className="live-dot absolute left-1/2 top-4 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-lime" />
      <div className="absolute left-[2.5%] top-[8%] sm:left-[3.5%]">
        <Rail team="Squall" score="27" tone="you" starters={YOU_STARTERS} />
      </div>
      <div className="absolute right-[2.5%] top-[8%] sm:right-[3.5%]">
        <Rail team="Thunder" score="24" tone="them" starters={THEM_STARTERS} align="right" />
      </div>
    </div>
  );
}
