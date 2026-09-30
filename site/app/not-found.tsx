import type { Metadata } from "next";
import { CtaLink } from "@/components/ui";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-start justify-center px-5">
        <p className="font-cond text-xs font-bold uppercase tracking-[0.22em] text-lime">404</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-text sm:text-4xl">
          That page isn&apos;t here.
        </h1>
        <p className="mt-3 text-muted">The link may be old. Head back to Sideline.</p>
        <CtaLink href="/" className="mt-8">
          Back to Sideline
        </CtaLink>
      </main>
      <SiteFooter />
    </>
  );
}
