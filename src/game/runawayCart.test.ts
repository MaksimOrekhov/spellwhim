import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { allSectorEventIds, eventIdsV2, sectorEventIds, sectorEventText } from './sectorContent'
import { sectorOneConfig, sectorPaths, validateSectorMap } from './dungeonGenerator'
import { longSectorConfigs, sectorLongConfig, sectorLongConfigV2, sectorLongConfigV3 } from './sectorLong'
import { availableDungeonNodes, battleStartArmor, createSectorRun, dungeonRunPhase, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle } from './campaign'
import type { DungeonMapNode, DungeonRunState } from './campaign'
import { cartPreview, resolveRoom, roomActionAvailable, roomActions, roomEligibleCards, selectRoom } from './dungeonRooms'
import type { RoomCommand } from './dungeonRooms'
import { cartRules, dinnerRules, roomRules } from './roomRules'
import { honestEconomies } from './economy'
import { honestDeck } from './honestDecks'
import { simulateSectorRun } from './honestLab'
import { decodeSnapshot, encodeSnapshot, LONG_SECTOR_CATALOG_VERSION, LONG_SECTOR_CATALOG_VERSION_2, LONG_SECTOR_CATALOG_VERSION_3, ROOM_RULES_VERSION, SECTOR_CATALOG_VERSION, sectorCatalogFor, validateRun } from './runSave'
import { endTurn } from './battle'
import { canUpgradeCard } from './cardProgression'
import CampaignMap from '../components/CampaignMap.vue'
import DungeonRoom from '../components/DungeonRoom.vue'
import before from './fixtures/long-saves-v2-before-cart.json'

const economy = honestEconomies['honest-b2-long']
const deck = honestDeck('armor8', true)
const isCart = (node: DungeonMapNode) => node.eventId === 'runaway-cart'
const isCombat = (node: DungeonMapNode) => ['battle', 'elite', 'final'].includes(node.type)

// ---------------------------------------------------------------------------------------------------------------------------------
// Walking a run with the real transactions. Fights are won by decree; the boon itself is played in a real battle further below.
// ---------------------------------------------------------------------------------------------------------------------------------
const won = (run: DungeonRunState) => { const battle = restoreDungeonBattle(run, economy); battle.enemy.health = 0; battle.result = 'victory'; return resolveDungeonBattle(run, battle) }
const reload = (run: DungeonRunState, revision = 1) => decodeSnapshot(encodeSnapshot(run, economy, revision)).run
const settle = (run: DungeonRunState): DungeonRunState => run.status === 'active' && run.pendingReward ? { ...run, pendingReward: null, decisions: [...run.decisions, run.pendingReward.id] } : run
function perform(run: DungeonRunState, node: DungeonMapNode): DungeonRunState {
  run = enterDungeonNode(run, node.id)
  if (run.room) return resolveRoom(run, { roomId: run.room.id, action: 'leave' })
  if (node.type === 'rest') return resolveDungeonRest(run, null)
  return settle(won(run))
}
const mapOf = (seed: number) => createSectorRun(seed, economy, deck, undefined, 'probe').map
const cartSeed = (() => { for (let seed = 1; seed < 300; seed += 1) if (mapOf(seed).layers.flat().some(isCart)) return seed; throw new Error('no cart in 300 seeds') })()
/** The route of `seed` that passes the cart, and the run standing inside the cart room. */
function atCart(before: (run: DungeonRunState) => DungeonRunState = run => run, seed = cartSeed) {
  let run = createSectorRun(seed, economy, deck, undefined, 'cart-' + seed)
  const route = sectorPaths(run.map).find(path => path.some(isCart))!
  for (const [index, node] of route.entries()) {
    if (isCart(node)) return { run: enterDungeonNode(before(run), node.id), route, index }
    run = perform(run, node)
  }
  throw new Error('unreachable')
}
const hurt = (run: DungeonRunState, warrior: number, mage: number): DungeonRunState => ({ ...run, heroes: { warrior: { ...run.heroes.warrior, health: warrior }, mage: { ...run.heroes.mage, health: mage } } })
const command = (run: DungeonRunState, rest: Omit<RoomCommand, 'roomId'>): RoomCommand => ({ roomId: run.room!.id, ...rest })
const ride = (run: DungeonRunState, heroId: 'warrior' | 'mage' = 'warrior', instanceId = roomEligibleCards(run, 'ride')[0]!.instanceId) => resolveRoom(run, command(run, { action: 'ride', heroId, instanceId }))
/** After the cart, walks the route until the party stands at the entrance of its next combat, carrying whatever the cart left. */
function toNextBattle(start: { run: DungeonRunState; route: DungeonMapNode[]; index: number }, afterRoom: (run: DungeonRunState) => DungeonRunState = run => run) {
  let run = afterRoom(start.run)
  for (const node of start.route.slice(start.index + 1)) {
    if (isCombat(node)) return enterDungeonNode(run, node.id)
    run = perform(run, node)
  }
  throw new Error('no battle after the cart')
}
const upgraded = (run: DungeonRunState) => run.deck.filter(card => card.upgrade === 1).length

