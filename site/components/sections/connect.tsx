import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

export function ConnectSection() {
  return (
    <section id="how" className="section-rise bg-[#08090c] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>How it works</SectionEyebrow>
        <SectionTitle>Connect the leagues you already play.</SectionTitle>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Sideline reads your matchups. It does not change lineups, waivers, or trades.
        </p>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-sm font-bold uppercase tracking-[0.18em] text-sleeper">Sleeper</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-text">Username only</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Type the handle from the Sleeper app or sleeper.com. No password. Uncheck any league
              you do not want, then add the rest. Click a league to put that matchup on the
              Scoreboard and the HUD.
            </p>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-sm font-bold uppercase tracking-[0.18em] text-[#ff8a8a]">ESPN</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-text">Sign in on your PC</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Sign in through ESPN’s own window. Sideline never sees your password. Cookies stay on
              this machine and expire after a few weeks. If a league is missing, paste the numeric
              ID from the fantasy URL.
            </p>
          </article>
        </div>
        <ProductStill
          still="connect"
          className="mt-8"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
