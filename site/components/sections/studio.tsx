import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function StudioSection() {
  return (
    <section id="studio" className="border-y border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>Overlay Studio</SectionEyebrow>
          <SectionTitle>Five placements. One click. Stay off the live rectangle.</SectionTitle>
          <SectionLead>
            Studio lives in the companion. Pick a preset, click a team frame, nudge position and
            size. Save over that slot. The center ~60% stays empty so RedZone and the national feed
            keep the picture.
          </SectionLead>
        </div>
        <ProductStill
          still="studio"
          className="mt-12 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <ol className="mt-10 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["1 · Far sides", "Full-height frost rails. Default Sunday look."],
            ["2 · Upper corners", "Shorter rails tucked to the top gutters."],
            ["3 · Lower corners", "Shorter rails tucked to the bottom."],
            ["4 · Same-side stack", "Both teams stacked on one sideline."],
            ["5 · Side bands", "You left-upper, them right-lower."],
          ].map(([title, body]) => (
            <li key={title} className="border-l-2 border-line pl-4">
              <p className="font-cond font-bold uppercase tracking-[0.1em] text-text">{title}</p>
              <p className="mt-1 text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
