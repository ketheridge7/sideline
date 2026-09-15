"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { CtaLink } from "@/components/ui";
import { WORDMARK_TEXT } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { DOWNLOAD_URL, NAV_LINKS } from "@/lib/constants";

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors",
        scrolled || open ? "border-b border-line bg-bg/88 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6">
        <Link href="/" className="shrink-0" aria-label={`${WORDMARK_TEXT} home`}>
          <BrandMark compact priority />
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <CtaLink href={DOWNLOAD_URL} external className="px-4 py-2 text-[13px]">
            Download for Windows
          </CtaLink>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center border border-line text-text md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5" aria-hidden="true">
            <span className={cn("h-px w-4 bg-text transition", open && "translate-y-[3.5px] rotate-45")} />
            <span className={cn("h-px w-4 bg-text transition", open && "-translate-y-[3.5px] -rotate-45")} />
          </span>
        </button>
      </div>
      {open ? (
        <nav id="mobile-nav" className="border-t border-line px-5 py-4 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="py-1 text-base text-muted hover:text-text"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <CtaLink href={DOWNLOAD_URL} external className="mt-2">
              Download for Windows
            </CtaLink>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
