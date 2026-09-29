import { Check, ClipboardCopy, Download, Plus, Trash2 } from 'lucide-react'
import { useState, type JSX } from 'react'
import {
  BUILT_IN_THEMES,
  decodeThemeCode,
  encodeThemeCode,
  HUD_FONT_STACKS,
  HUD_SHADOW_CSS,
  HUD_THEME_TAGLINES,
  matchingThemeId,
  MAX_THEME_NAME,
  removeSavedTheme,
  saveThemeToLibrary,
  type HudTheme
} from '@shared/hudStyle'
import { resolveHudTextColor, type OverlayLayout } from '@shared/overlayLayout'
import studioPlateUrl from '../../assets/studio-plate.jpg'
import { hudPlateStyle } from '../../overlay/look'
import { SectionHeader, TextButton } from './controls'
import type { Commit } from './StudioLayoutTab'

const ThemeSample = ({ theme }: { theme: HudTheme }): JSX.Element => {
  const plate = hudPlateStyle(theme.style, 'left')
  const team = resolveHudTextColor(theme.textColors, 'teamName') ?? '#B6FF3B'
  const score = resolveHudTextColor(theme.textColors, 'teamScore') ?? '#F8FBFF'
  const player = resolveHudTextColor(theme.textColors, 'playerName') ?? '#FFFFFF'
  const pts = resolveHudTextColor(theme.textColors, 'playerScore') ?? '#FFFFFF'
  return (
    <span
      className="relative block aspect-[16/9] overflow-hidden rounded-md bg-cover bg-center [container-type:size]"
      style={{ backgroundImage: `url(${studioPlateUrl})` }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 bg-black/35" />
      <span
        className="absolute left-[6%] top-[10%] grid w-[40%] justify-items-center gap-[4cqh] px-[3%] py-[5cqh]"
        style={{ ...(plate ?? {}), fontFamily: HUD_FONT_STACKS[theme.style.font], textShadow: HUD_SHADOW_CSS[theme.style.shadow] }}
      >
        <span className="text-[11cqh] font-extrabold uppercase leading-none tracking-[0.04em]" style={{ color: team }}>
          Ice Box
        </span>
        <span className="text-[24cqh] font-extrabold leading-none tabular-nums" style={{ color: score }}>
          98.4
        </span>
        <span className="flex w-full justify-between text-[9cqh] font-bold uppercase leading-none">
          <span style={{ color: player }}>Gibbs</span>
          <span style={{ color: pts }}>16.2</span>
        </span>
      </span>
    </span>
  )
}

const ThemeCard = ({
  theme,
  active,
  tagline,
  onApply,
  onDelete
}: {
  theme: HudTheme
  active: boolean
  tagline?: string
  onApply: () => void
  onDelete?: () => void
}): JSX.Element => (
  <div className="group relative">
    <button
      type="button"
      data-theme={theme.id}
      aria-pressed={active}
      onClick={onApply}
      className={`studio-preset-card grid w-full cursor-pointer gap-1.5 rounded-xl border p-1.5 text-left ${
        active ? 'studio-preset-active' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'
      }`}
    >
      <ThemeSample theme={theme} />
      <span className="flex items-center justify-between gap-1 px-0.5">
        <span className="grid min-w-0">
          <span className={`truncate font-cond text-[12px] font-bold uppercase tracking-[0.1em] ${active ? 'text-lime' : 'text-text'}`}>
            {theme.name}
          </span>
          {tagline ? <span className="truncate text-[10px] text-muted">{tagline}</span> : null}
        </span>
        {active ? <Check size={14} className="shrink-0 text-lime" /> : null}
      </span>
    </button>
    {onDelete ? (
      <button
        type="button"
        aria-label={`Delete ${theme.name}`}
        data-theme-delete={theme.id}
        onClick={onDelete}
        className="studio-press absolute right-2.5 top-2.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-black/70 text-muted opacity-0 ring-1 ring-white/10 hover:text-air focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    ) : null}
  </div>
)

export const StudioThemesTab = ({
  layout,
  commit,
  onNotice
}: {
  layout: OverlayLayout
  commit: Commit
  onNotice: (message: string) => void
}): JSX.Element => {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const saved = layout.library.savedThemes
  const activeId = matchingThemeId(layout.style, layout.textColors, saved)
  const activeName = [...saved, ...BUILT_IN_THEMES].find((row) => row.id === activeId)?.name ?? null
  const exportCode = encodeThemeCode(activeName ?? (name || 'My Sideline theme'), layout.style, layout.textColors)

  const apply = (theme: HudTheme): void => {
    commit({ ...layout, style: { ...theme.style }, textColors: { ...theme.textColors } }, `theme:${theme.id}`)
  }

  const saveCurrent = (): void => {
    const result = saveThemeToLibrary(layout.library, name, layout.style, layout.textColors)
    if (!result) return
    commit({ ...layout, library: result.library }, 'theme:save')
    setName('')
    onNotice(`Saved “${result.theme.name}”`)
  }

  const importCode = (): void => {
    const theme = decodeThemeCode(code)
    if (!theme) {
      setImportError('That code did not read as a Sideline theme.')
      return
    }
    const result = saveThemeToLibrary(layout.library, theme.name, theme.style, theme.textColors)
    if (!result) return
    commit(
      { ...layout, style: { ...theme.style }, textColors: { ...theme.textColors }, library: result.library },
      'theme:import'
    )
    setCode('')
    setImportError(null)
    onNotice(`Imported “${result.theme.name}”`)
  }

  const copy = (): void => {
    const done = (): void => onNotice('Theme code copied')
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(exportCode).then(done, () => onNotice('Copy failed — select the code and copy it'))
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5" data-studio-section="themes">
      <section className="grid gap-2">
        <SectionHeader
          title="Themes"
          hint={
            <>
              Look and text colors in one click. Placement stays put.{' '}
              <span className="text-text" data-theme-current={activeId ?? 'custom'}>
                {activeName ? `Current: ${activeName}` : 'Current: custom look'}
              </span>
            </>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          {BUILT_IN_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              tagline={HUD_THEME_TAGLINES[theme.id]}
              active={activeId === theme.id}
              onApply={() => apply(theme)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-2" data-studio-section="my-themes">
        <SectionHeader title="My themes" hint={saved.length === 0 ? 'Save the current look to reuse it later.' : undefined} />
        {saved.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {saved.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                active={activeId === theme.id}
                onApply={() => apply(theme)}
                onDelete={() => commit({ ...layout, library: removeSavedTheme(layout.library, theme.id) }, `theme:delete:${theme.id}`)}
              />
            ))}
          </div>
        ) : null}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            saveCurrent()
          }}
        >
          <input
            type="text"
            value={name}
            maxLength={MAX_THEME_NAME}
            placeholder="Name this look"
            aria-label="Theme name"
            data-theme-name=""
            onChange={(event) => setName(event.target.value)}
            className="min-w-0 flex-1 rounded-lg bg-black/40 px-2.5 py-1.5 text-[12px] text-text outline-none ring-1 ring-white/[0.08] placeholder:text-muted/70 focus:ring-lime/60"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            data-theme-save=""
            className="studio-press inline-flex cursor-pointer items-center gap-1 rounded-lg bg-lime/12 px-2.5 py-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-lime ring-1 ring-lime/50 hover:bg-lime/20 disabled:opacity-35"
          >
            <Plus size={12} />
            Save
          </button>
        </form>
      </section>

      <section className="grid gap-2" data-studio-section="share">
        <SectionHeader title="Share" hint="Send a theme to another machine, or paste one you were sent." />
        <div className="studio-card grid gap-2 p-2.5">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              readOnly
              value={exportCode}
              aria-label="Theme code"
              data-theme-export=""
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 truncate rounded-lg bg-black/40 px-2 py-1.5 font-mono text-[10px] text-muted outline-none ring-1 ring-white/[0.08] focus:ring-lime/60"
            />
            <TextButton onClick={copy} data={{ 'data-theme-copy': '' }}>
              <ClipboardCopy size={12} />
              Copy
            </TextButton>
          </div>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              importCode()
            }}
          >
            <input
              type="text"
              value={code}
              placeholder="Paste a theme code"
              aria-label="Import theme code"
              data-theme-import=""
              onChange={(event) => {
                setCode(event.target.value)
                setImportError(null)
              }}
              className="min-w-0 flex-1 rounded-lg bg-black/40 px-2 py-1.5 font-mono text-[10px] text-text outline-none ring-1 ring-white/[0.08] placeholder:font-sans placeholder:text-[12px] placeholder:text-muted/70 focus:ring-lime/60"
            />
            <button
              type="submit"
              disabled={!code.trim()}
              className="studio-press inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-cond text-[11px] font-bold uppercase tracking-[0.14em] text-muted ring-1 ring-white/[0.07] hover:text-text disabled:opacity-35"
            >
              <Download size={12} />
              Import
            </button>
          </form>
          {importError ? (
            <p className="text-[11px] text-air" role="alert" data-theme-import-error="">
              {importError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
