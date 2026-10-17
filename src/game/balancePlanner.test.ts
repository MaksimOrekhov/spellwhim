import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, playCard } from './battle'
import { allStrategies, classicStrategies, simulateBalance, simulateRun, summarizeBalance } from './balance'
import { cloneBattleState, createTurnPlanner, determinize, planTurn } from './balancePlanner'
import { createCampaignBattle } from './campaign'
import { cardDefinition, encounters, startingDeck } from './types'
import type { BattleState, CardId } from './types'

/** Damage-only profile: with a passive enemy the planner should simply maximise health damage this turn. */
const damageOnly = { health: 0, keep: 0, armorKeep: 0, lowHealth: 0 }
const exhaustive = { beamWidth: 100_000, maxNodes: 1_000_000, maxDepth: 20 }

function fixture(deck: readonly CardId[], seed = 17): BattleState {
  return createBattle({ ...encounters[2]!, maxHealth: 500 }, undefined, { deck, seed, openingHandSize: deck.length })
}
function play(state: BattleState, sequence: readonly CardId[]) {
  const used = new Set<string>()
  const results = sequence.map(definitionId => {
    const instance = state.hand.find(card => card.definitionId === definitionId && !used.has(card.instanceId))
    if (!instance) throw new Error('Plan wants a card that is not in hand: ' + definitionId)
    used.add(instance.instanceId)
    return playCard(state, instance.instanceId)
  })
  return results
}
function damageOf(state: BattleState, sequence: readonly CardId[]): number {
  return play(state, sequence).reduce((sum, result) => sum + (result.ok ? result.damageDealt : 0), 0)
}
/** Reference oracle: every legal order of every subset of the hand, played through the real engine. */
function bruteForceBestDamage(state: BattleState): number {
  let best = 0
  const walk = (current: BattleState, total: number) => {
    best = Math.max(best, total)
    const tried = new Set<CardId>()
    for (const card of current.hand) {
      if (tried.has(card.definitionId) || cardDefinition(card.definitionId).cost > current.mana) continue
      tried.add(card.definitionId)
      const next = structuredClone(current)
      const result = playCard(next, card.instanceId)
      if (result.ok) walk(next, total + result.damageDealt)
    }
  }
  walk(structuredClone(state), 0)
  return best
}
function identities(state: BattleState): string[] {
  return [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhausted].map(card => card.instanceId).sort()
}

describe('planner state copies', () => {
  it('matches structuredClone, shares no mutable zone, and refuses a play in progress', () => {
    const state = createBattle(encounters[2], undefined, { seed: 5 })
    endTurn(state)
    state.statuses.mark = { expiresOnTurn: 3 }
    const mageHealth = state.heroes.mage.health
    const copy = cloneBattleState(state)
    expect(copy).toEqual(structuredClone(state))
    // A field added to BattleState later that this copy forgets would be shared by reference and fail here.
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'object' && value !== null) expect(copy[key as keyof BattleState], key).not.toBe(value)
    }
    expect(copy.heroes.warrior).not.toBe(state.heroes.warrior)
    expect(copy.enemy).not.toBe(state.enemy)
    expect(copy.statuses.mark).not.toBe(state.statuses.mark)
    copy.hand.pop()
    copy.heroes.mage.health = 1
    expect(state.hand.length).toBe(copy.hand.length + 1)
    expect(state.heroes.mage.health).toBe(mageHealth)

    const pending = createBattle(encounters[2], undefined, { seed: 5 })
    pending.pending = { actionId: 'x', card: pending.hand[0]!, handIndex: 0, effects: [], consume: [], preview: { damage: 0, armorDamage: 0, healthDamage: 0, bonusDamage: 0, armor: { warrior: 0, mage: 0 }, draw: 0, links: [], appliedStatuses: [] } }
    expect(() => cloneBattleState(pending)).toThrow()
  })
})

