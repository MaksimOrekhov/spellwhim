import { cardDefinition } from './types'
import type { CardDefinition, CardInstance, PersistentCard } from './types'

/** All combat/UI resolution of a copy goes through this boundary. Stage 2 supplies the real catalogue. */
export function resolveCardDefinition(card: Pick<CardInstance, 'definitionId' | 'upgrade'>): CardDefinition {
  if (card.upgrade) throw new Error('Улучшенная версия этой карты пока недоступна в бою.')
  return cardDefinition(card.definitionId)
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
