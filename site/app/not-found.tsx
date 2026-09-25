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
      <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-start justify-center px-5">
        <p className="font-cond text-4xl font-extrabold uppercase leading-none tracking-[0.06em] text-lime sm:text-5xl">
          404
        </p>
        <h1 className="mt-3 max-w-3xl text-xl font-medium leading-snug tracking-tight text-text sm:text-2xl">
          Off the rails.
        </h1>
        <p className="mt-3 text-muted">That page is not on Sunday Tape. Head back to the sideline.</p>
        <CtaLink href="/" className="mt-8">
          Back to Sideline
        </CtaLink>
      </main>
      <SiteFooter />
    </>
  );
}
