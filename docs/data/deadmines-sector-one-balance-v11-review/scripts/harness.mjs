// Read-only loader for game modules through Vite SSR. Writes nothing to the game sources.
// SPELLWHIM_ROOT (default: current directory) must be a checkout with installed node_modules.
// The combat engine of 1afabb3 (origin/main) and c344a4e (Codex v1.1) is byte-identical;
// only sectorContent.ts differs, and every experiment installs the variant definitions in memory.
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
