import { describe, expect, it, vi } from 'vitest'
import { createBattle, endTurn, playCard } from './battle'
import { allStrategies, classicStrategies, simulateBalance, simulateRun, summarizeBalance } from './balance'
import { cloneBattleState, createTurnPlanner, determinize, observableSeed, planTurn } from './balancePlanner'
import { createCampaignBattle } from './campaign'
import { cardDefinition, encounters, startingDeck } from './types'
import type { BattleState, CardId } from './types'

interface PlannerCall { snapshot: BattleState; fresh: boolean; chosen: string | undefined; options: unknown }
/** Records every decision the Balance Lab asks its planner for, with the exact state it saw. */
const calls = vi.hoisted(() => [] as PlannerCall[])
vi.mock('./balancePlanner', async importOriginal => {
  const actual = await importOriginal<typeof import('./balancePlanner')>()
  return {
    ...actual,
    createTurnPlanner(options?: Parameters<typeof actual.createTurnPlanner>[0]) {
      const planner = actual.createTurnPlanner(options)
      return {
        stats: planner.stats,
        next(state: BattleState) {
          const plans = planner.stats.plans
          const snapshot = structuredClone(state)
          const chosen = planner.next(state)
          calls.push({ snapshot, fresh: planner.stats.plans > plans, chosen, options })
          return chosen
        },
      }
    },
  }
})

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

/**
 * The same game as seen by the player, but with every hidden or technical detail changed: reversed draw and discard
 * order, other seed / RNG state / battle id, and every card instance renamed (in a different sort order).
 */
function equivalentView(state: BattleState): BattleState {
  const view = structuredClone(state)
  view.drawPile.reverse()
  view.discardPile.reverse()
  view.seed = (state.seed ^ 0x5bd1e995) >>> 0
  view.rngState = (state.rngState + 12345) >>> 0
  view.battleId = 'completely/different'
  const zones = [view.hand, view.drawPile, view.discardPile, view.exhausted]
  const total = zones.reduce((sum, zone) => sum + zone.length, 0)
  let next = total
  for (const zone of zones) for (const card of zone) { next -= 1; card.instanceId = 'renamed/' + String(next).padStart(4, '0') }
  return view
}

describe('planner state copies', () => {
  it('matches structuredClone, shares no mutable zone, and refuses a play in progress', () => {
    const state = createBattle(encounters[2], undefined, { seed: 5 })
    endTurn(state)
    state.enemy.vulnerable = true
    const mageHealth = state.heroes.mage.health
    const copy = cloneBattleState(state)
    expect(copy).toEqual(structuredClone(state))
    // A field added to BattleState later that this copy forgets would be shared by reference and fail here.
    for (const [key, value] of Object.entries(state)) {
      if (typeof value === 'object' && value !== null) expect(copy[key as keyof BattleState], key).not.toBe(value)
    }
    expect(copy.heroes.warrior).not.toBe(state.heroes.warrior)
    expect(copy.enemy).not.toBe(state.enemy)
    expect(copy.enemy.vulnerable).toBe(true)
    copy.hand.pop()
    copy.heroes.mage.health = 1
    expect(state.hand.length).toBe(copy.hand.length + 1)
    expect(state.heroes.mage.health).toBe(mageHealth)

    const pending = createBattle(encounters[2], undefined, { seed: 5 })
    pending.pending = { actionId: 'x', card: pending.hand[0]!, handIndex: 0, effects: [], consumeVulnerability: false, artifactTriggers: [], preview: { damage: 0, armorDamage: 0, healthDamage: 0, bonusDamage: 0, vulnerabilityBonus: 0, armorBonus: 0, artifactDamage: 0, artifactArmor: { warrior: 0, mage: 0 }, artifactBonuses: [], armor: { warrior: 0, mage: 0 }, draw: 0, bonuses: [], appliedStatuses: [] } }
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

  it('gives the same plan whatever the hidden draw order, reshuffle order, seed, RNG state or card ids', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = createBattle(encounters[2], undefined, { seed })
      for (let turn = 0; turn < 2; turn += 1) {
        for (const card of [...state.hand]) if (cardDefinition(card.definitionId).cost <= state.mana) playCard(state, card.instanceId)
        endTurn(state)
      }
      expect(state.discardPile.length).toBeGreaterThan(0)
      expect(state.drawPile.length).toBeGreaterThan(1)
      const other = equivalentView(state)
      expect(other.drawPile.map(card => card.instanceId)).not.toEqual(state.drawPile.map(card => card.instanceId))
      expect(planTurn(other, { salt: 7 }).sequence).toEqual(planTurn(state, { salt: 7 }).sequence)
      expect(planTurn(other)).toEqual(planTurn(state))
      // The planner's private copy is built from the visible zones only (labels such as seed/battleId are just copied).
      const mine = determinize(state, 7)
      const theirs = determinize(other, 7)
      expect(theirs.drawPile.map(card => card.definitionId)).toEqual(mine.drawPile.map(card => card.definitionId))
      expect(theirs.discardPile.map(card => card.definitionId)).toEqual(mine.discardPile.map(card => card.definitionId))
      expect(theirs.rngState).toBe(mine.rngState)
    }
  })

  it('seeds its sampling from the observable situation only', () => {
    const state = createBattle(encounters[2], undefined, { seed: 11 })
    const view = equivalentView(state)
    expect(observableSeed(view)).toBe(observableSeed(state))
    expect(observableSeed(state, 1)).not.toBe(observableSeed(state, 2))
    // A genuinely different situation (one more point of enemy damage, one card fewer in hand) changes it.
    const damaged = structuredClone(state)
    damaged.enemy.health -= 1
    expect(observableSeed(damaged)).not.toBe(observableSeed(state))
    const smaller = structuredClone(state)
    smaller.hand.pop()
    expect(observableSeed(smaller)).not.toBe(observableSeed(state))
  })

  it('ignores the enemy script beyond the action it has announced', () => {
    const state = createBattle(encounters[2], undefined, { seed: 3 })
    const other = structuredClone(state)
    const decoy = { kind: 'attack' as const, name: 'Скрытый удар', damage: 99, target: 'warrior' as const }
    other.enemy.behavior = { phase1: other.enemy.behavior.phase1.map((action, index) => (index === 0 ? action : decoy)), phase2: [decoy] }
    expect(planTurn(other, { salt: 1 })).toEqual(planTurn(state, { salt: 1 }))
  })

  it('changes with the salt only through the shuffle of unknown cards, and stays reproducible', () => {
    const state = createBattle(encounters[2], undefined, { seed: 4 })
    expect(planTurn(state, { salt: 2 })).toEqual(planTurn(state, { salt: 2 }))
    expect(determinize(state, 2).drawPile.map(card => card.instanceId)).not.toEqual(determinize(state, 3).drawPile.map(card => card.instanceId))
    expect(new Set(determinize(state, 2).drawPile.map(card => card.instanceId))).toEqual(new Set(state.drawPile.map(card => card.instanceId)))
  })
})

