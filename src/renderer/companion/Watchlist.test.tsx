import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { Watchlist } from './Watchlist'

describe('Watchlist provider health', () => {
  it('sits SL and ES to the right of My leagues', () => {
    const state = emptyAppState()
    state.sleeperConnected = true
    state.espnConnected = true
    const html = renderToStaticMarkup(
      <Watchlist state={state} history={{}} onBoards={() => undefined} />
    )
    expect(html).toContain('My leagues')
    expect(html).toContain('data-provider-health')
    expect(html).toContain('>SL<')
    expect(html).toContain('>ES<')
    expect(html.indexOf('My leagues')).toBeLessThan(html.indexOf('data-provider-health'))
  })

  it('marks ES unhealthy when cookies are expired or the last fetch was 401', () => {
    const state = emptyAppState()
    state.espnConnected = false
    state.espnNeedsRelogin = true
    const html = renderToStaticMarkup(
      <Watchlist state={state} history={{}} onBoards={() => undefined} />
    )
    expect(html).toContain('data-espn-health="unhealthy"')
  })

  it('marks ES healthy when the session is connected and the last fetch was ok', () => {
    const state = emptyAppState()
    state.espnConnected = true
    state.espnNeedsRelogin = false
    const html = renderToStaticMarkup(
      <Watchlist state={state} history={{}} onBoards={() => undefined} />
    )
    expect(html).toContain('data-espn-health="healthy"')
  })
})
