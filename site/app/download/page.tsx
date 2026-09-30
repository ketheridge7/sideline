import type { Metadata } from "next";
import { DownloadRedirect } from "@/components/download-redirect";
import { DOWNLOAD_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Download",
  description: "Download the Sideline Windows installer.",
  robots: { index: false, follow: false },
};

export default function DownloadPage() {
  return (
    <main id="main" className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-text">Download Sideline</h1>
      <p className="mt-4 text-base leading-relaxed text-muted">
        Your download should start. If not,{" "}
        <a
          href={DOWNLOAD_URL}
          className="text-text underline decoration-white/40 underline-offset-4 hover:text-lime"
        >
          click here
        </a>
        .
      </p>
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<meta http-equiv="refresh" content="0;url=${DOWNLOAD_URL}">`,
        }}
      />
      <DownloadRedirect href={DOWNLOAD_URL} />
    </main>
  );
}
