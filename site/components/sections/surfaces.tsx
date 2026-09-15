import { Kbd, SectionEyebrow, SectionLead, SectionTitle } from "@/components/ui";

const SURFACES = [
  {
    title: "Windows companion + HUD",
    body: "First-class surface. Glanceable board on a second screen, always-on-top overlay on the broadcast PC. Click-through in watch mode.",
    primary: true,
  },
  {
    title: "OBS / localhost overlay",
    body: "Browser Source at http://127.0.0.1:7333/overlay. Same HUD payload as the desktop window — no extra chrome, no editor.",
    primary: false,
  },
  {
    title: "Phone on this Wi-Fi",
    body: "Allow devices on the LAN, then paste the phone URL. Pairing uses a 6-digit code and a session token. Loopback OBS is unchanged while the toggle is off.",
    primary: false,
  },
  {
    title: "Google TV",
    body: "Secondary. The TV app is a transparent shell over the same overlay. Desktop HUD and OBS stay the product.",
    primary: false,
  },
] as const;

export function SurfacesSection() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:py-28">
      <SectionEyebrow>Surfaces</SectionEyebrow>
      <SectionTitle>Desktop first. Overlay everywhere it belongs.</SectionTitle>
      <SectionLead>
        Sideline is not a phone app with a TV afterthought. Windows is the truck. OBS, a phone on
        the same Wi-Fi, and Google TV reuse the Hashmark HUD — they do not replace it.
      </SectionLead>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {SURFACES.map((surface) => (
          <article
            key={surface.title}
            className={`border p-6 ${surface.primary ? "border-you/40 bg-you/5" : "border-line bg-card"}`}
          >
            {surface.primary ? (
              <p className="mb-2 font-cond text-[10px] font-bold uppercase tracking-[0.18em] text-you">
                Primary
              </p>
            ) : null}
            <h3 className="font-cond text-xl font-bold uppercase tracking-[0.06em]">{surface.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">{surface.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        HUD hotkey <Kbd>Ctrl + Shift + O</Kbd>
        <span className="mx-2 text-line">·</span>
        next display <Kbd>Ctrl + Shift + M</Kbd>
        <span className="mx-2 text-line">·</span>
        cycle leagues <Kbd>[</Kbd> <Kbd>]</Kbd>
      </p>
    </section>
  );
}
