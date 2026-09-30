import { describe, expect, it } from 'vitest'
import { EMPTY_HUD_TEXT_COLORS } from './hudText'
import {
  BUILT_IN_THEMES,
  DEFAULT_HUD_DISPLAY,
  DEFAULT_HUD_STYLE,
  DEFAULT_THEME_ID,
  HUD_THEME_TAGLINES,
  MAX_RECENT_COLORS,
  MAX_SAVED_THEMES,
  cleanThemeName,
  decodeThemeCode,
  emptyStudioLibrary,
  encodeThemeCode,
  matchingThemeId,
  parseHudDisplay,
  parseHudStyle,
  parseStudioLibrary,
  pushRecentColor,
  removeSavedTheme,
  saveThemeToLibrary
} from './hudStyle'

const theme = (id: string) => {
  const hit = BUILT_IN_THEMES.find((row) => row.id === id)
  if (!hit) throw new Error(`missing theme ${id}`)
  return hit
}

describe('parseHudStyle', () => {
  it('defaults to the plate-free Sunday Tape look', () => {
    expect(parseHudStyle(undefined)).toEqual(DEFAULT_HUD_STYLE)
    expect(parseHudStyle('glass')).toEqual(DEFAULT_HUD_STYLE)
    expect(DEFAULT_HUD_STYLE.backdrop).toBe('none')
    expect(DEFAULT_HUD_STYLE.accent).toBe('#B6FF3B')
  })

  it('keeps valid fields, clamps numbers, and drops junk', () => {
    const style = parseHudStyle({
      backdrop: 'glass',
      opacity: 140,
      radius: -3.4,
      tint: '0c1512',
      edge: 'neon',
      accent: 'lime',
      font: 'stadium',
      shadow: 'bold'
    })
    expect(style).toEqual({
      ...DEFAULT_HUD_STYLE,
      backdrop: 'glass',
      opacity: 100,
      radius: 0,
      tint: '#0C1512',
      font: 'stadium',
      shadow: 'bold'
    })
    expect(parseHudStyle({ opacity: Number.NaN, radius: 12.6 })).toMatchObject({ opacity: 55, radius: 13 })
  })
})

describe('parseHudDisplay', () => {
  it('shows everything by default and keeps booleans only', () => {
    expect(parseHudDisplay(null)).toEqual(DEFAULT_HUD_DISPLAY)
    expect(parseHudDisplay({ size: 'large', ticker: false, lead: 'no', rails: 0 })).toEqual({
      ...DEFAULT_HUD_DISPLAY,
      size: 'large',
      ticker: false
    })
    expect(parseHudDisplay({ size: 'huge' }).size).toBe('auto')
  })
})

describe('parseStudioLibrary', () => {
  it('keeps valid themes, dedupes ids and colors, and caps both lists', () => {
    const rows = Array.from({ length: MAX_SAVED_THEMES + 5 }, (_, index) => ({
      id: `my-theme-${index}`,
      name: `Theme ${index}`,
      style: { backdrop: 'solid' },
      textColors: {}
    }))
    const library = parseStudioLibrary({
      savedThemes: [
        rows[0],
        rows[0],
        { id: 'Bad Id!', name: 'x', style: {} },
        { id: 'no-name', name: '   ', style: {} },
        ...rows.slice(1)
      ],
      recentColors: ['#fff', '#FFFFFF', 'nope', ...Array.from({ length: 20 }, (_, i) => `#0000${String(i).padStart(2, '0')}`)]
    })
    expect(library.savedThemes).toHaveLength(MAX_SAVED_THEMES)
    expect(library.savedThemes[0]).toMatchObject({ id: 'my-theme-0', name: 'Theme 0' })
    expect(library.savedThemes[0].style.backdrop).toBe('solid')
    expect(library.recentColors).toHaveLength(MAX_RECENT_COLORS)
    expect(library.recentColors[0]).toBe('#FFFFFF')
    expect(parseStudioLibrary('x')).toEqual(emptyStudioLibrary())
  })
})

