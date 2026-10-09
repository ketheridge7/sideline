import { InstallerSha256 } from "@/components/installer-sha256";
import { CtaLink, SectionEyebrow, SectionTitle } from "@/components/ui";
import { DOWNLOAD_URL, RELEASES_URL, supportHref } from "@/lib/constants";
import { fetchLatestRelease, formatInstallerSize } from "@/lib/release";

export async function DownloadSection() {
  const release = await fetchLatestRelease();
  const support = supportHref();
  const version = release ? `v${release.version}` : null;
  const size = release?.installerBytes ? formatInstallerSize(release.installerBytes) : "about 90 MB";

  return (
    <section id="download" className="section-rise relative overflow-hidden py-16 lg:py-24">
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
          <SectionTitle>Get the Windows desktop overlay.</SectionTitle>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
            One installer. It adds a desktop shortcut and a Start menu entry for your user account.
            No administrator prompt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CtaLink href={DOWNLOAD_URL} external sameTab>
              Download for Windows
            </CtaLink>
            <CtaLink href="/docs" variant="ghost">
              Connect & shortcuts
            </CtaLink>
          </div>
          {release?.installerSha256 ? <InstallerSha256 sha256={release.installerSha256} /> : null}
          <p className="mt-4 text-sm text-muted">
            Windows 10/11 · per-user install
            {version ? (
              <>
                {" · "}
                {version}
              </>
            ) : null}
            {" · "}
            {size}
            {" · "}
            <a
              href={RELEASES_URL}
              className="text-text underline decoration-white/40 underline-offset-4 hover:text-lime"
              target="_blank"
              rel="noopener noreferrer"
            >
              All releases
            </a>
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            The build is unsigned, so SmartScreen may say “Windows protected your PC.” Choose More
            info, then Run anyway.
          </p>
          {support ? (
            <p className="mt-4 text-sm text-muted">
              Sideline is free. If it earns a spot on your Sunday, you can{" "}
              <a
                href={support}
                className="text-text underline decoration-white/40 underline-offset-4 hover:text-lime"
                target="_blank"
                rel="noopener noreferrer"
              >
                back the build
              </a>
              .
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
