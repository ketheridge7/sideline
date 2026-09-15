import { CompanionLaptop } from "@/components/mockups/companion-board";
import { FieldCanvas } from "@/components/mockups/field-canvas";
import { HeroHudRail, TvBezel } from "@/components/mockups/hero-hud";
import { CtaLink } from "@/components/ui";
import { DOWNLOAD_URL } from "@/lib/constants";

export function Hero() {
  return (
    <section id="top" className="hero-room relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-[8%] top-[18%] h-40 w-40 rounded-full bg-you/8 blur-3xl" />
        <div className="absolute right-[18%] top-[22%] h-72 w-72 rounded-full bg-lime/8 blur-[90px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.15fr)] lg:gap-6 lg:pb-24 lg:pt-6">
        <div className="rise relative z-10 max-w-xl">
          <h1 className="text-[2.35rem] font-medium leading-[1.05] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]">
            Your fantasy tape.
            <br />
            Always on the sideline.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Live Sleeper and ESPN matchups on a second screen — frosted HUD when you need it.
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
          <p className="mt-6 text-sm text-muted">
            Personal companion · No betting · Sleeper + ESPN
          </p>
        </div>

        <div className="relative fade min-h-[340px] sm:min-h-[420px] lg:min-h-[520px]">
          <TvBezel className="ml-auto w-[92%] max-w-[640px]">
            <FieldCanvas className="h-full w-full">
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/20" />
            </FieldCanvas>
          </TvBezel>

          <HeroHudRail className="absolute left-0 top-[8%] z-20 sm:left-[2%] lg:-left-2" />

          <div className="absolute -bottom-2 right-0 z-20 w-[78%] max-w-[380px] sm:bottom-4 sm:right-4">
            <CompanionLaptop />
          </div>
        </div>
      </div>

      <div className="relative h-16 wood-top">
        <div className="absolute -top-6 left-[18%] h-8 w-8 rounded-full bg-[#1a120c] shadow-[inset_-2px_-3px_4px_rgba(0,0,0,0.5)]" />
      </div>
    </section>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M4 2.5v9l8-4.5-8-4.5Z" />
    </svg>
  );
}
