import { Kbd, SectionEyebrow, SectionTitle } from "@/components/ui";

const SURFACES = [
  { title: "Windows companion + HUD", detail: null },
  { title: "OBS", detail: "http://127.0.0.1:7333/overlay" },
  { title: "Phone on this Wi-Fi", detail: null },
  { title: "Google TV", detail: null },
] as const;

export function SurfacesSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:py-28">
      <SectionEyebrow>Surfaces</SectionEyebrow>
      <SectionTitle>Desktop first. Overlay everywhere it belongs.</SectionTitle>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {SURFACES.map((surface) => (
          <article key={surface.title} className="border border-line bg-card p-6">
            <h3 className="font-cond text-xl font-bold uppercase tracking-[0.06em] text-lime">
              {surface.title}
            </h3>
            {surface.detail ? <p className="mt-3 font-mono text-sm text-muted">{surface.detail}</p> : null}
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        HUD hotkey <Kbd>Ctrl + Shift + O</Kbd>
        <span className="mx-2 text-line">·</span>
        next display <Kbd>Ctrl + Shift + M</Kbd>
        <span className="mx-2 text-line">·</span>
        cycle leagues <Kbd>[</Kbd> <Kbd>]</Kbd>
      </p>
    </section>
  );
}
