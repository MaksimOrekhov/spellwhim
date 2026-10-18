import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

/**
 * Re-records src/game/fixtures/status-foundation-baseline.json (and, with --full <path>, the complete event traces for
 * diffing). The baseline guards "zero gameplay change"; regenerate it only for an approved gameplay change.
 */
const fullIndex = process.argv.indexOf('--full')
const fullPath = fullIndex >= 0 ? process.argv[fullIndex + 1] : null
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { compactTrace, regressionSpecs, traceBattle } = await server.ssrLoadModule('/src/game/regressionTrace.ts')
  const traces = regressionSpecs().map(spec => traceBattle(spec))
  await mkdir('src/game/fixtures', { recursive: true })
  await writeFile('src/game/fixtures/status-foundation-baseline.json', JSON.stringify(traces.map(compactTrace), null, 1) + '\n')
  if (fullPath) await writeFile(fullPath, JSON.stringify(traces))
  console.log('Recorded ' + traces.length + ' battle traces.')
} finally {
  await server.close()
}
