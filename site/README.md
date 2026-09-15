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
- Logo lock: official packaging mark only (`public/icon.png` / `public/icon.svg` — mint→lime stripe + geometric white S). Wordmark is that mark + SIDELINE with a lime underline. No hexagon S, dual-bar S, or sportsbook gold.
- Product stills in `public/images/` are synthetic Sunday Tape renders (not live scores, not photos of a real Sunday).
- Do not add this app to the Electron installer; `electron-builder.yml` already excludes `site/`.
