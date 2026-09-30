import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

const PLACEMENTS = [
  { title: "Far sides", body: "Each team on a sideline, left and right." },
  { title: "Upper corners", body: "Tight to the top of the picture." },
  { title: "Lower corners", body: "Under the broadcast, above the ticker." },
  { title: "Same-side stack", body: "Both teams stacked on one side." },
  { title: "Side bands", body: "Full rails along the edges." },
] as const;

export function StudioSection() {
  return (
    <section id="studio" className="section-rise border-y border-line bg-[#08090c] py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Overlay Studio</SectionEyebrow>
        <SectionTitle>Place the HUD where the broadcast isn’t.</SectionTitle>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          Five presets, then sliders if you want it tighter. The preview is the same HUD that goes
          on the game.
        </p>
        <ProductStill
          still="studio"
          className="mt-8"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <ol className="mt-10 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {PLACEMENTS.map((item, index) => (
            <li key={item.title} className="border-l-2 border-lime pl-4">
              <p className="font-cond font-bold uppercase tracking-[0.1em] text-lime">
                {index + 1} · {item.title}
              </p>
              <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
