import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TapeEvent } from '@shared/types'
import { ScoringTape } from './ScoringTape'

const events: TapeEvent[] = [
  {
    id: 'score',
    at: 1,
    kind: 'score',
    player: 'J. Allen • BUF',
    detail: 'QB',
    delta: 6
  },
  {
    id: 'inj',
    at: 2,
    kind: 'injury',
    player: 'T. Kelce • KC',
    detail: 'Questionable'
  }
]

describe('ScoringTape', () => {
  it('uses Scoring tape language with INJ + delta, without invented play-by-play', () => {
    const html = renderToStaticMarkup(<ScoringTape events={events} />)
    expect(html).toContain('Scoring tape')
    expect(html).toContain('This matchup')
    expect(html).toContain('J. Allen • BUF')
    expect(html).toContain('QB')
    expect(html).toContain('+6.0')
    expect(html).toContain('INJ')
    expect(html).toContain('Questionable')
    expect(html).toContain('T. Kelce • KC')
    expect(html).not.toContain('4 yd pass TD')
    expect(html).not.toContain('Live scoring')
  })
})
