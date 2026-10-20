import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { definitions } from './config.mjs'
const output = new URL('../results/', import.meta.url)
await mkdir(output, { recursive: true })
const server = await createServer({ logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const [g, oracle, content] = await Promise.all(['/src/game/dungeonGenerator.ts', '/research/sector-review/oracle.ts', '/src/game/sectorContent.ts'].map(p => server.ssrLoadModule(p)))
  const rows = [], seeds = [...Array.from({ length: 10000 }, (_, i) => i), 0xffffffff, 0x80000000]
  const patch = v => definitions(v).forEach(e => Object.assign(content.sectorEncounters.find(x => x.id === e.id), structuredClone(e)))
  const structural = map => JSON.stringify({ ...map, layers: map.layers.map(layer => layer.map(({ encounterHealth, ...node }) => node)) })
  for (const seed of seeds) {
    patch('V0'); const old = g.generateSectorMap(seed)
    patch('V2'); const current = g.generateSectorMap(seed)
    if (structural(old) !== structural(current)) throw Error('Balance changed topology/assignments: ' + seed)
    const checked = oracle.inspectSectorRoutes(current)
    if (checked.errors.length || g.validateSectorMap(current).length) throw Error(JSON.stringify({ seed, errors: checked.errors }))
    rows.push({ seed, paths: checked.paths.length, attempts: current.generation.attempts, errors: checked.errors, sameGraphAndAssignments: true, fallback: current.generation.fallback })
  }
  await writeFile(new URL('structure.jsonl.gz', output), gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'))
  await writeFile(new URL('structure.json', output), JSON.stringify({ count: rows.length, range: [0, 9999], boundarySeeds: [0xffffffff, 0x80000000], oracle: 'research/sector-review/oracle.ts (independent DFS)', violations: 0, changedGraphsOrAssignments: 0, paths: rows.reduce((s, r) => s + r.paths, 0), fallbacks: rows.filter(r => r.fallback).length }, null, 2) + '\n')
  console.log('independent structure', rows.length, 'passed')
} finally { await server.close() }
