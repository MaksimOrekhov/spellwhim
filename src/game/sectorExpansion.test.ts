import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { allSectorEventIds, sectorEventIds, sectorEventText } from './sectorContent'
import { generateSectorMap, sectorOneConfig, sectorPaths, validateSectorConfig, validateSectorMap } from './dungeonGenerator'
import { expansionElites, longSectorConfigs, sectorLongConfig, sectorLongConfigV2, thistlenettle } from './sectorLong'
import { availableDungeonNodes, claimDungeonReward, createCampaignBattle, createSectorRun, dungeonEncounter, dungeonNode, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, equipDungeonArtifact, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from './campaign'
import type { DungeonMapNode, DungeonRunState } from './campaign'
import { createRoomVisit, dinnerHealBudget, dinnerPreview, resolveRoom, roomActionAvailable, roomActions, selectRoom, suggestDinnerHeal } from './dungeonRooms'
import type { RoomCommand } from './dungeonRooms'
import { dinnerRules, roomRules } from './roomRules'
import { artifactDefinitions } from './artifacts'
import { honestEconomies } from './economy'
import { honestDeck } from './honestDecks'
import { createChooser, eliteIds, runFight, simulateSectorRun } from './honestLab'
import { decodeSnapshot, encodeSnapshot, IncompatibleSave, LONG_SECTOR_CATALOG_VERSION, LONG_SECTOR_CATALOG_VERSION_2, ROOM_RULES_VERSION, SECTOR_CATALOG_VERSION, sectorCatalogFor, validateRun } from './runSave'
import { endTurn, forecastEnemyAction } from './battle'
import { enemyTier } from '../ui/enemyTier'
import { resolveEnemyPortrait } from '../ui/enemyArt'
import CampaignMap from '../components/CampaignMap.vue'
import DungeonRoom from '../components/DungeonRoom.vue'
import legacy from './fixtures/long-saves-before-expansion.json'

const economy = honestEconomies['honest-b2-long']
const deck = honestDeck('armor8', true)
const JOHNSON = 'old-mines-johnson', FOREMAN = thistlenettle.id

// ---------------------------------------------------------------------------------------------------------------------------------
// Walking a run with the real transactions. Fights are won by decree (the engine's own fights are exercised separately below).
// ---------------------------------------------------------------------------------------------------------------------------------
const won = (run: DungeonRunState) => { const battle = restoreDungeonBattle(run, economy); battle.enemy.health = 0; battle.result = 'victory'; return resolveDungeonBattle(run, battle) }
const reload = (run: DungeonRunState, revision = 1) => decodeSnapshot(encodeSnapshot(run, economy, revision)).run
/** Does what a careful player does in a node that is not the one under study. */
function perform(run: DungeonRunState, node: DungeonMapNode): DungeonRunState {
  run = enterDungeonNode(run, node.id)
  if (run.room) return resolveRoom(run, { roomId: run.room.id, action: 'leave' })
  if (node.type === 'rest') return resolveDungeonRest(run, null)
  return settle(won(run))
}
/** An ordinary reward is skipped; an elite one (which cannot be) takes its first card. */
const settle = (run: DungeonRunState): DungeonRunState => run.status === 'active' && run.pendingReward ? (run.pendingReward.elite ? claimDungeonReward(run, dungeonRewardOptions(run)[0]!) : skipDungeonReward(run, run.pendingReward.id)) : run
/** A run of `seed` standing inside the first room that fits `fits`; `before` may change the run right before it is entered. */
function insideRoom(seed: number, fits: (node: DungeonMapNode) => boolean, before: (run: DungeonRunState) => DungeonRunState = run => run): DungeonRunState {
  let run = createSectorRun(seed, economy, deck, undefined, 'room-' + seed)
  const route = sectorPaths(run.map).find(path => path.some(fits))
  if (!route) throw new Error('no such room on any route of seed ' + seed)
  for (const node of route) {
    if (fits(node)) return enterDungeonNode(before(run), node.id)
    run = perform(run, node)
  }
  throw new Error('unreachable')
}
const isDinner = (node: DungeonMapNode) => node.eventId === 'suspicious-dinner'
/** The map a new run of `seed` really gets (its map seed is derived from the run seed). */
const mapOf = (seed: number) => createSectorRun(seed, economy, deck, undefined, 'probe').map
const seedWith = (fits: (node: DungeonMapNode) => boolean) => { for (let seed = 1; seed < 300; seed += 1) if (mapOf(seed).layers.flat().some(fits)) return seed; throw new Error('no such room in 300 seeds') }
const dinnerSeed = seedWith(isDinner)
const hurt = (run: DungeonRunState, warrior: number, mage: number): DungeonRunState => ({ ...run, heroes: { warrior: { ...run.heroes.warrior, health: warrior }, mage: { ...run.heroes.mage, health: mage } } })
const atDinner = (before?: (run: DungeonRunState) => DungeonRunState) => insideRoom(dinnerSeed, isDinner, before)
const command = (run: DungeonRunState, rest: Omit<RoomCommand, 'roomId'>): RoomCommand => ({ roomId: run.room!.id, ...rest })
const owns = (run: DungeonRunState, hero: 'warrior' | 'mage') => run.artifacts.find(item => item.ownerInstanceId === run.heroes[hero].instanceId)

describe('E05 «Подозрительный ужин»: the room', () => {
  it('is an event of the long route\'s configuration 2 only, with its own text and three actions', () => {
    expect(sectorEventIds).not.toContain('suspicious-dinner')
    expect(allSectorEventIds).toContain('suspicious-dinner')
    expect(sectorLongConfigV2.eventPool).toContain('suspicious-dinner')
    expect(sectorLongConfig.eventPool).not.toContain('suspicious-dinner')
    expect(sectorOneConfig.eventPool).not.toContain('suspicious-dinner')
    expect(sectorEventText['suspicious-dinner'].name).toBe('Подозрительный ужин')
    const run = atDinner()
    expect(run.room!.type).toBe('event')
    expect(roomActions(run.room!)).toEqual(['heal', 'artifact', 'leave'])
    expect(dungeonRunPhase(run)).toBe('room')
  })

  it('offers two artifacts the party does not own, the same every time for the same seed', () => {
    const run = atDinner()
    expect(run.room!.artifactIds).toHaveLength(roomRules.artifacts)
    expect(new Set(run.room!.artifactIds).size).toBe(2)
    expect(createRoomVisit({ ...run, room: null }, dungeonNode(run.map, run.currentNodeId!)!)).toEqual(run.room)
    expect(atDinner().room).toEqual(run.room)
    // An artifact already carried is never offered again.
    const armed = atDinner(r => equipDungeonArtifact(r, 'reliable-wedge', r.heroes.warrior.instanceId, undefined, 'test'))
    expect(armed.room!.artifactIds).not.toContain('reliable-wedge')
    expect(armed.room!.artifactIds).toHaveLength(2)
  })
})

describe('E05 A «Подкрепиться»', () => {
  it('heals both heroes with a split the player chooses, never past maximum health', () => {
    const run = hurt(atDinner(), 20, 15)   // missing 5 and 3: the whole 6 can be given in a few ways
    expect(dinnerHealBudget(run)).toBe(6)
    for (const [warrior, mage] of [[3, 3], [4, 2], [5, 1], [6 - 3, 3]] as const) {
      const preview = dinnerPreview(run, { action: 'heal', heal: { warrior, mage } })
      expect(preview.valid, `${warrior}/${mage}`).toBe(true)
      const done = resolveRoom(run, command(run, { action: 'heal', heal: { warrior, mage } }))
      // The preview is the result.
      expect(done.heroes.warrior.health).toBe(preview.heroes.warrior.after)
      expect(done.heroes.mage.health).toBe(preview.heroes.mage.after)
      expect(done.heroes.warrior.health).toBe(20 + warrior)
      expect(done.heroes.mage.health).toBe(15 + mage)
      expect(done.room).toBeNull()
      expect(done.completedNodeIds).toContain(run.currentNodeId)
      expect(done.journal!.slice(-1)[0]).toMatchObject({ kind: 'heal', nodeId: run.currentNodeId })
    }
  })

  it('refuses a split that exceeds a maximum, wastes health, or is not whole numbers; nothing changes then', () => {
    const run = hurt(atDinner(), 20, 15)
    const before = structuredClone(run)
    for (const heal of [{ warrior: 6, mage: 0 }, { warrior: 0, mage: 6 }, { warrior: 2, mage: 2 }, { warrior: 4, mage: 3 }, { warrior: -1, mage: 7 }, { warrior: 2.5, mage: 3.5 }]) {
      expect(dinnerPreview(run, { action: 'heal', heal }).valid, JSON.stringify(heal)).toBe(false)
      expect(() => resolveRoom(run, command(run, { action: 'heal', heal })), JSON.stringify(heal)).toThrow()
    }
    expect(() => resolveRoom(run, command(run, { action: 'heal' }))).toThrow()
    expect(run).toEqual(before)
    expect(run.room).not.toBeNull()
  })

  it('gives only what the party is missing, and is closed when everyone is at full health', () => {
    const light = hurt(atDinner(), 24, 18)
    expect(dinnerHealBudget(light)).toBe(1)
    expect(suggestDinnerHeal(light)).toEqual({ warrior: 1, mage: 0 })
    expect(resolveRoom(light, command(light, { action: 'heal', heal: { warrior: 1, mage: 0 } })).heroes.warrior.health).toBe(25)
    expect(() => resolveRoom(light, command(light, { action: 'heal', heal: { warrior: 0, mage: 1 } }))).toThrow()
    const full = hurt(atDinner(), 25, 18)
    expect(dinnerHealBudget(full)).toBe(0)
    expect(roomActionAvailable(full, 'heal')).toBe(false)
    expect(() => resolveRoom(full, command(full, { action: 'heal', heal: { warrior: 0, mage: 0 } }))).toThrow()
    // Leaving is always possible.
    expect(roomActionAvailable(full, 'leave')).toBe(true)
  })

  it('the suggested split is always a legal one and favours the more wounded hero', () => {
    for (const [warrior, mage] of [[1, 1], [10, 18], [25, 4], [13, 9], [24, 17], [5, 5]] as const) {
      const run = hurt(atDinner(), warrior, mage)
      const heal = suggestDinnerHeal(run)
      expect(dinnerPreview(run, { action: 'heal', heal }).valid, `${warrior}/${mage}`).toBe(true)
    }
    const run = hurt(atDinner(), 25, 10)
    expect(suggestDinnerHeal(run)).toEqual({ warrior: 0, mage: 6 })
  })
})

describe('E05 B «Забрать подозрительный трофей»', () => {
  it('gives one of the two offered artifacts to the chosen hero for 3 health', () => {
    const run = atDinner()
    const artifactId = run.room!.artifactIds[1]!
    const done = resolveRoom(run, command(run, { action: 'artifact', heroId: 'mage', artifactId }))
    expect(done.heroes.mage.health).toBe(run.heroes.mage.health - dinnerRules.trophyHealth)
    expect(done.heroes.warrior.health).toBe(run.heroes.warrior.health)
    expect(owns(done, 'mage')?.definitionId).toBe(artifactId)
    expect(done.artifacts).toHaveLength(1)
    expect(done.room).toBeNull()
    expect(done.journal!.slice(-1)[0]!.text).toContain('−3 HP')
    // The preview said the same.
    expect(dinnerPreview(run, { action: 'artifact', heroId: 'mage' }).heroes.mage).toEqual({ before: 18, after: 15, delta: -3 })
  })

  it('is closed for a hero who would not survive the price, and for the party when none can', () => {
    const run = hurt(atDinner(), 3, 18)
    const artifactId = run.room!.artifactIds[0]!
    expect(dinnerPreview(run, { action: 'artifact', heroId: 'warrior' }).valid).toBe(false)
    expect(() => resolveRoom(run, command(run, { action: 'artifact', heroId: 'warrior', artifactId }))).toThrow()
    expect(roomActionAvailable(run, 'artifact')).toBe(true)
    expect(resolveRoom(run, command(run, { action: 'artifact', heroId: 'mage', artifactId })).heroes.mage.health).toBe(15)
    const both = hurt(atDinner(), 3, 2)
    expect(roomActionAvailable(both, 'artifact')).toBe(false)
    expect(() => resolveRoom(both, command(both, { action: 'artifact', heroId: 'mage', artifactId }))).toThrow()
    const four = hurt(atDinner(), 4, 4)
    expect(resolveRoom(four, command(four, { action: 'artifact', heroId: 'warrior', artifactId })).heroes.warrior.health).toBe(1)
  })

  it('replaces an occupied slot only when the replacement is confirmed, and a duplicate is impossible', () => {
    const run = atDinner(r => equipDungeonArtifact(r, 'reliable-wedge', r.heroes.mage.instanceId, undefined, 'test'))
    const artifactId = run.room!.artifactIds[0]!
    const old = owns(run, 'mage')!
    expect(() => resolveRoom(run, command(run, { action: 'artifact', heroId: 'mage', artifactId }))).toThrow()
    const done = resolveRoom(run, command(run, { action: 'artifact', heroId: 'mage', artifactId, replaceInstanceId: old.instanceId }))
    expect(done.artifacts).toHaveLength(1)
    expect(owns(done, 'mage')!.definitionId).toBe(artifactId)
    expect(done.heroes.mage.health).toBe(run.heroes.mage.health - 3)
    // The free slot is simply filled.
    const other = resolveRoom(run, command(run, { action: 'artifact', heroId: 'warrior', artifactId }))
    expect(other.artifacts).toHaveLength(2)
    // Something that was not offered cannot be taken.
    const notOffered = artifactDefinitions.find(item => !run.room!.artifactIds.includes(item.id) && item.id !== 'reliable-wedge')!.id
    expect(() => resolveRoom(run, command(run, { action: 'artifact', heroId: 'warrior', artifactId: notOffered }))).toThrow()
  })

  it('is closed when there is nothing to take', () => {
    const run = atDinner()
    const empty = { ...run, room: { ...run.room!, artifactIds: [] } }
    expect(roomActionAvailable(empty, 'artifact')).toBe(false)
    expect(roomActionAvailable(hurt(empty, 10, 10), 'heal')).toBe(true)
    expect(roomActionAvailable(empty, 'leave')).toBe(true)
  })

  it('a refused trophy leaves the run exactly as it was, and the room can still be resolved', () => {
    const run = atDinner()
    const before = structuredClone(run)
    expect(() => resolveRoom(run, command(run, { action: 'artifact', heroId: 'mage', artifactId: 'tension-spool' === run.room!.artifactIds[0] ? 'reliable-wedge' : run.room!.artifactIds[0]!, replaceInstanceId: 'nothing-here' }))).toThrow()
    expect(run).toEqual(before)
    expect(resolveRoom(run, command(run, { action: 'leave' })).completedNodeIds).toContain(run.currentNodeId)
  })
})

describe('E05 C «Отказаться» and the one-shot guarantees', () => {
  it('leaving changes nothing but the room', () => {
    const run = hurt(atDinner(), 10, 10)
    const done = resolveRoom(run, command(run, { action: 'leave' }))
    expect(done.heroes).toEqual(run.heroes)
    expect(done.artifacts).toEqual(run.artifacts)
    expect(done.deck).toEqual(run.deck)
    expect(done.room).toBeNull()
    expect(done.journal!.slice(-1)[0]).toMatchObject({ kind: 'leave', text: 'Комната покинута без изменений' })
  })

  it('pays out once: a second command on the spent room is refused, also after a reload', () => {
    const run = hurt(atDinner(), 20, 10)
    const heal = suggestDinnerHeal(run)
    const done = resolveRoom(run, command(run, { action: 'heal', heal }))
    expect(() => resolveRoom(done, command(run, { action: 'heal', heal }))).toThrow()
    const loaded = reload(done)
    expect(loaded).toEqual(done)
    expect(() => resolveRoom(loaded, command(run, { action: 'heal', heal }))).toThrow()
    expect(() => resolveRoom(loaded, command(run, { action: 'artifact', heroId: 'warrior', artifactId: run.room!.artifactIds[0]! }))).toThrow()
    expect(loaded.heroes.warrior.health + loaded.heroes.mage.health).toBe(30 + 6)
  })

  it('a draft is not a purchase: choosing, changing and cancelling spend nothing and survive a reload', () => {
    let run = hurt(atDinner(), 20, 10)
    run = selectRoom(run, run.room!.id, { action: 'heal', heal: { warrior: 2, mage: 4 } })
    expect(reload(run)).toEqual(run)
    expect(reload(run).room!.selection).toEqual({ action: 'heal', heal: { warrior: 2, mage: 4 } })
    run = selectRoom(run, run.room!.id, { action: 'artifact', heroId: 'warrior', artifactId: run.room!.artifactIds[0]! })
    expect(reload(run)).toEqual(run)
    run = selectRoom(run, run.room!.id, null)
    expect(run.room!.selection).toBeNull()
    expect(run.heroes).toEqual(hurt(atDinner(), 20, 10).heroes)
    expect(run.completedNodeIds).not.toContain(run.currentNodeId)
  })

  it('a damaged save cannot bring other offers, an impossible draft or an unknown event', () => {
    const run = hurt(atDinner(), 20, 10)
    const wrongOffer = structuredClone(run)
    wrongOffer.room!.artifactIds = [...wrongOffer.room!.artifactIds].reverse()
    expect(() => validateRun(wrongOffer)).toThrow()
    const swapped = structuredClone(run)
    swapped.room!.artifactIds = [artifactDefinitions.find(item => !run.room!.artifactIds.includes(item.id))!.id, run.room!.artifactIds[0]!]
    expect(() => validateRun(swapped)).toThrow()
    const hugeDraft = structuredClone(run)
    hugeDraft.room!.selection = { action: 'heal', heal: { warrior: 99, mage: 0 } }
    expect(() => validateRun(hugeDraft)).toThrow()
    const draftOnWrongRoom = structuredClone(run)
    draftOnWrongRoom.room!.selection = { action: 'risk' }
    expect(() => validateRun(draftOnWrongRoom)).toThrow()
    const unknownEvent = structuredClone(run) as unknown as { room: { eventId: string } }
    unknownEvent.room.eventId = 'free-dinner'
    expect(() => validateRun(unknownEvent as unknown as DungeonRunState)).toThrow()
    expect(() => validateRun(run)).not.toThrow()
    // An event that was resolved leaves a journal entry, and the room cannot come back with a doctored completed list.
    const done = resolveRoom(run, command(run, { action: 'leave' }))
    const revived = { ...done, room: run.room, completedNodeIds: done.completedNodeIds.slice(0, -1) }
    expect(() => validateRun(revived as DungeonRunState)).toThrow()
  })
})

describe('the second elite on the map', () => {
  const seeds = Array.from({ length: 160 }, (_, i) => i + 1)
  const elitesOf = (seed: number) => [...new Set(generateSectorMap(seed, sectorLongConfigV2).layers.flat().filter(node => node.type === 'elite').map(node => node.encounterId))]

  it('is a valid second member of the elite pool, with the first one still Johnson', () => {
    expect(() => validateSectorConfig(sectorLongConfigV2)).not.toThrow()
    expect(sectorLongConfigV2.elitePool).toEqual([JOHNSON, FOREMAN])
    expect(sectorLongConfig.elitePool).toEqual([JOHNSON])
    expect(sectorOneConfig.elitePool).toEqual([JOHNSON])
    expect(eliteIds).toEqual([JOHNSON, FOREMAN])
    expect(expansionElites).toEqual([thistlenettle])
  })

  it('both elites really meet, by seed, one elite per map, and the choice repeats', () => {
    const chosen = seeds.map(elitesOf)
    expect(chosen.every(list => list.length === 1)).toBe(true)
    const johnson = chosen.filter(list => list[0] === JOHNSON).length, foreman = chosen.filter(list => list[0] === FOREMAN).length
    expect(johnson + foreman).toBe(seeds.length)
    expect(johnson).toBeGreaterThan(seeds.length * 0.3)
    expect(foreman).toBeGreaterThan(seeds.length * 0.3)
    expect(seeds.map(elitesOf)).toEqual(chosen)
    // The standard route and the first long route are untouched: always Johnson.
    for (const seed of seeds.slice(0, 30)) {
      for (const config of [sectorOneConfig, sectorLongConfig]) expect(new Set(generateSectorMap(seed, config).layers.flat().filter(node => node.type === 'elite').map(node => node.encounterId))).toEqual(new Set([JOHNSON]))
    }
  }, 60000)

  it('keeps every old promise of the long route: ten visits, one optional elite, an elite-free route, development, a rest before the boss', () => {
    for (const seed of seeds) {
      const map = generateSectorMap(seed, sectorLongConfigV2)
      expect(validateSectorMap(map), 'seed ' + seed).toEqual([])
      expect(map.generation!.fallback).toBe(false)
      const routes = sectorPaths(map)
      expect(routes.some(route => !route.some(node => node.type === 'elite'))).toBe(true)
      for (const route of routes) {
        const types = route.map(node => node.type)
        expect(route).toHaveLength(10)
        expect(types[8]).toBe('rest')
        expect(types.filter(type => type === 'elite').length).toBeLessThanOrEqual(1)
        const normal = types.filter(type => type === 'battle').length
        expect(normal).toBeGreaterThanOrEqual(4)
        expect(normal).toBeLessThanOrEqual(5)
      }
      expect(map.layers[4]!.some(node => node.type === 'elite') && map.layers[4]!.some(node => node.type === 'rest')).toBe(true)
    }
  }, 120000)

  it('is never named on the map and never on the route screen', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const run = createSectorRun(seed, economy, deck, undefined, 'ui' + seed)
      const html = await renderToString(createSSRApp(CampaignMap, { map: run.map, run }))
      for (const word of ['Чертополох', 'Прораб', 'Джонсон', 'Подозрительный ужин', 'old-mines-thistlenettle']) expect(html, word).not.toContain(word)
    }
  })

  it('rejects a map that holds two different elites, or an elite its configuration does not list', () => {
    const map = structuredClone(generateSectorMap(2, sectorLongConfigV2))
    const elites = map.layers.flat().filter(node => node.type === 'elite')
    const other = elites[0]!.encounterId === JOHNSON ? thistlenettle : expansionElites.find(item => item.id === JOHNSON) ?? { id: JOHNSON, maxHealth: 64 }
    if (elites.length > 1) {
      elites[1]!.encounterId = other.id; elites[1]!.encounterHealth = other.maxHealth
      expect(validateSectorMap(map)).toContain('Two different elites on one map')
    }
    const old = structuredClone(generateSectorMap(2, sectorLongConfig))
    const node = old.layers.flat().find(n => n.type === 'elite')!
    node.encounterId = FOREMAN; node.encounterHealth = thistlenettle.maxHealth
    expect(validateSectorMap(old)).toContain('Invalid encounter')
  })
})