describe('E06 «Вагонетка без тормозов»: where it lives', () => {
  it('is an event of the long route\'s configuration 3 only, with its own text and three actions', () => {
    expect(sectorEventIds).not.toContain('runaway-cart')
    expect(eventIdsV2).not.toContain('runaway-cart')
    expect(allSectorEventIds).toContain('runaway-cart')
    expect(sectorLongConfigV3.eventPool).toContain('runaway-cart')
    expect(sectorLongConfigV2.eventPool).not.toContain('runaway-cart')
    expect(sectorLongConfig.eventPool).not.toContain('runaway-cart')
    expect(sectorOneConfig.eventPool).not.toContain('runaway-cart')
    expect(longSectorConfigs.map(config => config.version)).toEqual([1, 2, 3])
    expect(sectorEventText['runaway-cart'].name).toBe('Вагонетка без тормозов')
    const { run } = atCart()
    expect(run.room!.type).toBe('event')
    expect(run.room!.eventId).toBe('runaway-cart')
    expect(roomActions(run.room!)).toEqual(['ride', 'bypass', 'leave'])
    expect(dungeonRunPhase(run)).toBe('room')
  })

  it('appears on a good share of new maps and never breaks the generator\'s promises', () => {
    let withCart = 0
    for (let seed = 1; seed <= 120; seed += 1) {
      const map = mapOf(seed)
      expect(validateSectorMap(map), 'seed ' + seed).toEqual([])
      expect(map.layers).toHaveLength(10)
      const cartNodes = map.layers.flat().filter(isCart)
      expect(cartNodes.length).toBeLessThanOrEqual(1)
      if (cartNodes.length) withCart += 1
    }
    expect(withCart).toBeGreaterThan(120 * 0.4)
  }, 60000)

  it('the short sector and the games of the other rules never get it', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const short = createSectorRun(seed, honestEconomies['honest-b2'], deck, undefined, 's' + seed)
      expect(short.campaign).toEqual({ id: sectorOneConfig.id, version: 1 })
      expect(short.map.layers.flat().some(isCart)).toBe(false)
    }
  })
})

