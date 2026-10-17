import { endTurn, playCard } from './battle'
import { shuffle } from './deck'
import { cardDefinition } from './types'
import type { BattleState, CardId, CardInstance } from './types'

/**
 * Turn planner for the headless Balance Lab.
 *
 * Instead of scoring one card at a time, it searches whole-turn card sequences on copies of the live state, always
 * through the real engine (`playCard`, `endTurn`): there is no second implementation of the rules. A sequence is scored
 * on the state AFTER the visible enemy action resolves, so armor, links and held cards are judged by their consequences.
 *
 * Information discipline (what a player at the table can know when deciding):
 * - hand, mana, statuses, both discard zones, hero and enemy health/armor, and the enemy's CURRENT announced action;
 * - the CONTENTS of the draw pile (deck minus everything seen), but NOT its order. The copy is canonicalised and
 *   reshuffled with the planner's own RNG, so the real draw order and `rngState` can never influence a decision;
 * - the enemy's later actions are not read: scoring never looks at the intent that will be announced next turn.
 * The planner is deterministic: the same visible state and `entropy` always give the same plan.
 */

export interface PlannerProfile {
  /** Weight of health lost by the heroes (the mage counts 1.3x). */
  health: number
  /** Value of each card kept in hand after the turn. */
  keep: number
  /** Value of armor left on heroes that were not hit (it still absorbs a later attack). */
  armorKeep: number
  /** Penalty for ending the turn with a hero near death. */
  lowHealth: number
}

export interface PlannerLimits {
  /** Nodes kept per search depth. */
  beamWidth: number
  /** Hard cap of evaluated nodes per plan; the search is deterministic, so there is no wall-clock limit. */
  maxNodes: number
  /** Longest sequence of plays considered. */
  maxDepth: number
}

export const defaultPlannerProfile: PlannerProfile = { health: 1, keep: 0.35, armorKeep: 0.4, lowHealth: 0.25 }
export const defaultPlannerLimits: PlannerLimits = { beamWidth: 30, maxNodes: 900, maxDepth: 12 }

export interface PlannerOptions {
  profile?: Partial<PlannerProfile>
  limits?: Partial<PlannerLimits>
  /** Seeds the planner's private determinisation RNG. Never derive it from the battle's `rngState`. */
  entropy?: number
}

export interface TurnPlan {
  /** Card definitions to play this turn, in order. Empty means: end the turn now. */
  sequence: CardId[]
  score: number
  nodesEvaluated: number
  /** True when the node cap stopped the search before the frontier was exhausted. */
  truncated: boolean
}

export interface PlannerStats { plans: number; nodes: number; truncated: number; maxNodes: number }

const WIN_SCORE = 1_000_000

/**
 * Copies everything a play or turn end can mutate. `enemy.behavior` and `enemy.nextAction` are replaced, never
 * mutated, by the engine, so they are shared. The unit tests compare this against `structuredClone`.
 */
export function cloneBattleState(state: BattleState): BattleState {
  if (state.pending) throw new Error('Cannot copy a battle with a card play in progress')
  const statuses: BattleState['statuses'] = {}
  for (const [status, value] of Object.entries(state.statuses)) statuses[status as keyof typeof statuses] = { ...value! }
  return {
    ...state,
    heroes: { warrior: { ...state.heroes.warrior }, mage: { ...state.heroes.mage } },
    enemy: { ...state.enemy },
    statuses,
    hand: [...state.hand], drawPile: [...state.drawPile], discardPile: [...state.discardPile], exhausted: [...state.exhausted],
  }
}

function byInstanceId(a: CardInstance, b: CardInstance): number { return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0 }

function mix(a: number, b: number): number {
  let value = Math.imul(a ^ b, 0x9e3779b1) >>> 0
  value = Math.imul(value ^ value >>> 15, 0x85ebca6b) >>> 0
  return (value ^ value >>> 13) >>> 0
}

/**
 * Builds the planner's working copy: same visible information, hidden order replaced by a fresh random one.
 * Zone contents are sorted before shuffling, so two states that differ only in hidden order give the same copy.
 */
export function determinize(state: BattleState, entropy = 0): BattleState {
  const copy = cloneBattleState(state)
  const rng = { rngState: mix(mix(entropy >>> 0, copy.turn), copy.hand.length * 977 + copy.drawPile.length) }
  copy.drawPile = shuffle(rng, [...copy.drawPile].sort(byInstanceId))
  copy.discardPile = [...copy.discardPile].sort(byInstanceId)
  copy.rngState = rng.rngState
  return copy
}

function digest(state: BattleState): string {
  const ids = (cards: readonly CardInstance[]) => cards.map(card => card.definitionId).join(',')
  const statuses = Object.entries(state.statuses).map(([name, value]) => name + ':' + value!.expiresOnTurn).sort().join(',')
  return [
    state.mana, [...state.hand].map(card => card.definitionId).sort().join(','), statuses, state.enemy.health, state.enemy.armor,
    state.heroes.warrior.armor, state.heroes.warrior.health, state.heroes.mage.armor, state.heroes.mage.health,
    ids(state.drawPile), [...state.exhausted].map(card => card.definitionId).sort().join(','), state.rngState,
  ].join('|')
}