describe('Прораб Чертополох in a battle', () => {
  const node = { id: 'fore', layer: 4, column: 0, type: 'elite' as const, edges: [], encounterId: FOREMAN, encounterHealth: thistlenettle.maxHealth }
  const start = () => {
    const run = createSectorRun(3, economy, deck, undefined, 'f')
    return createCampaignBattle({ encounter: dungeonEncounter(node, economy), economy, heroes: run.heroes, deck: run.deck, artifacts: [], seed: 9, battleId: 'f' })
  }
  /** Ends turns with both heroes armored to the teeth: the cycle advances and nobody is hurt. */
  const pass = (state: ReturnType<typeof start>, turns: number) => { for (let n = 0; n < turns; n += 1) { state.heroes.warrior.armor = state.heroes.mage.armor = 99; endTurn(state) } state.heroes.warrior.armor = state.heroes.mage.armor = 0 }

  it('is an elite with the honest-rules health, a portrait that is not the fallback, and the elite look', () => {
    const encounter = dungeonEncounter(node, economy)
    expect(encounter.maxHealth).toBe(Math.round(58 * 1.75))
    expect(enemyTier(encounter.id)).toBe('elite')
    expect(resolveEnemyPortrait(encounter.id).fallback).toBe(false)
    expect(thistlenettle.mapLabel).toBe('Опасный забой')
  })

  it('winds a rage clock: every shift call makes later blows harder, up to the engine cap', () => {
    const state = start()
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 8, target: 'warrior' })
    pass(state, 1)
    expect(state.enemy.nextAction.kind).toBe('recover')
    pass(state, 1)
    expect(state.enemy.power).toBe(2)
    expect(state.enemy.nextAction.kind).toBe('prepare')
    pass(state, 1)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', name: 'Зов Чертополоха', damage: 11 + 2, target: 'mage', pierce: 4, interrupt: 26 })
    pass(state, 40)
    expect(state.enemy.power).toBe(6)
    // Even at full rage no announced blow can kill a full-health Jaina on its own: the hardest one is 11 + 6.
    const hardest = Math.max(...thistlenettle.behavior.phase1.map(action => action.kind === 'prepare' ? (action.prepared.kind === 'attack' ? action.prepared.damage : action.prepared.damage) : action.kind === 'attack' || action.kind === 'attack_all' ? action.damage : 0)) + 6
    expect(hardest).toBeLessThan(18)
  })

  it('pierces armor, and is stopped whole by enough damage dealt in one turn', () => {
    const state = start()
    pass(state, 3)
    state.heroes.mage.armor = 10
    const hit = forecastEnemyAction(state)
    // 13 against 10 armor of which 4 is ignored: 6 armor absorbs 6, 7 goes through.
    expect(hit.targets[0]).toMatchObject({ target: 'mage', pierced: 4, healthLoss: 7 })
    expect(hit.interrupt).toEqual({ need: 26, dealt: 0, broken: false })
    state.enemy.hurt = 26
    const stopped = forecastEnemyAction(state)
    expect(stopped.interrupt!.broken).toBe(true)
    const before = state.heroes.mage.health
    endTurn(state)
    expect(state.heroes.mage.health).toBe(before)
    // Less than the threshold does not stop it.
    const again = start()
    pass(again, 3)
    again.heroes.mage.armor = 0
    again.enemy.hurt = 25
    expect(forecastEnemyAction(again).interrupt!.broken).toBe(false)
  })

  it('can be beaten by the fair planner from a fresh party and from a half-spent one, and answered in more than one way', () => {
    const results = Array.from({ length: 24 }, (_, i) => {
      const run = createSectorRun(i + 1, economy, deck, undefined, 'p' + i)
      const state = createCampaignBattle({ encounter: dungeonEncounter(node, economy), economy, heroes: run.heroes, deck: run.deck, artifacts: [], seed: i + 1, battleId: 'p' + i })
      return runFight(state, createChooser('planner-careful'))
    })
    expect(results.filter(fight => fight.result === 'victory').length).toBeGreaterThanOrEqual(22)
    expect(results.every(fight => fight.result !== 'timeout')).toBe(true)
    // The answers it found: it broke the announced blow in some fights and armored against it in others.
    const strikes = results.flatMap(fight => fight.log.filter(turn => turn.traits.interrupt && turn.strike))
    expect(strikes.some(turn => turn.interruptBroken)).toBe(true)
    expect(strikes.some(turn => !turn.interruptBroken && turn.armorAbsorbed > 0)).toBe(true)
    // Nothing happens that was not announced.
    expect(results.every(fight => fight.log.every(turn => turn.unexplained === 0))).toBe(true)
  })
})

