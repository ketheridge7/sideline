import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

const PROBLEMS = [
  {
    title: "Eyes off the broadcast",
    body: "Phone apps steal the snap. Sideline lives on a second screen, or as frost on the rails, so the game stays in the middle.",
  },
  {
    title: "Tickers, not a matchup",
    body: "Most overlays cycle eight teams. Sunday is one board: your starters, their starters, live ticks — side by side.",
  },
  {
    title: "Noise that is not the game",
    body: "No sportsbook chrome. No odds. No write actions. A personal companion for Sleeper and ESPN while you watch.",
  },
] as const;

export function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:py-28">
      <SectionEyebrow>The Sunday problem</SectionEyebrow>
      <SectionTitle>
        You are in one matchup.
        <br />
        Your phone is in another room.
      </SectionTitle>
      <SectionLead>
        Sideline is the production truck for a single head-to-head: companion board on the coffee
        table, Hashmark HUD on the TV, Overlay Studio when the broadcast chrome moves.
      </SectionLead>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {PROBLEMS.map((item) => (
          <article key={item.title} className="border border-line bg-card p-6">
            <h3 className="font-cond text-lg font-bold uppercase tracking-[0.08em] text-text">
              {item.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
