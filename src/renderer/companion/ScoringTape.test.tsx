import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { TapeEvent } from '@shared/types'
import { ScoringTape } from './ScoringTape'

const at = Date.UTC(2026, 9, 1, 21, 2, 0)

const event = (row: Pick<TapeEvent, 'id' | 'kind'> & Partial<TapeEvent>): TapeEvent => ({
  at,
  player: 'Pollard TEN',
  detail: 'WAIVER CLAIM',
  leagueKey: 'sleeper:fourth-drunken',
  leagueName: 'Fourth & Drunken',
  ...row
})

describe('ScoringTape', () => {
  it('dates Sleeper waiver and free-agent adds in local time and leaves plays on the clock', () => {
    const date = new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' })
    const time = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const html = renderToStaticMarkup(
      <ScoringTape
        events={[
          event({ id: 'waiver', kind: 'add' }),
          event({ id: 'free-agent', kind: 'add', player: 'Dowdle DAL', detail: 'add' }),
          event({ id: 'score', kind: 'score', player: 'Gibbs DET', detail: 'TD', delta: 6.2 })
        ]}
      />
    )
    expect(html).toContain('Matchup Scoring')
    expect(html).toContain(`${date} · ${time}`)
    expect(html.match(new RegExp(`${date} · ${time}`, 'g'))).toHaveLength(2)
    expect(html).toContain(`<span>${time}</span>`)
    expect(html).toContain('Pollard TEN')
    expect(html).toContain('Dowdle DAL')
    expect(html).toContain('>Waiver<')
    const score = html.slice(html.lastIndexOf('border-b border-line px-3 py-2'))
    expect(score).toContain('Gibbs DET')
    expect(score).toContain(`<span>${time}</span>`)
    expect(score).not.toContain(date)
    expect(score).not.toContain('·')
  })
})
