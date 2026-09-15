import { CompanionBoardCard } from "@/components/mockups/companion-board";
import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function CompanionSection() {
  return (
    <section id="features" className="border-t border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div>
          <SectionEyebrow>Companion board</SectionEyebrow>
          <SectionTitle>Real-time scoring tape. One board. No app-switching.</SectionTitle>
          <SectionLead>
            Pin the leagues that matter, keep the head-to-head in the center, and let the tape catch
            the ticks. Same live data as the HUD — Sleeper and ESPN, read-only.
          </SectionLead>
          <ul className="mt-8 grid gap-3 text-sm text-muted">
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              Watchlist of pinned leagues with live scores and sparkline.
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              You-vs-them starters as POS · NAME · PTS — lime +N / red −N when points move.
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              Scoring tape from real diffs. Quiet when nothing happened. Nothing invented.
            </li>
          </ul>
        </div>
        <CompanionBoardCard />
      </div>
    </section>
  );
}
