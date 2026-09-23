import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { scrubDiagnostics } from '@shared/diagnostics'

export const LOG_MAX_BYTES = 256 * 1024
export const LOG_FILE_NAME = 'sideline.log'

const rotatedName = (name: string): string => `${name}.1`

export const formatLogLine = (
  now: Date,
  level: 'info' | 'warn' | 'error',
  message: string,
  extra?: { reason?: string; exitCode?: number; step?: string; code?: string }
): string => {
  const fields = [
    extra?.reason != null ? `reason=${extra.reason}` : '',
    extra?.exitCode != null ? `exitCode=${extra.exitCode}` : '',
    extra?.step != null ? `step=${extra.step}` : '',
    extra?.code != null ? `code=${extra.code}` : ''
  ].filter((field) => field.length > 0)
  const text = [message, ...fields].join(' ').replace(/[\r\n]/g, ' ')
  return scrubDiagnostics(`${now.toISOString()} ${level} ${text}`)
}

const rotate = (path: string): void => {
  const backup = rotatedName(path)
  if (existsSync(backup)) unlinkSync(backup)
  if (existsSync(path)) renameSync(path, backup)
}

export const appendLogFile = (dir: string, line: string): void => {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, LOG_FILE_NAME)
  const next = scrubDiagnostics(line)
  const size = existsSync(path) ? statSync(path).size : 0
  if (size > 0 && size + next.length + 1 > LOG_MAX_BYTES) rotate(path)
  appendFileSync(path, `${next}\n`, 'utf8')
}

export const readLogTail = (dir: string, maxChars: number): string => {
  const path = join(dir, LOG_FILE_NAME)
  const parts: string[] = []
  const backup = rotatedName(path)
  if (existsSync(backup)) parts.push(readFileSync(backup, 'utf8'))
  if (existsSync(path)) parts.push(readFileSync(path, 'utf8'))
  const text = scrubDiagnostics(parts.join(''))
  if (text.length <= maxChars) return text
  return text.slice(text.length - maxChars)
}
