import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
  BrowserWindow: class {},
  session: { fromPartition: () => ({}) }
}))

import { espnSignInPreviewEnabled, previewEspnFetch } from './espnSignInPreview'

const ORIGINAL_PREVIEW = process.env.SIDELINE_ESPN_SIGNIN_PREVIEW
const ORIGINAL_RENDERER = process.env.ELECTRON_RENDERER_URL

afterEach(() => {
  if (ORIGINAL_PREVIEW == null) delete process.env.SIDELINE_ESPN_SIGNIN_PREVIEW
  else process.env.SIDELINE_ESPN_SIGNIN_PREVIEW = ORIGINAL_PREVIEW
  if (ORIGINAL_RENDERER == null) delete process.env.ELECTRON_RENDERER_URL
  else process.env.ELECTRON_RENDERER_URL = ORIGINAL_RENDERER
})

describe('espn sign-in preview', () => {
  it('stays off unless dev mode and the preview flag are both set', () => {
    delete process.env.SIDELINE_ESPN_SIGNIN_PREVIEW
    delete process.env.ELECTRON_RENDERER_URL
    expect(espnSignInPreviewEnabled()).toBe(false)
    process.env.SIDELINE_ESPN_SIGNIN_PREVIEW = '1'
    expect(espnSignInPreviewEnabled()).toBe(false)
    process.env.ELECTRON_RENDERER_URL = 'http://127.0.0.1:5173'
    expect(espnSignInPreviewEnabled()).toBe(true)
  })

  it('returns mocked football leagues for the fan API and forwards other calls', async () => {
    const fallback = async (): Promise<Response> => new Response('ok', { status: 200 })
    const fans = await previewEspnFetch('https://fan.api.espn.com/apis/v2/fans/%7B1%7D', undefined, fallback)
    const body = (await fans.json()) as { favoriteLeagues: { leagueName: string }[] }
    expect(body.favoriteLeagues.map((row) => row.leagueName)).toEqual(['Gridiron Gurus', 'Dawg Pound'])
    const other = await previewEspnFetch('https://lm-api-reads.fantasy.espn.com/x', undefined, fallback)
    expect(other.status).toBe(200)
    expect(await other.text()).toBe('ok')
    const pasted = await previewEspnFetch(
      'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/333?view=mSettings',
      undefined,
      fallback
    )
    const league = (await pasted.json()) as { settings: { name: string } }
    expect(league.settings.name).toBe('Preview League 333')
  })
})