describe('E06 A «Прыгнуть в вагонетку»', () => {
  it('costs the chosen hero 3 health, upgrades exactly one chosen card, and owes that hero 2 armor for the next battle', () => {
    const { run } = atCart()
    const copy = roomEligibleCards(run, 'ride')[2]!
    const preview = cartPreview(run, { action: 'ride', heroId: 'mage' })
    expect(preview).toMatchObject({ valid: true, armor: { heroId: 'mage', amount: cartRules.armor } })
    const done = ride(run, 'mage', copy.instanceId)
    expect(done.heroes.mage.health).toBe(preview.heroes.mage.after)
    expect(done.heroes.mage.health).toBe(run.heroes.mage.health - cartRules.health)
    expect(done.heroes.warrior.health).toBe(run.heroes.warrior.health)
    expect(upgraded(done)).toBe(upgraded(run) + 1)
    expect(done.deck.find(card => card.instanceId === copy.instanceId)!.upgrade).toBe(1)
    expect(done.deck).toHaveLength(run.deck.length)
    expect(done.pendingBattleEffects).toEqual([{ id: `${run.runId}/effect/${run.currentNodeId}`, kind: 'start-armor', heroId: 'mage', amount: cartRules.armor, sourceNodeId: run.currentNodeId }])
    expect(battleStartArmor(done)).toEqual({ mage: cartRules.armor })
    expect(done.room).toBeNull()
    expect(done.completedNodeIds).toContain(run.currentNodeId)
    expect(done.journal!.slice(-1)[0]).toMatchObject({ kind: 'ride', nodeId: run.currentNodeId })
    expect(done.journal!.slice(-1)[0]!.text).toContain('−3 HP')
    // A hero's armor on the run itself stays zero: the boon lives only in the pending list and the battle that spends it.
    expect(done.heroes.mage.armor).toBe(0)
  })

  it('is only for a rider who stays on his feet, and a lethal payment is impossible', () => {
    const { run } = atCart()
    const low = hurt(run, 3, 18)
    expect(cartPreview(low, { action: 'ride', heroId: 'warrior' }).valid).toBe(false)
    expect(() => ride(low, 'warrior')).toThrow()
    expect(roomActionAvailable(low, 'ride')).toBe(true)
    expect(ride(low, 'mage').heroes.mage.health).toBe(15)
    const both = hurt(run, 3, 1)
    expect(roomActionAvailable(both, 'ride')).toBe(false)
    expect(() => ride(both, 'mage')).toThrow()
    const four = hurt(run, 4, 4)
    expect(ride(four, 'warrior').heroes.warrior.health).toBe(1)
    expect(() => resolveRoom(low, command(low, { action: 'ride', instanceId: roomEligibleCards(low, 'ride')[0]!.instanceId }))).toThrow()
  })

  it('refuses a copy that cannot be upgraded, a foreign copy and a missing choice; nothing is spent then', () => {
    const { run } = atCart(r => ({ ...r, deck: r.deck.map((card, index) => index === 0 ? { ...card, upgrade: 1 as const } : card) }))
    const snapshot = structuredClone(run)
    const maxed = run.deck.find(card => !canUpgradeCard(card))!
    expect(() => ride(run, 'warrior', maxed.instanceId)).toThrow()
    expect(() => ride(run, 'warrior', 'nope')).toThrow()
    expect(() => resolveRoom(run, command(run, { action: 'ride', heroId: 'warrior' }))).toThrow()
    expect(() => resolveRoom(run, { roomId: 'another-room', action: 'ride', heroId: 'warrior', instanceId: run.deck[1]!.instanceId })).toThrow()
    expect(run).toEqual(snapshot)
    expect(run.room).not.toBeNull()
    expect(run.pendingBattleEffects).toBeUndefined()
  })

  it('is closed when no card can be upgraded', () => {
    const { run } = atCart(r => ({ ...r, deck: r.deck.map(card => canUpgradeCard(card) ? { ...card, upgrade: 1 as const } : card) }))
    expect(roomEligibleCards(run, 'ride')).toHaveLength(0)
    expect(roomActionAvailable(run, 'ride')).toBe(false)
    // A healthy party has nothing to mend either, so only leaving remains.
    expect(roomActionAvailable(run, 'bypass')).toBe(false)
    expect(roomActionAvailable(hurt(run, 20, 18), 'bypass')).toBe(true)
    expect(roomActionAvailable(run, 'leave')).toBe(true)
  })

  it('happens once: the room is spent, a repeat — also after a reload — gives nothing', () => {
    const { run } = atCart()
    const done = ride(run)
    expect(() => ride(done)).toThrow()
    expect(() => resolveRoom(done, { roomId: run.room!.id, action: 'ride', heroId: 'warrior', instanceId: run.deck[0]!.instanceId })).toThrow()
    const loaded = reload(done)
    expect(loaded).toEqual(done)
    expect(() => resolveRoom(loaded, { roomId: run.room!.id, action: 'ride', heroId: 'mage', instanceId: run.deck[0]!.instanceId })).toThrow()
    expect(loaded.pendingBattleEffects).toHaveLength(1)
  })

  it('keeps the draft while the player decides, and cancelling spends nothing', () => {
    const { run } = atCart()
    const drafted = selectRoom(run, run.room!.id, { action: 'ride', heroId: 'warrior', instanceId: run.deck[0]!.instanceId })
    expect(reload(drafted).room!.selection).toEqual(drafted.room!.selection)
    const cancelled = selectRoom(drafted, run.room!.id, null)
    expect(cancelled.heroes).toEqual(run.heroes)
    expect(cancelled.pendingBattleEffects).toBeUndefined()
  })
})

