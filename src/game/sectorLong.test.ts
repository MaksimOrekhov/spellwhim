import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { generateSectorMap, sectorOneConfig, sectorPaths, validateSectorConfig, validateSectorMap } from './dungeonGenerator'
import { longSectorEnemies, sectorLongConfig } from './sectorLong'
import { availableDungeonNodes, createCampaignBattle, createSectorRun, dungeonEncounter, dungeonNode, dungeonRunPhase, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from './campaign'
import { resolveRoom } from './dungeonRooms'
import { gameEconomy, honestEconomies } from './economy'
import { decodeSnapshot, encodeSnapshot, IncompatibleSave, LONG_SECTOR_CATALOG_VERSION, rulesVersionFor, SECTOR_CATALOG_VERSION } from './runSave'
import { resolveRulesMode, rulesModes } from './rulesMode'
import { honestDeck } from './honestDecks'
import { createChooser, runFight } from './honestLab'
import { resolveEnemyPortrait } from '../ui/enemyArt'
import CampaignMap from '../components/CampaignMap.vue'

const economy = honestEconomies['honest-b2-long']
const seeds = Array.from({ length: 120 }, (_, i) => i + 1)

/** A digest of the standard Sector I maps of seeds 0-399, computed before the long route existed: the generator must still reproduce them exactly. */
function digest(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16)
}

describe('standard Sector I is untouched by the long route', () => {
  it('generates the same 400 maps as before', () => {
    const all = Array.from({ length: 400 }, (_, seed) => JSON.stringify(generateSectorMap(seed))).join('\n')
    expect(digest(all)).toBe('7531f651')
  }, 60000)
  it('the standard configuration has none of the long route fields and the other modes none of its economy field', () => {
    expect('maxNormalBattles' in sectorOneConfig || 'assigner' in sectorOneConfig).toBe(false)
    for (const id of ['honest-a08', 'honest-a09', 'honest-b1', 'honest-b2'] as const) expect('sectorRoute' in honestEconomies[id]).toBe(false)
    expect('sectorRoute' in gameEconomy).toBe(false)
    expect(createSectorRun(7, honestEconomies['honest-b2'], undefined, undefined, 'r').map.layers).toHaveLength(6)
  })
})

describe('long route generation', () => {
  it('has a valid configuration and generates a valid map for every seed, without a fallback', () => {
    expect(() => validateSectorConfig(sectorLongConfig)).not.toThrow()
    for (const seed of seeds) {
      const map = generateSectorMap(seed, sectorLongConfig)
      expect(validateSectorMap(map), 'seed ' + seed).toEqual([])
      expect(map.generation!.fallback).toBe(false)
    }
  }, 60000)
  it('every route is ten visits: 4-5 ordinary battles, at most one elite, a rest right before the boss, development on offer', () => {
    for (const seed of seeds) {
      const map = generateSectorMap(seed, sectorLongConfig)
      const routes = sectorPaths(map)
      expect(routes.length).toBeGreaterThan(3)
      for (const route of routes) {
        const types = route.map(node => node.type)
        expect(route).toHaveLength(10)
        expect(types[types.length - 1]).toBe('final')
        expect(types[types.length - 2]).toBe('rest')
        const normal = types.filter(type => type === 'battle').length
        expect(normal, 'seed ' + seed).toBeGreaterThanOrEqual(4)
        expect(normal).toBeLessThanOrEqual(5)
        expect(types.filter(type => type === 'elite').length).toBeLessThanOrEqual(1)
        const ids = route.filter(node => node.type === 'battle').map(node => node.encounterId)
        expect(new Set(ids).size).toBe(ids.length)
      }
      // The optional elite is never forced: a route without it exists, and the mid-sector rest and elite are both on the map.
      expect(routes.some(route => !route.some(node => node.type === 'elite'))).toBe(true)
      expect(map.layers[4]!.some(node => node.type === 'elite') && map.layers[4]!.some(node => node.type === 'rest')).toBe(true)
      expect(routes.some(route => route.some(node => node.type === 'forge'))).toBe(true)
    }
  }, 60000)
  it('uses every new enemy somewhere', () => {
    const used = new Set<string>()
    for (const seed of seeds) for (const node of generateSectorMap(seed, sectorLongConfig).layers.flat()) if (node.encounterId) used.add(node.encounterId)
    for (const enemy of longSectorEnemies) expect(used.has(enemy.id), enemy.id).toBe(true)
  }, 60000)
  it('the new enemies fight through the real engine with their traits and have portraits that do not fall back', () => {
    const deck = honestDeck('armor8', true)
    for (const enemy of longSectorEnemies) {
      expect(resolveEnemyPortrait(enemy.id).fallback).toBe(false)
      const run = createSectorRun(3, economy, deck, undefined, 'x')
      const node = { id: 'n', layer: 0, column: 0, type: 'battle' as const, edges: [], encounterId: enemy.id, encounterHealth: enemy.maxHealth }
      const encounter = dungeonEncounter(node, economy)
      expect(encounter.maxHealth).toBe(Math.round(enemy.maxHealth * 1.75))
      const state = createCampaignBattle({ encounter, economy, heroes: run.heroes, deck: run.deck, artifacts: [], seed: 5, battleId: 'x' })
      expect(['victory', 'defeat']).toContain(runFight(state, createChooser('planner')).result)
    }
    const traits = JSON.stringify(longSectorEnemies.map(enemy => enemy.behavior))
    for (const trait of ['"interrupt"', '"pierce"', '"exposes"', '"attack_all"', '"prepare"']) expect(traits).toContain(trait)
  })
})

