import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function ConnectSection() {
  return (
    <section id="how" className="border-t border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Connect & trust</SectionEyebrow>
        <SectionTitle>Username. Your login. Nothing leaves this PC.</SectionTitle>
        <SectionLead>
          Connect in the companion, pin a league, then raise the HUD. Sideline has no backend for
          your leagues. ESPN cookies never leave the machine.
        </SectionLead>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-sleeper">Sleeper</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em]">Username only</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Type your Sleeper username — not email, not password. Sideline uses the official
              read-only HTTP API, then lists your NFL leagues for the current season.
            </p>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-espn">ESPN</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em]">Sign in here</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              An in-app window opens ESPN&apos;s own login (2FA included). Sideline never sees your
              password. It reads session cookies on this machine for personal companion use only.
            </p>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-you">Trust</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em]">Personal companion</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              No betting, no Yahoo, no DFS, no lineup writes. Out of scope on purpose. If ESPN
              cookies expire, sign in again the same way.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
