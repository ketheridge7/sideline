import { Eraser, FlipHorizontal2, Move, RotateCcw, Save, Undo } from 'lucide-react'
import type { JSX } from 'react'
import {
  applyPreset,
  clearPresetSlot,
  OVERLAY_PRESET_IDS,
  overwritePreset,
  PRESET_LABELS,
  PRESET_PLACEMENTS,
  presetBaseline,
  presetHasSavedSlot,
  presetIsModified,
  type OverlayLayout,
  type OverlayPresetId
} from '@shared/overlayLayout'
import {
  applyStudioSlider,
  mirrorStudioBlock,
  otherTeamBlock,
  resetStudioBlock,
  STUDIO_BLOCK_IDS,
  STUDIO_BLOCK_LABELS,
  studioBlockBox,
  type StudioBlockId
} from '@shared/overlayStudioBlocks'
import type { HudDisplay } from '@shared/hudStyle'
import { IconButton, SectionHeader, StudioSlider, TextButton, Toggle } from './controls'

export type Commit = (next: OverlayLayout, key?: string) => void

const THUMB_COLORS: Record<StudioBlockId, string> = {
  mine: '#B6FF3B',
  opp: '#E8E4DC',
  ticker: '#94A3B8'
}

const CHIP_LABELS: Record<StudioBlockId, string> = {
  mine: 'You',
  opp: 'Them',
  ticker: 'Ticker'
}

const PresetThumb = ({ layout }: { layout: OverlayLayout }): JSX.Element => (
  <svg viewBox="0 0 160 90" className="block h-auto w-full" aria-hidden="true">
    <rect x="0.5" y="0.5" width="159" height="89" rx="5" fill="#0b0e12" stroke="rgba(255,255,255,0.08)" />
    <rect x={160 * 0.22} y={90 * 0.22} width={160 * 0.56} height={90 * 0.64} rx="3" fill="rgba(255,255,255,0.035)" />
    {STUDIO_BLOCK_IDS.map((id) => {
      if (id === 'ticker' && !layout.display.ticker) return null
      const box = studioBlockBox(layout, id)
      return (
        <rect
          key={id}
          x={(box.x / 100) * 160}
          y={(box.y / 100) * 90}
          width={Math.max(2, (box.w / 100) * 160)}
          height={Math.max(2, (box.h / 100) * 90)}
          rx={id === 'ticker' ? 1 : 2.5}
          fill={THUMB_COLORS[id]}
          fillOpacity={id === 'ticker' ? 0.5 : 0.85}
        />
      )
    })}
  </svg>
)

const PresetCard = ({
  id,
  layout,
  onPick
}: {
  id: OverlayPresetId
  layout: OverlayLayout
  onPick: () => void
}): JSX.Element => {
  const active = layout.presetId === id
  const preview = active ? layout : applyPreset(id, layout)
  const saved = presetHasSavedSlot(layout, id)
  return (
    <button
      type="button"
      data-preset={id}
      onClick={onPick}
      className={`studio-preset-card group grid cursor-pointer gap-1 rounded-lg border p-1 font-cond text-sm font-bold ${
        active ? 'studio-preset-active border-lime bg-lime/15 text-lime' : 'border-white/[0.07] bg-white/[0.02] text-muted hover:border-white/20 hover:text-text'
      }`}
      aria-pressed={active}
      aria-label={`${PRESET_LABELS[id]}, ${PRESET_PLACEMENTS[id]}`}
    >
      <PresetThumb layout={preview} />
      <span className="flex items-center justify-center gap-1 leading-none">
        {id}
        {saved ? <span className="h-1 w-1 rounded-full bg-current opacity-70" title="Saved slot" /> : null}
      </span>
    </button>
  )
}

const BlockChips = ({
  selected,
  onSelect
}: {
  selected: StudioBlockId | null
  onSelect: (id: StudioBlockId) => void
}): JSX.Element => (
  <div className="grid grid-cols-3 gap-1" role="group" aria-label="Block">
    {STUDIO_BLOCK_IDS.map((id) => {
      const active = selected === id
      return (
        <button
          key={id}
          type="button"
          data-block-chip={id}
          aria-pressed={active}
          onClick={() => onSelect(id)}
          aria-label={STUDIO_BLOCK_LABELS[id]}
          className={`studio-press flex cursor-pointer items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.1em] ring-1 ${
            active ? 'bg-lime/12 text-lime ring-lime/60' : 'bg-white/[0.03] text-muted ring-white/[0.07] hover:text-text'
          }`}
        >
          <span className="h-2 w-2 rounded-sm" style={{ background: THUMB_COLORS[id] }} aria-hidden="true" />
          {CHIP_LABELS[id]}
        </button>
      )
    })}
  </div>
)

