import { cardDefinition, encounters, startingDeck } from './types'
import { drawForTurn, gameEconomy, manaForTurn } from './economy'
import type { EconomyConfig } from './economy'
import { drawCards, shuffle } from './deck'
import type { BattleState, CardEffect, CardDefinition, CardId, CardPreview, EncounterDefinition, EnemyAction, EnemyHit, HeroId, PendingPlay, StatusId } from './types'

export interface BattleOptions {
  deck?: readonly CardId[]
  seed?: number
  battleId?: string
  openingHandSize?: number
  /** Mana curve and draw schedule; standard model B when omitted. Balance Lab passes model A explicitly. */
  economy?: EconomyConfig
}
const ENEMY_ARMOR_CAP = 8

type Failure = { ok: false; reason: 'mana' | 'finished' | 'busy' | 'not-in-hand' | 'stale-action' }
export type PlayStartResult = { ok: true; play: PendingPlay } | Failure
export type PlayResult = { ok: true; outcome: CardPreview; drawn: number; damageDealt: number } | Failure

function updateResult(state: BattleState): void {
  if (state.result) return
  if (Object.values(state.heroes).some(hero => hero.health <= 0)) state.result = 'defeat'
  else if (state.enemy.health <= 0) state.result = 'victory'
  if (state.result) state.enemy.vulnerable = false
}

export function createBattle(encounter: EncounterDefinition = encounters[1]!, previousHeroes?: BattleState['heroes'], options: BattleOptions = {}): BattleState {
  const seed = (options.seed ?? 1) >>> 0
  const economy = options.economy ?? gameEconomy
  const battleId = options.battleId ?? encounter.id + ':' + seed
  const heroes = previousHeroes
    ? { warrior: { ...previousHeroes.warrior, armor: 0 }, mage: { ...previousHeroes.mage, armor: 0 } }
    : {
      warrior: { id: 'warrior' as const, name: 'Вариан Ринн', title: 'Король Штормграда', health: 25, maxHealth: 25, armor: 0, icon: '⚔' },
      mage: { id: 'mage' as const, name: 'Джайна Праудмур', title: 'Верховная волшебница Кирин-Тора', health: 18, maxHealth: 18, armor: 0, icon: '✦' },
    }
  const state: BattleState = {
    battleId, seed, rngState: seed, nextActionId: 1, heroes,
    enemy: { name: encounter.name, title: encounter.title, health: encounter.maxHealth, maxHealth: encounter.maxHealth, armor: 0, vulnerable: false, appearance: encounter.appearance, phase: 1, nextActionPhase: 1, behavior: encounter.behavior, behaviorIndex: 1, nextAction: encounter.behavior.phase1[0]!, focus: initialFocus(encounter.behavior.phase1[0]!) },
    hand: [], blockedDraws: 0, drawPile: [], discardPile: [], exhausted: [], pending: null,
    economy, mana: manaForTurn(economy, 1), maxMana: manaForTurn(economy, 1), turn: 1, result: null,
  }
  state.drawPile = shuffle(state, (options.deck ?? startingDeck).map((id, index) => ({
    instanceId: battleId + '/card/' + (index + 1), definitionId: cardDefinition(id).id,
  })))
  updateResult(state)
  drawCards(state, options.openingHandSize ?? economy.openingHand)
  return state
}

function hitFocus(action: EnemyAction, fallback: HeroId): HeroId {
  const hit = action.kind === 'prepare' ? action.prepared : action
  return hit.kind === 'attack' ? hit.target : hit.kind === 'attack_all' ? hit.primaryTarget : fallback
}
function schedule(state: BattleState): EnemyAction[] { return state.enemy.phase === 2 ? state.enemy.behavior.phase2 ?? state.enemy.behavior.phase1 : state.enemy.behavior.phase1 }
function initialFocus(action: EnemyAction): HeroId { return hitFocus(action, 'warrior') }

export function hasStatus(state: BattleState, status: StatusId): boolean {
  return status === 'vulnerability' && !state.result && state.enemy.vulnerable
}

