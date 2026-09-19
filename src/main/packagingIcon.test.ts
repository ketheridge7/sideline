import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  bindEmptyNativeTitle,
  COMPANION_TITLEBAR_OVERLAY_RIGHT_PX,
  NATIVE_WINDOW_TITLE,
  packagingWindowIconPath
} from './packagingIcon'

const pngSize = (buf: Buffer): { width: number; height: number } => ({
  width: buf.readUInt32BE(16),
  height: buf.readUInt32BE(20)
})

const icoSizes = (buf: Buffer): number[] => {
  const count = buf.readUInt16LE(4)
  const sizes: number[] = []
  for (let i = 0; i < count; i++) {
    const width = buf.readUInt8(6 + i * 16)
    sizes.push(width === 0 ? 256 : width)
  }
  return sizes
}

describe('packagingWindowIconPath', () => {
  it('uses the broadcast S PNG for the running window and tray', () => {
    const icon = packagingWindowIconPath()
    expect(icon.endsWith('broadcast-s.png')).toBe(true)
    expect(existsSync(icon)).toBe(true)
  })
})

describe('packaging installer icons', () => {
  it('keeps electron-builder on the regenerated lime-on-black ICO/ICNS', () => {
    const yml = readFileSync(resolve(process.cwd(), 'electron-builder.yml'), 'utf8')
    expect(yml).toContain('icon: build/icon.ico')
    expect(yml).toContain('installerIcon: icon.ico')
    expect(yml).toContain('uninstallerIcon: icon.ico')
    expect(yml).toContain('icon: build/icon.icns')
  })

  it('ships a 1024 master PNG and a 16–256 ICO from the broadcast S', () => {
    const png = readFileSync(resolve(process.cwd(), 'build/icon.png'))
    const ico = readFileSync(resolve(process.cwd(), 'build/icon.ico'))
    const svg = readFileSync(resolve(process.cwd(), 'build/icon.svg'), 'utf8')
    expect(existsSync(resolve(process.cwd(), 'build/icon.icns'))).toBe(true)
    expect(png[0]).toBe(0x89)
    expect(pngSize(png)).toEqual({ width: 1024, height: 1024 })
    expect(ico.readUInt16LE(2)).toBe(1)
    expect(icoSizes(ico)).toEqual([16, 24, 32, 48, 64, 128, 256])
    expect(svg).toContain('#B6FF3B')
    expect(svg).not.toContain('linearGradient')
    expect(svg).not.toContain('#FFFFFF')
    expect(svg).not.toContain('#7DFFB0')
  })
})

describe('COMPANION_TITLEBAR_OVERLAY_RIGHT_PX', () => {
  it('matches the Windows overlay caption cluster used as the TopBar safe inset', () => {
    expect(COMPANION_TITLEBAR_OVERLAY_RIGHT_PX).toBe(138)
  })
})

describe('NATIVE_WINDOW_TITLE', () => {
  it('does not repeat Sideline in the native caption', () => {
    expect(NATIVE_WINDOW_TITLE).toBe('\u200b')
    expect(NATIVE_WINDOW_TITLE).not.toMatch(/sideline/i)
  })
})

describe('bindEmptyNativeTitle', () => {
  it('keeps the native caption empty when the document title updates', () => {
    const preventDefault = vi.fn()
    const setTitle = vi.fn()
    const listeners = new Map<string, Array<(event: { preventDefault: () => void }) => void>>()
    const win = {
      setTitle,
      on: (event: string, handler: (event: { preventDefault: () => void }) => void) => {
        const list = listeners.get(event) ?? []
        list.push(handler)
        listeners.set(event, list)
      }
    }

    bindEmptyNativeTitle(win as never)
    expect(setTitle).toHaveBeenCalledWith(NATIVE_WINDOW_TITLE)

    const titleHandlers = listeners.get('page-title-updated')
    expect(titleHandlers?.length).toBe(1)
    titleHandlers?.[0]({ preventDefault })
    expect(preventDefault).toHaveBeenCalledTimes(1)
  })
})
