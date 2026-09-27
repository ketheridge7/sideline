import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UpdateCountdownBanner } from './UpdateCountdownBanner'

describe('UpdateCountdownBanner', () => {
  it('shows the silent restart countdown with Restart now and Later', () => {
    const html = renderToStaticMarkup(
      <UpdateCountdownBanner version="1.0.2" seconds={10} onRestart={() => undefined} onLater={() => undefined} />
    )
    expect(html).toContain('data-update-banner="countdown"')
    expect(html).toContain('Updating Sideline to v1.0.2 — restarting in 10s')
    expect(html).toContain('Restart now')
    expect(html).toContain('Later')
    expect(html).toContain('bg-lime')
    expect(html).toContain('data-update-restart="now"')
    expect(html).toContain('data-update-restart="later"')
  })
})