export const StudioLayoutTab = ({
  layout,
  selected,
  onSelect,
  commit
}: {
  layout: OverlayLayout
  selected: StudioBlockId | null
  onSelect: (id: StudioBlockId | null) => void
  commit: Commit
}): JSX.Element => {
  const target = selected ? studioBlockBox(layout, selected) : null
  const modified = presetIsModified(layout)
  const saved = presetHasSavedSlot(layout, layout.presetId)
  const other = selected ? otherTeamBlock(selected) : null
  const setDisplay = (patch: Partial<HudDisplay>, key: string): void =>
    commit({ ...layout, display: { ...layout.display, ...patch } }, key)
  const box = (patch: Parameters<typeof applyStudioSlider>[2], key: string): void =>
    commit(applyStudioSlider(layout, selected, patch), key)

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="grid gap-2" data-studio-section="layout">
        <SectionHeader
          title="Layout"
          hint={
            <>
              <span className="text-text">{PRESET_LABELS[layout.presetId]}</span> · {PRESET_PLACEMENTS[layout.presetId]}
              {modified ? (
                <span className="ml-1.5 rounded-full bg-lime/10 px-1.5 py-px font-cond text-[10px] font-bold uppercase tracking-wider text-lime" data-preset-modified="">
                  Edited
                </span>
              ) : null}
            </>
          }
        />
        <div className="grid grid-cols-5 gap-1.5" data-active-preset={layout.presetId}>
          {OVERLAY_PRESET_IDS.map((id) => (
            <PresetCard key={id} id={id} layout={layout} onPick={() => commit(applyPreset(id, layout), `preset:${id}`)} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="grid min-w-0 flex-1">
            <TextButton tone={modified ? 'accent' : 'quiet'} onClick={() => commit(overwritePreset(layout), 'preset:save')}>
              <Save size={12} />
              Save over {PRESET_LABELS[layout.presetId]}
            </TextButton>
          </div>
          <IconButton
            label="Revert to the saved placement"
            disabled={!modified}
            onClick={() => commit(applyPreset(layout.presetId, layout), 'preset:revert')}
            data={{ 'data-preset-revert': '' }}
          >
            <Undo size={14} />
          </IconButton>
          <IconButton
            label="Forget the saved slot and use the factory placement"
            disabled={!saved}
            onClick={() => commit(clearPresetSlot(layout, layout.presetId), 'preset:factory')}
            data={{ 'data-preset-factory': '' }}
          >
            <Eraser size={14} />
          </IconButton>
        </div>
      </section>

      <section className="grid gap-2.5" data-studio-section="size">
        <SectionHeader
          title="Position & size"
          hint={
            <span data-studio-slider-target={selected ?? 'none'}>
              {selected
                ? `Moving ${STUDIO_BLOCK_LABELS[selected]}`
                : 'Click your team, their team, or the ticker. Sliders move that block only.'}
            </span>
          }
        />
        <BlockChips selected={selected} onSelect={(id) => onSelect(id)} />
        <div className={`studio-card grid gap-2.5 p-2.5 transition-opacity duration-200 ${selected ? '' : 'opacity-60'}`}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <StudioSlider label="Position X" value={target?.x ?? 0} min={0} max={96} disabled={!selected} onChange={(x) => box({ x }, 'box:x')} />
            <StudioSlider label="Position Y" value={target?.y ?? 0} min={0} max={96} disabled={!selected} onChange={(y) => box({ y }, 'box:y')} />
            <StudioSlider
              label="Width"
              value={target?.w ?? 0}
              min={selected === 'ticker' ? 24 : 8}
              max={100}
              disabled={!selected}
              onChange={(w) => box({ w }, 'box:w')}
            />
            <StudioSlider
              label="Height"
              value={target?.h ?? 0}
              min={selected === 'ticker' ? 4 : 12}
              max={90}
              disabled={!selected}
              onChange={(h) => box({ h }, 'box:h')}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TextButton
              disabled={!selected || !other}
              onClick={() => selected && commit(mirrorStudioBlock(layout, selected), 'box:mirror')}
              title={other ? `Place ${STUDIO_BLOCK_LABELS[other]} as a mirror image` : undefined}
              data={{ 'data-block-mirror': '' }}
            >
              <FlipHorizontal2 size={12} />
              Mirror {other ? `to ${STUDIO_BLOCK_LABELS[other].toLowerCase()}` : ''}
            </TextButton>
            <TextButton
              disabled={!selected}
              onClick={() => selected && commit(resetStudioBlock(layout, selected, presetBaseline(layout)), 'box:reset')}
              data={{ 'data-block-reset': '' }}
            >
              <RotateCcw size={12} />
              Reset block
            </TextButton>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted">
            <Move size={12} className="mt-px shrink-0 text-lime/80" />
            Drag blocks in the preview. Arrow keys nudge 1% (Shift for 5%). Hold Alt for free placement.
          </p>
        </div>
      </section>

      <section className="grid gap-1.5" data-studio-section="display">
        <SectionHeader title="Show on the HUD" />
        <div className="studio-card grid p-1">
          <Toggle
            name="rails"
            label="Player rails"
            hint="Starters under each score"
            checked={layout.display.rails}
            onChange={(rails) => setDisplay({ rails }, 'display:rails')}
          />
          <Toggle
            name="lead"
            label="Lead chip"
            hint="+/- next to your score"
            checked={layout.display.lead}
            onChange={(lead) => setDisplay({ lead }, 'display:lead')}
          />
          <Toggle
            name="ticker"
            label="NFL ticker"
            hint="Scores strip along the bottom"
            checked={layout.display.ticker}
            onChange={(ticker) => setDisplay({ ticker }, 'display:ticker')}
          />
        </div>
      </section>
    </div>
  )
}
