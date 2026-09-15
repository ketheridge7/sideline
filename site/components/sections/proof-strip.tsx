export function ProofStrip() {
  return (
    <section className="border-y border-line bg-card/60" aria-label="Works with">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-6 sm:flex-row sm:px-6">
        <p className="font-cond text-xs font-bold uppercase tracking-[0.22em] text-muted">Works with</p>
        <div className="flex flex-wrap items-center justify-center gap-8">
          <SleeperMark />
          <EspnMark />
        </div>
        <p className="text-sm text-muted">Windows-first · Personal companion · No betting</p>
      </div>
    </section>
  );
}

function SleeperMark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sleeper/15 text-sleeper">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="10" r="5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 16c1.2 2 6.8 2 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="10" cy="9" r="0.8" fill="currentColor" />
          <circle cx="14" cy="9" r="0.8" fill="currentColor" />
        </svg>
      </span>
      <span className="font-cond text-2xl font-extrabold lowercase tracking-wide text-text">sleeper</span>
    </span>
  );
}

function EspnMark() {
  return (
    <span className="font-cond text-3xl font-extrabold italic tracking-[0.08em] text-text">
      ESPN
    </span>
  );
}
