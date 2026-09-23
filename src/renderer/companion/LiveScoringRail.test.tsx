import { describe, expect, it } from 'vitest'
import { railPlayerName } from './LiveScoringRail'

describe('railPlayerName', () => {
  it('drops the trailing NFL team but keeps multi-word surnames', () => {
    expect(railPlayerName('Gibbs DET')).toBe('Gibbs')
    expect(railPlayerName('St. Brown DET')).toBe('St. Brown')
    expect(railPlayerName('Ravens BAL')).toBe('Ravens')
    expect(railPlayerName('Eagles D/ST')).toBe('Eagles D/ST')
    expect(railPlayerName('Hurts')).toBe('Hurts')
  })
})
