import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Player } from '@shared/types'
import { BenchFootButton, BenchFootStack, BenchSocialCard } from './BenchFoot'
import { BoardRails, BoardRosterColumn, LineupRow } from './LineupRow'

const player = (row: Partial<Player> & Pick<Player, 'playerId' | 'name' | 'position'>): Player => ({
  nflTeam: 'SF',
  ...row
})

const kittle = player({ playerId: 'bn', name: 'George Kittle', position: 'TE', points: 4.2 })
const nico = player({ playerId: 'obn', name: 'Nico Collins', position: 'WR', points: 3.1 })
const cmc = player({ playerId: 'cmc', name: 'Christian McCaffrey', position: 'RB', points: 11.9 })

const col = (html: string, field: 'pos' | 'name' | 'pts'): string => {
  const match = html.match(new RegExp(`data-lineup-col="${field}"[\\s\\S]*?</span>`))
  return match?.[0] ?? ''
}

describe('BenchFootButton', () => {
  it('paints you-side lime and opponent silver without a lime wash', () => {
    const mine = renderToStaticMarkup(
      <BenchFootButton you open={false} copy={{ kind: 'count', count: 6 }} onToggle={() => undefined} />
    )
    const opp = renderToStaticMarkup(
      <BenchFootButton open={false} copy={{ kind: 'count', count: 6 }} onToggle={() => undefined} />
    )
    expect(mine).toContain('data-bench-foot="mine"')
    expect(mine).toContain('text-lime')
    expect(mine).toContain('border-lime/')
    expect(mine).toContain('▲')
    expect(mine).toContain('>6<')
    expect(mine).toContain('h-10 w-full')
    expect(mine).not.toContain('bg-lime')
    expect(opp).toContain('data-bench-foot="opp"')
    expect(opp).toContain('text-them')
    expect(opp).toContain('border-them/')
    expect(opp).not.toContain('text-lime')
    expect(opp).not.toContain('bg-lime')
  })

  it('shows Bench · Empty and does not expand', () => {
    const html = renderToStaticMarkup(
      <BenchFootButton you open={false} copy={{ kind: 'empty' }} onToggle={() => undefined} />
    )
    expect(html).toContain('Empty')
    expect(html).toContain('disabled')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('▲')
  })
})

describe('Bench social popover', () => {
  it('opens flush with the foot, stacked above it, with no caret', () => {
    const html = renderToStaticMarkup(
      <BenchFootStack
        you
        open
        copy={{ kind: 'count', count: 1 }}
        columnBodyHeight={400}
        onToggle={() => undefined}
      >
        <LineupRow player={kittle} you fixed />
      </BenchFootStack>
    )
    expect(html).toContain('data-bench-popover="mine"')
    expect(html).toContain('rounded-3xl')
    expect(html).toContain('bottom-full')
    expect(html).toContain('left-0')
    expect(html).toContain('right-0')
    expect(html).toContain('bg-[#12141A]')
    expect(html).toContain('shadow-[0_22px_64px_rgba(0,0,0,0.8)]')
    expect(html).toContain('width:2px')
    expect(html).toContain('bg-lime')
    expect(html).toContain('bench-social-popover')
    expect(html).toContain('data-state="open"')
    expect(html).toContain('George Kittle')
    expect(html).toContain('data-lineup-col="pos"')
    expect(html).toContain('▼')
    expect(html).toContain('h-10 w-full')
    expect(html).toContain('relative z-30')
    expect(html).not.toContain('left-3')
    expect(html).not.toContain('right-3')
    expect(html).not.toContain('bottom:20px')
    expect(html).not.toContain('data-bench-caret')
    expect(html).not.toContain('clip-path')
    expect(html).not.toMatch(/data-bench-popover="mine"[^>]*bg-lime/)
    expect(col(html, 'pos')).toContain('TE')
    expect(col(html, 'name')).toContain('George Kittle')
    expect(col(html, 'pts')).toContain('4.2')
  })

  it('stays closed with no bubble when the bench is empty', () => {
    const html = renderToStaticMarkup(
      <BenchFootStack
        you
        open
        copy={{ kind: 'empty' }}
        columnBodyHeight={400}
        onToggle={() => undefined}
      >
        <LineupRow player={kittle} you fixed />
      </BenchFootStack>
    )
    expect(html).toContain('Bench')
    expect(html).toContain('Empty')
    expect(html).not.toContain('data-bench-popover')
    expect(html).not.toContain('George Kittle')
  })

  it('keeps opponent chrome silver when open', () => {
    const html = renderToStaticMarkup(
      <BenchSocialCard you={false} maxHeight={220} state="open">
        <LineupRow player={nico} fixed />
      </BenchSocialCard>
    )
    expect(html).toContain('data-bench-popover="opp"')
    expect(html).toContain('bg-them')
    expect(html).not.toContain('bg-lime')
    expect(html).toContain('Nico Collins')
  })
})

