import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { cardDefinition, encounters, startingDeck } from './types'
import type { CardId } from './types'

export interface CombatScenario {
  name: string
  deck: CardId[]
  plays: CardId[]
  enemyHealth?: number
  heroHealth?: number
  enemyTurn?: boolean
}

// Short, scripted comparisons. Every scenario starts from the same seeded boss hit (7).
export const combatScenarios: CombatScenario[] = [
  { name: 'Обычная атака', deck: ['sword-strike', 'sword-strike'], plays: ['sword-strike', 'sword-strike'], enemyTurn: true },
  { name: 'Джайна готовит цель Вариану', deck: ['frostbolt', 'sword-strike', 'guard'], plays: ['frostbolt', 'sword-strike'], enemyTurn: true },
  { name: 'Вариан готовит цель Джайне', deck: ['guard', 'frostbolt', 'sword-strike'], plays: ['guard', 'frostbolt'], enemyTurn: true },
  { name: 'Бастион → разряд', deck: ['bastion', 'thunderbolt', 'sword-strike'], plays: ['bastion', 'thunderbolt'], enemyTurn: true },
  { name: 'Нехватка маны', deck: ['fireball', 'fireball'], plays: ['fireball', 'fireball'] },
  { name: 'Пустая колода', deck: ['thunderbolt'], plays: ['thunderbolt'] },
  { name: 'Повторные копии', deck: ['sword-strike', 'sword-strike', 'sword-strike'], plays: ['sword-strike', 'sword-strike', 'sword-strike'] },
  { name: 'Победа', deck: ['sword-strike'], plays: ['sword-strike'], enemyHealth: 6, enemyTurn: true },
  { name: 'Поражение', deck: ['guard'], plays: [], heroHealth: 3, enemyTurn: true },
  { name: 'Гибридный ход', deck: ['guard', 'thunderbolt', 'sword-strike'], plays: ['guard', 'thunderbolt', 'sword-strike'], enemyTurn: true },
]

export function runCombatScenario(scenario: CombatScenario, seed = 42) {
  const encounter = { ...encounters[2]!, maxHealth: scenario.enemyHealth ?? 46 }
  const state = createBattle(encounter, undefined, { seed, deck: scenario.deck, openingHandSize: scenario.deck.length })
  if (scenario.heroHealth !== undefined) state.heroes[encounter.behavior.phase1[0]!.kind === 'attack' ? encounter.behavior.phase1[0]!.target : 'warrior'].health = scenario.heroHealth
  const outcomes = scenario.plays.map(definitionId => {
    const card = state.hand.find(instance => instance.definitionId === definitionId)
    return playCard(state, card?.instanceId ?? 'missing')
  })
  const statusesAfterCards = state.enemy.vulnerable ? ['vulnerability'] : []
  if (scenario.enemyTurn) endTurn(state)
  return {
    name: scenario.name, seed,
    damage: encounter.maxHealth - state.enemy.health,
    health: { varian: state.heroes.warrior.health, jaina: state.heroes.mage.health },
    manaSpent: outcomes.reduce((sum, result, index) => sum + (result.ok ? cardDefinition(scenario.plays[index]!).cost : 0), 0),
    drawn: outcomes.reduce((sum, result) => sum + (result.ok ? result.drawn : 0), 0),
    rejected: outcomes.flatMap(result => result.ok ? [] : [result.reason]),
    statusesAfterCards, result: state.result,
  }
}

export type StrategyName = 'aggressive' | 'defensive' | 'mixed'
export interface StrategyResult { strategy: StrategyName; encounter: string; seed: number; turns: number; damage: number; hp: { warrior: number; mage: number }; result: string; choices: string[] }

/** Deterministic, headless comparison using actual draw, vulnerability, armor, and enemy rules. */
export function runStrategyComparison(seed = 42): StrategyResult[] {
  const strategies: StrategyName[] = ['aggressive', 'defensive', 'mixed']
  return encounters.map(encounter => strategies.map(strategy => {
    const state = createBattle(encounter, undefined, { seed, deck: [...startingDeck, 'quick-cut', 'thunderbolt', 'bastion'], openingHandSize: 4 })
    const choices: string[] = []
    for (let turn = 0; turn < 12 && !state.result; turn += 1) {
      let safety = 0
      while (safety++ < 8 && !state.result) {
        const forecast = forecastEnemyAction(state)
        const incoming = forecast.targets.length ? forecast.targets : forecast.futureTargets
        const threatened = new Set(incoming.map(hit => hit.target))
        const candidates = state.hand.map((instance, index) => {
          const card = cardDefinition(instance.definitionId)
          const preview = previewCard(state, card)
          const armorValue = (['warrior', 'mage'] as const).reduce((sum, hero) => sum + preview.armor[hero] * (threatened.has(hero) ? 1 : 0.12), 0)
          const damage = preview.healthDamage + preview.armorDamage * 0.35
          const synergyValue = preview.bonusDamage * 0.35 + preview.draw * 0.55 + preview.bonuses.length * 0.25
          const score = strategy === 'aggressive'
            ? damage + synergyValue - card.cost * 0.3 + (card.kind === 'defense' ? -1 : 0)
            : strategy === 'defensive'
              ? armorValue * (incoming.some(hit => hit.attack >= 7) ? 1.6 : 1.15) + damage * 0.28 + synergyValue * 0.5 - card.cost * 0.15
              : damage * 0.72 + armorValue * 1.15 + synergyValue - card.cost * 0.18
          return { instance, card, index, score }
        }).filter(item => item.card.cost <= state.mana).sort((a, b) => b.score - a.score || a.index - b.index)
        const choice = candidates[0]
        if (!choice || choice.score <= 0.1) break
        const played = playCard(state, choice.instance.instanceId)
        if (!played.ok) break
        choices.push(choice.card.name)
      }
      if (!state.result) endTurn(state)
    }
    return { strategy, encounter: encounter.id, seed, turns: state.turn, damage: encounter.maxHealth - state.enemy.health, hp: { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }, result: state.result ?? 'ongoing', choices }
  }))
    .flat()
}
