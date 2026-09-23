import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function CompanionSection() {
  return (
    <section id="features" className="border-t border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>Companion board</SectionEyebrow>
          <SectionTitle>Real-time scoring tape. One board. No app-switching.</SectionTitle>
          <SectionLead>
            Pin the leagues that matter, keep the head-to-head in the center, and let the tape catch
            the ticks. Same live data as the HUD — Sleeper and ESPN, read-only.
          </SectionLead>
          <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              My leagues rail: every pinned board with its live score and lead sparkline.
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              You-vs-them starters as POS · NAME · PTS, plus chance to win — ESPN&apos;s own, or
              Est. win% from Sleeper projections.
            </li>
            <li className="flex gap-3">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-you" />
              Scoring tape from real diffs: +pts, −pts, injuries, waivers. Quiet when nothing
              happened.
            </li>
          </ul>
        </div>
        <ProductStill
          still="companion"
          className="mt-12"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h3 className="font-cond text-2xl font-bold uppercase tracking-[0.06em]">Every league at a glance</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Leagues puts every Sleeper and ESPN matchup on one grid — live totals, lead bars,
              top scorers — with the all-leagues tape running beside it. Click a card to put that
              matchup on the Scoreboard and the HUD.
            </p>
          </div>
          <ProductStill
            still="leagues"
            frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            sizes="(min-width: 1152px) 690px, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
