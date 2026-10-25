import { endTurn, playCard } from './battle'
import { shuffle } from './deck'
import { cloneEconomy } from './economy'
import { cloneStatuses, statusSignature } from './statuses'
import { resolveCardDefinition } from './cardProgression'
import { goldCards } from './types'
import type { BattleState, CardId, CardInstance } from './types'

/**
 * Turn planner for the headless Balance Lab.
 *
 * Instead of scoring one card at a time, it searches whole-turn card sequences on copies of the live state, always
 * through the real engine (`playCard`, `endTurn`): there is no second implementation of the rules. A sequence is scored
 * on the state AFTER the visible enemy action resolves, so armor, vulnerability and held cards are judged by their consequences.
 *
 * Information discipline (what a player at the table can know when deciding):
 * - hand, mana, both discard zones, hero and enemy health/armor, enemy vulnerability, and the CURRENT announced action;
 * - the CONTENTS of the draw pile (deck minus everything seen), but NOT its order. The copy is canonicalised (by card
 *   definition, never by technical instance id) and reshuffled with an RNG seeded ONLY from the observable situation,
 *   so the real draw order, `rngState`, `seed`, `battleId` and instance ids can never influence a decision;
 * - the enemy's later actions are not read: scoring never looks at the intent that will be announced next turn.
 * The planner is deterministic: the same visible situation (and `salt`) always gives the same plan.
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
  /**
   * Optional extra salt for the determinisation RNG (default 0), to draw a different sample of the unknown deck order.
   * Never derive it from the battle's `seed` or `rngState`: the Balance Lab does not pass it at all.
   */
  salt?: number
}

export interface TurnPlan {
  /** Card definitions to play this turn, in order. Empty means: end the turn now. */
  sequence: CardId[]
  upgrades: (0 | 1)[]
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
  return {
    ...state,
    heroes: { warrior: { ...state.heroes.warrior }, mage: { ...state.heroes.mage } },
    artifacts: state.artifacts.map(artifact => ({ ...artifact })),
    artifactNotices: [...state.artifactNotices],
    statuses: cloneStatuses(state.statuses),
    enemy: { ...state.enemy },
    economy: cloneEconomy(state.economy),
    hand: [...state.hand], drawPile: [...state.drawPile], discardPile: [...state.discardPile], exhausted: [...state.exhausted],
    classesPlayedThisTurn: [...state.classesPlayedThisTurn],
  }
}

/** Canonical order of a zone: by card definition. Instance ids are technical labels and must not matter. */
function byDefinition(a: CardInstance, b: CardInstance): number {
  return a.definitionId < b.definitionId ? -1 : a.definitionId > b.definitionId ? 1 : (a.upgrade ?? 0) !== (b.upgrade ?? 0) ? (a.upgrade ?? 0) - (b.upgrade ?? 0) : a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0
}

function variantKey(card: CardInstance): string { return card.definitionId + (card.upgrade ? '+1' : '') }

function mix(a: number, b: number): number {
  let value = Math.imul(a ^ b, 0x9e3779b1) >>> 0
  value = Math.imul(value ^ value >>> 15, 0x85ebca6b) >>> 0
  return (value ^ value >>> 13) >>> 0
}

/** FNV-1a over a string; used to turn the observable situation into a seed. */
function hashText(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
  return hash
}

/**
 * Every status except the enemy's Vulnerability, which keeps its original slot in the key so existing Balance Lab seeds
 * and plans are unchanged. Adds nothing while no other status exists.
 */
function extraStatusSignature(state: BattleState): string[] {
  const text = statusSignature(state, { carrier: 'enemy', id: 'vulnerability' })
  return text ? [text] : []
}

function visibleArtifactState(state: BattleState): string {
  return state.artifacts.map(artifact => {
    const owner = Object.values(state.heroes).find(hero => hero.instanceId === artifact.ownerInstanceId)
    return `${artifact.definitionId}:${owner?.partySlot ?? 'missing'}:${artifact.usedThisBattle}:${artifact.lastTriggeredTurn}:${artifact.armedThisTurn}`
  }).sort().join(',')
}

/**
 * A seed computed only from what the player can see: turn, mana, the multiset of cards in each zone, hero and enemy
 * health/armor, statuses and the announced enemy action. Equivalent situations always give the same value, whatever the
 * hidden draw order, RNG state, seed, battle id or instance ids.
 */
export function observableSeed(state: BattleState, salt = 0): number {
  const zone = (cards: readonly CardInstance[]) => cards.map(card => variantKey(card)).sort().join(',')
  const text = [
    state.turn, state.mana, state.maxMana, zone(state.hand), zone(state.drawPile), zone(state.discardPile), zone(state.exhausted), state.statuses.enemy.some(item => item.id === 'vulnerability'),
    state.heroes.warrior.health, state.heroes.warrior.armor, state.heroes.mage.health, state.heroes.mage.armor,
    ...(state.artifacts.length ? [visibleArtifactState(state)] : []),
    ...extraStatusSignature(state),
    state.enemy.health, state.enemy.armor, state.enemy.nextAction.name,
    ...(state.enemy.hurt || state.enemy.power ? [(state.enemy.hurt ?? 0) + '/' + (state.enemy.power ?? 0)] : []),
  ].join('|')
  return mix(hashText(text), salt >>> 0)
}

