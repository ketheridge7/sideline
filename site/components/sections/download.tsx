import { CtaLink, SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";
import { DOWNLOAD_URL, REPO_URL } from "@/lib/constants";

export function DownloadSection() {
  return (
    <section id="download" className="relative overflow-hidden py-20 lg:py-28">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 80% 40%, rgba(182,255,59,0.08), transparent 55%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-10 border border-line bg-card p-8 sm:p-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div>
            <SectionEyebrow>Download</SectionEyebrow>
            <SectionTitle>Get the Windows companion.</SectionTitle>
            <SectionLead>
              Latest installer is on GitHub Releases. Per-user setup, desktop shortcut, no admin
              prompt. Unsigned personal builds will trip SmartScreen — that is expected.
            </SectionLead>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaLink href={DOWNLOAD_URL} external>
                Download for Windows
              </CtaLink>
              <CtaLink href="/docs" variant="ghost">
                Connect & shortcuts
              </CtaLink>
            </div>
            <div className="mt-8 border-t border-line pt-6">
              <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                Windows SmartScreen
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                Because the build is unsigned, Windows may show <strong className="font-medium text-text">Windows protected your PC</strong>.
                Choose <strong className="font-medium text-text">More info</strong> →{" "}
                <strong className="font-medium text-text">Run anyway</strong>. Authenticode signing is
                an optional follow-up, not required for private use.
              </p>
            </div>
          </div>
          <div className="border border-line bg-bg p-6">
            <p className="font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              Latest release
            </p>
            <p className="mt-3 font-cond text-4xl font-extrabold uppercase tracking-[0.08em] text-lime">
              Windows
            </p>
            <p className="mt-2 text-sm text-muted">NSIS installer · GitHub Releases</p>
            <a
              href={REPO_URL}
              className="mt-6 inline-block text-sm text-you hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source on GitHub →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
