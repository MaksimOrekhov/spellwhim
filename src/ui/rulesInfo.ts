import { inject, provide } from 'vue'
import type { InjectionKey } from 'vue'
import type { EconomyConfig } from '../game/economy'
import { defaultRulesMode } from '../game/rulesMode'

/**
 * What the screens need to know about the battle rules to tell the truth in their hints. A component shown without a provider
 * (a dev laboratory page, a test) speaks about the game itself: B2 Long, the default since Decision Log X04.
 */
export interface RulesInfo {
  /** Unplayed cards are discarded when the turn ends. */
  discardsHand: boolean
  /** Hero armor is cleared once the enemy action has resolved, instead of waiting for a hit. */
  armorExpires: boolean
  openingHand: number
  /** The most mana a turn gives (the whole pool under the flat curve of the default game). */
  mana: number
  /** The B1 enemy rules: the sector's enemies carry pierce, interrupt, mark and rage. */
  newThreats: boolean
  /** The Frost and Steel cards are in the deck. */
  frost: boolean
}

const key: InjectionKey<RulesInfo> = Symbol('battle-rules')

export const rulesInfoOf = (economy: Pick<EconomyConfig, 'discardHand' | 'armorExpiry' | 'openingHand' | 'manaByTurn'> & { sectorFoes?: EconomyConfig['sectorFoes'] }, extra: { frost?: boolean } = {}): RulesInfo =>
  ({ discardsHand: economy.discardHand === true, armorExpires: economy.armorExpiry === 'turn', openingHand: economy.openingHand, mana: Math.max(...economy.manaByTurn), newThreats: economy.sectorFoes !== undefined, frost: extra.frost === true })
const gameRules: RulesInfo = rulesInfoOf(defaultRulesMode.economy!, { frost: defaultRulesMode.frost === true })
export const provideRules = (info: RulesInfo): void => provide(key, info)
export const useRules = (): RulesInfo => inject(key, gameRules)

/** The armor tooltip of a health plate. Enemy armor never expires: it stays until card damage breaks it, and Bleeding goes past it. */
export function armorNote(side: 'hero' | 'enemy', rules: Pick<RulesInfo, 'armorExpires'>): string {
  if (side === 'enemy') return 'Поглощает урон карт и держится, пока её не пробьют; урон Кровотечения она не поглощает. Запас брони врага — не больше 8.'
  return rules.armorExpires ? 'Поглощает урон. Исчезает, когда враг закончит свой ход, — даже если по этому герою не били.' : 'Поглощает урон. Остаток исчезает после атаки по этому герою.'
}
