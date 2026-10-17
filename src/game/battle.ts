import { encounters } from './types'
import type { BattleState, CardDefinition, EncounterDefinition, HeroId } from './types'

export function createBattle(encounter: EncounterDefinition = encounters[1]!, previousHeroes?: BattleState['heroes']): BattleState {
  const heroes = previousHeroes
    ? { warrior: { ...previousHeroes.warrior, armor: 0 }, mage: { ...previousHeroes.mage, armor: 0 } }
    : {
      warrior: { id: 'warrior' as const, name: 'Бранн', title: 'Хранитель клятвы', health: 25, maxHealth: 25, armor: 0, icon: '⚔' },
      mage: { id: 'mage' as const, name: 'Лира', title: 'Искра чародейки', health: 18, maxHealth: 18, armor: 0, icon: '✦' },
    }
  return {
    heroes,
    enemy: { name: encounter.name, title: encounter.title, health: encounter.maxHealth, maxHealth: encounter.maxHealth, attack: encounter.attack, intent: encounter.intent, appearance: encounter.appearance, marked: false },
    mana: 3,
    maxMana: 3,
    turn: 1,
    result: null,
  }
}

export type PlayResult = { ok: true; damage?: number; armor?: number; partnerArmor?: number; draw?: number } | { ok: false; reason: 'mana' | 'finished' }

export function payCardCost(state: BattleState, card: CardDefinition): PlayResult {
  if (state.result) return { ok: false, reason: 'finished' }
  if (state.mana < card.cost) return { ok: false, reason: 'mana' }
  state.mana -= card.cost
  return { ok: true }
}

export function resolveCardEffect(state: BattleState, card: CardDefinition): PlayResult {
  if (state.result) return { ok: false, reason: 'finished' }
  if (card.armor) {
    const target = state.heroes[state.enemy.intent]
    const partner = state.heroes[state.enemy.intent === 'warrior' ? 'mage' : 'warrior']
    target.armor += card.armor
    partner.armor += card.partnerArmor ?? 0
    return { ok: true, armor: card.armor, partnerArmor: card.partnerArmor ?? 0 }
  }
  let damage = card.damage ?? 0
  let draw = 0
  if (card.kind === 'attack' && state.enemy.marked) {
    damage += 3
    draw = 1
    state.enemy.marked = false
  }
  if (card.kind === 'spell') state.enemy.marked = true
  state.enemy.health = Math.max(0, state.enemy.health - damage)
  if (state.enemy.health === 0) state.result = 'victory'
  return { ok: true, damage, ...(draw ? { draw } : {}) }
}

export function playCard(state: BattleState, card: CardDefinition): PlayResult {
  const payment = payCardCost(state, card)
  if (!payment.ok) return payment
  return resolveCardEffect(state, card)
}

export function endTurn(state: BattleState): void {
  if (state.result) return
  const target: HeroId = state.enemy.intent
  const hero = state.heroes[target]
  const absorbed = Math.min(hero.armor, state.enemy.attack)
  hero.armor -= absorbed
  hero.health = Math.max(0, hero.health - (state.enemy.attack - absorbed))
  if (hero.health === 0) state.result = 'defeat'
  state.heroes.warrior.armor = 0
  state.heroes.mage.armor = 0
  state.mana = state.maxMana
  state.turn += 1
  state.enemy.intent = target === 'warrior' ? 'mage' : 'warrior'
}
