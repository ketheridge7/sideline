import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

export function CompanionSection() {
  return (
    <section id="features" className="border-t border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>Companion board</SectionEyebrow>
          <SectionTitle>Real-time scoring. One board. No app-switching.</SectionTitle>
        </div>
        <ProductStill
          still="companion"
          className="mt-12"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <div className="mt-14">
          <h3 className="font-cond text-2xl font-bold uppercase tracking-[0.06em] text-lime">Leagues</h3>
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
