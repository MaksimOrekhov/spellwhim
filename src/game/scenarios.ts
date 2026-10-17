import { createBattle, endTurn, playCard } from './battle'
import { cardDefinition, encounters } from './types'
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
  { name: 'Маг → воин', deck: ['fireball', 'sword-strike', 'guard'], plays: ['fireball', 'sword-strike'], enemyTurn: true },
  { name: 'Воин → маг', deck: ['guard', 'fireball', 'sword-strike'], plays: ['guard', 'fireball'], enemyTurn: true },
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
  if (scenario.heroHealth !== undefined) state.heroes[encounter.intent].health = scenario.heroHealth
  const outcomes = scenario.plays.map(definitionId => {
    const card = state.hand.find(instance => instance.definitionId === definitionId)
    return playCard(state, card?.instanceId ?? 'missing')
  })
  const statusesAfterCards = Object.keys(state.statuses)
  if (scenario.enemyTurn) endTurn(state)
  return {
    name: scenario.name, seed,
    damage: encounter.maxHealth - state.enemy.health,
    health: { brann: state.heroes.warrior.health, lira: state.heroes.mage.health },
    manaSpent: outcomes.reduce((sum, result, index) => sum + (result.ok ? cardDefinition(scenario.plays[index]!).cost : 0), 0),
    drawn: outcomes.reduce((sum, result) => sum + (result.ok ? result.drawn : 0), 0),
    rejected: outcomes.flatMap(result => result.ok ? [] : [result.reason]),
    statusesAfterCards, result: state.result,
  }
}
