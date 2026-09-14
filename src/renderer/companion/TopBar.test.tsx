import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyAppState } from '@shared/types'
import { TopBar } from './TopBar'

describe('TopBar', () => {
  it('keeps HUD and Studio in the top bar without SL/ES pips', () => {
    const state = emptyAppState()
    state.espnConnected = true
    const html = renderToStaticMarkup(
      <TopBar state={state} screen="board" studioOpen={false} onScreen={() => undefined} onStudio={() => undefined} />
    )
    expect(html).toContain('HUD')
    expect(html).toContain('Studio')
    expect(html).not.toContain('data-espn-health')
    expect(html).not.toContain('data-provider-health')
    expect(html).not.toContain('>SL<')
    expect(html).not.toContain('>ES<')
  })
})