/**
 * Builds the planner's working copy: same visible information, hidden order replaced by a fresh random one.
 * Zones are sorted by definition before shuffling and the RNG comes from `observableSeed`, so two states that differ
 * only in hidden information give the same copy.
 */
export function determinize(state: BattleState, salt = 0): BattleState {
  const copy = cloneBattleState(state)
  const rng = { rngState: observableSeed(state, salt) }
  copy.drawPile = shuffle(rng, [...copy.drawPile].sort(byDefinition))
  copy.discardPile = [...copy.discardPile].sort(byDefinition)
  copy.rngState = rng.rngState
  return copy
}

/** Cards whose rules read the classes already played this turn; only a battle that still holds one needs that history in its identity. */
const readsClassHistory = new Set<string>(goldCards.filter(card => card.damageBonus?.condition === 'other-class-played').map(card => card.id))
const classHistoryMatters = (state: BattleState) => [state.hand, state.drawPile, state.discardPile].some(zone => zone.some(card => readsClassHistory.has(card.definitionId)))

function digest(state: BattleState): string {
  const ids = (cards: readonly CardInstance[]) => cards.map(card => variantKey(card)).join(',')
  return [
    state.mana, [...state.hand].map(card => variantKey(card)).sort().join(','), state.statuses.enemy.some(item => item.id === 'vulnerability'), state.enemy.health, state.enemy.armor,
    state.heroes.warrior.armor, state.heroes.warrior.health, state.heroes.mage.armor, state.heroes.mage.health,
    ...(state.artifacts.length ? [visibleArtifactState(state)] : []),
    ...extraStatusSignature(state),
    ...(state.enemy.hurt ? ['h' + state.enemy.hurt] : []),
    ...(classHistoryMatters(state) ? ['c' + [...new Set(state.classesPlayedThisTurn)].sort().join('+')] : []),
    ids(state.drawPile), [...state.exhausted].map(card => variantKey(card)).sort().join(','), state.rngState,
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

interface Node { state: BattleState; sequence: CardId[]; upgrades: (0 | 1)[]; score: number }

/** Finds the best sequence of plays for the current turn. Never mutates `state`. */
export function planTurn(state: BattleState, options: PlannerOptions = {}): TurnPlan {
  const profile = { ...defaultPlannerProfile, ...options.profile }
  const limits = { ...defaultPlannerLimits, ...options.limits }
  if (state.result || state.pending) return { sequence: [], upgrades: [], score: 0, nodesEvaluated: 0, truncated: false }

  const root = determinize(state, options.salt ?? 0)
  const reference = cloneBattleState(root)
  let evaluated = 0
  const evaluate = (node: BattleState): number => {
    evaluated += 1
    const after = cloneBattleState(node)
    endTurn(after)
    return score(reference, node, after, profile)
  }

  const first: Node = { state: root, sequence: [], upgrades: [], score: evaluate(root) }
  let best = first
  let frontier = [first]
  const seen = new Set([digest(root)])
  let truncated = false
  for (let depth = 0; depth < limits.maxDepth && frontier.length > 0; depth += 1) {
    const next: Node[] = []
    for (const node of frontier) {
      const tried = new Set<string>()
      for (const instance of node.state.hand) {
        // Copies of one card are interchangeable, so each definition is tried once per node.
        if (tried.has(variantKey(instance)) || resolveCardDefinition(instance).cost > node.state.mana) continue
        tried.add(variantKey(instance))
        if (evaluated >= limits.maxNodes) { truncated = true; continue }
        const child = cloneBattleState(node.state)
        if (!playCard(child, instance.instanceId).ok) continue
        const key = digest(child)
        if (seen.has(key)) continue
        seen.add(key)
        const entry: Node = { state: child, sequence: [...node.sequence, instance.definitionId], upgrades: [...node.upgrades, instance.upgrade ?? 0], score: evaluate(child) }
        next.push(entry)
        if (entry.score > best.score) best = entry
      }
    }
    next.sort((a, b) => b.score - a.score)
    frontier = next.slice(0, limits.beamWidth)
    if (truncated) break
  }
  return { sequence: best.sequence, upgrades: best.upgrades, score: best.score, nodesEvaluated: evaluated, truncated }
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
  let plan: { id: CardId; upgrade: 0 | 1 }[] | null = null
  let planTurnNumber = -1
  let expectedHand = ''
  const replan = (state: BattleState) => {
    const result = planTurn(state, options)
    stats.plans += 1
    stats.nodes += result.nodesEvaluated
    stats.maxNodes = Math.max(stats.maxNodes, result.nodesEvaluated)
    if (result.truncated) stats.truncated += 1
    plan = result.sequence.map((id, i) => ({ id, upgrade: result.upgrades[i]! }))
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
        const card = state.hand.find(instance => instance.definitionId === wanted.id && (instance.upgrade ?? 0) === wanted.upgrade && resolveCardDefinition(instance).cost <= state.mana)
        if (!card) continue
        expectedHand = handKey(state.hand.filter(instance => instance !== card))
        return card.instanceId
      }
      return undefined
    },
  }
}
