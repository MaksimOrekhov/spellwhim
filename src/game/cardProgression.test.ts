import { describe, expect, it } from 'vitest'
import { availableDungeonNodes, claimDungeonArtifact, claimDungeonReward, confirmDeckOperation, createDungeonRun, dungeonArtifactOptions, dungeonNode, dungeonRewardOptions, enterDungeonNode, enumerateDungeonPaths, offerDeckOperation, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from './campaign'
import type { DungeonRunState } from './campaign'
import { createBattle, endTurn, playCard, resolveCardPlay, startCardPlay } from './battle'
import { resolveCardDefinition } from './cardProgression'
import { cardDefinition, encounters, startingDeck } from './types'
import { decodeSnapshot, encodeSnapshot } from './runSave'
import { gameEconomy } from './economy'
import { useBattle } from '../composables/useBattle'

export function roundTrip(run: DungeonRunState) { return decodeSnapshot(encodeSnapshot(run, gameEconomy, 1)).run }
export function win(run: DungeonRunState): DungeonRunState {
  const battle = restoreDungeonBattle(run)
  battle.result = 'victory'
  battle.enemy.health = 0
  battle.heroes.warrior.health = Math.max(1, battle.heroes.warrior.health - 1)
  return resolveDungeonBattle(run, battle)
}
export function rewardRun(seed = 42): DungeonRunState {
  const run = createDungeonRun(seed)
  return win(enterDungeonNode(run, availableDungeonNodes(run)[0]!.id))
}
const zones = (battle: ReturnType<typeof createBattle>) => [...battle.hand, ...battle.drawPile, ...battle.discardPile, ...battle.exhausted, ...(battle.pending ? [battle.pending.card] : [])]

describe('persistent copies and the combat boundary', () => {
  it('gives duplicate definitions independent IDs and each new run its own namespace even with the same seed', () => {
    const a = createDungeonRun(42)
    const b = createDungeonRun(42)
    expect(a.deck.map(card => card.definitionId)).toEqual(startingDeck)
    expect(new Set(a.deck.map(card => card.instanceId)).size).toBe(18)
    expect(a.deck.every(card => !b.deck.some(other => other.instanceId === card.instanceId))).toBe(true)
    expect(a.map).toEqual(b.map)
  })

  it('preserves every copy in exactly one zone through payment, draw, discard, exhaust and subsequent battles', () => {
    const run = createDungeonRun(3, undefined, ['quick-cut', 'arcane-insight', 'sword-strike', 'sword-strike'])
    const before = structuredClone(run)
    const battle = createBattle(encounters[1], run.heroes, { deck: run.deck, openingHandSize: 4, battleId: 'first' })
    const quick = battle.hand.find(card => card.definitionId === 'quick-cut')!
    const play = startCardPlay(battle, quick.instanceId)
    expect(play.ok).toBe(true)
    expect(zones(battle).map(card => card.instanceId).sort()).toEqual(run.deck.map(card => card.instanceId).sort())
    if (!play.ok) throw new Error('play')
    resolveCardPlay(battle, play.play.actionId)
    expect(resolveCardPlay(battle, play.play.actionId).ok).toBe(false)
    expect(battle.exhausted[0]!.instanceId).toBe(quick.instanceId)
    playCard(battle, battle.hand.find(card => card.definitionId === 'arcane-insight')!.instanceId)
    endTurn(battle)
    expect(new Set(zones(battle).map(card => card.instanceId)).size).toBe(run.deck.length)
    expect(zones(battle)).toHaveLength(run.deck.length)
    expect(run).toEqual(before)
    const second = createBattle(encounters[1], run.heroes, { deck: roundTrip(run).deck, battleId: 'second' })
    expect(zones(second).map(card => card.instanceId).sort()).toEqual(run.deck.map(card => card.instanceId).sort())
    expect(second.exhausted).toEqual([])
  })

  it('keeps legacy draws/RNG identical and makes the reactive adapter read only the current run deck', () => {
    let run = createDungeonRun(5)
    const legacy = createBattle(encounters[0], undefined, { seed: 5, deck: startingDeck })
    const persistent = createBattle(encounters[0], run.heroes, { seed: 5, deck: run.deck })
    expect(persistent.hand.map(card => card.definitionId)).toEqual(legacy.hand.map(card => card.definitionId))
    expect(persistent.rngState).toBe(legacy.rngState)
    const adapter = useBattle({ seed: 5, runDeck: () => run.deck })
    expect(() => adapter.addCard(cardDefinition('fireball'))).toThrow()
    run = confirmDeckOperation(offerDeckOperation(run, 'one-removal', 'remove'), 'one-removal', run.deck[0]!.instanceId)
    adapter.startBattle(encounters[0]!, run.heroes)
    expect(zones(adapter.state.value)).toHaveLength(17)
    const stale = adapter.beginPlay(adapter.cards.value.find(card => card.playable)!.instanceId)!
    adapter.startBattle(encounters[0]!, run.heroes)
    const current = adapter.beginPlay(adapter.cards.value.find(card => card.playable)!.instanceId)!
    adapter.resolvePlay(stale.actionId)
    expect(adapter.state.value.pending!.actionId).toBe(current.actionId)
  })
})

describe('reward decisions', () => {
  it('accepts exactly one new copy; repeated and stale offer commands cannot claim later rewards', () => {
    const run = rewardRun()
    const id = run.pendingReward!.id
    const card = dungeonRewardOptions(run)[0]!
    const claimed = roundTrip(claimDungeonReward(run, card, id))
    expect(claimed.deck.slice(0, -1)).toEqual(run.deck)
    expect(claimed.deck[18]).toMatchObject({ definitionId: card.id, upgrade: 0 })
    expect(claimed.nextCardId).toBe(20)
    expect(() => claimDungeonReward(claimed, card, id)).toThrow()
    const next = availableDungeonNodes(claimed).find(node => node.type === 'battle')!
    const later = win(enterDungeonNode(claimed, next.id))
    const before = structuredClone(later)
    expect(() => claimDungeonReward(later, dungeonRewardOptions(later)[0]!, id)).toThrow()
    expect(() => skipDungeonReward(later, id)).toThrow()
    expect(later).toEqual(before)
  })

  it('skips without changing health, deck, counters, seeds, map or artifacts and does not resurrect on reload', () => {
    const run = rewardRun()
    const offer = structuredClone(run.pendingReward!)
    expect(roundTrip(run).pendingReward).toEqual(offer)
    expect(dungeonRewardOptions(run)).toEqual(dungeonRewardOptions(roundTrip(run)))
    const skipped = roundTrip(skipDungeonReward(run, offer.id))
    for (const key of ['deck', 'heroes', 'artifacts', 'nextCardId', 'seed', 'map'] as const) expect(skipped[key]).toEqual(run[key])
    expect(skipped.pendingReward).toBeNull()
    expect(availableDungeonNodes(skipped).length).toBeGreaterThan(0)
    expect(() => skipDungeonReward(skipped, offer.id)).toThrow()
    expect(() => claimDungeonReward(skipped, dungeonRewardOptions(run)[0]!, offer.id)).toThrow()
  })

  it('keeps elite card-or-artifact rewards, owners and explicit slot replacement across reload', () => {
    let run = createDungeonRun(44)
    const path = enumerateDungeonPaths(run.map).find(nodes => nodes.filter(node => node.type === 'elite').length === 2)!
    let firstArtifact = ''
    for (const node of path) {
      run = enterDungeonNode(run, node.id)
      if (node.type === 'rest') { run = resolveDungeonRest(run, null); continue }
      run = win(run)
      if (!run.pendingReward) break
      if (!run.pendingReward.elite) { run = skipDungeonReward(run, run.pendingReward.id); continue }
      expect(() => skipDungeonReward(run, run.pendingReward!.id)).toThrow()
      const offer = roundTrip(run).pendingReward!
      expect(offer.cards).toHaveLength(5)
      const artifact = dungeonArtifactOptions(run)[0]!
      const owner = run.heroes.warrior.instanceId
      if (firstArtifact) expect(() => claimDungeonArtifact(run, artifact.id, owner)).toThrow()
      run = roundTrip(claimDungeonArtifact(run, artifact.id, owner, firstArtifact || undefined, offer.id))
      firstArtifact = run.artifacts[0]!.instanceId
      expect(run.artifacts).toHaveLength(1)
      expect(run.artifacts[0]!.ownerInstanceId).toBe(owner)
      expect(run.pendingReward).toBeNull()
      expect(run.deck).toHaveLength(18)
    }
    expect(run.status).toBe('victory')
  })
})

describe('future acquisitions', () => {
  it('preserves and resolves an upgraded reward through the canonical catalogue', () => {
    const run = rewardRun(700)
    run.pendingReward!.cards[0]!.upgrade = 1 // Isolated future-catalogue fixture; live offers always have level 0.
    const restored = roundTrip(run)
    const choice = restored.pendingReward!.cards[0]!
    expect(dungeonRewardOptions(restored)[0]).toEqual(resolveCardDefinition(choice))
    const next = roundTrip(claimDungeonReward(restored, cardDefinition(choice.definitionId), restored.pendingReward!.id))
    expect(next.deck[next.deck.length - 1]!.upgrade).toBe(1)
  })
})

describe('atomic progression services', () => {
  it('addresses only one identical copy; invalid/repeated removal is a no-op', () => {
    const run = offerDeckOperation(createDungeonRun(9), 'remove-a', 'remove')
    const before = structuredClone(run)
    expect(() => confirmDeckOperation(run, 'remove-a', 'missing')).toThrow()
    expect(run).toEqual(before)
    const copy = run.deck[0]!
    const next = roundTrip(confirmDeckOperation(run, 'remove-a', copy.instanceId))
    expect(next.deck).toEqual(run.deck.slice(1))
    expect(next.deck.some(card => card.definitionId === copy.definitionId)).toBe(true)
    expect(() => confirmDeckOperation(next, 'remove-a', next.deck[0]!.instanceId)).toThrow()
    expect(() => offerDeckOperation(next, 'remove-a', 'remove')).toThrow()
  })

  it('persists a fixed replacement offer; cancellation/invalid confirmation spend nothing; replacement is atomic', () => {
    const options = [{ definitionId: 'fireball' as const, upgrade: 0 as const }]
    const run = roundTrip(offerDeckOperation(createDungeonRun(10), 'replace-a', 'replace', options))
    const snapshot = structuredClone(run)
    // Selection and cancellation do not issue a command. The same saved offer remains available.
    expect(roundTrip(run)).toEqual(snapshot)
    expect(() => confirmDeckOperation(run, 'replace-a', run.deck[0]!.instanceId, { definitionId: 'guard', upgrade: 0 })).toThrow()
    expect(run).toEqual(snapshot)
    const upgradedFixture = structuredClone(run)
    upgradedFixture.deck[0]!.upgrade = 1
    const next = confirmDeckOperation(upgradedFixture, 'replace-a', run.deck[0]!.instanceId, options[0])
    expect(next.deck).toHaveLength(run.deck.length)
    expect(next.deck[0]).toEqual({ ...options[0], instanceId: `${run.runId}/card/19` })
    expect(next.deck.slice(1)).toEqual(run.deck.slice(1))
    expect(() => confirmDeckOperation(roundTrip(next), 'replace-a', next.deck[1]!.instanceId, options[0])).toThrow()
  })

  it('upgrades one copy without changing a shared definition, rejects repeats and resolves combat variants', () => {
    let run = offerDeckOperation(createDungeonRun(11), 'upgrade-a', 'upgrade')
    const definition = structuredClone(cardDefinition(run.deck[0]!.definitionId))
    run = roundTrip(confirmDeckOperation(run, 'upgrade-a', run.deck[0]!.instanceId))
    expect(run.deck[0]!.upgrade).toBe(1)
    expect(run.deck.slice(1).every(card => card.upgrade === 0)).toBe(true)
    expect(run.deck).toHaveLength(18)
    expect(cardDefinition(run.deck[0]!.definitionId)).toEqual(definition)
    run = offerDeckOperation(run, 'upgrade-b', 'upgrade')
    expect(() => confirmDeckOperation(run, 'upgrade-b', run.deck[0]!.instanceId)).toThrow()
    expect(resolveCardDefinition(run.deck[0]!).effects[0]).toMatchObject({ amount: 8 })
    expect(zones(createBattle(encounters[0], run.heroes, { deck: run.deck })).find(card => card.instanceId === run.deck[0]!.instanceId)?.upgrade).toBe(1)
    const upgradedReward = { definitionId: 'frostbolt' as const, upgrade: 1 as const }
    run = offerDeckOperation(run, 'future-acquisition', 'replace', [upgradedReward])
    expect(roundTrip(confirmDeckOperation(run, 'future-acquisition', run.deck[1]!.instanceId, upgradedReward)).deck[1]!.upgrade).toBe(1)
  })

  it('rejects services in active battles, unresolved rewards/rests and finished campaigns', () => {
    let run = createDungeonRun(12)
    run = offerDeckOperation(run, 'old-service', 'remove')
    run = enterDungeonNode(run, availableDungeonNodes(run)[0]!.id)
    expect(() => confirmDeckOperation(run, 'old-service', run.deck[0]!.instanceId)).toThrow()
    expect(() => offerDeckOperation(run, 'during-battle', 'remove')).toThrow()
    const reward = win(run)
    expect(() => offerDeckOperation(reward, 'during-reward', 'remove')).toThrow()
    const battle = restoreDungeonBattle(run)
    battle.heroes.mage.health = 0
    battle.result = 'defeat'
    expect(() => offerDeckOperation(resolveDungeonBattle(run, battle), 'after-defeat', 'remove')).toThrow()
  })

  it('holds invariants through 1,000 fixed-seed sequences of decisions, save/load, duplicates and services', () => {
    for (let seed = 0; seed < 1000; seed++) {
      let run = rewardRun(seed)
      const initialIds = run.deck.map(card => card.instanceId)
      run = roundTrip(seed % 2 ? claimDungeonReward(run, dungeonRewardOptions(run)[0]!, run.pendingReward!.id) : skipDungeonReward(run, run.pendingReward!.id))
      const option = { definitionId: 'fireball' as const, upgrade: 0 as const }
      run = roundTrip(offerDeckOperation(run, 'service', seed % 3 ? 'replace' : 'remove', seed % 3 ? [option] : []))
      const target = run.deck[seed % 18]!.instanceId
      const before = structuredClone(run)
      expect(() => confirmDeckOperation(run, 'service', 'bad-id', option)).toThrow()
      expect(run).toEqual(before)
      run = roundTrip(confirmDeckOperation(run, 'service', target, seed % 3 ? option : undefined))
      expect(run.deck.some(card => card.instanceId === target)).toBe(false)
      expect(new Set(run.deck.map(card => card.instanceId)).size).toBe(run.deck.length)
      expect(initialIds.filter(id => id !== target).every(id => run.deck.some(card => card.instanceId === id))).toBe(true)
      expect(() => confirmDeckOperation(run, 'service', run.deck[0]!.instanceId, option)).toThrow()
      const next = availableDungeonNodes(run).find(node => node.type === 'battle')!
      run = roundTrip(enterDungeonNode(run, next.id))
      expect(zones(restoreDungeonBattle(run)).map(card => card.instanceId).sort()).toEqual(run.deck.map(card => card.instanceId).sort())
      expect(dungeonNode(run.map, next.id)).toEqual(next)
    }
  }, 30000)
})