describe('long route modes, saves and versions', () => {
  it('opens only when asked for, in its own slot, under its own rules version', () => {
    expect(resolveRulesMode('').id).toBe('control')
    expect(resolveRulesMode('?rules=honest-b2-long').id).toBe('honest-b2-long')
    expect(resolveRulesMode('?rules=b1long').id).toBe('honest-b1-long')
    expect(resolveRulesMode('?rules=honest-b2').id).toBe('honest-b2')
    expect(new Set(rulesModes.map(mode => mode.saveKey)).size).toBe(rulesModes.length)
    expect(rulesVersionFor(economy)).toBe('honest-turn-b2-long-1')
    expect(rulesVersionFor(honestEconomies['honest-b2'])).toBe('honest-turn-b2-1')
  })
  it('a long run is saved and restored exactly, on the first step and mid-route, with its own catalogue version', () => {
    let run = createSectorRun(11, economy, honestDeck('armor8', true), undefined, 'long-run')
    expect(run.map.layers).toHaveLength(10)
    expect(run.campaign).toEqual({ id: sectorLongConfig.id, version: 1 })
    expect(decodeSnapshot(encodeSnapshot(run, economy, 1)).run).toEqual(run)
    run = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
    const raw = encodeSnapshot(run, economy, 2)
    expect(JSON.parse(raw).payload.catalogVersion).toBe(LONG_SECTOR_CATALOG_VERSION)
    expect(LONG_SECTOR_CATALOG_VERSION).not.toBe(SECTOR_CATALOG_VERSION)
    expect(decodeSnapshot(raw).run).toEqual(run)
    expect(dungeonNode(run.map, run.currentNodeId!)).toBeTruthy()
  })
  it('refuses to cross-load: a short run under long rules, a long run under short rules, and a tampered catalogue version', () => {
    const short = createSectorRun(11, honestEconomies['honest-b2'], honestDeck('armor8', true), undefined, 's')
    const long = createSectorRun(11, economy, honestDeck('armor8', true), undefined, 'l')
    expect(() => encodeSnapshot(short, economy, 1)).toThrow()
    expect(() => encodeSnapshot(long, honestEconomies['honest-b2'], 1)).toThrow()
    const raw = JSON.parse(encodeSnapshot(long, economy, 1))
    raw.payload.catalogVersion = SECTOR_CATALOG_VERSION
    expect(() => decodeSnapshot(JSON.stringify(raw))).toThrow()
    expect(IncompatibleSave).toBeDefined()
  })
})

describe('a whole long run', () => {
  it('walks ten visits to the end, saving and restoring after every step, and ends the sector once', () => {
    let run = createSectorRun(23, economy, honestDeck('armor8', true), undefined, 'walk')
    const visited: string[] = []
    const reload = () => { run = decodeSnapshot(encodeSnapshot(run, economy, visited.length + 1)).run }
    for (let guard = 0; guard < 40 && run.status === 'active'; guard++) {
      const node = availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!
      run = enterDungeonNode(run, node.id); visited.push(node.type); reload()
      if (run.room) run = resolveRoom(run, { roomId: run.room.id, action: 'leave' })
      else if (node.type === 'rest') run = resolveDungeonRest(run, null)
      else {
        const battle = restoreDungeonBattle(run)
        battle.enemy.health = 0; battle.result = 'victory'
        run = resolveDungeonBattle(run, battle)
        reload()
        if (run.pendingReward) run = skipDungeonReward(run, run.pendingReward.id)
      }
      reload()
    }
    expect(visited).toHaveLength(10)
    expect(visited[9]).toBe('final')
    expect(run.status).toBe('sector-complete')
    expect(dungeonRunPhase(run)).toBe('complete')
  }, 30000)
})

describe('long route map screen', () => {
  it('draws ten rows of rooms as categories only, never an enemy', async () => {
    const run = createSectorRun(11, economy, honestDeck('armor8', true), undefined, 'ui')
    const html = await renderToString(createSSRApp(CampaignMap, { map: run.map, run }))
    expect(html).toContain('is-dense')
    expect(html).toContain('ШТРЕК 9')
    expect(html).toContain('ФИНАЛ')
    for (const enemy of longSectorEnemies) expect(html).not.toContain(enemy.name)
    expect((html.match(/aria-label="(ШТРЕК|ФИНАЛ)/g) ?? []).length).toBe(run.map.layers.flat().length)
  })
})
