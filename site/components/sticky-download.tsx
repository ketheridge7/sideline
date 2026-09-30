"use client";

import { useEffect, useState } from "react";
import { CtaLink } from "@/components/ui";
import { DOWNLOAD_URL } from "@/lib/constants";

export function StickyDownload() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const download = document.getElementById("download");
    const narrowQuery = window.matchMedia("(max-width: 767px)");
    let pastHero = false;
    let downloadOnScreen = false;
    let narrow = narrowQuery.matches;

    const update = () => setVisible(narrow && pastHero && !downloadOnScreen);

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        pastHero = !entry.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    const downloadObserver = new IntersectionObserver(
      ([entry]) => {
        downloadOnScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.2 },
    );
    if (hero) heroObserver.observe(hero);
    if (download) downloadObserver.observe(download);

    const onNarrow = () => {
      narrow = narrowQuery.matches;
      update();
    };
    narrowQuery.addEventListener("change", onNarrow);
    update();

    return () => {
      heroObserver.disconnect();
      downloadObserver.disconnect();
      narrowQuery.removeEventListener("change", onNarrow);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <CtaLink href={DOWNLOAD_URL} external sameTab className="px-4 py-2 text-[13px] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        Download for Windows
      </CtaLink>
    </div>
  );
}
