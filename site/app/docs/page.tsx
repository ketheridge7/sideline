import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Kbd } from "@/components/ui";
import { DOWNLOAD_URL } from "@/lib/constants";
import { SHORTCUTS } from "@/lib/demo";

export const metadata: Metadata = {
  title: "Connect & shortcuts",
  description:
    "Connect Sleeper and ESPN, HUD shortcuts, OBS localhost overlay, and optional TV pairing for Sideline.",
};

export default function DocsPage() {
  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-3xl px-5 py-16 sm:px-6">
        <p className="font-cond text-4xl font-extrabold uppercase leading-none tracking-[0.06em] text-lime sm:text-5xl">
          Docs
        </p>
        <h1 className="mt-3 max-w-3xl text-xl font-medium leading-snug tracking-tight text-text sm:text-2xl">
          Connect, shortcuts, overlay
        </h1>

        <section className="mt-14">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em] text-lime">Sleeper</h2>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              In the Sleeper app or on sleeper.com, find your{" "}
              <strong className="font-medium text-text">username</strong> (the handle — not your
              password).
            </li>
            <li>Type that username and press Connect. No password.</li>
            <li>
              Your leagues appear as a checklist. Uncheck any you do not want, then{" "}
              <strong className="font-medium text-text">Add selected</strong>.
            </li>
            <li>Click a league card to put that matchup on the Scoreboard and the HUD.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em] text-lime">ESPN</h2>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Click <strong className="font-medium text-text">Sign in with ESPN</strong>.
            </li>
            <li>
              Sideline lists your ESPN leagues as a checklist. Keep the ones you want and press{" "}
              <strong className="font-medium text-text">Add selected</strong>.
            </li>
            <li>
              If a league is missing, open <strong className="font-medium text-text">Advanced</strong>{" "}
              and paste the numeric league ID from the ESPN fantasy URL.
            </li>
            <li>Cookies expire (often after a few weeks). Sign in again the same way.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em] text-lime">
            Keyboard shortcuts
          </h2>
          <div className="mt-4 overflow-hidden border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-card font-cond text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                <tr>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Default</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((row) => (
                  <tr key={row.action} className="border-t border-line">
                    <td className="px-4 py-2.5 text-text">{row.action}</td>
                    <td className="px-4 py-2.5">
                      <Kbd>{row.keys}</Kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em] text-lime">
            OBS / localhost overlay
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Browser Source: <code className="text-text">http://127.0.0.1:7333/overlay</code>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em] text-lime">
            TV / LAN pairing
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Connect → Allow devices on this Wi-Fi. Enter the 6-digit code on the TV, or open the
            phone URL.
          </p>
        </section>

        <p className="mt-14 text-sm">
          <a href={DOWNLOAD_URL} className="text-lime hover:underline" target="_blank" rel="noopener noreferrer">
            Download for Windows
          </a>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
