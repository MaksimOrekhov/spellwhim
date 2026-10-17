import { createBattle } from './battle'
import { cards, startingDeck } from './types'
import { baselineEconomy, economyEncounters } from './economy'
import type { EconomyConfig } from './economy'
import { shuffle } from './deck'
import type { BattleState, CardDefinition, CardId, EncounterDefinition, Hero } from './types'

export interface CampaignBattleOptions {
  encounter?: EncounterDefinition
  heroes?: BattleState['heroes']
  deck?: readonly CardId[]
  seed?: number
  battleId?: string
  economy?: EconomyConfig
}

/** Shared campaign rules used by the playable app and the headless balance lab. */
export function createCampaignBattle(options: CampaignBattleOptions = {}): BattleState {
  const economy = options.economy ?? baselineEconomy
  return createBattle(options.encounter ?? economyEncounters(economy)[0]!, options.heroes, {
    deck: options.deck ?? startingDeck,
    seed: options.seed,
    battleId: options.battleId,
    economy,
  })
}

/** The encounters of the economy's enemy package (the v0.6 enemies for the standard game). */
export function campaignEncounters(economy: EconomyConfig = baselineEconomy): readonly EncounterDefinition[] {
  return economyEncounters(economy)
}

export function campaignEncounter(index: number, economy: EconomyConfig = baselineEconomy): EncounterDefinition | undefined {
  return campaignEncounters(economy)[index]
}

export function campaignRewards(): CardDefinition[] {
  return cards.filter(card => card.reward)
}

/** Seeded reward offer shared by the app and Balance Lab. */
export function campaignRewardOptions(battle: BattleState, count = 3): CardDefinition[] {
  const random = { rngState: (battle.rngState ^ 0x51f15e) >>> 0 }
  return shuffle(random, campaignRewards()).slice(0, Math.max(0, count))
}

export function addCampaignReward(deck: readonly CardId[], reward: CardDefinition): CardId[] {
  return [...deck, reward.id]
}

export type CampaignAdvance = { kind: 'reward'; nextEncounter: number } | { kind: 'complete' } | { kind: 'defeat' }

export function advanceCampaign(battle: BattleState, encounterIndex: number): CampaignAdvance {
  if (battle.result === 'defeat') return { kind: 'defeat' }
  if (battle.result !== 'victory') throw new Error('Campaign can advance only after a victory')
  return encounterIndex >= campaignEncounters(battle.economy).length - 1
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
