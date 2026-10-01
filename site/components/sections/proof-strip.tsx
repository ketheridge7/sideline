import Image from "next/image";

const logoClass = "h-5 w-5 shrink-0 sm:h-[26px] sm:w-[26px]";

export function ProofStrip() {
  return (
    <section className="border-y border-line bg-card/60" aria-label="Works with">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-5 py-6 sm:gap-x-4 sm:px-6">
        <Image
          src="/images/sleeper.png"
          alt=""
          width={225}
          height={225}
          sizes="28px"
          aria-hidden="true"
          className={logoClass}
        />
        <p className="max-w-full text-center font-cond text-sm font-bold uppercase tracking-[0.22em] text-muted sm:text-base">
          Works with Sleeper and ESPN Fantasy
        </p>
        <Image
          src="/images/espn-fantasy.png"
          alt=""
          width={500}
          height={500}
          sizes="28px"
          aria-hidden="true"
          className={logoClass}
        />
      </div>
    </section>
  );
}
