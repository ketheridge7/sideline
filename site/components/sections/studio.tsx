import { ProductStill } from "@/components/product-still";
import { SectionEyebrow } from "@/components/ui";

export function StudioSection() {
  return (
    <section id="studio" className="border-y border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-3xl">
          <SectionEyebrow>Overlay Studio</SectionEyebrow>
        </div>
        <ProductStill
          still="studio"
          className="mt-12"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
        <ol className="mt-10 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {["1 · Far sides", "2 · Upper corners", "3 · Lower corners", "4 · Same-side stack", "5 · Side bands"].map(
            (title) => (
              <li key={title} className="border-l-2 border-lime pl-4">
                <p className="font-cond font-bold uppercase tracking-[0.1em] text-lime">{title}</p>
              </li>
            ),
          )}
        </ol>
      </div>
    </section>
  );
}
