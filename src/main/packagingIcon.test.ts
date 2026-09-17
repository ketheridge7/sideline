import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { bindEmptyNativeTitle, NATIVE_WINDOW_TITLE, packagingWindowIconPath } from './packagingIcon'

describe('packagingWindowIconPath', () => {
  it('uses the broadcast S PNG for the running window', () => {
    const icon = packagingWindowIconPath()
    expect(icon.endsWith('broadcast-s.png')).toBe(true)
    expect(existsSync(icon)).toBe(true)
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
