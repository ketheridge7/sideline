"use client";

import { useEffect, useState } from "react";
import { CtaLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DOWNLOAD_URL } from "@/lib/constants";

export function StickyDownload() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 transition duration-500 motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line bg-card/95 px-3 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <CtaLink href={DOWNLOAD_URL} external className="px-4 py-2 text-[13px]">
          Download for Windows
        </CtaLink>
      </div>
    </div>
  );
}
