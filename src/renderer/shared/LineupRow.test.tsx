import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Player } from '@shared/types'
import { BoardRails, HudRail, LineupRow } from './LineupRow'

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

const col = (html: string, field: 'pos' | 'name' | 'pts'): string => {
  const match = html.match(new RegExp(`data-lineup-col="${field}"[\\s\\S]*?</span>`))
  return match?.[0] ?? ''
}

describe('LineupRow', () => {
  it('locks POS | NAME | PTS as a three-column grid for live points and dashes', () => {
    const scored = renderToStaticMarkup(
      <LineupRow
        player={player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })}
        you
      />
    )
    const kicker = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1.0 })} you />
    )
    const dash = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'herbert', name: 'Justin Herbert', position: 'QB' })} you />
    )
    const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
    expect(css).toContain('grid-template-columns: 3.25em minmax(0, 1fr) 3.75em')
    for (const html of [scored, kicker, dash]) {
      expect(html).toContain('lineup-row')
      expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="name"'))
      expect(html.indexOf('data-lineup-col="name"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
      expect(col(html, 'pos')).not.toMatch(/11\.9|1\.0|—/)
    }
    expect(col(scored, 'pos')).toContain('RB')
    expect(col(scored, 'name')).toContain('Christian McCaffrey')
    expect(col(scored, 'pts')).toContain('11.9')
    expect(col(scored, 'pos')).not.toContain('11.9')
    expect(col(kicker, 'pos')).toContain('K')
    expect(col(kicker, 'pts')).toContain('1.0')
    expect(col(kicker, 'pos')).not.toContain('1.0')
    expect(col(kicker, 'name')).not.toContain('1.0')
    expect(col(dash, 'pos')).toContain('QB')
    expect(col(dash, 'pts')).toContain('—')
    expect(col(dash, 'pos')).not.toContain('—')
  })

  it('keeps the same POS | NAME | PTS order on the opponent rail', () => {
    const html = renderToStaticMarkup(
      <LineupRow player={player({ playerId: 'dart', name: 'Drake Maye', position: 'QB', points: 0 })} />
    )
    expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
    expect(col(html, 'pos')).toContain('QB')
    expect(col(html, 'pts')).toContain('0.0')
  })
})

describe('HudRail', () => {
  it('renders compact overlay rows with points confined to the pts column', () => {
    const html = renderToStaticMarkup(
      <HudRail
        you
        players={[
          player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 }),
          player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1 }),
          player({ playerId: 'herbert', name: 'Justin Herbert', position: 'QB' })
        ]}
      />
    )
    expect(html).toContain('data-hud-rail="mine"')
    expect(html.match(/data-lineup-row="mine"/g)?.length).toBe(3)
    expect(col(html, 'pts')).toContain('11.9')
    expect(html).toContain('McCaffrey')
    expect(html).toContain('Mevis')
    expect(html).not.toMatch(/data-lineup-col="pos"[^>]*>([^<]*1\.0)/)
  })
})

describe('BoardRails', () => {
  it('uses the same POS | NAME | PTS columns on you and them', () => {
    const html = renderToStaticMarkup(
      <BoardRails
        mine={[player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })]}
        opp={[player({ playerId: 'mevis', name: 'Jake Mevis', position: 'K', points: 1.0 })]}
      />
    )
    expect(html).toContain('data-hud-rail="mine"')
    expect(html).toContain('data-hud-rail="opp"')
    expect(html.indexOf('data-lineup-col="pos"')).toBeLessThan(html.indexOf('data-lineup-col="pts"'))
    expect(html).toContain('Christian McCaffrey')
    expect(html).toContain('11.9')
    expect(html).toContain('Jake Mevis')
    expect(html).toContain('1.0')
    expect(html).toContain('>You<')
    expect(html).toContain('>Them<')
  })
})