describe('E06 the boon in the next battle', () => {
  it('only the chosen hero starts the next battle in armor, and the armor really stops damage', () => {
    const start = atCart()
    const run = toNextBattle(start, room => ride(room, 'warrior'))
    const battle = restoreDungeonBattle(run, economy)
    expect(battle.heroes.warrior.armor).toBe(cartRules.armor)
    expect(battle.heroes.mage.armor).toBe(0)
    // The armor takes the first blow before health does.
    battle.enemy.nextAction = { kind: 'attack', name: 'Проверочный удар', damage: 6, target: 'warrior' }
    battle.enemy.focus = 'warrior'
    const health = battle.heroes.warrior.health
    endTurn(battle)
    expect(health - battle.heroes.warrior.health).toBe(6 - cartRules.armor)
  })

  it('waits through rests, forges and other rooms: it is for the next real battle, not the next node', () => {
    // A cart whose route has a non-combat room right after it.
    let start = atCart()
    for (let seed = 1; seed < 300 && isCombat(start.route[start.index + 1]!); seed += 1) {
      if (!mapOf(seed).layers.flat().some(isCart)) continue
      const candidate = atCart(undefined, seed)
      if (!isCombat(candidate.route[candidate.index + 1]!)) { start = candidate; break }
    }
    expect(isCombat(start.route[start.index + 1]!)).toBe(false)
    const afterCart = ride(start.run, 'mage')
    let run = afterCart
    let nonCombatBetween = 0
    for (const node of start.route.slice(start.index + 1)) {
      if (isCombat(node)) { run = enterDungeonNode(run, node.id); break }
      run = perform(run, node)
      nonCombatBetween += 1
      expect(run.pendingBattleEffects, 'after ' + node.type).toEqual(afterCart.pendingBattleEffects)
    }
    expect(restoreDungeonBattle(run, economy).heroes.mage.armor).toBe(cartRules.armor)
    expect(nonCombatBetween).toBeGreaterThan(0)
  })

  it('is spent by the battle that gets it: gone after the result, absent from the next battle', () => {
    const start = atCart()
    let run = toNextBattle(start, room => ride(room, 'warrior'))
    expect(run.pendingBattleEffects).toHaveLength(1)
    const after = won(run)
    expect(after.pendingBattleEffects).toBeUndefined()
    expect('pendingBattleEffects' in after).toBe(false)
    expect(battleStartArmor(after)).toEqual({})
    run = settle(after)
    // Walk on to the next battle of the route: no armor from the cart is left.
    const rest = start.route.slice(start.route.findIndex(node => node.id === run.currentNodeId) + 1)
    for (const node of rest) {
      run = enterDungeonNode(run, node.id)
      if (isCombat(node)) { expect(restoreDungeonBattle(run, economy).heroes.warrior.armor).toBe(0); return }
      run = run.room ? resolveRoom(run, { roomId: run.room.id, action: 'leave' }) : node.type === 'rest' ? resolveDungeonRest(run, null) : run
    }
  })

  it('a defeat drops it too, and the same result cannot be applied twice', () => {
    const run = toNextBattle(atCart(), room => ride(room, 'mage'))
    const battle = restoreDungeonBattle(run, economy)
    battle.heroes.mage.health = 0
    battle.result = 'defeat'
    const lost = resolveDungeonBattle(run, battle)
    expect(lost.status).toBe('defeat')
    expect(lost.pendingBattleEffects).toBeUndefined()
    expect(reload(lost).status).toBe('defeat')
    expect(() => resolveDungeonBattle(lost, battle)).toThrow()
  })

  it('survives a reload before the battle and in the middle of it: the same armor comes back, and it is still spent once', () => {
    const run = toNextBattle(atCart(), room => ride(room, 'warrior'))
    // Saved at the entrance of the battle: the effect is in the file and the restored battle has the armor.
    const loaded = reload(run)
    expect(loaded.pendingBattleEffects).toEqual(run.pendingBattleEffects)
    expect(restoreDungeonBattle(loaded, economy).heroes.warrior.armor).toBe(cartRules.armor)
    // The battle is replayed from its entry after a restart, again with the armor; leaving and coming back never doubles it.
    const again = restoreDungeonBattle(reload(loaded, 2), economy)
    expect(again.heroes.warrior.armor).toBe(cartRules.armor)
    const finished = reload(won(loaded), 3)
    expect(finished.pendingBattleEffects).toBeUndefined()
  })

  it('the armor is added once: the whole party carries exactly the owed amount into the battle', () => {
    const run = toNextBattle(atCart(), room => ride(room, 'warrior'))
    const battle = restoreDungeonBattle(run, economy)
    expect(Object.values(battle.heroes).reduce((sum, hero) => sum + hero.armor, 0)).toBe(cartRules.armor)
  })
})

