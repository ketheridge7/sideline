import { describe, expect, it } from 'vitest'
import { captureRequested, DEMO_FLAG, demoDevHint, demoRelaunchArgs, demoRequested, demoSwitchPlan } from './demoMode'

describe('demoMode', () => {
  it('turns on from npm run replay or from the Connect relaunch flag', () => {
    expect(demoRequested({ SIDELINE_REPLAY: '1' }, ['electron', '.'])).toBe(true)
    expect(demoRequested({}, ['Sideline.exe', DEMO_FLAG])).toBe(true)
    expect(demoRequested({}, ['Sideline.exe'])).toBe(false)
    expect(demoRequested({ SIDELINE_REPLAY: '0' }, ['Sideline.exe'])).toBe(false)
  })

  it('only hides Demo chrome for explicit marketing captures', () => {
    expect(captureRequested({ SIDELINE_CAPTURE: '1' })).toBe(true)
    expect(captureRequested({ SIDELINE_REPLAY: '1' })).toBe(false)
  })

  it('relaunches to switch, never flips demo inside a live process, and hints on a dev server', () => {
    expect(demoSwitchPlan({ enabled: true, active: false, devServer: false })).toBe('relaunch')
    expect(demoSwitchPlan({ enabled: false, active: true, devServer: false })).toBe('relaunch')
    expect(demoSwitchPlan({ enabled: true, active: true, devServer: false })).toBe('noop')
    expect(demoSwitchPlan({ enabled: false, active: false, devServer: true })).toBe('noop')
    expect(demoSwitchPlan({ enabled: true, active: false, devServer: true })).toBe('dev-hint')
    expect(demoDevHint(true)).toContain('npm run replay')
    expect(demoDevHint(false)).toContain('npm run dev')
  })

  it('adds or strips exactly one demo flag and keeps the other launch args', () => {
    expect(demoRelaunchArgs(['Sideline.exe', '--hidden'], true)).toEqual(['--hidden', DEMO_FLAG])
    expect(demoRelaunchArgs(['Sideline.exe', DEMO_FLAG, '--hidden'], true)).toEqual(['--hidden', DEMO_FLAG])
    expect(demoRelaunchArgs(['Sideline.exe', '--hidden', DEMO_FLAG], false)).toEqual(['--hidden'])
  })
})
