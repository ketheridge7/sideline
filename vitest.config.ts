import { defineConfig, type Plugin } from 'vitest/config'
import { dirname, isAbsolute, resolve } from 'node:path'
import react from '@vitejs/plugin-react'

/** Resolve electron-vite `?asset` imports to the source file path in unit tests. */
const electronViteAssetQuery = (): Plugin => ({
  name: 'electron-vite-asset-query',
  enforce: 'pre',
  resolveId(id, importer) {
    if (!id.endsWith('?asset')) return undefined
    const spec = id.slice(0, -'?asset'.length)
    const file = isAbsolute(spec) ? spec : resolve(importer ? dirname(importer) : process.cwd(), spec)
    return `\0electron-asset:${file}`
  },
  load(id) {
    if (!id.startsWith('\0electron-asset:')) return undefined
    return `export default ${JSON.stringify(id.slice('\0electron-asset:'.length))}`
  }
})

export default defineConfig({
  plugins: [electronViteAssetQuery(), react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  }
})
