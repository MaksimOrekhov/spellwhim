import type { DungeonMap, DungeonMapNode, DungeonNodeType } from './campaign'
import { rhahkZor, sectorEncounters, sectorEventIds, sectorOneElite, sectorOneEnemies } from './sectorContent'
import type { SectorEventId } from './sectorContent'
import { shuffle } from './deck'
import { deriveDungeonSeed as sectorSeed } from './dungeonSeed'

export const CARVED_GENERATOR_VERSION = 'carved-paths-1'
export interface SectorRow {
  types: DungeonNodeType[]
  /** At least one of each; remaining occupied cells sample types. */
  required?: DungeonNodeType[]
  minNodes?: number
  encounters?: string[]
}
export interface SectorConfig {
  id: string
  version: number
  name: string
  generatorVersion: string
  columns: number
  paths: number
  maxStep: number
  rows: SectorRow[]
  normalPool: string[]
  elitePool: string[]
  eventPool: SectorEventId[]
  boss: string
  maxElites: number
  maxConsecutiveServices: number
  maxBattles: number
  requireDevelopment: boolean
}
export const sectorOneConfig: SectorConfig = {
  id: 'deadmines-old-mines', version: 1, name: 'Старые штольни', generatorVersion: CARVED_GENERATOR_VERSION,
  columns: 4, paths: 6, maxStep: 1,
  rows: [
    { types: ['battle'], encounters: sectorOneEnemies.slice(0, 3).map(e => e.id) },
    { types: ['battle', 'event'], required: ['battle', 'event'], minNodes: 2 },
    { types: ['forge', 'treasure', 'event', 'elite'], required: ['forge', 'treasure', 'elite'], minNodes: 3 },
    { types: ['battle'], encounters: sectorOneEnemies.slice(1).map(e => e.id) },
    { types: ['rest'] },
  ],
  normalPool: sectorOneEnemies.map(e => e.id), elitePool: [sectorOneElite.id], eventPool: [...sectorEventIds], boss: rhahkZor.id,
  maxElites: 1, maxConsecutiveServices: 2, maxBattles: 4, requireDevelopment: true,
}

const ordered = <T>(seed: number, pool: readonly T[]) => shuffle({ rngState: seed }, pool)
const service = (n: DungeonMapNode) => ['forge', 'treasure', 'event', 'rest'].includes(n.type)
const combat = (n: DungeonMapNode) => ['battle', 'elite', 'final'].includes(n.type)

export function validateSectorConfig(c: SectorConfig): void {
  const types = ['battle', 'elite', 'forge', 'treasure', 'event', 'rest']
  const known = (id: string) => sectorEncounters.some(e => e.id === id)
  if (!c || c.generatorVersion !== CARVED_GENERATOR_VERSION || !c.id || !c.name || !Number.isInteger(c.version) || c.version < 1
    || !Number.isInteger(c.columns) || c.columns < 3 || c.columns > 8 || !Number.isInteger(c.paths) || c.paths < c.columns || c.paths > 32
    || c.maxStep !== 1 || !Array.isArray(c.rows) || c.rows.length < 4 || c.rows.length > 30
    || c.rows[0]?.types.join() !== 'battle' || c.rows[c.rows.length-1]?.types.join() !== 'rest'
    || !c.normalPool?.length || !c.elitePool?.length || !known(c.boss)
    || ![...c.normalPool, ...c.elitePool].every(known) || !c.eventPool?.length || new Set(c.eventPool).size !== c.eventPool.length || !c.eventPool.every(id => sectorEventIds.includes(id))
    || !Number.isInteger(c.maxElites) || c.maxElites < 0 || !Number.isInteger(c.maxBattles) || c.maxBattles < 3
    || !Number.isInteger(c.maxConsecutiveServices) || c.maxConsecutiveServices < 1 || typeof c.requireDevelopment !== 'boolean'
    || c.rows.some((r, i) => !r.types.length || r.types.some(t => !types.includes(t)) || (i < 2 && r.types.includes('elite'))
      || (r.required ?? []).some(t => !r.types.includes(t)) || new Set(r.required).size !== (r.required?.length ?? 0)
      || (r.minNodes !== undefined && (!Number.isInteger(r.minNodes) || r.minNodes < 1 || r.minNodes > c.columns))
      || (r.required?.length ?? 0) > c.columns || r.encounters?.some(id => !c.normalPool.includes(id)))) throw new Error('Invalid sector configuration')
}