describe('BoardRosterColumn open/close', () => {
  it('hides bench players until the column is open', () => {
    const closed = renderToStaticMarkup(
      <BoardRosterColumn
        you
        starters={[cmc]}
        bench={[kittle]}
        rows={1}
        open={false}
        onOpenChange={() => undefined}
        onFocus={() => undefined}
      />
    )
    const opened = renderToStaticMarkup(
      <BoardRosterColumn
        you
        starters={[cmc]}
        bench={[kittle]}
        rows={1}
        open
        onOpenChange={() => undefined}
        onFocus={() => undefined}
      />
    )
    expect(closed).toContain('data-bench-column="mine"')
    expect(closed).toContain('data-bench-open="false"')
    expect(closed).toContain('Christian McCaffrey')
    expect(closed).not.toContain('George Kittle')
    expect(closed).not.toContain('data-bench-popover')
    expect(opened).toContain('data-bench-open="true"')
    expect(opened).toContain('George Kittle')
    expect(opened).toContain('data-bench-popover="mine"')
    expect(opened).toContain('Christian McCaffrey')
  })

  it('opens you and them independently', () => {
    const html = renderToStaticMarkup(
      <section>
        <BoardRosterColumn
          you
          starters={[cmc]}
          bench={[kittle]}
          rows={1}
          open
          onOpenChange={() => undefined}
          onFocus={() => undefined}
        />
        <BoardRosterColumn
          starters={[player({ playerId: 'hurts', name: 'Jalen Hurts', position: 'QB', points: 24.8 })]}
          bench={[nico]}
          rows={1}
          open={false}
          onOpenChange={() => undefined}
          onFocus={() => undefined}
        />
      </section>
    )
    expect(html).toContain('data-bench-popover="mine"')
    expect(html).toContain('George Kittle')
    expect(html).not.toContain('data-bench-popover="opp"')
    expect(html).not.toContain('Nico Collins')
    expect(html).toContain('data-bench-open="false"')
  })

  it('drops ? placeholders and raw-id labels from the open card', () => {
    const mystery = player({ playerId: '4034', name: '4034', position: '?', nflTeam: '' })
    const html = renderToStaticMarkup(
      <BoardRosterColumn
        you
        starters={[cmc]}
        bench={[kittle, mystery]}
        rows={1}
        open
        onOpenChange={() => undefined}
        onFocus={() => undefined}
      />
    )
    expect(html).toContain('George Kittle')
    expect(col(html, 'pos')).toContain('TE')
    expect(col(html, 'name')).toContain('George Kittle')
    expect(col(html, 'pts')).toContain('4.2')
    expect(html).toContain('>1<')
    expect(html).not.toContain('>4034<')
    expect(html).not.toContain('>?</')
    expect(html).not.toContain('data-lineup-row="empty"')
  })

  it('does not open when the bench is only unresolved placeholders', () => {
    const html = renderToStaticMarkup(
      <BoardRosterColumn
        you
        starters={[cmc]}
        bench={[player({ playerId: '4034', name: '4034', position: '?', nflTeam: '' })]}
        rows={1}
        open
        onOpenChange={() => undefined}
        onFocus={() => undefined}
      />
    )
    expect(html).toContain('Empty')
    expect(html).toContain('disabled')
    expect(html).not.toContain('data-bench-popover')
    expect(html).not.toContain('>4034<')
  })
})

describe('BoardRails companion bench', () => {
  it('puts a foot on each starters column and drops the chip rail', () => {
    const html = renderToStaticMarkup(
      <BoardRails mine={[cmc]} opp={[nico]} mineBench={[kittle]} oppBench={[nico]} />
    )
    expect(html).toContain('data-bench-foot="mine"')
    expect(html).toContain('data-bench-foot="opp"')
    expect(html).toContain('text-lime">Starters</h2>')
    expect(html).toContain('text-them">Starters</h2>')
    expect(html).not.toContain('overflow-x-auto')
    expect(html).not.toContain('data-bench-popover')
    expect(html).not.toContain('George Kittle')
  })

  it('shows Bench · Empty when a side has no players', () => {
    const html = renderToStaticMarkup(<BoardRails mine={[cmc]} opp={[]} mineBench={[]} oppBench={[]} />)
    expect(html).toContain('Empty')
    expect(html).not.toContain('data-bench-popover')
  })

  it('shows Bench · — when the opponent team is missing', () => {
    const html = renderToStaticMarkup(
      <BoardRosterColumn
        starters={[]}
        bench={[]}
        rows={1}
        open={false}
        missing
        onOpenChange={() => undefined}
        onFocus={() => undefined}
      />
    )
    expect(html).toContain('—')
    expect(html).toContain('disabled')
    expect(html).not.toContain('data-bench-popover')
  })
})

describe('bench motion CSS', () => {
  it('scales from 0.94 with a bottom origin and snaps under reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8')
    expect(css).toContain('.bench-social-popover')
    expect(css).toContain('transform-origin: bottom center')
    expect(css).toContain('scale(0.94)')
    expect(css).toContain('bench-social-in 200ms')
    expect(css).toContain('bench-social-out 160ms')
    expect(css).toContain('prefers-reduced-motion: reduce')
    expect(css).not.toContain('data-bench-caret')
  })
})