describe('E06 B «Пропустить вагонетку» and C «уйти»', () => {
  it('heals the chosen hero by 2, never past maximum, and leaves cards and armor alone', () => {
    const { run } = atCart()
    const wounded = hurt(run, 20, 10)
    const preview = cartPreview(wounded, { action: 'bypass', heroId: 'mage' })
    expect(preview.heroes.mage).toEqual({ before: 10, after: 12, delta: 2 })
    const done = resolveRoom(wounded, command(wounded, { action: 'bypass', heroId: 'mage' }))
    expect(done.heroes.mage.health).toBe(12)
    expect(done.heroes.warrior.health).toBe(20)
    expect(done.deck).toEqual(wounded.deck)
    expect(done.pendingBattleEffects).toBeUndefined()
    expect(done.room).toBeNull()
    expect(done.journal!.slice(-1)[0]).toMatchObject({ kind: 'bypass' })
    // One missing point heals one point.
    const almost = hurt(run, 24, 18)
    expect(resolveRoom(almost, command(almost, { action: 'bypass', heroId: 'warrior' })).heroes.warrior.health).toBe(25)
  })

  it('needs a hurt hero, and the choice of that hero', () => {
    const { run } = atCart()
    const mixed = hurt(run, 25, 10)
    expect(roomActionAvailable(mixed, 'bypass')).toBe(true)
    expect(cartPreview(mixed, { action: 'bypass', heroId: 'warrior' }).valid).toBe(false)
    expect(() => resolveRoom(mixed, command(mixed, { action: 'bypass', heroId: 'warrior' }))).toThrow()
    expect(() => resolveRoom(mixed, command(mixed, { action: 'bypass' }))).toThrow()
    const healthy = hurt(run, 25, 18)
    expect(roomActionAvailable(healthy, 'bypass')).toBe(false)
    expect(() => resolveRoom(healthy, command(healthy, { action: 'bypass', heroId: 'mage' }))).toThrow()
    expect(mixed.room).not.toBeNull()
  })

  it('leaving changes nothing but the room, and nothing is owed afterwards', () => {
    const { run } = atCart()
    const done = resolveRoom(run, command(run, { action: 'leave' }))
    expect(done.heroes).toEqual(run.heroes)
    expect(done.deck).toEqual(run.deck)
    expect(done.pendingBattleEffects).toBeUndefined()
    expect(done.room).toBeNull()
    expect(() => resolveRoom(done, command(run, { action: 'leave' }))).toThrow()
  })
})

