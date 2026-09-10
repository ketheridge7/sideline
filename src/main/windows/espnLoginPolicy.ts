import type { EspnCookies } from '../providers/espnClient'

/** True only when espn_s2 + SWID exist and are not the snapshot from before this login. */
export const shouldCloseOnCookies = (
  observed: EspnCookies | null,
  preexisting: EspnCookies | null
): boolean => {
  if (!observed) return false
  if (!preexisting) return true
  return observed.espn_s2 !== preexisting.espn_s2 || observed.SWID !== preexisting.SWID
}
