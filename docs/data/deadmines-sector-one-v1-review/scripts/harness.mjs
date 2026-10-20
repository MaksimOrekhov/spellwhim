// Review harness: loads game modules of a Spellwhim checkout read-only via Vite SSR. Writes nothing to the project.
// SPELLWHIM_ROOT (default: current directory) must be a checkout of codex/deadmines-sector-one-v1 (e115e81) with node_modules.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(process.env.SPELLWHIM_ROOT ?? process.cwd())
const { createServer } = await import(pathToFileURL(resolve(root, 'node_modules/vite/dist/node/index.js')).href)

export async function withGame(names, fn) {
  const server = await createServer({ root, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
  try {
    const mods = await Promise.all(names.map(n => server.ssrLoadModule('/src/game/' + n + '.ts')))
    return await fn(Object.fromEntries(names.map((n, i) => [n, mods[i]])))
  } finally { await server.close() }
}

export const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN
export const pct = (n, d) => +(100 * n / d).toFixed(2)
export const r3 = x => +x.toFixed(3)
