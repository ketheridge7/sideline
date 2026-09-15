import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { WORDMARK_TEXT } from "@/lib/brand";
import { REPO_URL } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Link href="/" aria-label={`${WORDMARK_TEXT} home`}>
            <BrandMark compact />
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted">
            Second-screen fantasy companion for NFL Sundays. Sunday Tape on near-black — not a
            sportsbook.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted" aria-label="Footer">
          <Link href="/#features" className="hover:text-text">
            Features
          </Link>
          <Link href="/#how" className="hover:text-text">
            How it works
          </Link>
          <Link href="/#download" className="hover:text-text">
            Download
          </Link>
          <Link href="/docs" className="hover:text-text">
            Docs
          </Link>
          <a href={REPO_URL} className="hover:text-text" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs leading-relaxed text-muted sm:px-6">
          Not affiliated with the NFL, Sleeper, or ESPN. Sideline is a personal companion. No
          betting. ESPN access is unofficial and for personal use on your own machine.
        </p>
      </div>
    </footer>
  );
}