function buildPlan(state: BattleState, card: CardDefinition): Omit<PendingPlay, 'actionId' | 'card' | 'handIndex'> {
  const enemyAction = state.enemy.nextAction
  const enemyAttacking = enemyAction.kind === 'attack' || enemyAction.kind === 'attack_all'
  const allEffects = card.effects.filter(effect => effect.type !== 'damage' || effect.when !== 'enemy-attacking' || enemyAttacking)
  const baseDamage = allEffects.reduce((sum, effect) => sum + (effect.type === 'damage' ? effect.amount : 0), 0)
  const vulnerabilityBonus = state.enemy.vulnerable && baseDamage > 0 ? 3 : 0
  const armorBonus = card.damageBonus?.condition === 'hero-has-armor' && state.heroes[card.damageBonus.hero].armor > 0 && baseDamage > 0 ? card.damageBonus.amount : 0
  const damage = baseDamage + vulnerabilityBonus + armorBonus
  const armorDamage = Math.min(state.enemy.armor, damage)
  const healthDamage = Math.min(state.enemy.health, Math.max(0, damage - armorDamage))
  const effects: CardEffect[] = allEffects.filter(effect => effect.type !== 'damage')
  // Deal the entire hit together, before secondary effects. A lethal hit stops the action.
  if (damage > 0) effects.unshift({ type: 'damage', amount: damage })
  const armor: Record<HeroId, number> = { warrior: 0, mage: 0 }
  for (const effect of effects) {
    if (effect.type !== 'armor') continue
    const target = armorTarget(effect.target, state.enemy.focus)
    armor[target] += effect.amount
  }
  return {
    effects,
    consumeVulnerability: vulnerabilityBonus > 0,
    preview: {
      damage, armorDamage, healthDamage, armor,
      bonusDamage: vulnerabilityBonus + armorBonus, vulnerabilityBonus, armorBonus,
      draw: effects.reduce((sum, effect) => sum + (effect.type === 'draw' ? effect.amount : 0), 0),
      bonuses: [vulnerabilityBonus ? 'Уязвимость' : '', armorBonus ? 'Броня Джайны' : ''].filter(Boolean),
      appliedStatuses: effects.flatMap(effect => effect.type === 'status' ? [effect.status] : []),
    },
  }
}

export function previewCard(state: BattleState, card: CardDefinition): CardPreview {
  return buildPlan(state, card).preview
}

export function startCardPlay(state: BattleState, instanceId: string): PlayStartResult {
  updateResult(state)
  if (state.result) return { ok: false, reason: 'finished' }
  if (state.pending) return { ok: false, reason: 'busy' }
  const index = state.hand.findIndex(card => card.instanceId === instanceId)
  const instance = state.hand[index]
  if (!instance) return { ok: false, reason: 'not-in-hand' }
  const definition = cardDefinition(instance.definitionId)
  if (state.mana < definition.cost) return { ok: false, reason: 'mana' }
  const plan = buildPlan(state, definition)
  state.mana -= definition.cost
  state.hand.splice(index, 1)
  state.pending = { actionId: state.battleId + '/action/' + state.nextActionId++, card: instance, handIndex: index, ...plan }
  return { ok: true, play: state.pending }
}

export function resolveCardPlay(state: BattleState, actionId: string): PlayResult {
  const pending = state.pending
  if (!pending || pending.actionId !== actionId) return { ok: false, reason: 'stale-action' }
  // Clear the transaction before applying anything; duplicate animation events are harmless.
  state.pending = null
  updateResult(state)
  let drawn = 0
  let damageDealt = 0
  if (!state.result) {
    if (pending.consumeVulnerability) state.enemy.vulnerable = false
    for (const effect of pending.effects) {
      if (effect.type === 'damage') {
        const absorbed = Math.min(state.enemy.armor, effect.amount)
        state.enemy.armor -= absorbed
        const healthDamage = Math.min(state.enemy.health, effect.amount - absorbed)
        damageDealt += healthDamage
        state.enemy.health = Math.max(0, state.enemy.health - (effect.amount - absorbed))
        if (state.enemy.phase === 1 && state.enemy.behavior.phase2 && state.enemy.health * 2 <= state.enemy.maxHealth) {
          state.enemy.phase = 2
          state.enemy.behaviorIndex = 0
        }
      } else if (effect.type === 'armor') {
        const target = armorTarget(effect.target, state.enemy.focus)
        state.heroes[target].armor += effect.amount
      } else if (effect.type === 'draw') {
        drawn += drawCards(state, effect.amount).length
      } else {
        state.enemy.vulnerable = true
      }
      updateResult(state)
      if (state.result) break
    }
  }
  // The resolving copy cannot draw itself. Free cards exhaust, so they cannot form recycle loops.
  const destination = cardDefinition(pending.card.definitionId).exhaust ? state.exhausted : state.discardPile
  destination.push(pending.card)
  return { ok: true, outcome: pending.preview, drawn, damageDealt }
}

