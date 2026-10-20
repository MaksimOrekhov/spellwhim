import { describe, expect, it } from 'vitest'
import { availableDungeonNodes, claimDungeonReward, confirmDeckOperation, createDungeonRun, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, enumerateDungeonPaths, offerDeckOperation, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward, upgradeDungeonRest } from './campaign'
import type { DungeonRunState } from './campaign'
import { resolveCardDefinition } from './cardProgression'
import { endTurn, startCardPlay } from './battle'
import { CATALOG_VERSION, createRunSaveStore, decodeSnapshot, encodeSnapshot, RULES_VERSION, RUN_SAVE_KEY } from './runSave'
import { gameEconomy } from './economy'

const roundTrip = (run: DungeonRunState) => decodeSnapshot(encodeSnapshot(run, gameEconomy, 7)).run
function restRun(): DungeonRunState {
  let run = createDungeonRun(81)
  const path = enumerateDungeonPaths(run.map).find(nodes => nodes.some(node => node.type === 'rest'))!
  for (const node of path) {
    run = enterDungeonNode(run, node.id)
    if (node.type === 'rest') return run
    const battle = restoreDungeonBattle(run)
    battle.result = 'victory'; battle.enemy.health = 0
    battle.heroes.warrior.health -= 3
    run = resolveDungeonBattle(run, battle)
    run = skipDungeonReward(run, run.pendingReward!.id)
  }
  throw new Error('No rest')
}
const source = (run: DungeonRunState) => `${run.runId}/${run.currentNodeId}`

