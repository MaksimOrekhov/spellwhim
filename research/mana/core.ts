/**
 * Research harness for docs/mana-progression-research.md.
 *
 * Isolated from production: it imports the real rules (`createBattle`, `playCard`, `endTurn`,
 * `forecastEnemyAction`) and layers experimental economy rules ON TOP of them from the outside.
 * Nothing in src/ is modified. Experimental parameters (mana curve, enemy HP, card costs, extra draw)
 * are applied by this wrapper, never by editing the rules.
 */
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from '../../src/game/battle'
import { drawCards, shuffle } from '../../src/game/deck'
import { addCampaignReward, campaignRewardOptions, carriedHeroes } from '../../src/game/campaign'
import { CARDS_DRAWN_PER_TURN, MAX_HAND_SIZE, OPENING_HAND_SIZE, cardDefinition, cards, encounters, startingDeck } from '../../src/game/types'
import type { BattleState, CardDefinition, CardId, CardInstance, EncounterDefinition, EnemyAction, EnemyHit, HeroId } from '../../src/game/types'

/* ------------------------------------------------------------------ mana models */

export interface ManaModel {
  id: string
  label: string
  /** Maximum mana on the player's turn `turn` (1-based) of encounter `encounter` (0-based). */
  at(turn: number, encounter: number): number
  /** Unspent mana carried into the next turn, up to this many points. */
  carryCap?: number
  /** Cards that trigger a link cost 1 less (min 0), up to this many times per turn. */
  comboDiscount?: number
  /** One-shot burst per battle: +amount mana on a turn the player chooses, available from `fromTurn`. Planner bots only. */
  surge?: { amount: number; fromTurn: number }
}

const ramp = (values: number[]) => (turn: number) => values[Math.min(turn, values.length) - 1]!
export const manaModels: Record<string, ManaModel> = {
  A: { id: 'A', label: 'A · плоские 3', at: () => 3 },
  B: { id: 'B', label: 'B · 3→4→5', at: ramp([3, 4, 5]) },
  C: { id: 'C', label: 'C · 3→4→5→6', at: ramp([3, 4, 5, 6]) },
  D: { id: 'D', label: 'D · 2→3→4→5 (коротко)', at: ramp([2, 3, 4, 5]) },
  D0: { id: 'D0', label: 'D0 · 1→2→3→4→5 (как HS)', at: ramp([1, 2, 3, 4, 5]) },
  F4: { id: 'F4', label: 'F4 · плоские 4', at: () => 4 },
  F5: { id: 'F5', label: 'F5 · плоские 5', at: () => 5 },
  P4: { id: 'P4', label: 'P4 · 3→4 (потолок 4)', at: ramp([3, 4]) },
  K: { id: 'K', label: 'K · по боям 3/4/5', at: (_turn, encounter) => 3 + Math.min(encounter, 2) },
  E: { id: 'E', label: 'E · 3 + копилка до 3', at: () => 3, carryCap: 3 },
  E2: { id: 'E2', label: 'E2 · 3 + копилка до 2', at: () => 3, carryCap: 2 },
  G: { id: 'G', label: 'G · 3 + «эхо связки» ×2', at: () => 3, comboDiscount: 2 },
  G1: { id: 'G1', label: 'G1 · 3 + «эхо связки» ×1', at: () => 3, comboDiscount: 1 },
  PG: { id: 'PG', label: 'PG · 3→4 + эхо ×2', at: ramp([3, 4]), comboDiscount: 2 },
  BG: { id: 'BG', label: 'BG · 3→4→5 + эхо ×2', at: ramp([3, 4, 5]), comboDiscount: 2 },
  KR: { id: 'KR', label: 'KR · рост +1/ход, потолок 4/5/6 по боям', at: (turn, encounter) => Math.min(2 + turn, 4 + encounter) },
  Z: { id: 'Z', label: 'Z · 3 + «кульминация» +2 раз за бой', at: () => 3, surge: { amount: 2, fromTurn: 3 } },
  UZ: { id: 'UZ', label: 'UZ · 3,4,4,5,5,6 + «кульминация» +2', at: ramp([3, 4, 4, 5, 5, 6]), surge: { amount: 2, fromTurn: 3 } },
  S: { id: 'S', label: 'S · медленный 3,3,4,4,5', at: ramp([3, 3, 4, 4, 5]) },
  U: { id: 'U', label: 'U · 3,4,4,5,5,6', at: ramp([3, 4, 4, 5, 5, 6]) },
  PG1: { id: 'PG1', label: 'PG1 · 3→4 + эхо ×1', at: ramp([3, 4]), comboDiscount: 1 },
  BG1: { id: 'BG1', label: 'BG1 · 3→4→5 + эхо ×1', at: ramp([3, 4, 5]), comboDiscount: 1 },
  UG1: { id: 'UG1', label: 'UG1 · 3,4,4,5,5,6 + эхо ×1', at: ramp([3, 4, 4, 5, 5, 6]), comboDiscount: 1 },
  SG1: { id: 'SG1', label: 'SG1 · медленный + эхо ×1', at: ramp([3, 3, 4, 4, 5]), comboDiscount: 1 },
}
export function capOf(model: ManaModel, encounter: number): { value: number; turn: number } {
  let best = model.at(1, encounter)
  let turn = 1
  for (let t = 2; t <= 12; t += 1) if (model.at(t, encounter) > best) { best = model.at(t, encounter); turn = t }
  return { value: best, turn }
}

