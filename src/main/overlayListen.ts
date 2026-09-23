export const OVERLAY_PORT_SPAN = 30

export class OverlayListenError extends Error {
  code: string | undefined
  startPort: number
  endPort: number

  constructor(code: string | undefined, startPort: number, endPort: number) {
    super(`Overlay server could not bind ports ${startPort}-${endPort}${code ? ` (${code})` : ''}`)
    this.name = 'OverlayListenError'
    this.code = code
    this.startPort = startPort
    this.endPort = endPort
  }
}

/**
 * Any bind error moves on to the next port, not only EADDRINUSE: Windows
 * Hyper-V/WSL excluded port ranges surface as EACCES, and adapters can
 * report EADDRNOTAVAIL.
 */
export const listenOnFreePort = async (
  startPort: number,
  host: string,
  attempt: (port: number, host: string) => Promise<number>,
  span = OVERLAY_PORT_SPAN
): Promise<number> => {
  const endPort = Math.min(65535, startPort + span - 1)
  let lastCode: string | undefined
  for (let port = startPort; port <= endPort; port += 1) {
    try {
      return await attempt(port, host)
    } catch (error) {
      lastCode = (error as NodeJS.ErrnoException | null)?.code ?? lastCode
    }
  }
  throw new OverlayListenError(lastCode, startPort, endPort)
}
