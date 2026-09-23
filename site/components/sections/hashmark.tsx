import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

export function HashmarkSection() {
  return (
    <section id="overlay" className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Hashmark overlay</SectionEyebrow>
        <SectionTitle>
          Frosted type on the rails.
          <br />
          Empty center for the game.
        </SectionTitle>
        <SectionLead>
          Always-on-top HUD on the broadcast PC, or on the TV through the Google TV app. Modules
          sit on the sidelines so live video stays the product — team names, scores, starter
          rails, and an optional NFL ticker. No smoke wash, no card.
        </SectionLead>
        <ProductStill
          still="overlay"
          className="mt-12"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
