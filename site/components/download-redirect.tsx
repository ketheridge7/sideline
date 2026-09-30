"use client";

import { useEffect } from "react";
import { DOWNLOAD_PAGEVIEW_EVENT } from "@/lib/download-attribution";

const AFTER_PAGEVIEW_MS = 400;
const FALLBACK_MS = 1600;

/**
 * Leave for the installer once Web Analytics has accepted the pageview.
 * `fetch(..., { keepalive: true })` has to start before navigation.
 * If the script never loads, the fallback still starts the download.
 */
export function DownloadRedirect({ href }: { href: string }) {
  useEffect(() => {
    let followUp = 0;
    let fallback = 0;
    const go = () => {
      window.clearTimeout(followUp);
      window.clearTimeout(fallback);
      window.location.replace(href);
    };
    const onPageview = () => {
      window.clearTimeout(fallback);
      followUp = window.setTimeout(go, AFTER_PAGEVIEW_MS);
    };
    window.addEventListener(DOWNLOAD_PAGEVIEW_EVENT, onPageview);
    fallback = window.setTimeout(go, FALLBACK_MS);
    return () => {
      window.removeEventListener(DOWNLOAD_PAGEVIEW_EVENT, onPageview);
      window.clearTimeout(followUp);
      window.clearTimeout(fallback);
    };
  }, [href]);

  return null;
}