export function sectorPaths(map: DungeonMap): DungeonMapNode[][] {
  const byId = new Map(map.layers.flat().map(n => [n.id, n]))
  const paths: DungeonMapNode[][] = []
  const walk = (id: string, path: DungeonMapNode[]) => {
    const n = byId.get(id)
    if (!n || path.some(p => p.id === id)) return
    const next = [...path, n]
    if (id === map.finalNodeId) { paths.push(next); return }
    for (const edge of n.edges) walk(edge, next)
  }
  map.startNodeIds.forEach(id => walk(id, []))
  return paths
}

export function validateSectorMap(map: DungeonMap): string[] {
  const c = map.configuration
  if (!c) return ['Missing sector configuration']
  try { validateSectorConfig(c) } catch { return ['Invalid sector configuration'] }
  const errors: string[] = []
  const nodes = map.layers.flat(), byId = new Map(nodes.map(n => [n.id, n]))
  const fail = (ok: unknown, why: string) => { if (!ok) errors.push(why) }
  fail(map.layers.length === c.rows.length + 1 && byId.size === nodes.length, 'Invalid rows or duplicate IDs')
  fail(map.layers[map.layers.length-1]?.length === 1 && map.finalNodeId === map.layers[map.layers.length-1]?.[0]?.id, 'Invalid boss row')
  fail(new Set(map.startNodeIds).size === map.startNodeIds.length && map.startNodeIds.length === map.layers[0]?.length && map.startNodeIds.every(id => byId.get(id)?.layer === 0), 'Invalid entrances')
  const events = nodes.filter(n => n.type === 'event').map(n => n.eventId)
  fail(new Set(events).size === events.length && events.every(id => id && c.eventPool.includes(id)), 'Repeated or invalid event')
  map.layers.forEach((row, layer) => {
    fail(row.length >= (c.rows[layer]?.minNodes ?? 1) && new Set(row.map(n => n.column)).size === row.length, 'Empty row or duplicate columns')
    for (const t of c.rows[layer]?.required ?? []) fail(row.some(n => n.type === t), 'Missing required room')
    for (const n of row) {
      fail(n.layer === layer && n.column >= 0 && n.column < c.columns && (n.type==='final' ? n.column===(c.columns-1)/2 : Number.isInteger(n.column)) && new Set(n.edges).size === n.edges.length, 'Invalid coordinates/edges')
      fail(layer === c.rows.length ? n.type === 'final' && n.encounterId === c.boss && n.edges.length === 0 : c.rows[layer]?.types.includes(n.type) && n.edges.length > 0, 'Invalid room role')
      if (combat(n)) {
        const pool = n.type === 'final' ? [c.boss] : n.type === 'elite' ? c.elitePool : c.rows[layer]?.encounters ?? c.normalPool
        fail(pool.includes(n.encounterId ?? '') && sectorEncounters.find(e => e.id === n.encounterId)?.maxHealth === n.encounterHealth, 'Invalid encounter')
      }
      for (const id of n.edges) {
        const to = byId.get(id)
        fail(to && to.layer === layer + 1 && (to.type === 'final' || Math.abs(n.column - to.column) <= c.maxStep), 'Invalid edge')
      }
    }
    const links = row.flatMap(n => n.edges.map(id => [n, byId.get(id)] as const)).filter((p): p is readonly [DungeonMapNode, DungeonMapNode] => !!p[1])
    fail(!links.some(([a,b]) => links.some(([d,e]) => a.column < d.column && b.column > e.column)), 'Crossing edges')
  })
  // Reject malformed graphs before path enumeration; forward edges bound recursion.
  if (errors.length) return [...new Set(errors)]
  // Dynamic summaries cover all routes without expanding an exponential list of geometric paths.
  const reached = new Set(map.startNodeIds)
  const budgets = new Map<string, { elites: number; battles: number; services: number }>()
  for (const n of nodes) {
    const parents = nodes.filter(p => p.edges.includes(n.id))
    const previous = parents.map(p => budgets.get(p.id)!).filter(Boolean)
    if (parents.some(p => reached.has(p.id))) reached.add(n.id)
    const budget = { elites: Math.max(0,...previous.map(p=>p.elites))+Number(n.type==='elite'), battles: Math.max(0,...previous.map(p=>p.battles))+Number(combat(n)), services: service(n) ? Math.max(0,...previous.map(p=>p.services))+1 : 0 }
    budgets.set(n.id,budget)
    fail(budget.elites<=c.maxElites && budget.battles<=c.maxBattles,'Combat budget exceeded')
    fail(budget.services<=c.maxConsecutiveServices,'Too many services in sequence')
    if(n.type==='final') fail(parents.length>0 && parents.every(p=>p.type==='rest'),'Missing rest or boss')
  }
  const reachesBoss = new Set([map.finalNodeId]), safe = new Set([map.finalNodeId]), development = new Set<string>()
  for (const n of [...nodes].reverse()) {
    if(n.edges.some(id=>reachesBoss.has(id))) reachesBoss.add(n.id)
    fail(n.id===map.finalNodeId || n.edges.some(id=>safe.has(id)), 'Forced future elite')
    if(n.type!=='elite' && (n.id===map.finalNodeId || n.edges.some(id=>safe.has(id)))) safe.add(n.id)
    if(safe.has(n.id) && (n.type==='forge'||n.type==='event'||n.edges.some(id=>development.has(id)))) development.add(n.id)
  }
  fail(nodes.every(n=>reached.has(n.id)&&reachesBoss.has(n.id)), 'Unreachable room or dead end')
  for(const start of map.startNodeIds) fail(safe.has(start)&&(!c.requireDevelopment||development.has(start)), 'No safe development route')
  fail(nodes.some(n => n.edges.length > 1) && nodes.some(n => nodes.filter(from => from.edges.includes(n.id)).length > 1), 'No branching/merging')
  return [...new Set(errors)]
}