describe('rest upgrade transactions and reload', () => {
  it('selection/cancellation and reload before confirmation spend nothing; confirmation spends the rest once', () => {
    const before = restRun()
    const selected = before.deck[0]!
    expect(roundTrip(before)).toEqual(before)
    expect(dungeonRunPhase(roundTrip(before))).toBe('rest')
    const next = roundTrip(upgradeDungeonRest(before, selected.instanceId, source(before)))
    expect(next.deck[0]).toEqual({ ...selected, upgrade: 1 })
    expect(next.deck.slice(1)).toEqual(before.deck.slice(1))
    expect(next.heroes).toEqual(before.heroes)
    expect(next.nextCardId).toBe(before.nextCardId)
    expect(dungeonRunPhase(next)).toBe('map')
    expect(() => upgradeDungeonRest(next, selected.instanceId, source(before))).toThrow()
    expect(() => upgradeDungeonRest(next, next.deck[1]!.instanceId, source(before))).toThrow()
    expect(() => resolveDungeonRest(next, 'warrior')).toThrow()
    expect(next.decisions.filter(id => id === `rest:${before.currentNodeId}`)).toHaveLength(1)
  })
  it('healing keeps its existing +6 rule and precludes upgrading', () => {
    const before = restRun()
    const next = roundTrip(resolveDungeonRest(before, 'warrior'))
    expect(next.heroes.warrior.health).toBe(Math.min(25, before.heroes.warrior.health + 6))
    expect(next.deck).toEqual(before.deck)
    expect(() => upgradeDungeonRest(next, next.deck[0]!.instanceId, source(before))).toThrow()
  })
  it('rejects stale sources, unknown copies, repeated upgrades and fully upgraded decks atomically', () => {
    const before = restRun()
    const snapshot = structuredClone(before)
    expect(() => upgradeDungeonRest(before, before.deck[0]!.instanceId, 'stale')).toThrow()
    expect(() => upgradeDungeonRest(before, 'missing', source(before))).toThrow()
    expect(before).toEqual(snapshot)
    const all = { ...before, deck: before.deck.map(card => ({ ...card, upgrade: 1 as const })) }
    expect(() => upgradeDungeonRest(all, all.deck[0]!.instanceId, source(all))).toThrow()
    expect(dungeonRunPhase(roundTrip(all))).toBe('rest')
    expect(() => resolveDungeonRest(all, 'warrior')).not.toThrow()
  })
  it('uses the upgraded copy in the next battle and replays its interrupted entry with identical zones', () => {
    const before = restRun()
    let run = upgradeDungeonRest(before, before.deck[0]!.instanceId, source(before))
    run = enterDungeonNode(run, availableDungeonNodes(run).find(node => node.type !== 'rest')!.id)
    const state = restoreDungeonBattle(run)
    const initial = structuredClone(state)
    endTurn(state)
    startCardPlay(state, state.hand[0]!.instanceId)
    const restored = restoreDungeonBattle(roundTrip(run))
    expect(restored.hand).toEqual(initial.hand)
    expect(restored.drawPile).toEqual(initial.drawPile)
    const card = [...restored.hand, ...restored.drawPile].find(card => card.instanceId === run.deck[0]!.instanceId)!
    expect(resolveCardDefinition(card).effects[0]).toMatchObject({ amount: 8 })
    expect(restored.pending).toBeNull()
    expect(restored.turn).toBe(1)
  })
  it('removal of an upgraded copy leaves its duplicate intact; replacement starts at its offered level', () => {
    const rest = restRun()
    let run = upgradeDungeonRest(rest, rest.deck[0]!.instanceId, source(rest))
    run = confirmDeckOperation(offerDeckOperation(run, 'remove', 'remove'), 'remove', run.deck[0]!.instanceId)
    expect(run.deck[0]).toEqual(rest.deck[1])
    const option = { definitionId: 'sword-strike' as const, upgrade: 0 as const }
    run = confirmDeckOperation(offerDeckOperation(run, 'replace', 'replace', [option]), 'replace', run.deck[0]!.instanceId, option)
    expect(run.deck[0]?.upgrade).toBe(0)
    expect(roundTrip(run)).toEqual(run)
  })
  it('retains an upgraded future reward and consumes the reward once on reload', () => {
    let run = createDungeonRun(5)
    run = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
    const battle = restoreDungeonBattle(run); battle.result = 'victory'
    run = resolveDungeonBattle(run, battle)
    run.pendingReward!.cards[0]!.upgrade = 1
    const card = dungeonRewardOptions(roundTrip(run))[0]!
    expect(card.upgrade).toBe(1)
    const next = roundTrip(claimDungeonReward(run, card))
    expect(next.deck[next.deck.length - 1]?.upgrade).toBe(1)
    expect(() => claimDungeonReward(next, card)).toThrow()
  })
})

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}'
  return JSON.stringify(value)
}
function legacySave(run: DungeonRunState, catalogVersion = 'edd7267b') {
  const envelope = JSON.parse(encodeSnapshot(run, gameEconomy, 8))
  envelope.payload.rulesVersion = 'combat-progression-1'
  envelope.payload.catalogVersion = catalogVersion
  let hash = 0x811c9dc5
  for (const char of canonical(envelope.payload)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  envelope.checksum = (hash >>> 0).toString(16)
  return JSON.stringify(envelope)
}
describe('save catalogue contract and conservative v1 migration', () => {
  it('migrates known foundation saves with all levels zero without touching original records or identities', () => {
    for (const run of [createDungeonRun(99), enterDungeonNode(createDungeonRun(99), availableDungeonNodes(createDungeonRun(99))[0]!.id), restRun()]) {
      const raw = legacySave(run)
      const migrated = decodeSnapshot(raw)
      expect(migrated.run).toEqual(run)
      expect(migrated.rulesVersion).toBe(RULES_VERSION)
      expect(migrated.catalogVersion).toBe(CATALOG_VERSION)
      expect(migrated.revision).toBe(8)
      const storage = new Map([[RUN_SAVE_KEY, raw]])
      const store = createRunSaveStore(() => ({ getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) } }))
      expect(store.load().blocked).toBe(false)
      expect(storage.get(RUN_SAVE_KEY)).toBe(raw)
      expect(store.exportSnapshot()).toBe(raw)
    }
  })
  it('refuses unknown catalogues or legacy level 1; exports exact originals including an incompatible mirror', () => {
    const run = restRun()
    run.deck[0]!.upgrade = 1
    for (const raw of [legacySave(run), legacySave(createDungeonRun(3), 'unknown')]) {
      expect(() => decodeSnapshot(raw)).toThrow()
      const records = new Map([[RUN_SAVE_KEY, raw], [RUN_SAVE_KEY + '.backup', encodeSnapshot(createDungeonRun(1), gameEconomy, 1)]])
      const store = createRunSaveStore(() => ({ getItem: key => records.get(key) ?? null, setItem: () => { throw Error('no writes') } }))
      expect(store.load()).toMatchObject({ blocked: true, snapshot: null })
      expect(JSON.parse(store.exportSnapshot()).records[0].raw).toBe(raw)
      expect(records.get(RUN_SAVE_KEY)).toBe(raw)
    }
  })
  it('reports a failed upgrade save, retains export, retries the same transaction without granting another upgrade', () => {
    const records = new Map<string, string>()
    let fail = false
    const storage = { getItem: (key: string) => records.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw Error('quota'); records.set(key, value) } }
    const store = createRunSaveStore(() => storage)
    const before = restRun()
    expect(store.save(before, gameEconomy).ok).toBe(true)
    const next = upgradeDungeonRest(before, before.deck[0]!.instanceId, source(before))
    fail = true
    expect(store.save(next, gameEconomy).ok).toBe(false)
    expect(decodeSnapshot(store.exportSnapshot()).run).toEqual(next)
    fail = false
    expect(store.save(next, gameEconomy).ok).toBe(true)
    expect(createRunSaveStore(() => storage).load().snapshot?.run).toEqual(next)
    expect(() => upgradeDungeonRest(next, next.deck[1]!.instanceId, source(before))).toThrow()
  })
})
