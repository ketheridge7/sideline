import Image from "next/image";

export function ProofStrip() {
  return (
    <section className="border-y border-line bg-card/60" aria-label="Sleeper and ESPN">
      <div
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-10 px-5 py-6 sm:gap-16 sm:px-6 lg:gap-28"
      >
        <Image
          src="/images/sleeper.png"
          alt="Sleeper"
          width={88}
          height={88}
          style={{ width: 88, height: 88 }}
        />
        <Image
          src="/images/espn-fantasy.png"
          alt="ESPN Fantasy"
          width={104}
          height={104}
          style={{ width: 104, height: 104 }}
        />
      </div>
    </section>
  );
}
