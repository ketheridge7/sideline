# Sideline marketing site

Next.js App Router site for **Sideline** — the Windows-first fantasy companion (Sleeper + ESPN, no betting). Isolated from the Electron app at the repo root. Visual language is **Sunday Tape**.

## Scripts

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (must succeed)
npm run start    # serve the production build
npm run lint
```

## Routes

- `/` — marketing homepage
- `/docs` — Connect, shortcuts, OBS overlay, TV pairing (secondary)

Primary download CTA: [GitHub Releases latest](https://github.com/ketheridge7/sideline/releases/latest).

## Notes

- Tokens match `docs/design/hud.md` (`#07080A`, ice `#A6E6A0`, lime `#B6FF3B`, alert `#FF4D4D`).
- Logo lock matches the desktop companion: broadcast S (`public/broadcast-s.svg`, same mark as `src/renderer/assets/broadcast-s.svg`) plus ice `#F4F7F2` SIDELINE. No packaging stripe, no mint→lime underline, no hexagon S. Favicon stays `public/icon.png` / `icon.svg`.
- Product stills in `public/images/` are real captures from Demo Sunday (`npm run replay:capture` at the repo root): fake leagues and managers only, never live leagues. The two living-room shots composite those captures onto generated, people-free rooms. Alt text and captions live in `lib/stills.ts`; the capture checklist is `docs/marketing/stills.md`.
- Do not add this app to the Electron installer; `electron-builder.yml` already excludes `site/`.