describe('elite rewards of both elites', () => {
  it('offer three gold cards and the artifacts of the existing elite reward, whichever elite was fought', () => {
    const found = new Set<string>()
    for (let seed = 1; seed < 80 && found.size < 2; seed += 1) {
      let run = createSectorRun(seed, economy, deck, undefined, 'g' + seed)
      const route = sectorPaths(run.map).find(path => path.some(node => node.type === 'elite'))!
      const eliteId = route.find(node => node.type === 'elite')!.encounterId!
      if (found.has(eliteId)) continue
      for (const node of route) {
        if (node.type !== 'elite') { run = perform(run, node); continue }
        run = won(enterDungeonNode(run, node.id))
        const offer = run.pendingReward!
        expect(offer.elite).toBe(true)
        expect(offer.rarity).toBe('gold')
        expect(offer.cards).toHaveLength(3)
        expect(offer.artifactIds.length).toBeGreaterThan(0)
        expect(new Set(offer.cards.map(card => card.definitionId)).size).toBe(3)
        expect(reload(run).pendingReward).toEqual(offer)
        const taken = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
        expect(taken.deck).toHaveLength(run.deck.length + 1)
        expect(() => claimDungeonReward(taken, dungeonRewardOptions(run)[0]!, offer.id)).toThrow()
        found.add(eliteId)
        break
      }
    }
    expect([...found].sort()).toEqual([FOREMAN, JOHNSON].sort())
  })
})

