import * as electron from 'electron'
import { createLanPowerController } from './liveWindow'
import { appendLog } from './log'

/** Vitest's electron mock throws when a test does not stub this export. Missing means no-op. */
const optionalBlocker = (): Electron.PowerSaveBlocker | undefined => {
  try {
    return electron.powerSaveBlocker
  } catch {
    return undefined
  }
}

const controller = createLanPowerController(optionalBlocker(), {
  onStart: () => appendLog('info', 'powerSaveBlocker start'),
  onStop: () => appendLog('info', 'powerSaveBlocker stop')
})

/** Match the published LAN flag and the settled live window (`pollingLive`). */
export const syncLanPowerSave = (lanEnabled: boolean, live: boolean): void => {
  controller.sync(lanEnabled, live)
}

export const releaseLanPowerSave = (): void => {
  controller.sync(false, false)
}
