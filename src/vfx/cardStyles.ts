import type { CardDefinition, CardId } from '../game/types'
import type { GuardStyle, RuneSigil, School, StrikeStyle } from './types'

/**
 * Presentation only: which school a card belongs to and how its effects are drawn. The table is keyed by the stable card ID, so an
 * upgraded copy looks like its base card, and `Record<CardId, …>` makes the compiler ask for an entry whenever a card is added.
 * What a card DOES (damage, armor, statuses, draw) is never read from here; the plan takes that from the engine's preview.
 */
export interface CardVfxStyle {
  school: School
  /** How a damaging card reaches the enemy. */
  strike?: StrikeStyle
  /** How armor from this card is drawn on the hero who receives it. */
  guard?: GuardStyle
  /** The sigil of a card that does not hit. */
  rune?: RuneSigil
}

export const cardVfxStyles: Record<CardId, CardVfxStyle> = {
  'sword-strike': { school: 'physical', strike: 'slash' },
  'quick-cut': { school: 'physical', strike: 'lunge' },
  'crushing-swing': { school: 'physical', strike: 'cleave' },
  rend: { school: 'physical', strike: 'slash' },
  'reaping-blow': { school: 'physical', strike: 'cleave' },
  'stance-strike': { school: 'physical', strike: 'slash', guard: 'steel' },
  'shield-bash': { school: 'physical', strike: 'bash', guard: 'steel' },
  'ice-breaker': { school: 'physical', strike: 'slash' },
  guard: { school: 'physical', guard: 'steel' },
  parry: { school: 'physical', guard: 'steel', strike: 'lunge' },
  bastion: { school: 'physical', guard: 'steel' },
  interpose: { school: 'physical', guard: 'steel' },
  'covering-counter': { school: 'physical', guard: 'steel', strike: 'lunge' },
  'wound-clamp': { school: 'physical', guard: 'steel' },
  fireball: { school: 'fire', strike: 'fireball' },
  frostbolt: { school: 'frost', strike: 'frostbolt' },
  thunderbolt: { school: 'lightning', strike: 'lightning' },
  'frost-grip': { school: 'frost', strike: 'chill' },
  'ice-echo': { school: 'frost', strike: 'frostbolt' },
  'ice-ward': { school: 'frost', guard: 'frost' },
  'arcane-insight': { school: 'arcane', rune: 'insight' },
  'arcane-mark': { school: 'arcane', rune: 'mark' },
  'boil-blood': { school: 'blood', rune: 'heat' },
  'frost-seal': { school: 'frost', rune: 'seal' },
  'blood-resonance': { school: 'blood', strike: 'arcane-bolt' },
}

/** A card the table does not know yet still gets a sensible look from its class and shape instead of a wrong one. */
export function cardVfxStyle(card: Pick<CardDefinition, 'id' | 'className' | 'kind'>): CardVfxStyle {
  const known = cardVfxStyles[card.id]
  if (known) return known
  const mage = card.className === 'mage'
  if (card.kind === 'defense') return { school: mage ? 'arcane' : 'physical', guard: mage ? 'arcane' : 'steel' }
  if (card.kind === 'attack') return { school: 'physical', strike: 'slash' }
  return { school: 'arcane', strike: 'arcane-bolt', rune: 'insight' }
}
