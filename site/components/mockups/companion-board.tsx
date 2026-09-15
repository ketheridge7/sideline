import { cn } from "@/lib/cn";
import { COMPANION_LEAGUES, COMPANION_WATCH, HERO_WATCHLIST, TAPE_STILLS } from "@/lib/demo";
import { ScoreTick } from "@/components/score-tick";

function Spark({ up }: { up: boolean }) {
  return (
    <svg width="42" height="16" viewBox="0 0 42 16" fill="none" aria-hidden="true">
      <path
        d={up ? "M1 12 L8 9 L15 11 L22 6 L29 8 L41 3" : "M1 4 L8 7 L15 5 L22 9 L29 8 L41 13"}
        stroke={up ? "#B6FF3B" : "#FF4D4D"}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CompanionLaptop({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden rounded-[12px] border border-white/12 bg-[#0b0c0e] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        <div className="overflow-hidden rounded-[8px] border border-line bg-bg">
          <LaptopScreen />
        </div>
      </div>
      <div className="relative mx-auto h-2 w-[108%] -translate-x-[4%] rounded-b-[10px] bg-[#1a1c22]">
        <div className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b bg-[#2a2d36]" />
      </div>
    </div>
  );
}

function LaptopScreen() {
  return (
    <div className="min-h-[220px] bg-card sm:min-h-[260px]">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="font-cond text-[11px] font-extrabold uppercase tracking-[0.2em] text-text">
          Sunday Tape
        </span>
        <span className="flex items-center gap-1.5 font-cond text-[10px] font-bold uppercase tracking-[0.16em] text-lime">
          <span className="live-dot inline-block h-1.5 w-1.5 bg-lime" />
          Live
        </span>
      </div>
      <div className="border-b border-line px-3 py-2">
        <p className="font-cond text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Scoring tape</p>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {TAPE_STILLS.map((still) => (
            <div
              key={still.name}
              className="aspect-[5/4] overflow-hidden rounded-[2px] border border-line bg-[#12181c]"
            >
              <div className="flex h-full flex-col justify-end bg-[radial-gradient(circle_at_30%_20%,rgba(166,230,160,0.18),transparent_55%)] p-1">
                <span className="font-cond text-[8px] font-bold uppercase tracking-wide text-frost">
                  {still.name}
                </span>
                <span className="font-cond text-[10px] font-extrabold text-lime">{still.tick}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-3 py-2">
        <p className="font-cond text-[9px] font-bold uppercase tracking-[0.2em] text-muted">Watchlist</p>
        <div className="mt-1 grid gap-1">
          {HERO_WATCHLIST.map((row, index) => {
            const down = row.delta.startsWith("-");
            return (
              <div key={row.player} className="flex items-center gap-2 text-[10px]">
                <span className="min-w-0 flex-1 truncate font-medium text-text">{row.player}</span>
                <span className="text-muted">{row.nfl}</span>
                <span className="w-8 text-right font-cond font-bold tabular-nums">{row.pts}</span>
                <span className={cnDelta(down)}>
                  <ScoreTick rest={row.delta} delta={row.delta} delayMs={index * 280} />
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="font-cond text-[10px] font-bold uppercase tracking-[0.12em] text-you">
            You&apos;re up by 6.4
          </span>
          <span className="h-1 flex-1 overflow-hidden bg-line">
            <span className="block h-full w-[62%] bg-you" />
          </span>
        </div>
        <p className="mt-1 text-right font-cond text-[9px] font-bold uppercase tracking-[0.14em] text-muted">
          2nd Qtr · 8:42
        </p>
      </div>
    </div>
  );
}

function cnDelta(down: boolean): string {
  return `w-8 text-right font-cond text-[11px] font-extrabold ${down ? "text-air" : "text-lime"}`;
}

export function CompanionBoardCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[#0b0c0e] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between border-b border-line bg-card px-3 py-2">
        <span className="font-cond text-[11px] font-extrabold uppercase tracking-[0.18em]">
          SIDELINE
        </span>
        <span className="flex items-center gap-2 font-cond text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
          <span className="rounded-sm bg-lime/15 px-1.5 py-0.5 text-lime">Live</span>
          Qtr 2 · 8:37
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="font-cond text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            Scoring tape
          </p>
          <div className="mt-2 grid gap-1.5">
            {COMPANION_LEAGUES.map((league) => (
              <div
                key={league.abbr}
                className="flex items-center gap-2 border-b border-line pb-1.5 last:border-0"
              >
                <span className="w-8 font-cond text-sm font-extrabold tracking-wide">{league.abbr}</span>
                <span className="font-cond text-lg font-extrabold">{league.score}</span>
                <span className="ml-auto font-cond text-[11px] tabular-nums text-muted">
                  {league.clock}
                </span>
                <span className="font-cond text-[11px] font-bold text-muted">{league.qtr}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="font-cond text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
            My watchlist
          </p>
          <div className="mt-2 grid gap-2">
            {COMPANION_WATCH.map((row) => (
              <div key={row.player} className="grid gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium">{row.player}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">
                    {row.nfl} · {row.pos}
                  </span>
                  <span className="ml-auto">
                    <Spark up={row.up} />
                  </span>
                </div>
                <p className="font-cond text-[11px] uppercase tracking-[0.08em] text-muted">{row.line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
