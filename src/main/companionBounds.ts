import { screen } from 'electron'
import { companionBoundsOnScreen, parseCompanionBounds, type CompanionBounds } from '@shared/settings'
import { loadSettings } from './store'

export const initialCompanionBounds = (): CompanionBounds | null => {
  const saved = parseCompanionBounds(loadSettings().companionBounds)
  if (!saved) return null
  const displays = screen.getAllDisplays().map((display) => display.bounds)
  return companionBoundsOnScreen(saved, displays) ? saved : null
}
