import { cardUpgrades, upgradedDefinition } from './cardUpgrades'
import { cardDefinition, goldCards } from './types'
import type { CardDefinition, CardInstance, PersistentCard } from './types'

/** The canonical combat, presentation and laboratory boundary for one copy. */
export function resolveCardDefinition(card: Pick<CardInstance, 'definitionId' | 'upgrade'>): CardDefinition {
  if (card.upgrade !== undefined && card.upgrade !== 0 && card.upgrade !== 1) throw new Error('Invalid card upgrade')
  const base = cardDefinition(card.definitionId)
  return card.upgrade === 1 ? upgradedDefinition(base) : base
}

export interface CardAcquisition {
  definitionId: PersistentCard['definitionId']
  upgrade: PersistentCard['upgrade']
}

export const isGoldCard = (definitionId: PersistentCard['definitionId']): boolean => cardDefinition(definitionId).rarity === 'gold'

/** Gold is unique by definition in the whole permanent deck (GDD §5.1), whatever its zone or level. */
export function goldCardsOwned(deck: readonly Pick<PersistentCard, 'definitionId'>[]): Set<PersistentCard['definitionId']> {
  return new Set(deck.map(card => card.definitionId).filter(isGoldCard))
}

/** The gold cards a deck can still be offered: everything in the gold catalogue it does not hold yet. */
export function availableGoldCards(deck: readonly Pick<PersistentCard, 'definitionId'>[]): CardDefinition[] {
  const owned = goldCardsOwned(deck)
  return goldCards.filter(card => !owned.has(card.id))
}

/** Shared admission boundary for rewards and replacements. */
export function validateAcquisition(card: CardAcquisition, deck: readonly Pick<PersistentCard, 'definitionId'>[] = []): void {
  cardDefinition(card.definitionId)
  if (card.upgrade !== 0 && card.upgrade !== 1) throw new Error('Invalid card upgrade')
  if (isGoldCard(card.definitionId) && (card.upgrade !== 0 || goldCardsOwned(deck).has(card.definitionId))) throw new Error('A gold card is unique in the deck and has no upgraded version')
}

export function canUpgradeCard(card: Pick<PersistentCard, 'definitionId' | 'upgrade'>): boolean {
  return card.upgrade === 0 && Object.prototype.hasOwnProperty.call(cardUpgrades, card.definitionId)
}
