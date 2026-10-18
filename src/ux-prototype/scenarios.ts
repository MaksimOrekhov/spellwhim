// Fixtures for the UX prototype. They are built with the REAL engine (createCampaignBattle, previewCard,
// forecastEnemyAction) so every number on screen follows the current v0.8 rules; only the starting situation
// (hand, mana, status, health) is staged by hand. Nothing in src/game is modified.
import { createCampaignBattle } from '../game/campaign'
import { economyEncounters, gameEconomy, manaForTurn } from '../game/economy'
import type { BattleState, CardId, CardInstance, EnemyAction } from '../game/types'

export type ScenarioId = 'normal' | 'synergy' | 'ten' | 'swarm'

export interface ScenarioMeta { id: ScenarioId; label: string; hint: string }
export const scenarioList: ScenarioMeta[] = [
  { id: 'normal', label: 'Обычный ход', hint: 'Ход 1 · 8 карт · Джайна под прицелом' },
  { id: 'synergy', label: 'Синергия', hint: 'Уязвим враг + броня Джайны · бонусы активны' },
  { id: 'ten', label: 'Рука из 10', hint: 'Ход 5 · максимум руки · часть карт недоступна' },
  { id: 'swarm', label: 'Босс · фаза II', hint: 'Массовая атака · оба героя под угрозой' },
]

const encounters = economyEncounters(gameEconomy)

function stage(id: string, encounterIndex: number, turn: number, hand: CardId[], drawLeft: number, discard: number): BattleState {
  const state = createCampaignBattle({ encounter: encounters[encounterIndex]!, seed: 7, battleId: 'proto/' + id })
  const instances: CardInstance[] = hand.map((definitionId, index) => ({ instanceId: `proto/${id}/${index}`, definitionId }))
  state.hand = instances
  state.turn = turn
  state.maxMana = manaForTurn(state.economy, turn)
  state.mana = state.maxMana
  state.drawPile = state.drawPile.slice(0, drawLeft)
  // Fill the discard counter with plausible instances so the pile icon is not empty.
  state.discardPile = Array.from({ length: discard }, (_, i): CardInstance => ({ instanceId: `proto/${id}/discard/${i}`, definitionId: 'sword-strike' }))
  return state
}

function setAction(state: BattleState, action: EnemyAction, focus: 'warrior' | 'mage') {
  state.enemy.nextAction = action
  state.enemy.focus = focus
}

export function buildScenario(id: ScenarioId): BattleState {
  if (id === 'synergy') {
    // Turn 3: the enemy is Vulnerable, Jaina has armor → Frostbolt/Thunderbolt/Fireball/Strike all carry bonuses.
    const s = stage(id, 0, 3, ['frostbolt', 'thunderbolt', 'shield-bash', 'sword-strike', 'fireball', 'guard', 'interpose', 'arcane-insight'], 6, 4)
    s.mana = 4
    s.enemy.health = 41
    s.enemy.vulnerable = true
    s.enemy.armor = 3
    s.heroes.mage.health = 9
    s.heroes.mage.armor = 3
    s.heroes.warrior.health = 21
    setAction(s, { kind: 'attack', name: 'Удар корнями', damage: 6, target: 'mage' }, 'mage')
    return s
  }
  if (id === 'ten') {
    const s = stage(id, 1, 5, ['sword-strike', 'frostbolt', 'bastion', 'fireball', 'quick-cut', 'ice-ward', 'thunderbolt', 'parry', 'shield-bash', 'arcane-insight'], 4, 7)
    s.mana = 1
    s.enemy.health = 58
    s.heroes.warrior.health = 17
    s.heroes.mage.health = 14
    s.enemy.nextAction = { kind: 'prepare', name: 'Тяжёлый удар', prepared: { kind: 'attack', name: 'Сокрушающий удар', damage: 10, target: 'warrior' } }
    s.enemy.focus = 'warrior'
    return s
  }
  if (id === 'swarm') {
    const s = stage(id, 2, 6, ['fireball', 'frostbolt', 'guard', 'bastion', 'sword-strike', 'ice-ward', 'thunderbolt', 'parry'], 3, 9)
    s.enemy.phase = 2
    s.enemy.nextActionPhase = 2
    s.enemy.health = 47
    s.enemy.armor = 5
    s.heroes.warrior.health = 12
    s.heroes.mage.health = 6
    setAction(s, { kind: 'attack_all', name: 'Всплеск сердца', damage: 4, primaryTarget: 'mage' }, 'mage')
    return s
  }
  const s = stage(id, 0, 1, ['sword-strike', 'guard', 'shield-bash', 'parry', 'frostbolt', 'fireball', 'thunderbolt', 'ice-ward'], 10, 0)
  setAction(s, { kind: 'attack', name: 'Удар корнями', damage: 6, target: 'mage' }, 'mage')
  return s
}
