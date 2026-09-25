import { ProductStill } from "@/components/product-still";
import { SectionEyebrow } from "@/components/ui";

export function HashmarkSection() {
  return (
    <section id="overlay" className="py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Overlay</SectionEyebrow>
        <ProductStill
          still="overlay"
          className="mt-12"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
