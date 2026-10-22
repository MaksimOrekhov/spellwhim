import type { CardId } from './types'
import { cardDefinition } from './types'

/**
 * EXPERIMENT "Honest Turn B": starting-deck variants for the armor-source study (docs/design/honest-turn-b-experiment-v1.md §5).
 * The standard deck has 18 cards and 10 of them make armor (guard, parry, shield-bash, interpose, ice-ward, two copies each).
 * Every variant keeps 18 cards and the 10 : 8 split between Varian's and Jaina's classes; a variant only trades armor cards
 * for plain attacks of the SAME class, so what changes is how often the hand holds protection, never who owns the cards.
 *  - armor10: the standard deck;
 *  - armor8: one Guard and one Ice Ward become a Sword Strike and a Fireball;
 *  - armor6: both Guards and one Interpose become Sword Strikes, one Ice Ward becomes a Fireball.
 * The B2 package ("Мороз и сталь") then swaps two Arcane Insights for two Frost Grips and two Sword Strikes for two Ice Breakers.
 */
export type DeckVariantId = 'armor10' | 'armor8' | 'armor6'
export const deckVariantIds: readonly DeckVariantId[] = ['armor10', 'armor8', 'armor6']

const copies = (counts: Partial<Record<CardId, number>>): CardId[] =>
  (Object.entries(counts) as [CardId, number][]).flatMap(([id, count]) => Array.from({ length: count }, () => id))

export const deckVariants: Record<DeckVariantId, readonly CardId[]> = {
  armor10: copies({ 'sword-strike': 2, fireball: 2, guard: 2, parry: 2, 'shield-bash': 2, interpose: 2, frostbolt: 2, 'arcane-insight': 2, 'ice-ward': 2 }),
  armor8: copies({ 'sword-strike': 3, fireball: 3, guard: 1, parry: 2, 'shield-bash': 2, interpose: 2, frostbolt: 2, 'arcane-insight': 2, 'ice-ward': 1 }),
  armor6: copies({ 'sword-strike': 5, fireball: 3, parry: 2, 'shield-bash': 2, interpose: 1, frostbolt: 2, 'arcane-insight': 2, 'ice-ward': 1 }),
}

/** Cards that create armor for anyone (the number the study varies). */
export const armorSources = (deck: readonly CardId[]): number => deck.filter(id => cardDefinition(id).effects.some(effect => effect.type === 'armor')).length

/** The Frost and Steel swap: the same deck with the two B2 cards in it. */
export function withFrost(deck: readonly CardId[]): CardId[] {
  const swap = (cards: CardId[], from: CardId, to: CardId, count: number): CardId[] => {
    let left = count
    return cards.map(id => (id === from && left > 0 ? (left--, to) : id))
  }
  return swap(swap([...deck], 'arcane-insight', 'frost-grip', 2), 'sword-strike', 'ice-breaker', 2)
}

export const honestDeck = (variant: DeckVariantId, frost: boolean): CardId[] => frost ? withFrost(deckVariants[variant]) : [...deckVariants[variant]]
export const isDeckVariant = (value: unknown): value is DeckVariantId => typeof value === 'string' && (deckVariantIds as readonly string[]).includes(value)
