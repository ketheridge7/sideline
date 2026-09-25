import Image from "next/image";

export function ProofStrip() {
  return (
    <section className="border-y border-line bg-card/60" aria-label="Sleeper and ESPN">
      <div
        className="mx-auto flex max-w-6xl items-center justify-center px-5 py-6 sm:px-6"
        style={{ gap: "7rem" }}
      >
        <Image
          src="/images/sleeper.png"
          alt="Sleeper"
          width={72}
          height={72}
          style={{ width: 72, height: 72 }}
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
