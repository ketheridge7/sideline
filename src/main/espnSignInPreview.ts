import { espnSession } from './windows/espnLogin'

/** Dev-only. `electron-vite dev` sets ELECTRON_RENDERER_URL; packaged builds do not. */
export const espnSignInPreviewEnabled = (): boolean =>
  process.env.SIDELINE_ESPN_SIGNIN_PREVIEW === '1' && Boolean(process.env.ELECTRON_RENDERER_URL)

const PREVIEW_SWID = '{11111111-1111-1111-1111-111111111111}'

export const seedEspnSignInPreview = async (): Promise<void> => {
  const sess = espnSession()
  await sess.clearStorageData()
  await sess.cookies.set({
    url: 'https://fantasy.espn.com/',
    name: 'espn_s2',
    value: 'preview-s2-token',
    domain: '.espn.com',
    path: '/',
    secure: true,
    sameSite: 'no_restriction'
  })
  await sess.cookies.set({
    url: 'https://fantasy.espn.com/',
    name: 'SWID',
    value: PREVIEW_SWID,
    domain: '.espn.com',
    path: '/',
    secure: true,
    sameSite: 'no_restriction'
  })
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

/** Serves two football leagues for the fan API so Connect can show a post-login checklist. */
export const previewEspnFetch = async (url: string, init: RequestInit | undefined, fallback: FetchLike): Promise<Response> => {
  if (url.includes('/apis/v2/fans/')) {
    return new Response(
      JSON.stringify({
        favoriteLeagues: [
          { leagueId: '111', leagueName: 'Gridiron Gurus', sport: 'ffl' },
          { leagueId: '222', leagueName: 'Dawg Pound', sport: 'ffl' }
        ]
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  }
  return fallback(url, init)
}