/* ------------------------------------------------------------------ configuration */

export interface EnemyTweaks {
  /** HP multiplier, single or per encounter. */
  hpScale?: number | number[]
  /** Multiplier for attack damage, single or per encounter. */
  damageScale?: number | number[]
  /** Escalation: +rampBonus damage to attacks on turn >= rampStart, again every rampEvery turns. */
  rampStart?: number
  rampEvery?: number
  rampBonus?: number
  /** At the end of the player's turn the enemy gains floor(healthDamage / divisor) armor (total armor cap 8). */
  reactiveArmorDivisor?: number
  /** Encounter indexes (0-based) where escalation / reactive armor apply; all encounters when omitted. */
  rampScope?: number[]
  reactiveScope?: number[]
  /** Replace the encounter table entirely (fully redesigned patterns). */
  encounters?: EncounterDefinition[]
}

export interface ResearchConfig {
  id: string
  mana: ManaModel
  enemy?: EnemyTweaks
  /** Card cost overrides applied only for the duration of the run. */
  costs?: Partial<Record<CardId, number>>
  /** Extra card definitions (concept cards expressed with existing effect types). */
  extraCards?: CardDefinition[]
  /** Card ids appended to the starting deck. */
  deckAdd?: CardId[]
  /** Cards drawn per turn (>= 2: the rules draw 2, extra draws are added on top). */
  draw?: number
  opening?: number
  /** Extra cards drawn each turn starting from turn `from` (a draw that grows together with the mana curve). */
  drawLate?: { from: number; extra: number }
  /** Fraction of max HP restored to both heroes between encounters. */
  healBetween?: number
}

function per(value: number | number[] | undefined, index: number, fallback: number): number {
  if (value === undefined) return fallback
  return Array.isArray(value) ? value[Math.min(index, value.length - 1)]! : value
}

function mapHit(hit: EnemyHit, f: (d: number) => number): EnemyHit { return { ...hit, damage: f(hit.damage) } }
function mapAction(action: EnemyAction, f: (d: number) => number): EnemyAction {
  if (action.kind === 'attack' || action.kind === 'attack_all') return mapHit(action, f)
  if (action.kind === 'prepare') return { ...action, prepared: mapHit(action.prepared, f) }
  return action
}
export function transformEncounter(base: EncounterDefinition, index: number, tweaks: EnemyTweaks = {}): EncounterDefinition {
  const hp = per(tweaks.hpScale, index, 1)
  const dmg = per(tweaks.damageScale, index, 1)
  const scale = (d: number) => Math.max(1, Math.round(d * dmg))
  return {
    ...base,
    maxHealth: Math.round(base.maxHealth * hp),
    behavior: {
      phase1: base.behavior.phase1.map(a => mapAction(a, scale)),
      phase2: base.behavior.phase2?.map(a => mapAction(a, scale)),
    },
  }
}

/* ------------------------------------------------------------------ context & engine wrapper */

export interface Ctx {
  s: BattleState
  cfg: ResearchConfig
  encounter: number
  /** Combo discounts still available this turn. */
  discounts: number
  /** Health damage dealt to the enemy so far this turn. */
  turnDamage: number
  /** When set, planner bots also measure the value of one extra mana point each turn. */
  probe?: boolean
  /** Surge still unused in this battle, and whether it was spent this turn. */
  surgeLeft?: boolean
  surgeUsed?: number
}

export function cloneState(s: BattleState): BattleState {
  const statuses: BattleState['statuses'] = {}
  for (const [key, value] of Object.entries(s.statuses)) statuses[key as keyof typeof statuses] = { ...value! }
  return {
    ...s,
    heroes: { warrior: { ...s.heroes.warrior }, mage: { ...s.heroes.mage } },
    enemy: { ...s.enemy },
    statuses,
    hand: [...s.hand], drawPile: [...s.drawPile], discardPile: [...s.discardPile], exhausted: [...s.exhausted],
    pending: null,
  }
}
export function cloneCtx(ctx: Ctx): Ctx { return { ...ctx, s: cloneState(ctx.s) } }

