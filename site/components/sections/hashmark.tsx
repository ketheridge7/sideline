import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

export function HashmarkSection() {
  return (
    <section id="overlay" className="section-rise py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Overlay</SectionEyebrow>
        <SectionTitle>Your matchup, on the broadcast.</SectionTitle>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
          The HUD sits on the game you are already watching: your score, their score, and the
          starters, kept off the play. A thin ticker runs the rest of the slate underneath.
        </p>
        <ProductStill
          still="overlay"
          className="mt-8"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
