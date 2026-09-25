import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { UpdateSettings } from './UpdateSettings'

describe('UpdateSettings', () => {
  it('exposes Check for updates without talking to electron-updater at render', () => {
    const html = renderToStaticMarkup(<UpdateSettings />)
    expect(html).toContain('Updates')
    expect(html).toContain('Check for updates')
    expect(html).toContain('data-update-state="idle"')
    expect(html).not.toContain('GitHub Releases')
    expect(html).not.toContain('Download')
    expect(html).not.toContain('data-update-latest')
  })
})
