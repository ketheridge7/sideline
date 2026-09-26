// Render the pinned Replay overlay to a transparent PNG the same way hud-shot.mjs does.
// Serves the real overlay page and publishes tick-0 Replay state on /events, then captures
// with scripts/marketing/hud-shot.mjs. Preset 3 (lower corners) keeps the team cards on
// the grass, clear of the stands, for the living-room hero.
//
//   node scripts/marketing/render-hero-hud.mjs [out.png] [preset]
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const port = 5179
const out = process.argv[2] || resolve(root, 'hud-tv.png')
const preset = process.argv[3] || '3'
let hud = null

const server = await createServer({
  configFile: false,
  root: resolve(root, 'src/renderer'),
  server: { host: '127.0.0.1', port, strictPort: true },
  resolve: {
    alias: {
      '@renderer': resolve(root, 'src/renderer'),
      '@shared': resolve(root, 'src/shared')
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'replay-hud-sse',
      configureServer(dev) {
        dev.middlewares.use((req, res, next) => {
          const url = new URL(req.url ?? '/', 'http://127.0.0.1')
          if (url.pathname !== '/events') return next()
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive'
          })
          res.write(`data: ${JSON.stringify(hud)}\n\n`)
        })
      }
    }
  ]
})

await server.listen()
try {
  const replay = await server.ssrLoadModule(resolve(root, 'src/main/providers/replayWorld.ts'))
  const types = await server.ssrLoadModule(resolve(root, 'src/shared/types.ts'))
  const leagues = replay.replayWorldLeagues(replay.REPLAY_WEEK)
  const featured = leagues.find((row) => types.leagueKey(row.provider, row.id) === replay.FEATURED_LEAGUE_KEY)
  if (!featured) throw new Error('pinned Replay league missing')
  const state = types.emptyAppState()
  state.replay = true
  state.pollingLive = true
  state.nfl = {
    week: replay.REPLAY_WEEK,
    displayWeek: replay.REPLAY_WEEK,
    season: replay.REPLAY_SEASON,
    leagueSeason: replay.REPLAY_SEASON,
    seasonType: 'regular'
  }
  state.leagues = leagues
  state.selectedLeagueKey = replay.FEATURED_LEAGUE_KEY
  state.matchup = replay.replayMatchupFor(featured, 0)
  state.nflTicker = replay.replayTickerGames(0)
  state.tape = replay.replaySeedTape()
  hud = types.toOverlayHud(state)
  const url = `http://127.0.0.1:${port}/overlay/index.html?preset=${preset}`
  const code = await new Promise((resolveCode) => {
    const child = spawn('node', [resolve(here, 'hud-shot.mjs'), out, url], { stdio: 'inherit' })
    child.on('exit', resolveCode)
  })
  if (code !== 0) process.exit(code ?? 1)
} finally {
  await server.close()
}