function enemyBonus(cfg: ResearchConfig, turn: number, encounter: number): number {
  const t = cfg.enemy
  if (!t?.rampBonus || t.rampStart === undefined) return 0
  if (t.rampScope && !t.rampScope.includes(encounter)) return 0
  if (turn < t.rampStart) return 0
  return t.rampBonus * (1 + Math.floor((turn - t.rampStart) / (t.rampEvery ?? 1)))
}
type Tagged = { __base?: number }
function buff(action: EnemyAction, bonus: number): EnemyAction {
  const hit = <T extends EnemyHit>(h: T): T => {
    const base = (h as Tagged).__base ?? h.damage
    const next = { ...h, damage: base + bonus } as T
    ;(next as Tagged).__base = base
    return next
  }
  if (action.kind === 'attack' || action.kind === 'attack_all') return hit(action)
  if (action.kind === 'prepare') return { ...action, prepared: hit(action.prepared) }
  return action
}
function applyEscalation(ctx: Ctx): void {
  const bonus = enemyBonus(ctx.cfg, ctx.s.turn, ctx.encounter)
  if (bonus || (ctx.s.enemy.nextAction as Tagged).__base !== undefined) ctx.s.enemy.nextAction = buff(ctx.s.enemy.nextAction, bonus)
}

function comboDiscountFor(ctx: Ctx, def: CardDefinition): number {
  if (ctx.discounts <= 0 || def.cost <= 0) return 0
  return previewCard(ctx.s, def).links.length > 0 ? 1 : 0
}
export function effectiveCost(ctx: Ctx, instance: CardInstance): number {
  const def = cardDefinition(instance.definitionId)
  return def.cost - comboDiscountFor(ctx, def)
}
export function affordable(ctx: Ctx, instance: CardInstance): boolean { return effectiveCost(ctx, instance) <= ctx.s.mana }

/** Plays a card through the real rules, applying the experimental combo discount from the outside. */
export function tryPlay(ctx: Ctx, instanceId: string) {
  const instance = ctx.s.hand.find(card => card.instanceId === instanceId)
  const discount = instance ? comboDiscountFor(ctx, cardDefinition(instance.definitionId)) : 0
  ctx.s.mana += discount
  const result = playCard(ctx.s, instanceId)
  if (!result.ok) { ctx.s.mana -= discount; return result }
  if (discount) ctx.discounts -= 1
  ctx.turnDamage += result.damageDealt
  return result
}

export function beginBattle(ctx: Ctx): void {
  const s = ctx.s
  const max = ctx.cfg.mana.at(1, ctx.encounter)
  s.maxMana = max
  s.mana = max
  ctx.discounts = ctx.cfg.mana.comboDiscount ?? 0
  ctx.turnDamage = 0
  ctx.surgeLeft = !!ctx.cfg.mana.surge
  ctx.surgeUsed = 0
  applyEscalation(ctx)
}

/** Ends the player's turn through the real rules, then applies experimental refills on top. */
export function advanceTurn(ctx: Ctx): boolean {
  const s = ctx.s
  const unspent = s.mana
  const divisor = ctx.cfg.enemy?.reactiveArmorDivisor
  const inScope = !ctx.cfg.enemy?.reactiveScope || ctx.cfg.enemy.reactiveScope.includes(ctx.encounter)
  if (divisor && inScope && ctx.turnDamage > 0) s.enemy.armor = Math.min(8, s.enemy.armor + Math.floor(ctx.turnDamage / divisor))
  if (!endTurn(s)) return false
  if (s.result) return true
  const model = ctx.cfg.mana
  const max = model.at(s.turn, ctx.encounter)
  s.maxMana = max
  s.mana = max + Math.min(model.carryCap ?? 0, unspent)
  const extra = (ctx.cfg.draw ?? CARDS_DRAWN_PER_TURN) - CARDS_DRAWN_PER_TURN
  if (extra > 0) drawCards(s, extra)
  if (ctx.cfg.drawLate && s.turn >= ctx.cfg.drawLate.from) drawCards(s, ctx.cfg.drawLate.extra)
  ctx.discounts = model.comboDiscount ?? 0
  ctx.turnDamage = 0
  ctx.surgeUsed = 0
  applyEscalation(ctx)
  return true
}

/* ------------------------------------------------------------------ bots */

export type BotId = 'greedy-aggressive' | 'greedy-defensive' | 'greedy-balanced' | 'plan-aggro' | 'plan-even' | 'plan-safe'
type Strategy = 'aggressive' | 'defensive' | 'balanced'
export const strategyOf: Record<BotId, Strategy> = {
  'greedy-aggressive': 'aggressive', 'greedy-defensive': 'defensive', 'greedy-balanced': 'balanced',
  'plan-aggro': 'aggressive', 'plan-safe': 'defensive', 'plan-even': 'balanced',
}

