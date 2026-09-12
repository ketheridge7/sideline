import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { TopBar } from './TopBar'

describe('TopBar ESPN health', () => {
  it('marks ES unhealthy when cookies are expired or the last fetch was 401', () => {
    const state = emptyAppState()
    state.espnConnected = false
    state.espnNeedsRelogin = true
    const html = renderToStaticMarkup(
      <TopBar state={state} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).toContain('data-espn-health="unhealthy"')
  })

  it('marks ES healthy when the session is connected and the last fetch was ok', () => {
    const state = emptyAppState()
    state.espnConnected = true
    state.espnNeedsRelogin = false
    const html = renderToStaticMarkup(
      <TopBar state={state} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).toContain('data-espn-health="healthy"')
  })
})