describe('built-in themes', () => {
  it('ships a tagline for each theme and starts with Sunday Tape', () => {
    expect(BUILT_IN_THEMES[0].id).toBe(DEFAULT_THEME_ID)
    for (const row of BUILT_IN_THEMES) expect(HUD_THEME_TAGLINES[row.id]).toBeTruthy()
    expect(new Set(BUILT_IN_THEMES.map((row) => row.id)).size).toBe(BUILT_IN_THEMES.length)
  })

  it('recognizes the look each theme applies', () => {
    for (const row of BUILT_IN_THEMES) {
      expect(matchingThemeId(row.style, row.textColors)).toBe(row.id)
    }
    expect(matchingThemeId(DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS)).toBe(DEFAULT_THEME_ID)
  })

  it('ignores hidden plate settings when no plate is drawn', () => {
    expect(matchingThemeId({ ...DEFAULT_HUD_STYLE, opacity: 12, radius: 3, tint: '#FF0000' }, EMPTY_HUD_TEXT_COLORS)).toBe(
      DEFAULT_THEME_ID
    )
    const primetime = theme('primetime')
    expect(matchingThemeId({ ...primetime.style, opacity: 40 }, primetime.textColors)).toBeNull()
  })

  it('prefers a saved theme with the same look', () => {
    const saved = saveThemeToLibrary(emptyStudioLibrary(), 'Mine', DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS, 1)
    expect(saved).not.toBeNull()
    if (!saved) return
    expect(matchingThemeId(DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS, saved.library.savedThemes)).toBe(saved.theme.id)
  })
})

describe('recent colors', () => {
  it('moves repeats to the front and caps the row', () => {
    let recent: string[] = []
    for (let index = 0; index < MAX_RECENT_COLORS + 3; index += 1) {
      recent = pushRecentColor(recent, `#0000${String(index).padStart(2, '0')}`)
    }
    expect(recent).toHaveLength(MAX_RECENT_COLORS)
    recent = pushRecentColor(recent, recent[4].toLowerCase())
    expect(recent[0]).toBe('#000008')
    expect(new Set(recent).size).toBe(recent.length)
    expect(pushRecentColor(recent, 'nope')).toEqual(recent)
  })
})

describe('saved themes', () => {
  it('saves newest first, replaces by name, and removes by id', () => {
    const first = saveThemeToLibrary(emptyStudioLibrary(), '  Road   game ', DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS, 10)
    expect(first?.theme.name).toBe('Road game')
    if (!first) return
    const second = saveThemeToLibrary(first.library, 'Home', theme('primetime').style, EMPTY_HUD_TEXT_COLORS, 20)
    if (!second) throw new Error('expected save')
    expect(second.library.savedThemes.map((row) => row.name)).toEqual(['Home', 'Road game'])
    const replaced = saveThemeToLibrary(second.library, 'ROAD GAME', theme('scoreboard').style, EMPTY_HUD_TEXT_COLORS, 30)
    if (!replaced) throw new Error('expected save')
    expect(replaced.theme.id).toBe(first.theme.id)
    expect(replaced.library.savedThemes).toHaveLength(2)
    expect(replaced.library.savedThemes[0].style.font).toBe('scoreboard')
    expect(removeSavedTheme(replaced.library, first.theme.id).savedThemes.map((row) => row.name)).toEqual(['Home'])
    expect(saveThemeToLibrary(first.library, '   ', DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS)).toBeNull()
  })

  it('stays inside the library cap', () => {
    let library = emptyStudioLibrary()
    for (let index = 0; index < MAX_SAVED_THEMES + 4; index += 1) {
      const saved = saveThemeToLibrary(library, `Theme ${index}`, DEFAULT_HUD_STYLE, EMPTY_HUD_TEXT_COLORS, index)
      if (saved) library = saved.library
    }
    expect(library.savedThemes).toHaveLength(MAX_SAVED_THEMES)
    expect(library.savedThemes[0].name).toBe(`Theme ${MAX_SAVED_THEMES + 3}`)
  })

  it('trims long names', () => {
    expect(cleanThemeName('x'.repeat(80))).toHaveLength(32)
    expect(cleanThemeName(5)).toBe('')
  })
})

describe('theme codes', () => {
  it('round-trips a theme through a share code', () => {
    const scoreboard = theme('scoreboard')
    const code = encodeThemeCode('Amber Board', scoreboard.style, scoreboard.textColors)
    expect(code.startsWith('SL1.')).toBe(true)
    expect(code).not.toMatch(/[+/=\s]/)
    const decoded = decodeThemeCode(`  ${code}\n`, 99)
    expect(decoded).toEqual({ id: 'import-2r', name: 'Amber Board', style: scoreboard.style, textColors: scoreboard.textColors })
  })

  it('accepts raw JSON and sanitizes it', () => {
    const decoded = decodeThemeCode('{"name":"Raw","style":{"backdrop":"glass","opacity":900},"textColors":{"all":"#ffffff","teamName":"#fff"}}', 1)
    expect(decoded?.style.backdrop).toBe('glass')
    expect(decoded?.style.opacity).toBe(100)
    expect(decoded?.textColors.all).toBe('#FFFFFF')
    expect(decoded?.textColors.teamName).toBeNull()
  })

  it('rejects junk', () => {
    for (const bad of ['', 'hello', 'SL1.!!!!', 'SL1.' + btoa('not json'), '{"name":"x"}', '{bad json', '[1,2]']) {
      expect(decodeThemeCode(bad)).toBeNull()
    }
  })
})