/* -- greedy bots: copied from src/game/balance.ts (not exported there), cost made combo-discount aware */

function opponentForecast(state: BattleState) {
  const forecast = forecastEnemyAction(state)
  return forecast.targets.length ? forecast.targets : forecast.futureTargets
}
function evaluateCard(ctx: Ctx, instance: CardInstance, strategy: Strategy): number {
  const state = ctx.s
  const card = cardDefinition(instance.definitionId)
  const cost = effectiveCost(ctx, instance)
  const preview = previewCard(state, card)
  const forecast = opponentForecast(state)
  const remainingEnemyHp = state.enemy.health + state.enemy.armor
  const damage = Math.min(preview.damage, remainingEnemyHp)
  const lethal = damage >= remainingEnemyHp
  const incomingHealth = forecast.reduce((sum, hit) => sum + hit.healthLoss, 0)
  const block = forecast.reduce((sum, hit) => {
    const added = preview.armor[hit.target]
    return sum + Math.min(added, Math.max(0, hit.attack - state.heroes[hit.target].armor))
  }, 0)
  const lethalThreat = forecast.some(hit => hit.lethal || hit.healthLoss >= state.heroes[hit.target].health)
  const blocksLethal = forecast.some(hit => hit.lethal && preview.armor[hit.target] >= hit.healthLoss)
  const linkValue = preview.bonusDamage + preview.draw * 1.4 + preview.links.length * 1.2
  const drawValue = preview.draw * 1.7
  if (strategy === 'aggressive') {
    if (lethal) return 10_000 + damage
    if (lethalThreat && blocksLethal) return 9_000 + block
    return damage * 1.15 + linkValue * 0.75 + drawValue - cost * 0.65 + (card.kind === 'defense' ? -3 : 0)
  }
  if (strategy === 'defensive') {
    if (lethal) return 10_000 + damage
    const defenseWeight = lethalThreat ? 8 : incomingHealth > 0 ? 2.8 : 0.45
    return block * defenseWeight + (lethalThreat && blocksLethal ? 2_000 : 0) + damage * 0.42 + linkValue * 0.7 + drawValue * 0.6 - cost * 0.35
  }
  if (lethal) return 10_000 + damage
  const danger = lethalThreat ? 5 : incomingHealth > 0 ? 1.6 : 0.35
  return damage * 0.9 + block * danger + linkValue + drawValue * 0.7 - cost * 0.45
}
function greedyChoose(ctx: Ctx, strategy: Strategy): string | null {
  const choice = ctx.s.hand
    .filter(instance => affordable(ctx, instance))
    .map((instance, index) => ({ instance, index, score: evaluateCard(ctx, instance, strategy) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]
  return choice && choice.score > 0.15 ? choice.instance.instanceId : null
}

/* -- planner bots: search over whole-turn card sequences on a determinised clone of the real rules */

interface Profile { hp: number; keep: number; threat: number; armorKeep: number; low: number }
const profiles: Record<'plan-aggro' | 'plan-even' | 'plan-safe', Profile> = {
  'plan-aggro': { hp: 0.6, keep: 0.15, threat: 0.2, armorKeep: 0.2, low: 0.1 },
  'plan-even': { hp: 1.0, keep: 0.35, threat: 0.5, armorKeep: 0.4, low: 0.25 },
  'plan-safe': { hp: 1.6, keep: 0.6, threat: 0.9, armorKeep: 0.6, low: 0.5 },
}
export const SURGE_THRESHOLD = 6
export const PLANNER_BEAM = 30
export const PLANNER_NODE_CAP = 900

function scoreOutcome(root: BattleState, node: BattleState, after: BattleState, p: Profile): number {
  if (after.result === 'victory') return 1_000_000 + after.heroes.warrior.health + after.heroes.mage.health
  if (after.result === 'defeat') return -1_000_000
  const dmg = root.enemy.health - after.enemy.health
  const shed = root.enemy.armor - after.enemy.armor
  const lostW = root.heroes.warrior.health - after.heroes.warrior.health
  const lostM = root.heroes.mage.health - after.heroes.mage.health
  const low = (hp: number) => Math.pow(Math.max(0, 7 - hp), 1.5)
  const forecast = forecastEnemyAction(after)
  const next = [...forecast.targets, ...forecast.futureTargets].reduce((sum, hit) => sum + hit.healthLoss, 0)
  const blocked = after.blockedDraws - root.blockedDraws
  return dmg + 0.5 * shed
    - p.hp * (lostW + 1.3 * lostM)
    - p.low * (low(after.heroes.warrior.health) + 1.3 * low(after.heroes.mage.health))
    + p.armorKeep * 0.5 * (after.heroes.warrior.armor + 1.2 * after.heroes.mage.armor)
    - p.threat * next
    + p.keep * node.hand.length
    - 0.8 * blocked
    // Banked mana is only worth something to a bot that knows it can carry; value it as one HP-point each.
    + BANK_VALUE * Math.max(0, after.mana - after.maxMana)
    // A bot that banks mana needs a reason: reward being able to cast a card next turn that costs more than the normal turn mana.
    + (after.mana > after.maxMana && after.hand.some(card => cardDefinition(card.definitionId).cost > after.maxMana && cardDefinition(card.definitionId).cost <= after.mana) ? BANK_PLAN_BONUS : 0)
}
export const BANK_PLAN_BONUS = 5
export const BANK_VALUE = 1.0

export interface PlannerState { plan: string[] | null; turn: number; info?: PlanResult; marginal?: number }
function nodeKey(ctx: Ctx): string {
  const s = ctx.s
  const hand = s.hand.map(c => c.definitionId).sort().join(',')
  const status = Object.keys(s.statuses).sort().join('')
  return [s.mana, ctx.discounts, hand, status, s.enemy.health, s.enemy.armor, s.heroes.warrior.armor, s.heroes.mage.armor, s.drawPile.map(c => c.definitionId).join(','), s.exhausted.length].join('|')
}
export interface PlanResult { seq: CardId[]; score: number; sets: number; nearBest: number; gap: number }
/** Returns the best sequence of card definitions to play this turn (possibly empty). */
function planTurn(ctx: Ctx, p: Profile): PlanResult {
  const root = cloneCtx(ctx)
  // Determinise unknown information: the planner must not see the real draw order.
  const unknown = { rngState: (root.s.seed * 2654435761 + root.s.turn * 40503 + root.s.hand.length * 977) >>> 0 }
  root.s.drawPile = shuffle(unknown, root.s.drawPile)
  root.s.rngState = unknown.rngState
  const rootState = cloneState(root.s)
  type Node = { ctx: Ctx; seq: CardId[]; score: number }
  const evaluate = (node: Ctx): number => {
    const after = cloneCtx(node)
    advanceTurn(after)
    return scoreOutcome(rootState, node.s, after.s, p)
  }
  const first: Node = { ctx: root, seq: [], score: evaluate(root) }
  let best = first
  const all: Node[] = [first]
  let frontier: Node[] = [first]
  const seen = new Set<string>([nodeKey(root)])
  let evaluated = 1
  while (frontier.length && evaluated < PLANNER_NODE_CAP) {
    const next: Node[] = []
    for (const node of frontier) {
      const tried = new Set<CardId>()
      for (const instance of node.ctx.s.hand) {
        if (tried.has(instance.definitionId) || !affordable(node.ctx, instance)) continue
        tried.add(instance.definitionId)
        const child = cloneCtx(node.ctx)
        if (!tryPlay(child, instance.instanceId).ok) continue
        const key = nodeKey(child)
        if (seen.has(key)) continue
        seen.add(key)
        const entry: Node = { ctx: child, seq: [...node.seq, instance.definitionId], score: evaluate(child) }
        evaluated += 1
        next.push(entry)
        all.push(entry)
        if (entry.score > best.score) best = entry
      }
    }
    next.sort((a, b) => b.score - a.score)
    frontier = next.slice(0, PLANNER_BEAM)
  }
  // Decision-richness diagnostics: distinct play-SETS (order ignored) and how close the runners-up are.
  const bySet = new Map<string, number>()
  for (const node of all) {
    const key = [...node.seq].sort().join(',')
    if (!(bySet.has(key) && bySet.get(key)! >= node.score)) bySet.set(key, node.score)
  }
  const scores = [...bySet.values()].sort((a, b) => b - a)
  const top = scores[0]!
  return { seq: best.seq, score: best.score, sets: scores.length, nearBest: scores.filter(x => x >= top - 2).length, gap: scores.length > 1 ? top - scores[1]! : 99 }
}
function plannerChoose(ctx: Ctx, p: Profile, st: PlannerState, replan: boolean): string | null {
  if (!st.plan || st.turn !== ctx.s.turn || replan) {
    const fresh = st.turn !== ctx.s.turn
    let result = planTurn(ctx, p)
    const surge = ctx.cfg.mana.surge
    if (fresh && surge && ctx.surgeLeft && ctx.s.turn >= surge.fromTurn) {
      // Spend the one-shot burst only when it buys a clearly better turn than playing normally.
      const burst = cloneCtx(ctx)
      burst.s.mana += surge.amount
      const boosted = planTurn(burst, p)
      if (boosted.score - result.score >= SURGE_THRESHOLD) {
        ctx.s.mana += surge.amount
        ctx.surgeLeft = false
        ctx.surgeUsed = surge.amount
        result = boosted
      }
    }
    st.plan = [...result.seq]
    if (fresh) {
      st.info = result
      st.marginal = undefined
      if (ctx.probe) {
        const up = cloneCtx(ctx)
        up.s.mana += 1
        const norm = (x: number) => (x > 500_000 ? 15 : x < -500_000 ? -15 : Math.max(-15, Math.min(15, x)))
        st.marginal = Math.max(0, norm(planTurn(up, p).score) - norm(result.score))
      }
    }
    st.turn = ctx.s.turn
  }
  while (st.plan.length) {
    const wanted = st.plan.shift()!
    const instance = ctx.s.hand.find(card => card.definitionId === wanted && affordable(ctx, card))
    if (instance) return instance.instanceId
  }
  return null
}

/* ------------------------------------------------------------------ rewards (copied from balance.ts) */

function chooseReward(state: BattleState, deck: readonly CardId[], strategy: Strategy): CardId {
  const counts = new Map<CardId, number>()
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1)
  const hpRatio = Math.min(state.heroes.warrior.health / state.heroes.warrior.maxHealth, state.heroes.mage.health / state.heroes.mage.maxHealth)
  const recoveryNeed = Math.max(0, 1 - hpRatio)
  const scores: Partial<Record<CardId, number>> = {
    'quick-cut': strategy === 'aggressive' ? 3.5 : strategy === 'defensive' ? 2.7 : 3.1,
    thunderbolt: strategy === 'aggressive' ? 3.35 : strategy === 'defensive' ? 2.7 : 3.1,
    bastion: strategy === 'aggressive' ? 2 : strategy === 'defensive' ? 3.15 : 3,
    parry: strategy === 'defensive' ? 3.5 : 2.8,
    'shield-bash': strategy === 'aggressive' ? 3.6 : 2.8,
    interpose: strategy === 'defensive' ? 3.6 : 2.5,
    frostbolt: strategy === 'aggressive' ? 3.2 : 2.9,
    'arcane-insight': strategy === 'balanced' ? 3.6 : 2.8,
    'ice-ward': strategy === 'defensive' ? 3.4 : 2.5,
  }
  const reward = campaignRewardOptions(state).map(card => {
    const synergy = card.className === 'warrior' ? (counts.get('fireball') ?? 0) * 0.08 : (counts.get('guard') ?? 0) * 0.08
    const urgency = card.kind === 'defense' ? recoveryNeed * (strategy === 'defensive' ? 1.8 : 0.8) : 0
    // Concept cards have no hand-tuned reward score: value them by raw output.
    const concept = scores[card.id] === undefined ? 3.0 + (card.cost >= 3 ? 0.4 : 0) : 0
    return { card, score: (scores[card.id] ?? 0) + concept + synergy + urgency }
  }).sort((a, b) => b.score - a.score)[0]!.card
  return reward.id
}

/* ------------------------------------------------------------------ campaign simulation */

export interface TurnRecord {
  turn: number
  maxMana: number
  available: number
  spent: number
  unused: number
  plays: number
  handStart: number
  handEnd: number
  /** Cards still in hand that could be afforded but were not played. */
  held: number
  /** Cards still in hand that cost more than the remaining mana. */
  unaffordable: number
  links: number
  damage: number
  hpLost: number
  atCap: boolean
  enemyAction: string
  /** Raw damage announced for this enemy action and how much of it armor absorbed. */
  incoming: number
  absorbed: number
  /** Mana spent on defense-kind cards, and armor points actually granted by all cards. */
  defMana: number
  armorGiven: number
  /** Hero HP fractions after the enemy resolved. */
  hpAfter: { warrior: number; mage: number }
  /** Planner diagnostics (plan-* bots only): HP-equivalent value of +1 mana, distinct play-sets, near-best sets, gap to runner-up. */
  marginal: number | null
  sets: number | null
  nearBest: number | null
  gap: number | null
}
export interface BattleRecord {
  encounter: string
  index: number
  result: 'victory' | 'defeat' | 'timeout'
  turns: number
  capTurn: number
  enemyMaxHealth: number
  startHp: Record<HeroId, number>
  endHp: Record<HeroId, number>
  turnLog: TurnRecord[]
  minHpFrac: number
  /** Per card: plays, summed turns spent in hand before the play, and copies still in hand when the battle ended. */
  waits: Record<string, { plays: number; age: number; stuck: number }>
  blockedDraws: number
  plays: Record<string, number>
}
export interface RunRecord {
  seed: number
  bot: BotId
  config: string
  status: 'victory' | 'defeat' | 'timeout'
  battles: BattleRecord[]
  rewards: CardId[]
  trace?: string[]
}


/** Applies card cost overrides / concept cards for the duration of `fn`, then restores the card table. */
export function withCardSetup<T>(cfg: ResearchConfig, fn: () => T): T {
  const saved = new Map<CardId, number>()
  const added: CardDefinition[] = []
  try {
    for (const [id, cost] of Object.entries(cfg.costs ?? {}) as [CardId, number][]) {
      const card = cards.find(c => c.id === id)!
      saved.set(id, card.cost)
      card.cost = cost
    }
    for (const extra of cfg.extraCards ?? []) { cards.push(extra); added.push(extra) }
    return fn()
  } finally {
    for (const [id, cost] of saved) cards.find(c => c.id === id)!.cost = cost
    for (const extra of added) cards.splice(cards.indexOf(extra), 1)
  }
}

export interface RunOptions { startAt?: number; probe?: boolean; trace?: boolean; traceHand?: boolean; maxTurns?: number; stopAfterTurns?: number; encounterLimit?: number }

export function runCampaign(seed: number, bot: BotId, cfg: ResearchConfig, options: RunOptions = {}): RunRecord {
  return withCardSetup(cfg, () => simulate(seed, bot, cfg, options))
}

function simulate(seed: number, bot: BotId, cfg: ResearchConfig, options: RunOptions): RunRecord {
  const maxTurns = options.maxTurns ?? 40
  const table = (cfg.enemy?.encounters ?? encounters).map((e, i) => transformEncounter(e, i, cfg.enemy))
  const strategy = strategyOf[bot]
  const trace: string[] = []
  const log = (line: string) => { if (options.trace) trace.push(line) }
  let deck: CardId[] = [...startingDeck, ...(cfg.deckAdd ?? [])]
  let battle: BattleState | undefined
  let status: RunRecord['status'] = 'timeout'
  const battles: BattleRecord[] = []
  const rewards: CardId[] = []
  const limit = Math.min(table.length, options.encounterLimit ?? table.length)

  for (let index = options.startAt ?? 0; index < limit; index += 1) {
    const encounter = table[index]!
    let heroes = battle ? carriedHeroes(battle) : undefined
    if (heroes && cfg.healBetween) {
      for (const hero of Object.values(heroes)) hero.health = Math.min(hero.maxHealth, hero.health + Math.round(hero.maxHealth * cfg.healBetween))
    }
    const state = createBattle(encounter, heroes, {
      deck, seed: (seed + index) >>> 0, battleId: 'research/' + seed + '/' + bot + '/' + encounter.id,
      openingHandSize: cfg.opening ?? OPENING_HAND_SIZE,
    })
    battle = state
    const ctx: Ctx = { s: state, cfg, encounter: index, discounts: 0, turnDamage: 0, probe: options.probe }
    beginBattle(ctx)
    const cap = capOf(cfg.mana, index)
    const turnLog: TurnRecord[] = []
    const plays: Record<string, number> = {}
    const startHp = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    const planner: PlannerState = { plan: null, turn: -1 }
    const firstSeen = new Map<string, number>()
    const waits: BattleRecord['waits'] = {}
    const wait = (id: string) => (waits[id] ??= { plays: 0, age: 0, stuck: 0 })
    log(`── Бой ${index + 1}: ${encounter.name} (${encounter.maxHealth} HP), мана: ${cfg.mana.label}`)
    let turns = 0
    while (!state.result && turns < maxTurns) {
      turns += 1
      const record: TurnRecord = {
        turn: state.turn, maxMana: state.maxMana, available: state.mana, spent: 0, unused: 0, plays: 0,
        handStart: state.hand.length, handEnd: 0, held: 0, unaffordable: 0, links: 0, damage: 0, hpLost: 0,
        atCap: state.maxMana >= cap.value, enemyAction: state.enemy.nextAction.name,
        incoming: 0, absorbed: 0, defMana: 0, armorGiven: 0, hpAfter: { warrior: 1, mage: 1 },
        marginal: null, sets: null, nearBest: null, gap: null,
      }
      const hpBefore = state.heroes.warrior.health + state.heroes.mage.health
      for (const card of state.hand) if (!firstSeen.has(card.instanceId)) firstSeen.set(card.instanceId, state.turn)
      if (options.trace) log(`Ход ${state.turn}: мана ${state.mana}, враг: ${describe(state.enemy.nextAction)} · HP врага ${state.enemy.health}/${state.enemy.maxHealth}${state.enemy.armor ? ' (+' + state.enemy.armor + ' брони)' : ''} · герои ${state.heroes.warrior.health}/${state.heroes.mage.health}`)
      if (options.traceHand) log('  рука: ' + state.hand.map(c => cardDefinition(c.definitionId).name + '(' + cardDefinition(c.definitionId).cost + ')').join(', '))
      const manaStart = state.mana
      let guard = 0
      while (!state.result && guard++ < 14) {
        const id = bot.startsWith('greedy')
          ? greedyChoose(ctx, strategy)
          : plannerChoose(ctx, profiles[bot as keyof typeof profiles], planner, false)
        if (!id) break
        const instance = state.hand.find(c => c.instanceId === id)!
        const def = cardDefinition(instance.definitionId)
        const manaBefore = state.mana
        const result = tryPlay(ctx, id)
        if (!result.ok) break
        const paid = manaBefore - state.mana
        record.plays += 1
        record.spent += paid
        record.links += result.outcome.links.length
        record.damage += result.damageDealt
        record.armorGiven += result.outcome.armor.warrior + result.outcome.armor.mage
        if (def.kind === 'defense') record.defMana += paid
        plays[def.id] = (plays[def.id] ?? 0) + 1
        { const w = wait(def.id); w.plays += 1; w.age += state.turn - (firstSeen.get(id) ?? state.turn) }
        if (result.drawn > 0) planner.plan = null
        log(`  ▸ ${def.name} (${def.cost}${paid !== def.cost ? '→' + paid : ''})${result.outcome.links.length ? ' · ' + result.outcome.links.join(', ') : ''}${result.damageDealt ? ' · −' + result.damageDealt + ' HP врага' : ''}${result.drawn ? ' · +' + result.drawn + ' карт' : ''}`)
      }
      record.unused = state.mana
      record.available = manaStart + (ctx.surgeUsed ?? 0)
      record.handEnd = state.hand.length
      for (const card of state.hand) {
        if (affordable(ctx, card)) record.held += 1
        else record.unaffordable += 1
      }
      if (planner.info && planner.turn === record.turn) {
        record.sets = planner.info.sets; record.nearBest = planner.info.nearBest; record.gap = planner.info.gap
        record.marginal = planner.marginal ?? null
      }
      const forecast = forecastEnemyAction(state)
      for (const hit of forecast.targets) { record.incoming += hit.attack; record.absorbed += hit.absorbed }
      if (options.stopAfterTurns && turns >= options.stopAfterTurns) { turnLog.push(record); break }
      if (state.result) { turnLog.push(record); break }
      if (!advanceTurn(ctx)) { turnLog.push(record); break }
      record.hpAfter = { warrior: state.heroes.warrior.health / state.heroes.warrior.maxHealth, mage: state.heroes.mage.health / state.heroes.mage.maxHealth }
      record.hpLost = hpBefore - (state.heroes.warrior.health + state.heroes.mage.health)
      turnLog.push(record)
      log(`  ⇒ неиспользовано ${record.unused} маны, в руке ${record.handEnd}; потеряно HP: ${record.hpLost}`)
    }
    const result: BattleRecord['result'] = state.result ?? (options.stopAfterTurns ? 'timeout' : 'timeout')
    battles.push({
      encounter: encounter.id, index, result, turns, capTurn: cap.turn, enemyMaxHealth: encounter.maxHealth,
      startHp, endHp: { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health },
      turnLog, blockedDraws: state.blockedDraws, plays,
      minHpFrac: Math.min(1, ...turnLog.map(t => Math.min(t.hpAfter.warrior, t.hpAfter.mage))),
      waits: (() => { for (const card of state.hand) wait(card.definitionId).stuck += 1; return waits })(),
    })
    if (options.stopAfterTurns && !state.result) break
    if (state.result === 'defeat') { status = 'defeat'; break }
    if (state.result !== 'victory') { status = 'timeout'; break }
    if (index === limit - 1) { status = 'victory'; break }
    const rewardId = chooseReward(state, deck, strategy)
    const reward = cards.find(card => card.id === rewardId)!
    deck = addCampaignReward(deck, reward)
    rewards.push(rewardId)
    log(`Награда: ${reward.name}`)
  }
  return { seed, bot, config: cfg.id, status, battles, rewards, trace: options.trace ? trace : undefined }
}

function describe(action: EnemyAction): string {
  if (action.kind === 'attack') return `${action.name} ${action.damage}→${action.target === 'warrior' ? 'Воин' : 'Маг'}`
  if (action.kind === 'attack_all') return `${action.name} ${action.damage}→оба`
  if (action.kind === 'prepare') return `${action.name} (подготовка ${action.prepared.damage})`
  return `${action.name} (+${action.armor} брони)`
}

export { MAX_HAND_SIZE }