describe('E06 saves: the effect is kept exactly, and nothing can be forged', () => {
  const owing = () => ride(atCart().run)

  it('saves and restores the owed boon, on the map, mid-route and in the entrance of the battle', () => {
    const done = owing()
    expect(reload(done)).toEqual(done)
    expect(dungeonRunPhase(done)).toBe('map')
    const raw = JSON.parse(encodeSnapshot(done, economy, 1))
    expect(raw.payload.catalogVersion).toBe(sectorCatalogFor(sectorLongConfig.id, true, 3))
    expect(raw.payload.run.pendingBattleEffects).toHaveLength(1)
  })

  it('refuses a boon that history does not owe: no cart ride, a bigger amount, another source, a duplicate, an empty list', () => {
    const done = owing()
    const effect = done.pendingBattleEffects![0]!
    const tamper = (change: (run: DungeonRunState) => void) => { const copy = structuredClone(done); change(copy); return copy }
    expect(() => validateRun(done)).not.toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects![0]!.amount = 5 }))).toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects![0]!.amount = cartRules.armor + 1 }))).toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects![0]!.sourceNodeId = run.completedNodeIds[0]! }))).toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects![0]!.id = 'x' }))).toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects = [effect, effect] }))).toThrow()
    expect(() => validateRun(tamper(run => { run.pendingBattleEffects = [] }))).toThrow()
    // The effect cannot be invented on a run that never rode the cart...
    const never = atCart().run
    expect(() => validateRun({ ...resolveRoom(never, command(never, { action: 'leave' })), pendingBattleEffects: [{ ...effect, sourceNodeId: never.currentNodeId!, id: `${never.runId}/effect/${never.currentNodeId}` }] })).toThrow()
    // ...nor carried by a run that bypassed it.
    const wounded = hurt(atCart().run, 20, 10)
    expect(() => validateRun({ ...resolveRoom(wounded, command(wounded, { action: 'bypass', heroId: 'mage' })), pendingBattleEffects: [{ ...effect, id: `${wounded.runId}/effect/${wounded.currentNodeId}`, sourceNodeId: wounded.currentNodeId! }] })).toThrow()
  })

  it('refuses a ride whose boon was removed, and a boon that outlives the battle it was owed to', () => {
    const done = owing()
    const lost = structuredClone(done)
    delete lost.pendingBattleEffects
    expect(() => validateRun(lost)).toThrow()
    // A spent boon restored into a run that already fought the next battle is a second use.
    const start = atCart()
    const entered = toNextBattle(start, room => ride(room, 'warrior'))
    const fought = won(entered)
    expect(() => validateRun({ ...fought, pendingBattleEffects: entered.pendingBattleEffects })).toThrow()
    expect(() => validateRun(fought)).not.toThrow()
  })

  it('a run that rode the cart and then lost no longer owes anything', () => {
    const run = toNextBattle(atCart(), room => ride(room, 'mage'))
    const battle = restoreDungeonBattle(run, economy)
    battle.heroes.warrior.health = 0
    battle.result = 'defeat'
    const lost = resolveDungeonBattle(run, battle)
    expect(() => validateRun(lost)).not.toThrow()
    expect(() => validateRun({ ...lost, pendingBattleEffects: run.pendingBattleEffects })).toThrow()
  })
})

