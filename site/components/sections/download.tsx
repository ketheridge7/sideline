import { CtaLink, SectionEyebrow, SectionTitle } from "@/components/ui";
import { DOWNLOAD_URL } from "@/lib/constants";

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
        <div className="border border-line bg-card p-8 sm:p-12">
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
        </div>
      </div>
    </section>
  );
}
