import { cardUpgrades, upgradedDefinition } from './cardUpgrades'
import { cardDefinition } from './types'
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

/** Shared admission boundary for rewards and replacements; future gold uniqueness belongs here. */
export function validateAcquisition(card: CardAcquisition): void {
  cardDefinition(card.definitionId)
  if (card.upgrade !== 0 && card.upgrade !== 1) throw new Error('Invalid card upgrade')
}

export function canUpgradeCard(card: Pick<PersistentCard, 'definitionId' | 'upgrade'>): boolean {
  return card.upgrade === 0 && Object.prototype.hasOwnProperty.call(cardUpgrades, card.definitionId)
}
