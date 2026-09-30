import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { ISSUES_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Sideline keeps Sleeper and ESPN data on your PC. No account, no betting, no Sideline server.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
        <p className="font-cond text-xs font-bold uppercase tracking-[0.22em] text-lime">Privacy</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-text sm:text-4xl">
          Your leagues stay on this PC.
        </h1>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-muted">
          <p>
            Sideline is a personal Windows companion. It does not create a Sideline account, and it
            does not send your leagues to a Sideline server.
          </p>
          <p>
            This site uses cookieless, aggregate visit counts (Vercel Web Analytics) to see which
            links bring people in, and the app itself sends nothing.
          </p>
          <p>
            Sleeper connects with your username only. Sideline never asks for your Sleeper password.
          </p>
          <p>
            ESPN connects through ESPN’s own sign-in window. Sideline does not see that password.
            The session cookies ESPN sets stay on your machine so the companion can read your
            matchups. They expire, often after a few weeks, and signing out of ESPN in Sideline
            clears them.
          </p>
          <p>
            Scores and league names are cached on disk on this PC so a restart can paint the board
            without waiting on the network. That cache is not uploaded.
          </p>
          <p>Sideline does not place bets, show odds, or change your lineups, waivers, or trades.</p>
          <p>
            Questions go to{" "}
            <a
              href={ISSUES_URL}
              className="text-text underline decoration-white/40 underline-offset-4 hover:text-lime"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub issues
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
