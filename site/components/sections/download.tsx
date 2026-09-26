import { CtaLink, SectionEyebrow, SectionTitle } from "@/components/ui";
import { DOWNLOAD_URL, RELEASES_URL } from "@/lib/constants";

export function DownloadSection() {
  return (
    <section id="download" className="relative overflow-hidden py-16 lg:py-20">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 80% 40%, rgba(182,255,59,0.08), transparent 55%)",
        }}
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <div className="border border-line bg-card p-8 sm:p-10">
          <SectionEyebrow>Download</SectionEyebrow>
          <SectionTitle>Get the Windows companion.</SectionTitle>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href={DOWNLOAD_URL} external>
              Download for Windows
            </CtaLink>
            <CtaLink href="/docs" variant="ghost">
              Connect & shortcuts
            </CtaLink>
          </div>
          <p className="mt-4 text-sm text-muted">
            Windows 10/11 · v1.0.0 ·{" "}
            <a href={RELEASES_URL} className="text-text hover:text-lime" target="_blank" rel="noopener noreferrer">
              All releases
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