describe('whole runs to Rak\'Zor through every new room and both elites', () => {
  /** Walks one route to the end, in every room taking the new choices, saving and loading after every step. */
  function walk(seed: number, fits: (node: DungeonMapNode) => boolean): { run: DungeonRunState; visited: string[]; used: string[] } {
    let run = createSectorRun(seed, economy, deck, undefined, 'walk' + seed)
    const route = sectorPaths(run.map).find(path => path.some(fits))!
    const visited: string[] = [], used: string[] = []
    let revision = 1
    const keep = () => { run = reload(run, revision++) }
    for (const node of route) {
      run = enterDungeonNode(run, node.id); visited.push(node.type + ':' + (node.eventId ?? node.encounterId ?? '')); keep()
      if (run.room) {
        if (run.room.eventId === 'suspicious-dinner') {
          // Hurt, so that the heal is open, and a free slot, so that the trophy is too: do the heal on the first visit.
          run = hurt(run, 12, 9); keep()
          run = resolveRoom(run, command(run, { action: 'heal', heal: suggestDinnerHeal(run) })); used.push('heal')
        } else run = resolveRoom(run, { roomId: run.room.id, action: 'leave' })
      } else if (node.type === 'rest') run = resolveDungeonRest(run, null)
      else {
        run = won(run); keep()
        run = settle(run)
      }
      keep()
    }
    return { run, visited, used }
  }
  it('ends the sector after ten visits for a route with the dinner, and for a route with each elite', () => {
    for (const fits of [isDinner, (node: DungeonMapNode) => node.encounterId === FOREMAN, (node: DungeonMapNode) => node.encounterId === JOHNSON]) {
      const seed = seedWith(fits)
      const { run, visited } = walk(seed, fits)
      expect(visited).toHaveLength(10)
      expect(run.status).toBe('sector-complete')
      expect(dungeonRunPhase(run)).toBe('complete')
      expect(visited[visited.length - 1]).toContain('old-mines-rhahk-zor')
    }
  }, 60000)

  it('real fights, real rooms and the lab\'s route policies: no run stalls, and both elites are met', () => {
    const met = new Set<string>()
    for (let seed = 1; seed <= 40; seed += 1) {
      const log = simulateSectorRun(seed, economy, deck, 'planner-careful', 'risky')
      expect(log.result).not.toBe('timeout')
      for (const battle of log.battles) if (battle.node === 'elite') met.add(battle.enemy)
      for (const room of log.rooms ?? []) if (room.event === 'suspicious-dinner') expect(['heal', 'artifact', 'leave']).toContain(room.action)
    }
    expect([...met].sort()).toEqual([FOREMAN, JOHNSON].sort())
  }, 120000)
})

