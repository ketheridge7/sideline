import { ProductStill } from "@/components/product-still";
import { SectionEyebrow } from "@/components/ui";

export function ConnectSection() {
  return (
    <section id="how" className="bg-[#08090c] py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Connect</SectionEyebrow>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-base font-bold uppercase tracking-[0.18em] text-sleeper">Sleeper</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em] text-text">
              Username only
            </h3>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-base font-bold uppercase tracking-[0.18em] text-espn">ESPN</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em] text-text">
              Sign in
            </h3>
          </article>
        </div>
        <ProductStill
          still="connect"
          className="mt-8"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
