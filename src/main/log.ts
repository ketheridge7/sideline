import * as electron from 'electron'
import { join } from 'path'
import { appendLogFile, formatLogLine, readLogTail } from './logFile'

const pending: string[] = []
let dir: string | null = null

const clip = (value: unknown): string => {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : 'unknown'
  return message.replace(/[\r\n]/g, ' ').slice(0, 300)
}

export const bindLogDir = (next: string): void => {
  dir = next
  if (!dir) return
  const queued = pending.splice(0, pending.length)
  for (const line of queued) {
    try {
      appendLogFile(dir, line)
    } catch {
      // logging must not take the app down
    }
  }
}

export const appendLog = (
  level: 'info' | 'warn' | 'error',
  message: string,
  extra?: { reason?: string; exitCode?: number; step?: string; code?: string }
): void => {
  const line = formatLogLine(new Date(), level, message, extra)
  if (!dir) {
    pending.push(line)
    if (pending.length > 200) pending.shift()
    return
  }
  try {
    appendLogFile(dir, line)
  } catch {
    // logging must not take the app down
  }
}

export const readRecentLog = (maxChars = 12_000): string => {
  if (!dir) return pending.join('\n')
  try {
    return readLogTail(dir, maxChars)
  } catch {
    return ''
  }
}

export const userDataLogDir = (): string => join(electron.app.getPath('userData'), 'logs')

let installed = false

export const installProcessLogging = (): void => {
  if (installed) return
  installed = true
  process.on('unhandledRejection', (reason) => {
    appendLog('error', `unhandledRejection ${clip(reason)}`)
  })
  process.on('uncaughtException', (error) => {
    appendLog('error', `uncaughtException ${clip(error)}`)
  })
}