describe('saves: runs begun before the expansion', () => {
  const fixtures = legacy as unknown as Record<'fresh' | 'eventRoom' | 'eliteReward', { raw: string; eventId?: string; nodeId?: string; eliteId?: string }> & { versions: { long: string; sector: string; rooms: string } }

  it('the fingerprints a version-1 save was written under are exactly what they were, and version 2 has its own', () => {
    expect(LONG_SECTOR_CATALOG_VERSION).toBe(fixtures.versions.long)
    expect(SECTOR_CATALOG_VERSION).toBe(fixtures.versions.sector)
    expect(ROOM_RULES_VERSION).toBe(fixtures.versions.rooms)
    expect(LONG_SECTOR_CATALOG_VERSION_2).not.toBe(LONG_SECTOR_CATALOG_VERSION)
    expect(sectorCatalogFor(sectorLongConfig.id, false, 1)).toBe(LONG_SECTOR_CATALOG_VERSION)
    expect(sectorCatalogFor(sectorLongConfig.id, false, 2)).toBe(LONG_SECTOR_CATALOG_VERSION_2)
    expect(sectorCatalogFor(sectorLongConfig.id, false, 3)).not.toBe(LONG_SECTOR_CATALOG_VERSION_2)
    expect(longSectorConfigs.map(config => config.version)).toEqual([1, 2, 3])
  })

  it('loads each save written by the code before the expansion, as a version-1 run that keeps its map, its elite and its rooms', () => {
    for (const key of ['fresh', 'eventRoom', 'eliteReward'] as const) {
      const snapshot = decodeSnapshot(fixtures[key].raw)
      expect(snapshot.run.campaign, key).toEqual({ id: sectorLongConfig.id, version: 1 })
      expect(snapshot.run.map.configuration).toEqual(sectorLongConfig)
      // Saving it again keeps the old fingerprint: the run goes on exactly as it was written.
      const again = JSON.parse(encodeSnapshot(snapshot.run, economy, snapshot.revision + 1))
      expect(again.payload.catalogVersion, key).toBe(JSON.parse(fixtures[key].raw).payload.catalogVersion)
      expect(decodeSnapshot(JSON.stringify(again)).run).toEqual(snapshot.run)
    }
    expect(dungeonRunPhase(decodeSnapshot(fixtures.eventRoom.raw).run)).toBe('room')
    expect(dungeonRunPhase(decodeSnapshot(fixtures.eliteReward.raw).run)).toBe('reward')
  })

  it('an old run in an unfinished event room continues: the draft is there, the room resolves once, the sector ends', () => {
    let run = decodeSnapshot(fixtures.eventRoom.raw).run
    expect(run.room!.eventId).toBe(fixtures.eventRoom.eventId)
    expect(run.room!.selection).not.toBeNull()
    expect(sectorEventIds as readonly string[]).toContain(run.room!.eventId)
    run = resolveRoom(run, { roomId: run.room!.id, action: 'leave' })
    expect(() => resolveRoom(run, { roomId: 'whatever', action: 'leave' })).toThrow()
    for (let guard = 0; guard < 30 && run.status === 'active'; guard += 1) {
      run = reload(perform(run, availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!))
    }
    expect(run.status).toBe('sector-complete')
    // Whatever it met, it met nothing from the expansion.
    const met = new Set(run.map.layers.flat().flatMap(node => [node.encounterId, node.eventId]))
    expect(met.has(FOREMAN)).toBe(false)
    expect(met.has('suspicious-dinner')).toBe(false)
  }, 30000)

  it('an old run holding the elite reward still claims it once, and its elite is the one it was saved with', () => {
    let run = decodeSnapshot(fixtures.eliteReward.raw).run
    expect(dungeonNode(run.map, run.currentNodeId!)!.encounterId).toBe(fixtures.eliteReward.eliteId)
    expect(fixtures.eliteReward.eliteId).toBe(JOHNSON)
    expect(run.pendingReward!.rarity).toBe('gold')
    const first = dungeonRewardOptions(run)[0]!
    run = claimDungeonReward(run, first)
    expect(reload(run).deck.filter(card => card.definitionId === first.id)).toHaveLength(1)
    expect(() => claimDungeonReward(run, first)).toThrow()
  })

  it('refuses a map that carries content its version never had, or a version number that does not match its map', () => {
    const v1 = decodeSnapshot(fixtures.fresh.raw).run
    const poolPoisoned = structuredClone(v1)
    poolPoisoned.map.configuration!.eventPool = [...poolPoisoned.map.configuration!.eventPool, 'suspicious-dinner']
    expect(() => validateRun(poolPoisoned)).toThrow()
    const elitePoisoned = structuredClone(v1)
    elitePoisoned.map.configuration!.elitePool = [JOHNSON, FOREMAN]
    expect(() => validateRun(elitePoisoned)).toThrow()
    const relabelled = structuredClone(v1)
    relabelled.campaign = { id: sectorLongConfig.id, version: 2 }
    expect(() => validateRun(relabelled)).toThrow()
    const upgraded = structuredClone(v1)
    upgraded.map.configuration = structuredClone(sectorLongConfigV2)
    expect(() => validateRun(upgraded)).toThrow()
    // A version-1 snapshot cannot be re-labelled as version 2 by editing its fingerprint either.
    const raw = JSON.parse(fixtures.fresh.raw)
    raw.payload.catalogVersion = LONG_SECTOR_CATALOG_VERSION_2
    expect(() => decodeSnapshot(JSON.stringify(raw))).toThrow()
    expect(IncompatibleSave).toBeDefined()
  })

  it('a version-2 run has the expansion fingerprint, and does not read as version 1', () => {
    const run = createSectorRun(5, economy, deck, sectorLongConfigV2, 'new')
    expect(run.campaign).toEqual({ id: sectorLongConfig.id, version: 2 })
    expect(run.map.configuration).toEqual(sectorLongConfigV2)
    const raw = encodeSnapshot(run, economy, 1)
    expect(JSON.parse(raw).payload.catalogVersion).toBe(sectorCatalogFor(sectorLongConfig.id, true, 2))
    const forged = JSON.parse(raw)
    forged.payload.catalogVersion = sectorCatalogFor(sectorLongConfig.id, true, 1)
    expect(() => decodeSnapshot(JSON.stringify(forged))).toThrow()
    expect(decodeSnapshot(raw).run).toEqual(run)
    // The short sector is not a long run and never takes the expansion.
    const short = createSectorRun(5, honestEconomies['honest-b2'], deck, undefined, 's')
    expect(short.campaign).toEqual({ id: sectorOneConfig.id, version: 1 })
    expect(short.map.layers.flat().some(node => node.eventId === 'suspicious-dinner' || node.encounterId === FOREMAN)).toBe(false)
  })
})

