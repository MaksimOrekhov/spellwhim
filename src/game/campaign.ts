import { createBattle } from './battle'
import { cards, encounters, startingDeck } from './types'
import type { BattleState, CardDefinition, CardId, EncounterDefinition, Hero } from './types'

export interface CampaignBattleOptions {
  encounter?: EncounterDefinition
  heroes?: BattleState['heroes']
  deck?: readonly CardId[]
  seed?: number
  battleId?: string
}

/** Shared campaign rules used by the playable app and the headless balance lab. */
export function createCampaignBattle(options: CampaignBattleOptions = {}): BattleState {
  return createBattle(options.encounter ?? encounters[0]!, options.heroes, {
    deck: options.deck ?? startingDeck,
    seed: options.seed,
    battleId: options.battleId,
  })
}

export function campaignEncounter(index: number): EncounterDefinition | undefined {
  return encounters[index]
}

export function campaignRewards(): CardDefinition[] {
  return cards.filter(card => card.reward)
}

export function addCampaignReward(deck: readonly CardId[], reward: CardDefinition): CardId[] {
  return [...deck, reward.id]
}

export type CampaignAdvance = { kind: 'reward'; nextEncounter: number } | { kind: 'complete' } | { kind: 'defeat' }

export function advanceCampaign(battle: BattleState, encounterIndex: number): CampaignAdvance {
  if (battle.result === 'defeat') return { kind: 'defeat' }
  if (battle.result !== 'victory') throw new Error('Campaign can advance only after a victory')
  return encounterIndex >= encounters.length - 1
    ? { kind: 'complete' }
    : { kind: 'reward', nextEncounter: encounterIndex + 1 }
}

export function carriedHeroes(battle: BattleState): BattleState['heroes'] {
  return {
    warrior: { ...battle.heroes.warrior, armor: 0 },
    mage: { ...battle.heroes.mage, armor: 0 },
  }
}

export function heroHealth(heroes: BattleState['heroes']): Pick<Hero, 'health' | 'maxHealth'> {
  return { health: heroes.warrior.health + heroes.mage.health, maxHealth: heroes.warrior.maxHealth + heroes.mage.maxHealth }
}
