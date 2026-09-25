import { ProductStill } from "@/components/product-still";
import { CtaLink } from "@/components/ui";
import { DOWNLOAD_URL } from "@/lib/constants";

export function Hero() {
  return (
    <section id="top" className="hero-room relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-you/8 blur-3xl" />
        <div className="absolute right-[18%] top-[22%] h-72 w-72 rounded-full bg-lime/8 blur-[90px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-8 lg:pb-20 lg:pt-6">
        <div className="rise relative z-10 max-w-xl">
          <h1 className="text-[2.35rem] font-medium leading-[1.05] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]">
            Your fantasy matchup.
            <br />
            Always on the Sideline
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Live Sleeper and ESPN matchups on a second screen.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <CtaLink href={DOWNLOAD_URL} external>
              Download for Windows
            </CtaLink>
            <CtaLink href="/#how" variant="ghost">
              <PlayIcon />
              See how it works
            </CtaLink>
          </div>
        </div>

        <ProductStill
          still="hero"
          preload
          className="fade"
          frameClassName="shadow-[0_32px_80px_rgba(0,0,0,0.45)]"
          sizes="(min-width: 1024px) 55vw, 100vw"
        />
      </div>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg className="translate-y-px" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v9l8-4.5-8-4.5Z" />
    </svg>
  );
}