describe('the dinner screen', () => {
  const render = (run: DungeonRunState) => renderToString(createSSRApp(DungeonRoom, { run }))

  it('shows the story, the three choices with their costs, and the heroes\' health', async () => {
    const run = hurt(atDinner(), 20, 10)
    const html = await render(run)
    for (const text of ['Подозрительный ужин', 'Блюдо дня', 'Подкрепиться', 'Забрать подозрительный трофей', 'Отказаться', 'Цена: 3 HP', 'До 6 HP', 'Без последствий']) expect(html, text).toContain(text)
    expect(html).toContain('room-screen--suspicious-dinner')
  })

  it('shows the split and its result before it is confirmed', async () => {
    const run = selectRoom(hurt(atDinner(), 20, 10), atDinner().room!.id, { action: 'heal', heal: { warrior: 2, mage: 4 } })
    const html = await render(run)
    expect(html).toContain('+2')
    expect(html).toContain('+4')
    expect(html).toContain('20 → 22 / 25 HP')
    expect(html).toContain('10 → 14 / 18 HP')
    expect(html).toContain('Вариан 20 → 22 HP · Джайна 10 → 14 HP')
  })

  it('closes the heal at full health and the trophy for a hero that could not pay, saying why', async () => {
    const full = await render(hurt(atDinner(), 25, 18))
    expect(full).toContain('Здоровье у всех полное')
    const weak = selectRoom(hurt(atDinner(), 3, 18), atDinner().room!.id, { action: 'artifact' })
    const html = await render(weak)
    expect(html).toMatch(/disabled[^>]*>Вариан Ринн · 3\/25 HP/)
    expect(html).toContain('Джайна Праудмур · 18/18 HP')
  })

  it('has the same room contract as before for the other events', () => {
    expect(roomRules.version).toBe('sector-rooms-2')
    expect(dinnerRules).toEqual({ version: 'suspicious-dinner-1', heal: 6, trophyHealth: 3 })
  })
})