describe('planner choices', () => {
  it('chains guard, frostbolt and sword strike across armor and vulnerability bonuses', () => {
    const state = fixture(['sword-strike', 'frostbolt', 'guard'])
    const plan = planTurn(state)
    expect(plan.sequence).toEqual(['guard', 'frostbolt', 'sword-strike'])
    const results = play(state, plan.sequence)
    expect(results.every(result => result.ok)).toBe(true)
    expect(results.flatMap(result => (result.ok ? result.outcome.bonuses : []))).toEqual(['Броня Джайны', 'Уязвимость'])
  })

  it('uses vulnerability after Frostbolt establishes it', () => {
    const state = fixture(['sword-strike', 'frostbolt'])
    const plan = planTurn(state)
    expect(plan.sequence).toEqual(['frostbolt', 'sword-strike'])
    expect(damageOf(state, plan.sequence)).toBe(4 + 9)
  })

  it('finds the best damage that an exhaustive search of the real engine finds (profile: damage only)', () => {
    // The oracle searches the planner's own determinised world, so draw effects see the same cards on both sides.
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createBattle({ ...encounters[2]!, maxHealth: 500 }, undefined, { deck: startingDeck, seed })
      const world = determinize(state, seed)
      const plan = planTurn(state, { profile: damageOnly, limits: exhaustive, salt: seed })
      expect(damageOf(structuredClone(world), plan.sequence), 'seed ' + seed).toBe(bruteForceBestDamage(world))
    }
  })

  it('stays optimal on these hands with the default search limits too', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createBattle({ ...encounters[2]!, maxHealth: 500 }, undefined, { deck: startingDeck, seed })
      const world = determinize(state, seed)
      const plan = planTurn(state, { profile: damageOnly, salt: seed })
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
      const planner = createTurnPlanner()
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
  it('summarizes all classic strategies with the new card mechanics', () => {
    const runs = simulateBalance({ runs: 30, seed: 42 })
    const rows = summarizeBalance(runs)
    expect(rows.map(row => row.strategy)).toEqual([...classicStrategies])
    expect(summarizeBalance(simulateBalance({ runs: 30, seed: 42 }))).toEqual(rows)
    expect(rows.every(row => row.victories >= 0 && row.victories <= row.runs)).toBe(true)
    expect(rows.every(row => row.planningNodesPerTurn === 0)).toBe(true)
    expect(rows.every(row => Number.isFinite(row.vulnerabilityTriggersPerTurn))).toBe(true)
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

  it('reports vulnerability and armor-bonus usage for all strategies', () => {
    const rows = summarizeBalance(simulateBalance({ runs: 40, seed: 42, strategies: [...allStrategies] }))
    const byName = Object.fromEntries(rows.map(row => [row.strategy, row]))
    expect(byName.planner!.vulnerabilityTriggersPerTurn).toBeGreaterThan(0)
    expect(byName.planner!.armorBonusTriggersPerTurn).toBeGreaterThan(0)
    expect(byName.planner!.timeouts).toBe(0)
    expect(byName.planner!.manaUtilization).toBeGreaterThan(0.9)
    expect(byName.planner!.planningTruncatedPlans).toBe(0)
  })
})

describe('the integrated planner strategy cannot see hidden information', () => {
  it('is given no seed-derived entropy by the Balance Lab', () => {
    calls.length = 0
    for (const seed of [42, 43, 44]) simulateRun(seed, 'planner')
    expect(calls.length).toBeGreaterThan(50)
    expect(calls.every(call => call.options === undefined)).toBe(true)
  })

  it('makes the same decision in every situation it meets when only hidden details differ', () => {
    calls.length = 0
    for (const seed of [42, 43, 44, 45, 46, 47]) simulateRun(seed, 'planner')
    const decisions = calls.filter(call => call.fresh)
    expect(decisions.length).toBeGreaterThan(60)
    const definitionAt = (state: BattleState, id: string | undefined) => (id === undefined ? undefined : state.hand.find(card => card.instanceId === id)!.definitionId)
    for (const decision of decisions) {
      const view = equivalentView(decision.snapshot)
      expect(definitionAt(view, createTurnPlanner().next(view))).toBe(definitionAt(decision.snapshot, decision.chosen))
    }
  })

  it('reproduces whole runs, and changing the battle seed changes the draws but never the method', () => {
    const first = simulateRun(42, 'planner')
    expect(simulateRun(42, 'planner')).toEqual(first)
    expect(simulateRun(43, 'planner')).not.toEqual(first)
  })
})
