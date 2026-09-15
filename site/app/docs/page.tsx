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
        <p className="font-cond text-xs font-bold uppercase tracking-[0.22em] text-you">Docs</p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight">Connect, shortcuts, overlay</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Sideline is a Windows-first companion. Connect in the app, then raise the HUD on this PC
          — or share it to OBS, a phone on this Wi-Fi, or (secondarily) Google TV.
        </p>

        <section className="mt-14">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em]">Sleeper</h2>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              In the Sleeper app or on sleeper.com, find your{" "}
              <strong className="font-medium text-text">username</strong> (the handle — not your
              password).
            </li>
            <li>Type that username on Connect and press Connect. No password. Public API.</li>
            <li>
              Leagues appear under <strong className="font-medium text-text">Boards → My leagues</strong>.
            </li>
            <li>Select a Sleeper league to drive the live HUD.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em]">ESPN</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            ESPN access is unofficial, uses your own login, and is for personal companion use only.
            Sideline never sees or stores your password.
          </p>
          <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Click <strong className="font-medium text-text">Sign in with ESPN</strong>. An in-app
              window opens ESPN&apos;s own login (2FA/OTP included).
            </li>
            <li>
              After sign-in, Sideline reads <code className="text-text">espn_s2</code> and{" "}
              <code className="text-text">SWID</code> from the local session partition on this
              machine.
            </li>
            <li>
              If leagues do not appear, paste the numeric league ID from the ESPN fantasy URL.
            </li>
            <li>Cookies expire (often after a few weeks). Sign in again the same way.</li>
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em]">
            Keyboard shortcuts
          </h2>
          <p className="mt-3 text-sm text-muted">
            Windows-first defaults. On Mac, Ctrl is Cmd. Remap under Connect → Keyboard shortcuts.
          </p>
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
          <p className="mt-3 text-sm text-muted">
            Companion still has <Kbd>O</Kbd> (HUD), <Kbd>E</Kbd> (Studio), and <Kbd>Esc</Kbd> (close
            Studio) on the Scoreboard.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em]">
            OBS / localhost overlay
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Add a Browser Source pointing at{" "}
            <code className="text-text">http://127.0.0.1:7333/overlay</code>. The port increments if
            7333 is taken. Center ~60% of the canvas stays empty so live video is the product. OBS
            never mounts edit chrome.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-cond text-2xl font-bold uppercase tracking-[0.08em]">
            TV / LAN pairing
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Secondary to the desktop HUD. Connect → <strong className="font-medium text-text">Allow devices on this Wi-Fi to load the overlay</strong>.
            Sideline binds on all interfaces, shows a 6-digit pairing code, and requires a session
            token. On the Google TV app, type that code — you do not enter the IP or hex token.
            Paste the phone URL into a browser to confirm. Loopback OBS use is unchanged while this
            toggle is off.
          </p>
        </section>

        <p className="mt-14 text-sm text-muted">
          Ready?{" "}
          <a href={DOWNLOAD_URL} className="text-you hover:underline" target="_blank" rel="noopener noreferrer">
            Download for Windows
          </a>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
