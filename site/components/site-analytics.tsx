"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import {
  attributedDownloadUrl,
  DOWNLOAD_PAGEVIEW_EVENT,
  isBareDownloadPage,
} from "@/lib/download-attribution";

function beforeSend(event: BeforeSendEvent): BeforeSendEvent {
  if (event.type !== "pageview") return event;
  if (isBareDownloadPage(event.url) && typeof window !== "undefined") {
    queueMicrotask(() => {
      window.dispatchEvent(new Event(DOWNLOAD_PAGEVIEW_EVENT));
    });
  }
  const url = attributedDownloadUrl(event.url);
  if (url === event.url) return event;
  return { ...event, url };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
