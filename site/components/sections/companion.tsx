import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

export function CompanionSection() {
  return (
    <section id="features" className="section-rise border-t border-line bg-[#08090c] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>Companion</SectionEyebrow>
          <SectionTitle>Real-time scoring. One board. No app-switching.</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            Starters, the bench, and the scoring tape stay on the Scoreboard while the game is on
            the other screen. The watchlist keeps the rest of your leagues in the corner.
          </p>
        </div>
        <ProductStill
          still="companion"
          className="mt-8"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <div className="mt-14">
          <h3 className="font-cond text-2xl font-bold uppercase tracking-[0.06em] text-text">
            Every league, one grid
          </h3>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
            Open Leagues to see every matchup at once. Pin the one you want on the Scoreboard and
            the HUD.
          </p>
          <ProductStill
            still="leagues"
            className="mt-6"
            frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
            sizes="(min-width: 1152px) 1152px, 100vw"
          />
        </div>
      </div>
    </section>
  );
}
