import Image from "next/image";

const logoClass = "h-5 w-5 shrink-0 sm:h-[26px] sm:w-[26px]";

export function ProofStrip() {
  return (
    <section className="border-y border-line bg-card/60" aria-label="Works with">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-3 px-5 py-6 sm:gap-x-4 sm:px-6">
        <Image
          src="/images/sleeper.png"
          alt=""
          width={225}
          height={225}
          sizes="28px"
          aria-hidden="true"
          className={logoClass}
        />
        {/* 12rem is the two-line measure; from 430px the tracked sentence fits on one line. */}
        <p className="min-w-0 max-w-[12rem] text-balance text-center font-cond text-sm font-bold uppercase tracking-[0.22em] text-muted min-[430px]:max-w-none sm:text-base">
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
