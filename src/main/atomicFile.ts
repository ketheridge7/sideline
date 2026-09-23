import { closeSync, fsyncSync, mkdirSync, openSync, renameSync, writeSync } from 'fs'
import { dirname } from 'path'

/** Write `body` to `target` via a temp file and rename. Settings pass `fsync: true` so a crash cannot leave a half-written file. */
export const writeAtomicSync = (target: string, body: string, opts?: { fsync?: boolean }): void => {
  mkdirSync(dirname(target), { recursive: true })
  const tmp = `${target}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeSync(fd, body, undefined, 'utf8')
    if (opts?.fsync !== false) fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, target)
}