// Atomic, rendering-free API for scenarios and future AI/simulation tools.
export function playCard(state: BattleState, instanceId: string): PlayResult {
  const start = startCardPlay(state, instanceId)
  return start.ok ? resolveCardPlay(state, start.play.actionId) : start
}

function partnerOf(id: HeroId): HeroId { return id === 'warrior' ? 'mage' : 'warrior' }
function armorTarget(target: 'threatened' | 'partner' | HeroId, threatened: HeroId): HeroId {
  return target === 'threatened' ? threatened : target === 'partner' ? partnerOf(threatened) : target
}

export interface EnemyTargetForecast {
  target: HeroId
  attack: number
  absorbed: number
  healthLoss: number
  lethal: boolean
}

export interface EnemyActionForecast {
  action: EnemyAction
  phase: 1 | 2
  targets: EnemyTargetForecast[]
  futureTargets: EnemyTargetForecast[]
  threatened: HeroId[]
  armorGain: number
}

function forecastHit(state: BattleState, hit: EnemyHit): EnemyTargetForecast[] {
  const targets = hit.kind === 'attack' ? [hit.target] : ['warrior', 'mage'] as HeroId[]
  // Every AoE hit reads the same pre-hit armor/health snapshot.
  return targets.map(target => {
  const hero = state.heroes[target]
  const attack = hit.damage
  const absorbed = Math.min(attack, hero.armor)
  const remaining = Math.max(0, attack - absorbed)
  return { target, attack, absorbed, healthLoss: Math.min(hero.health, remaining), lethal: remaining >= hero.health }
  })
}

export function forecastEnemyAction(state: BattleState): EnemyActionForecast {
  const action = state.enemy.nextAction
  const hit = action.kind === 'prepare' ? null : action.kind === 'attack' || action.kind === 'attack_all' ? action : null
  const futureHit = action.kind === 'prepare' ? action.prepared : null
  const targets = hit ? forecastHit(state, hit) : []
  const futureTargets = futureHit ? forecastHit(state, futureHit) : []
  const announcedHit = hit ?? futureHit
  const threatened: HeroId[] = announcedHit?.kind === 'attack' ? [announcedHit.target] : announcedHit?.kind === 'attack_all' ? ['warrior', 'mage'] : []
  return { action, phase: state.enemy.nextActionPhase, targets, futureTargets, threatened, armorGain: action.kind === 'defend' || action.kind === 'recover' ? Math.min(action.armor, Math.max(0, ENEMY_ARMOR_CAP - state.enemy.armor)) : 0 }
}

/** Compatibility helper for the previous single-target UI and tests. */
export interface EnemyAttackForecast extends EnemyTargetForecast { action?: EnemyAction; phase?: 1 | 2; targets?: EnemyTargetForecast[]; futureTargets?: EnemyTargetForecast[]; threatened?: HeroId[]; armorGain?: number }
export function forecastEnemyAttack(state: BattleState): EnemyAttackForecast {
  const forecast = forecastEnemyAction(state)
  const item = forecast.targets[0] ?? forecast.futureTargets[0] ?? { target: state.enemy.focus, attack: 0, absorbed: 0, healthLoss: 0, lethal: false }
  return { ...item, ...forecast }
}

export function endTurn(state: BattleState): boolean {
  updateResult(state)
  if (state.result || state.pending) return false
  const forecast = forecastEnemyAction(state)
  const action = state.enemy.nextAction
  if (action.kind === 'defend' || action.kind === 'recover') state.enemy.armor = Math.min(ENEMY_ARMOR_CAP, state.enemy.armor + action.armor)
  for (const incoming of forecast.targets) {
    const hero = state.heroes[incoming.target]
    hero.health -= incoming.healthLoss
    // Only hit heroes consume armor; a partner shield remains available until that hero is hit.
    hero.armor = 0
  }
  updateResult(state)
  if (state.result) return true
  state.turn += 1
  // The curve grows at the start of the turn and the pool is refilled completely.
  state.maxMana = manaForTurn(state.economy, state.turn)
  state.mana = state.maxMana
  if (action.kind === 'prepare') {
    state.enemy.nextAction = action.prepared
    state.enemy.focus = hitFocus(action.prepared, state.enemy.focus)
  } else {
    const actions = schedule(state)
    const index = state.enemy.behaviorIndex % actions.length
    state.enemy.nextAction = actions[index]!
    state.enemy.nextActionPhase = state.enemy.phase
    state.enemy.behaviorIndex = (index + 1) % actions.length
    state.enemy.focus = hitFocus(state.enemy.nextAction, state.enemy.focus)
  }
  drawCards(state, drawForTurn(state.economy, state.turn))
  return true
}