describe('planner honesty about hidden information', () => {
  it('never mutates the live battle', () => {
    const state = createBattle(encounters[2], undefined, { seed: 8 })
    const before = structuredClone(state)
    planTurn(state)
    expect(state).toEqual(before)
  })

  it('gives the same plan whatever the hidden draw order, reshuffle order, seed or RNG state', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = createBattle(encounters[2], undefined, { seed })
      for (let turn = 0; turn < 2; turn += 1) {
        for (const card of [...state.hand]) if (cardDefinition(card.definitionId).cost <= state.mana) playCard(state, card.instanceId)
        endTurn(state)
      }
      expect(state.discardPile.length).toBeGreaterThan(0)
      expect(state.drawPile.length).toBeGreaterThan(1)
      const other = structuredClone(state)
      other.drawPile.reverse()
      other.discardPile.reverse()
      other.seed = 999_999
      other.rngState = 123_456_789
      other.battleId = 'completely/different'
      expect(other.drawPile.map(card => card.instanceId)).not.toEqual(state.drawPile.map(card => card.instanceId))
      expect(planTurn(other, { entropy: 7 })).toEqual(planTurn(state, { entropy: 7 }))
      // The planner's private copy is built from the visible zones only (labels such as seed/battleId are just copied).
      const mine = determinize(state, 7)
      const theirs = determinize(other, 7)
      expect(theirs.drawPile).toEqual(mine.drawPile)
      expect(theirs.discardPile).toEqual(mine.discardPile)
      expect(theirs.rngState).toBe(mine.rngState)
    }
  })

  it('ignores the enemy script beyond the action it has announced', () => {
    const state = createBattle(encounters[2], undefined, { seed: 3 })
    const other = structuredClone(state)
    const decoy = { kind: 'attack' as const, name: 'Скрытый удар', damage: 99, target: 'warrior' as const }
    other.enemy.behavior = { phase1: other.enemy.behavior.phase1.map((action, index) => (index === 0 ? action : decoy)), phase2: [decoy] }
    expect(planTurn(other, { entropy: 1 })).toEqual(planTurn(state, { entropy: 1 }))
  })

  it('changes with entropy only through the shuffle of unknown cards, and stays reproducible', () => {
    const state = createBattle(encounters[2], undefined, { seed: 4 })
    expect(planTurn(state, { entropy: 2 })).toEqual(planTurn(state, { entropy: 2 }))
    expect(determinize(state, 2).drawPile.map(card => card.instanceId)).not.toEqual(determinize(state, 3).drawPile.map(card => card.instanceId))
    expect(new Set(determinize(state, 2).drawPile.map(card => card.instanceId))).toEqual(new Set(state.drawPile.map(card => card.instanceId)))
  })
})

describe('planner choices', () => {
  it('chains guard, frostbolt and sword strike so that both team links fire', () => {
    const state = fixture(['sword-strike', 'frostbolt', 'guard'])
    const plan = planTurn(state)
    expect(plan.sequence).toEqual(['guard', 'frostbolt', 'sword-strike'])
    const results = play(state, plan.sequence)
    expect(results.every(result => result.ok)).toBe(true)
    expect(results.flatMap(result => (result.ok ? result.outcome.links : []))).toEqual(['Защитный резонанс', 'Магическая метка'])
  })

  it('sets the mark before the strike that spends it, not after', () => {
    const state = fixture(['sword-strike', 'fireball'])
    const plan = planTurn(state)
    expect(plan.sequence).toEqual(['fireball', 'sword-strike'])
    expect(damageOf(state, plan.sequence)).toBe(8 + 9)
  })

  it('finds the best damage that an exhaustive search of the real engine finds (profile: damage only)', () => {
    // The oracle searches the planner's own determinised world, so draw effects see the same cards on both sides.
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createBattle({ ...encounters[2]!, maxHealth: 500 }, undefined, { deck: startingDeck, seed })
      const world = determinize(state, seed)
      const plan = planTurn(state, { profile: damageOnly, limits: exhaustive, entropy: seed })
      expect(damageOf(structuredClone(world), plan.sequence), 'seed ' + seed).toBe(bruteForceBestDamage(world))
    }
  })

  it('stays optimal on these hands with the default search limits too', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createBattle({ ...encounters[2]!, maxHealth: 500 }, undefined, { deck: startingDeck, seed })
      const world = determinize(state, seed)
      const plan = planTurn(state, { profile: damageOnly, entropy: seed })
      expect(damageOf(structuredClone(world), plan.sequence), 'seed ' + seed).toBe(bruteForceBestDamage(world))
    }
  })

  it('can decide to play nothing when waiting is better', () => {
    const state = fixture(['sword-strike'])
    state.mana = 0
    expect(planTurn(state).sequence).toEqual([])
    expect(createTurnPlanner().next(state)).toBeUndefined()
  })
})

