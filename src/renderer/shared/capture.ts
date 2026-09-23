/** `npm run replay:capture` loads windows with `?capture=1`: demo data, no Demo chrome in the stills. */
export const captureSurface = (search: string | undefined = globalThis.location?.search): boolean =>
  new URLSearchParams(search ?? '').get('capture') === '1'
