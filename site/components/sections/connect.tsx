import { ProductStill } from "@/components/product-still";
import { SectionEyebrow, SectionTitle } from "@/components/ui";

export function ConnectSection() {
  return (
    <section id="how" className="border-t border-line bg-[#08090c] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionEyebrow>Connect</SectionEyebrow>
        <SectionTitle>Username. Your login. Nothing leaves this PC.</SectionTitle>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-sleeper">Sleeper</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em] text-lime">
              Username only
            </h3>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-espn">ESPN</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em] text-lime">
              Sign in here
            </h3>
          </article>
          <article className="border border-line bg-card p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-lime">Replay</p>
            <h3 className="mt-2 font-cond text-2xl font-bold uppercase tracking-[0.06em] text-lime">
              Scripted Sunday
            </h3>
          </article>
        </div>
        <ProductStill
          still="connect"
          className="mt-12"
          frameClassName="shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
          sizes="(min-width: 1152px) 1152px, 100vw"
        />
      </div>
    </section>
  );
}