describe('E06 compatibility with older runs and with B2 Long', () => {
  const fixtures = before as unknown as Record<'fresh' | 'dinnerRoom' | 'eliteReward', { raw: string; eventId?: string; eliteId?: string }> & { versions: Record<'long' | 'long2' | 'sector' | 'rooms' | 'gold2', string> }

  it('the fingerprints older saves were written under are exactly what they were; version 3 has its own', () => {
    expect(LONG_SECTOR_CATALOG_VERSION).toBe(fixtures.versions.long)
    expect(LONG_SECTOR_CATALOG_VERSION_2).toBe(fixtures.versions.long2)
    expect(SECTOR_CATALOG_VERSION).toBe(fixtures.versions.sector)
    expect(ROOM_RULES_VERSION).toBe(fixtures.versions.rooms)
    expect(sectorCatalogFor(sectorLongConfig.id, true, 2)).toBe(fixtures.versions.gold2)
    expect(LONG_SECTOR_CATALOG_VERSION_3).not.toBe(LONG_SECTOR_CATALOG_VERSION_2)
    expect(sectorCatalogFor(sectorLongConfig.id, false, 3)).toBe(LONG_SECTOR_CATALOG_VERSION_3)
    expect(sectorCatalogFor(sectorLongConfig.id, false, 4)).not.toBe(LONG_SECTOR_CATALOG_VERSION_3)
    // The room rules and the dinner's numbers the old saves hash were not touched by the cart.
    expect(Object.keys(roomRules)).not.toContain('cart')
    expect(dinnerRules).toEqual({ version: 'suspicious-dinner-1', heal: 6, trophyHealth: 3 })
  })

  it('loads each configuration-2 save written before E06, as a version-2 run that keeps its map and plays on', () => {
    for (const key of ['fresh', 'dinnerRoom', 'eliteReward'] as const) {
      const snapshot = decodeSnapshot(fixtures[key].raw)
      expect(snapshot.run.campaign, key).toEqual({ id: sectorLongConfig.id, version: 2 })
      expect(snapshot.run.map.configuration).toEqual(sectorLongConfigV2)
      expect(snapshot.run.map.layers.flat().some(isCart), key).toBe(false)
      expect(snapshot.run.pendingBattleEffects).toBeUndefined()
      const again = JSON.parse(encodeSnapshot(snapshot.run, economy, snapshot.revision + 1))
      expect(again.payload.catalogVersion, key).toBe(JSON.parse(fixtures[key].raw).payload.catalogVersion)
      expect(decodeSnapshot(JSON.stringify(again)).run).toEqual(snapshot.run)
    }
    expect(dungeonRunPhase(decodeSnapshot(fixtures.dinnerRoom.raw).run)).toBe('room')
    // The unfinished dinner still resolves, and the old run walks to the end of the sector.
    let run = decodeSnapshot(fixtures.dinnerRoom.raw).run
    run = resolveRoom(run, { roomId: run.room!.id, action: 'leave' })
    for (let guard = 0; guard < 30 && run.status === 'active'; guard += 1) run = reload(perform(run, availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!))
    expect(run.status).toBe('sector-complete')
    expect(run.map.layers.flat().some(isCart)).toBe(false)
  }, 30000)

  it('a map cannot carry the cart into an older version, and a version cannot be relabelled', () => {
    const v2 = decodeSnapshot(fixtures.fresh.raw).run
    const poisoned = structuredClone(v2)
    poisoned.map.configuration!.eventPool = [...poisoned.map.configuration!.eventPool, 'runaway-cart']
    expect(() => validateRun(poisoned)).toThrow()
    const relabelled = structuredClone(v2)
    relabelled.campaign = { id: sectorLongConfig.id, version: 3 }
    expect(() => validateRun(relabelled)).toThrow()
    const upgraded = structuredClone(v2)
    upgraded.map.configuration = structuredClone(sectorLongConfigV3)
    expect(() => validateRun(upgraded)).toThrow()
    const raw = JSON.parse(fixtures.fresh.raw)
    raw.payload.catalogVersion = LONG_SECTOR_CATALOG_VERSION_3
    expect(() => decodeSnapshot(JSON.stringify(raw))).toThrow()
  })

  it('a new B2 Long run is version 3 with its own fingerprint and does not read as version 2; the rules version is B2 Long\'s', () => {
    const run = createSectorRun(5, economy, deck, undefined, 'new')
    expect(run.campaign).toEqual({ id: sectorLongConfig.id, version: 3 })
    expect(run.map.configuration).toEqual(sectorLongConfigV3)
    const raw = JSON.parse(encodeSnapshot(run, economy, 1))
    expect(raw.payload.rulesVersion).toBe('honest-turn-b2-long-1')
    expect(raw.payload.catalogVersion).toBe(sectorCatalogFor(sectorLongConfig.id, true, 3))
    const forged = structuredClone(raw)
    forged.payload.catalogVersion = sectorCatalogFor(sectorLongConfig.id, true, 2)
    expect(() => decodeSnapshot(JSON.stringify(forged))).toThrow()
    expect(decodeSnapshot(JSON.stringify(raw)).run).toEqual(run)
    // Nothing of the run's economy changed: same hand, mana and armor rules as before.
    expect(economy).toMatchObject({ id: 'honest-b2-long', openingHand: 7, manaByTurn: [4] })
  })

  it('whole runs through the lab\'s policies: the cart is met and used, no run stalls, nothing is owed at the end', () => {
    const actions = new Set<string>()
    let met = 0
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const policy of ['safe', 'mixed', 'risky'] as const) {
        const log = simulateSectorRun(seed, economy, deck, 'planner-careful', policy)
        expect(log.result, `${seed}/${policy}`).not.toBe('timeout')
        for (const room of log.rooms ?? []) if (room.event === 'runaway-cart') { met += 1; actions.add(room.action); expect(['ride', 'bypass', 'leave']).toContain(room.action) }
      }
    }
    expect(met).toBeGreaterThan(10)
    expect(actions.has('ride') && actions.has('bypass')).toBe(true)
  }, 180000)
})

