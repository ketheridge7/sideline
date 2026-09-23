import { buildBugReportDiagnostics, type BugReportRuntime } from './bugReport'

const SECRET_PATTERNS: readonly RegExp[] = [
  /espn_s2["']?\s*[:=]\s*["']?[^"'\s,;}&]+/gi,
  /swid["']?\s*[:=]\s*["']?[^"'\s,;}&]+/gi,
  /(?:access_|overlay_|session_)?token["']?\s*[:=]\s*["']?[^"'\s,;}&]+/gi,
  /cookie["']?\s*[:=]\s*["']?[^"'\s,;}&]+/gi,
  /authorization["']?\s*[:=]\s*["']?(?:bearer\s+)?[^"'\s,;}&]+/gi,
  /bearer\s+\S+/gi,
  /\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}/gi
]

/** Strip cookies, tokens, and SWID-shaped values. Callers must not pass league names. */
export const scrubDiagnostics = (text: string): string =>
  SECRET_PATTERNS.reduce((line, pattern) => line.replace(pattern, '[redacted]'), text)

export const buildDiagnosticsText = (runtime: BugReportRuntime, logTail: string): string =>
  scrubDiagnostics(
    [
      'Sideline diagnostics',
      buildBugReportDiagnostics(runtime),
      '',
      'Recent log:',
      logTail.trim() ? logTail.trim() : '(no log yet)',
      '',
      'Do not include league names, cookies, tokens, or Sleeper/ESPN credentials.'
    ].join('\n')
  )