/** Carve random walks, merging cells/edges and refusing crossing diagonals. No fixed-map fallback. */
export function generateSectorMap(seed: number, configuration: SectorConfig = sectorOneConfig): DungeonMap {
  validateSectorConfig(configuration)
  const c = structuredClone(configuration)
  const prefix = JSON.stringify(c)
  for (let attempt = 0; attempt < 128; attempt++) {
    const layers: DungeonMapNode[][] = c.rows.map(() => [])
    const get = (layer: number, column: number) => {
      let n = layers[layer]!.find(n => n.column === column)
      if (!n) { n = { id: `layer-${layer+1}-column-${column+1}`, layer, column, type: 'battle', edges: [] }; layers[layer]!.push(n) }
      return n
    }
    for (let p = 0; p < c.paths; p++) {
      let n = get(0, p % c.columns)
      for (let layer = 1; layer < c.rows.length; layer++) {
        const choices = Array.from({ length: c.columns }, (_, i) => i).filter(col => Math.abs(n.column-col) <= c.maxStep
          && !layers[layer-1]!.some(from => from.edges.some(id => {
            const to = layers[layer]!.find(x => x.id === id)!
            return (from.column-n.column) * (to.column-col) < 0
          })))
        const col = ordered(sectorSeed(seed, `${prefix}:topology:${attempt}:${p}:${layer}`), choices)[0]!
        const target = get(layer, col)
        if (!n.edges.includes(target.id)) n.edges.push(target.id)
        n = target
      }
    }
    if (layers.some((row,i) => row.length < Math.max(c.rows[i]!.minNodes ?? 1, c.rows[i]!.required?.length ?? 0))) continue
    const events = ordered(sectorSeed(seed, `${prefix}:event-assignments:${attempt}`), c.eventPool)
    for (const [i,row] of layers.entries()) {
      row.sort((a,b) => a.column-b.column)
      const spec = c.rows[i]!, positions = ordered(sectorSeed(seed, `${prefix}:rooms:${attempt}:${i}`), row)
      for (const [j,n] of positions.entries()) {
        n.type = spec.required?.[j] ?? ordered(sectorSeed(seed, `${prefix}:rooms:${attempt}:${n.id}`), spec.types)[0]!
        if (n.type === 'event') n.eventId = events.pop()
        if (n.type === 'rest') n.healAmount = 6
        if (n.type === 'battle' || n.type === 'elite') {
          const pool = n.type === 'elite' ? c.elitePool : spec.encounters ?? c.normalPool
          n.encounterId = ordered(sectorSeed(seed, `${prefix}:encounter:${n.id}`), pool)[0]!
          n.encounterHealth = sectorEncounters.find(e => e.id === n.encounterId)!.maxHealth
          n.rewardCount = n.type === 'elite' ? 5 : 3
        }
      }
    }
    const boss: DungeonMapNode = { id: 'final', layer: c.rows.length, column: (c.columns-1)/2, type: 'final', edges: [], encounterId: c.boss, encounterHealth: sectorEncounters.find(e => e.id === c.boss)!.maxHealth }
    layers[layers.length-1]!.forEach(n => { n.edges = [boss.id] })
    const map: DungeonMap = { seed: seed >>> 0, layers: [...layers, [boss]], startNodeIds: layers[0]!.map(n => n.id), finalNodeId: boss.id, configuration: c, generation: { attempts: attempt+1, fallback: false } }
    if (!validateSectorMap(map).length) return map
  }
  throw new Error('Sector generation exhausted 128 attempts; no map was substituted')
}
