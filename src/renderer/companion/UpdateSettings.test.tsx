import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { UpdateSnapshot } from '@shared/updater'
import { UpdateSettings } from './UpdateSettings'

const snap = (partial: UpdateSnapshot): UpdateSnapshot => partial

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

  it('shows the installed-app note beside the button in dev', () => {
    const html = renderToStaticMarkup(
      <UpdateSettings framed={false} initialSnapshot={snap({ state: 'disabled', reason: 'dev', currentVersion: '1.0.1' })} />
    )
    expect(html).toContain('data-update-note="dev"')
    expect(html).toContain('Updates are available in the installed app')
    expect(html).toContain('v1.0.1')
    expect(html).toContain('Check for updates')
  })

  it('keeps the version and drops the dev note for a marketing capture', () => {
    const html = renderToStaticMarkup(
      <UpdateSettings
        framed={false}
        hideDevNote
        initialSnapshot={snap({ state: 'disabled', reason: 'dev', currentVersion: '1.0.3' })}
      />
    )
    expect(html).toContain('v1.0.3')
    expect(html).not.toContain('data-update-note="dev"')
    expect(html).not.toContain('installed app')
  })

  it('reports checking, up to date, download progress, ready, and errors', () => {
    const checking = renderToStaticMarkup(
      <UpdateSettings initialSnapshot={snap({ state: 'checking', currentVersion: '1.0.1' })} />
    )
    expect(checking).toContain('data-update-status="checking"')
    expect(checking).toContain('Checking')

    const current = renderToStaticMarkup(
      <UpdateSettings initialSnapshot={snap({ state: 'not-available', version: '1.0.1', currentVersion: '1.0.1' })} />
    )
    expect(current).toContain('Up to date')

    const downloading = renderToStaticMarkup(
      <UpdateSettings
        initialSnapshot={snap({ state: 'downloading', percent: 42, version: '1.0.2', currentVersion: '1.0.1' })}
      />
    )
    expect(downloading).toContain('Downloading 42%')

    const ready = renderToStaticMarkup(
      <UpdateSettings initialSnapshot={snap({ state: 'downloaded', version: '1.0.2', currentVersion: '1.0.1' })} />
    )
    expect(ready).toContain('Ready (restart)')
    expect(ready).toContain('data-update-status="downloaded"')

    const failed = renderToStaticMarkup(
      <UpdateSettings
        initialSnapshot={snap({
          state: 'error',
          message: 'Offline. Could not reach GitHub Releases.',
          currentVersion: '1.0.1'
        })}
      />
    )
    expect(failed).toContain('Offline. Could not reach GitHub Releases.')
  })
})
