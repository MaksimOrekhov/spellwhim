import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'
import type { EconomyConfig } from '../game/economy'

/**
 * What the screens need to know about the battle rules to tell the truth in their hints. The standard game is the default,
 * so a component that is shown without a provider (a lab page, a test) keeps today's wording.
 */
export interface RulesInfo {
  /** Unplayed cards are discarded when the turn ends. */
  discardsHand: boolean
  /** Hero armor is cleared once the enemy action has resolved, instead of waiting for a hit. */
  armorExpires: boolean
  openingHand: number
  /** EXPERIMENT B1: the sector's enemies carry pierce, interrupt, mark and rage. */
  newThreats: boolean
  /** EXPERIMENT B2: the Frost and Steel cards are in the deck. */
  frost: boolean
}

const standard: RulesInfo = { discardsHand: false, armorExpires: false, openingHand: 8, newThreats: false, frost: false }
const key: InjectionKey<RulesInfo> = Symbol('battle-rules')

export const rulesInfoOf = (economy: Pick<EconomyConfig, 'discardHand' | 'armorExpiry' | 'openingHand'> & { sectorFoes?: EconomyConfig['sectorFoes'] }, extra: { frost?: boolean } = {}): RulesInfo =>
  ({ discardsHand: economy.discardHand === true, armorExpires: economy.armorExpiry === 'turn', openingHand: economy.openingHand, newThreats: economy.sectorFoes !== undefined, frost: extra.frost === true })
export const provideRules = (info: RulesInfo): void => provide(key, info)
export const useRules = (): RulesInfo => inject(key, standard)