function score(root: BattleState, kept: BattleState, after: BattleState, profile: PlannerProfile): number {
  if (after.result === 'victory') return WIN_SCORE + after.heroes.warrior.health + after.heroes.mage.health
  if (after.result === 'defeat') return -WIN_SCORE
  const enemyDamage = root.enemy.health - after.enemy.health
  const armorShed = root.enemy.armor - after.enemy.armor
  const lostWarrior = root.heroes.warrior.health - after.heroes.warrior.health
  const lostMage = root.heroes.mage.health - after.heroes.mage.health
  const danger = (health: number) => Math.pow(Math.max(0, 7 - health), 1.5)
  return enemyDamage + 0.5 * armorShed
    - profile.health * (lostWarrior + 1.3 * lostMage)
    - profile.lowHealth * (danger(after.heroes.warrior.health) + 1.3 * danger(after.heroes.mage.health))
    + profile.armorKeep * 0.5 * (after.heroes.warrior.armor + 1.2 * after.heroes.mage.armor)
    + profile.keep * kept.hand.length
    - 0.8 * (after.blockedDraws - root.blockedDraws)
}

interface Node { state: BattleState; sequence: CardId[]; score: number }

/** Finds the best sequence of plays for the current turn. Never mutates `state`. */
export function planTurn(state: BattleState, options: PlannerOptions = {}): TurnPlan {
  const profile = { ...defaultPlannerProfile, ...options.profile }
  const limits = { ...defaultPlannerLimits, ...options.limits }
  if (state.result || state.pending) return { sequence: [], score: 0, nodesEvaluated: 0, truncated: false }

  const root = determinize(state, options.entropy ?? 0)
  const reference = cloneBattleState(root)
  let evaluated = 0
  const evaluate = (node: BattleState): number => {
    evaluated += 1
    const after = cloneBattleState(node)
    endTurn(after)
    return score(reference, node, after, profile)
  }

  const first: Node = { state: root, sequence: [], score: evaluate(root) }
  let best = first
  let frontier = [first]
  const seen = new Set([digest(root)])
  let truncated = false
  for (let depth = 0; depth < limits.maxDepth && frontier.length > 0; depth += 1) {
    const next: Node[] = []
    for (const node of frontier) {
      const tried = new Set<CardId>()
      for (const instance of node.state.hand) {
        // Copies of one card are interchangeable, so each definition is tried once per node.
        if (tried.has(instance.definitionId) || cardDefinition(instance.definitionId).cost > node.state.mana) continue
        tried.add(instance.definitionId)
        if (evaluated >= limits.maxNodes) { truncated = true; continue }
        const child = cloneBattleState(node.state)
        if (!playCard(child, instance.instanceId).ok) continue
        const key = digest(child)
        if (seen.has(key)) continue
        seen.add(key)
        const entry: Node = { state: child, sequence: [...node.sequence, instance.definitionId], score: evaluate(child) }
        next.push(entry)
        if (entry.score > best.score) best = entry
      }
    }
    next.sort((a, b) => b.score - a.score)
    frontier = next.slice(0, limits.beamWidth)
    if (truncated) break
  }
  return { sequence: best.sequence, score: best.score, nodesEvaluated: evaluated, truncated }
}

function handKey(hand: readonly CardInstance[]): string { return hand.map(card => card.instanceId).sort().join('|') }

export interface TurnPlanner {
  /** Instance id of the next card to play, or undefined to end the turn. Replans when the hand is not what the plan expects. */
  next(state: BattleState): string | undefined
  readonly stats: PlannerStats
}

/**
 * Stateful wrapper for a turn loop: plan once per turn, replan only when the hand changed unexpectedly
 * (a draw effect revealed new cards) or when a planned card cannot be played.
 */
export function createTurnPlanner(options: PlannerOptions = {}): TurnPlanner {
  const stats: PlannerStats = { plans: 0, nodes: 0, truncated: 0, maxNodes: 0 }
  let plan: CardId[] | null = null
  let planTurnNumber = -1
  let expectedHand = ''
  const replan = (state: BattleState) => {
    const result = planTurn(state, options)
    stats.plans += 1
    stats.nodes += result.nodesEvaluated
    stats.maxNodes = Math.max(stats.maxNodes, result.nodesEvaluated)
    if (result.truncated) stats.truncated += 1
    plan = [...result.sequence]
    planTurnNumber = state.turn
    expectedHand = handKey(state.hand)
  }
  return {
    stats,
    next(state) {
      if (state.result || state.pending) return undefined
      if (!plan || planTurnNumber !== state.turn || expectedHand !== handKey(state.hand)) replan(state)
      while (plan!.length) {
        const wanted = plan!.shift()!
        const card = state.hand.find(instance => instance.definitionId === wanted && cardDefinition(instance.definitionId).cost <= state.mana)
        if (!card) continue
        expectedHand = handKey(state.hand.filter(instance => instance !== card))
        return card.instanceId
      }
      return undefined
    },
  }
}
