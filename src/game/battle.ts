import { cardDefinition, encounters, links, startingDeck } from './types'
import { discardHand, drawCards, shuffle } from './deck'
import type { BattleState, CardEffect, CardDefinition, CardId, CardPreview, EncounterDefinition, HeroId, PendingPlay, StatusId } from './types'

export interface BattleOptions {
  deck?: readonly CardId[]
  seed?: number
  battleId?: string
  openingHandSize?: number
}

type Failure = { ok: false; reason: 'mana' | 'finished' | 'busy' | 'not-in-hand' | 'stale-action' }
export type PlayStartResult = { ok: true; play: PendingPlay } | Failure
export type PlayResult = { ok: true; outcome: CardPreview; drawn: number; damageDealt: number } | Failure

function updateResult(state: BattleState): void {
  if (state.result) return
  if (Object.values(state.heroes).some(hero => hero.health <= 0)) state.result = 'defeat'
  else if (state.enemy.health <= 0) state.result = 'victory'
  if (state.result) state.statuses = {}
}

export function createBattle(encounter: EncounterDefinition = encounters[1]!, previousHeroes?: BattleState['heroes'], options: BattleOptions = {}): BattleState {
  const seed = (options.seed ?? 1) >>> 0
  const battleId = options.battleId ?? encounter.id + ':' + seed
  const heroes = previousHeroes
    ? { warrior: { ...previousHeroes.warrior, armor: 0 }, mage: { ...previousHeroes.mage, armor: 0 } }
    : {
      warrior: { id: 'warrior' as const, name: 'Бранн', title: 'Хранитель клятвы', health: 25, maxHealth: 25, armor: 0, icon: '⚔' },
      mage: { id: 'mage' as const, name: 'Лира', title: 'Искра чародейки', health: 18, maxHealth: 18, armor: 0, icon: '✦' },
    }
  const state: BattleState = {
    battleId, seed, rngState: seed, nextActionId: 1, heroes,
    enemy: { name: encounter.name, title: encounter.title, health: encounter.maxHealth, maxHealth: encounter.maxHealth, attack: encounter.attack, intent: encounter.intent, appearance: encounter.appearance },
    statuses: {}, hand: [], drawPile: [], discardPile: [], exhausted: [], pending: null,
    mana: 3, maxMana: 3, turn: 1, result: null,
  }
  state.drawPile = shuffle(state, (options.deck ?? startingDeck).map((id, index) => ({
    instanceId: battleId + '/card/' + (index + 1), definitionId: cardDefinition(id).id,
  })))
  updateResult(state)
  drawCards(state, options.openingHandSize ?? 3)
  return state
}

export function hasStatus(state: BattleState, status: StatusId): boolean {
  const active = state.statuses[status]
  return !state.result && !!active && active.expiresOnTurn >= state.turn
}

function buildPlan(state: BattleState, card: CardDefinition): Omit<PendingPlay, 'actionId' | 'card' | 'handIndex'> {
  const activeLinks = links.filter(link => hasStatus(state, link.status) && link.actor === card.className && card.tags.includes(link.tag))
  const bonusEffects = activeLinks.flatMap(link => link.effects)
  const allEffects = [...card.effects, ...bonusEffects]
  const damage = allEffects.reduce((sum, effect) => sum + (effect.type === 'damage' ? effect.amount : 0), 0)
  const effects: CardEffect[] = allEffects.filter(effect => effect.type !== 'damage')
  // Deal the entire hit together, before secondary effects. A lethal hit stops the action.
  if (damage > 0) effects.unshift({ type: 'damage', amount: damage })
  const armor: Record<HeroId, number> = { warrior: 0, mage: 0 }
  for (const effect of effects) {
    if (effect.type !== 'armor') continue
    const target = effect.target === 'threatened' ? state.enemy.intent : partnerOf(state.enemy.intent)
    armor[target] += effect.amount
  }
  return {
    effects,
    consume: [...new Set(activeLinks.map(link => link.status))],
    preview: {
      damage, armor,
      bonusDamage: bonusEffects.reduce((sum, effect) => sum + (effect.type === 'damage' ? effect.amount : 0), 0),
      draw: effects.reduce((sum, effect) => sum + (effect.type === 'draw' ? effect.amount : 0), 0),
      links: activeLinks.map(link => link.name),
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
    for (const status of pending.consume) delete state.statuses[status]
    for (const effect of pending.effects) {
      if (effect.type === 'damage') {
        damageDealt += Math.min(state.enemy.health, effect.amount)
        state.enemy.health = Math.max(0, state.enemy.health - effect.amount)
      } else if (effect.type === 'armor') {
        const target = effect.target === 'threatened' ? state.enemy.intent : partnerOf(state.enemy.intent)
        state.heroes[target].armor += effect.amount
      } else if (effect.type === 'draw') {
        drawn += drawCards(state, effect.amount).length
      } else {
        state.statuses[effect.status] = { expiresOnTurn: state.turn + effect.durationTurns - 1 }
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

export interface EnemyAttackForecast {
  target: HeroId
  attack: number
  absorbed: number
  healthLoss: number
  lethal: boolean
}

export function forecastEnemyAttack(state: BattleState): EnemyAttackForecast {
  const target = state.enemy.intent
  const hero = state.heroes[target]
  const attack = state.enemy.attack
  const absorbed = Math.min(attack, hero.armor)
  const remaining = Math.max(0, attack - absorbed)
  return { target, attack, absorbed, healthLoss: Math.min(hero.health, remaining), lethal: remaining >= hero.health }
}

export function endTurn(state: BattleState): boolean {
  updateResult(state)
  if (state.result || state.pending) return false
  discardHand(state)
  const forecast = forecastEnemyAttack(state)
  const target = forecast.target
  const hero = state.heroes[target]
  hero.health -= forecast.healthLoss
  // Only the attacked hero loses remaining armor; party shields can protect the next target.
  hero.armor = 0
  for (const status of Object.keys(state.statuses) as StatusId[]) {
    if (state.statuses[status]!.expiresOnTurn <= state.turn) delete state.statuses[status]
  }
  updateResult(state)
  if (state.result) return true
  state.mana = state.maxMana
  state.turn += 1
  state.enemy.intent = partnerOf(target)
  drawCards(state, 3)
  return true
}