describe('planner legality and search limits', () => {
  it('only proposes plays the real engine accepts, across whole battles, and keeps every card accounted for', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const state = createCampaignBattle({ encounter: encounters[seed % encounters.length], seed, deck: [...startingDeck, 'quick-cut', 'thunderbolt', 'bastion'] })
      const planner = createTurnPlanner({ entropy: seed })
      const total = identities(state).length
      for (let turn = 0; turn < 40 && !state.result; turn += 1) {
        for (let guard = 0; guard < 20; guard += 1) {
          const id = planner.next(state)
          if (id === undefined) break
          const card = state.hand.find(instance => instance.instanceId === id)
          expect(card, 'planned card is in hand').toBeDefined()
          expect(cardDefinition(card!.definitionId).cost).toBeLessThanOrEqual(state.mana)
          expect(state.pending).toBeNull()
          expect(playCard(state, id).ok).toBe(true)
          expect(state.mana).toBeGreaterThanOrEqual(0)
          expect(state.hand.length).toBeLessThanOrEqual(10)
          expect(identities(state)).toHaveLength(total)
          if (state.result) break
        }
        if (!state.result) endTurn(state)
      }
      expect(state.result, 'seed ' + seed).not.toBeNull()
      expect(new Set(identities(state)).size).toBe(total)
    }
  })

  it('respects the node cap and the depth cap on a ten-card hand with lots of mana', () => {
    const deck: CardId[] = ['sword-strike', 'frostbolt', 'guard', 'parry', 'interpose', 'arcane-insight', 'ice-ward', 'quick-cut', 'sword-strike', 'frostbolt']
    const state = fixture(deck)
    state.maxMana = 10
    state.mana = 10
    expect(state.hand).toHaveLength(10)
    const capped = planTurn(state, { limits: { maxNodes: 120 } })
    expect(capped.nodesEvaluated).toBeLessThanOrEqual(120)
    expect(capped.truncated).toBe(true)
    const normal = planTurn(state)
    expect(normal.nodesEvaluated).toBeLessThanOrEqual(900)
    expect(normal.sequence.length).toBeGreaterThan(0)
    expect(planTurn(state, { limits: { maxDepth: 2 } }).sequence.length).toBeLessThanOrEqual(2)
    expect(planTurn(state, { limits: { maxDepth: 0 } }).sequence).toEqual([])
  })

  it('replans after a draw reveals new cards instead of following a stale plan', () => {
    const state = fixture(['thunderbolt', 'sword-strike', 'sword-strike', 'guard', 'frostbolt'])
    state.hand = state.hand.filter(card => card.definitionId === 'thunderbolt')
    state.drawPile = fixture(['sword-strike', 'sword-strike', 'guard', 'frostbolt']).hand
    const planner = createTurnPlanner()
    const first = planner.next(state)
    expect(first).toBeDefined()
    expect(playCard(state, first!).ok).toBe(true)
    expect(state.hand.length).toBeGreaterThan(0)
    const second = planner.next(state)
    if (second !== undefined) expect(state.hand.map(card => card.instanceId)).toContain(second)
    expect(planner.stats.plans).toBeGreaterThanOrEqual(2)
  })
})

describe('planner as a Balance Lab strategy', () => {
  it('keeps the three classic strategies exactly as in the v0.6 report', () => {
    const rows = summarizeBalance(simulateBalance({ runs: 200, seed: 42 }))
    expect(rows.map(row => row.strategy)).toEqual([...classicStrategies])
    expect(rows.map(row => row.victories)).toEqual([195, 200, 200])
    expect(rows.map(row => Number(row.averageTurns.toFixed(2)))).toEqual([10.39, 13.63, 11.86])
    expect(rows.every(row => row.planningNodesPerTurn === 0)).toBe(true)
  })

  it('is deterministic, completes the campaign, and leaves the classic runs unaffected', () => {
    const first = simulateRun(42, 'planner')
    expect(simulateRun(42, 'planner')).toEqual(first)
    expect(first).toMatchObject({ strategy: 'planner', status: 'victory', battlesCompleted: 3 })
    expect(first.planning.plans).toBeGreaterThan(0)
    expect(first.planning.nodes).toBeGreaterThan(first.planning.plans)
    expect(simulateRun(42, 'balanced').planning).toEqual({ plans: 0, nodes: 0, truncated: 0, maxNodes: 0 })
    expect(allStrategies).toEqual(['aggressive', 'defensive', 'balanced', 'planner'])
  })

  it('plays far more team links per turn than the greedy strategies on the same seeds', () => {
    const rows = summarizeBalance(simulateBalance({ runs: 40, seed: 42, strategies: [...allStrategies] }))
    const byName = Object.fromEntries(rows.map(row => [row.strategy, row]))
    expect(byName.planner!.linkTriggersPerTurn).toBeGreaterThan(2.5 * byName.balanced!.linkTriggersPerTurn)
    expect(byName.planner!.linkTriggersPerTurn).toBeGreaterThan(byName.defensive!.linkTriggersPerTurn)
    expect(byName.planner!.timeouts).toBe(0)
    expect(byName.planner!.manaUtilization).toBeGreaterThan(0.9)
    expect(byName.planner!.planningTruncatedPlans).toBe(0)
  })
})