describe('E06 screens', () => {
  const render = (component: typeof DungeonRoom | typeof CampaignMap, props: Record<string, unknown>) => renderToString(createSSRApp(component, props))

  it('shows the story, the three choices with their costs and the heroes\' health', async () => {
    const { run } = atCart()
    const html = await render(DungeonRoom, { run: hurt(run, 20, 10) })
    for (const text of ['Вагонетка без тормозов', 'Прыгнуть в вагонетку', 'Пропустить вагонетку', 'Уйти, ничего не меняя', 'Цена: 3 HP · +2 брони', '+2 HP', 'Без изменений']) expect(html, text).toContain(text)
    expect(html).toContain('room-screen--runaway-cart')
  })

  it('explains why a choice is closed, from the same rules', async () => {
    const { run } = atCart()
    expect(await render(DungeonRoom, { run: hurt(run, 3, 2) })).toContain('Ни у одного героя нет больше 3 HP')
    expect(await render(DungeonRoom, { run: hurt(run, 25, 18) })).toContain('Здоровье у всех полное')
  })

  it('shows what a chosen rider pays and carries before it is confirmed', async () => {
    const { run } = atCart()
    const picked = selectRoom(run, run.room!.id, { action: 'ride', heroId: 'mage' })
    const html = await render(DungeonRoom, { run: picked })
    expect(html).toContain('Джайна Праудмур: 18 → 15 HP')
    expect(html).toContain('начнёт с бронёй 2')
  })

  it('the map says who carries armor into the next battle, as long as it is owed', async () => {
    const { run } = atCart()
    const done = ride(run, 'warrior')
    const html = await render(CampaignMap, { map: done.map, run: done })
    expect(html).toContain('Вариан Ринн начнёт следующий бой с бронёй 2')
    const bypassed = resolveRoom(run, command(run, { action: 'leave' }))
    expect(await render(CampaignMap, { map: bypassed.map, run: bypassed })).not.toContain('начнёт следующий бой')
  })

  it('the map does not name the event before the party enters it', async () => {
    const run = createSectorRun(cartSeed, economy, deck, undefined, 'unseen')
    const html = await render(CampaignMap, { map: run.map, run })
    expect(html).not.toContain('Вагонетка')
    expect(html).not.toContain('runaway-cart')
  })
})
