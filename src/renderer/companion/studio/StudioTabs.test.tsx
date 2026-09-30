import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_THEMES, DEFAULT_HUD_STYLE, saveThemeToLibrary, emptyStudioLibrary } from '@shared/hudStyle'
import { EMPTY_HUD_TEXT_COLORS, layoutFromPreset, type OverlayLayout } from '@shared/overlayLayout'
import { emptyAppState } from '@shared/types'
import { OverlayStudio, STUDIO_TABS, type StudioTab } from '../OverlayStudio'

const render = (layout: OverlayLayout = layoutFromPreset('1'), tab: StudioTab = 'layout', wide = false): string => {
  const state = emptyAppState()
  state.overlayLayout = layout
  return renderToStaticMarkup(<OverlayStudio state={state} initialTab={tab} initialWide={wide} />)
}

const tag = (html: string, attr: string): string => html.match(new RegExp(`<[^>]*${attr}[^>]*>`))?.[0] ?? ''

const withTheme = (id: string): OverlayLayout => {
  const row = BUILT_IN_THEMES.find((theme) => theme.id === id)
  if (!row) throw new Error(`missing theme ${id}`)
  return { ...layoutFromPreset('1'), style: row.style, textColors: row.textColors }
}

describe('Studio tabs', () => {
  it('renders every tab and shows only the chosen panel', () => {
    for (const tab of STUDIO_TABS) {
      const html = render(layoutFromPreset('1'), tab)
      expect(tag(html, `data-studio-tab="${tab}"`)).toContain('aria-selected="true"')
      for (const other of STUDIO_TABS) {
        const panel = tag(html, `id="studio-panel-${other}"`)
        expect(panel).toBeTruthy()
        if (other === tab) expect(panel).not.toContain('hidden')
        else expect(panel).toContain('hidden')
      }
    }
  })

  it('starts with nothing to undo and a normal-width panel', () => {
    const html = render()
    expect(tag(html, 'data-studio-undo')).toContain('disabled')
    expect(tag(html, 'data-studio-redo')).toContain('disabled')
    expect(html).toContain('data-studio-wide="false"')
    expect(render(layoutFromPreset('1'), 'layout', true)).toContain('data-studio-wide="true"')
  })

  it('previews the HUD with the same canvas the overlay uses', () => {
    const html = render(withTheme('glass-booth'))
    expect(html).toContain('data-studio-preview="hud"')
    expect(html).toContain('data-hud-backdrop="glass"')
    expect(html).toContain('data-hud-plate="mine"')
  })
})

describe('Style tab', () => {
  it('marks the live backdrop and typeface', () => {
    const html = render(withTheme('scoreboard'), 'style')
    expect(tag(html, 'data-style-backdrop="solid"')).toContain('aria-pressed="true"')
    expect(tag(html, 'data-style-backdrop="none"')).toContain('aria-pressed="false"')
    expect(tag(html, 'data-style-font="scoreboard"')).toContain('aria-pressed="true"')
    expect(html).toContain('data-style-accent')
    expect(html).toContain('data-style-tint')
  })
})

describe('Themes tab', () => {
  it('lists the built-in themes and names the one in use', () => {
    const html = render(withTheme('night-ice'), 'themes')
    for (const row of BUILT_IN_THEMES) expect(html).toContain(`data-theme="${row.id}"`)
    expect(tag(html, 'data-theme="night-ice"')).toContain('aria-pressed="true"')
    expect(html).toContain('data-theme-current="night-ice"')
  })

  it('calls an edited look custom', () => {
    const base = withTheme('primetime')
    const html = render({ ...base, style: { ...base.style, opacity: 20 } }, 'themes')
    expect(html).toContain('data-theme-current="custom"')
  })

  it('shows saved themes with a delete control and a share code for the current look', () => {
    const saved = saveThemeToLibrary(emptyStudioLibrary(), 'Road game', DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS, 5)
    if (!saved) throw new Error('expected save')
    const html = render({ ...layoutFromPreset('1'), library: saved.library }, 'themes')
    expect(html).toContain(`data-theme="${saved.theme.id}"`)
    expect(html).toContain(`data-theme-delete="${saved.theme.id}"`)
    expect(html).toContain('Road game')
    expect(tag(html, 'data-theme-export')).toContain('value="SL1.')
    expect(html).toContain('data-theme-import')
  })
})
