#!/usr/bin/env node
// Render the live overlay page to a transparent PNG over the Chrome DevTools protocol.
// The overlay's EventSource never lets `chrome --screenshot` settle, so drive it directly.
//
//   node scripts/marketing/hud-shot.mjs [out.png] [url]
//
// Default url is the TV surface of the loopback overlay a running `npm run replay:capture`
// serves on 127.0.0.1:7333. Needs Google Chrome (or CHROME=/path/to/chrome) and Node 22+.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [out = 'hud-tv.png', url = 'http://127.0.0.1:7333/overlay?tv=1'] = process.argv.slice(2)
const width = 1920
const height = 1080
const settleMs = 5000
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn(
  process.env.CHROME || 'google-chrome',
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'sideline-hud-'))}`,
    `--remote-debugging-port=${port}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pageTarget = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const page = targets.find((row) => row.type === 'page')
      if (page) return page
    } catch {
      // Chrome is still starting.
    }
    await sleep(200)
  }
  throw new Error('Chrome DevTools did not come up')
}

try {
  const page = await pageTarget()
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let nextId = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    pending.get(msg.id)?.(msg)
    pending.delete(msg.id)
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      nextId += 1
      pending.set(nextId, resolve)
      ws.send(JSON.stringify({ id: nextId, method, params }))
    })
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  await send('Page.navigate', { url })
  await sleep(settleMs)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  ws.close()
  console.log(`saved ${out}`)
} finally {
  chrome.kill('SIGKILL')
}
