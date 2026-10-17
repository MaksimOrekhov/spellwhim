import type { ResearchConfig } from './core'
import type { CardDefinition, CardId } from '../../src/game/types'

/**
 * Concept cards for the 3–5 mana range, expressed with existing effect types only.
 * They exist to test the *economy* (does extra mana have something worth buying?), not as proposed content.
 * Each card does something a cheaper card cannot do: it sets up or cashes in links in bulk.
 */
const id = (value: string) => value as CardId
export const conceptCards: CardDefinition[] = [
  {
    // Bridge: cashes a mark (strike tag) AND opens the resonance in one card. Class-crossing combo as a single play.
    id: id('concept-blade-and-flame'), name: '[К] Клинок и пламя', className: 'warrior', cost: 3,
    description: '8 урона, 4 брони цели. Расходует метку Лиры. Создаёт резонанс.', icon: '⚔', kind: 'attack', tags: ['strike'],
    effects: [{ type: 'damage', amount: 8 }, { type: 'armor', amount: 4, target: 'threatened' }, { type: 'status', status: 'resonance', durationTurns: 1 }],
  },
  {
    // Finisher spell: pays for burst, leaves a mark so the next strike this turn is amplified.
    id: id('concept-arcane-barrage'), name: '[К] Арканный шквал', className: 'mage', cost: 4,
    description: '12 урона, добор. Расходует резонанс. Создаёт метку.', icon: '✹', kind: 'spell', tags: ['offensive-spell'],
    effects: [{ type: 'damage', amount: 12 }, { type: 'draw', amount: 1 }, { type: 'status', status: 'mark', durationTurns: 1 }],
  },
  {
    // Defensive anchor: big cover for both heroes that also opens the resonance.
    id: id('concept-oath-of-the-wall'), name: '[К] Клятва стены', className: 'warrior', cost: 3,
    description: '8 брони цели, 5 — напарнику. Создаёт резонанс.', icon: '⬡', kind: 'defense', tags: ['defense'],
    effects: [{ type: 'armor', amount: 8, target: 'threatened' }, { type: 'armor', amount: 5, target: 'partner' }, { type: 'status', status: 'resonance', durationTurns: 1 }],
  },
  {
    // Setup engine: no damage, but arms BOTH links for the cards that follow in the same turn. Rewards big-mana turns.
    id: id('concept-battle-signal'), name: '[К] Сигнал к бою', className: 'mage', cost: 3,
    description: 'Добор 2. Создаёт метку и резонанс.', icon: '✦', kind: 'spell', tags: [],
    effects: [{ type: 'draw', amount: 2 }, { type: 'status', status: 'mark', durationTurns: 1 }, { type: 'status', status: 'resonance', durationTurns: 1 }],
  },
]
export const conceptIds: CardId[] = conceptCards.map(card => card.id)

/** Named experimental variants, applied on top of a mana model + enemy lever. */
export const variants: Record<string, Partial<ResearchConfig>> = {
  base: {},
  // Four concept cards added to the starting deck (18 -> 22 cards).
  concept: { extraCards: conceptCards, deckAdd: conceptIds },
  // Heavy hitters get pricier so spare mana has a job (fireball/shield-bash/bastion +1).
  costup: { costs: { fireball: 3, 'shield-bash': 3, bastion: 3 } },
  'concept-costup': { extraCards: conceptCards, deckAdd: conceptIds, costs: { fireball: 3, 'shield-bash': 3, bastion: 3 } },
  // Draw / hand variants.
  draw3: { draw: 3 },
  draw4: { draw: 4 },
  open6: { opening: 6 },
  open6draw3: { opening: 6, draw: 3 },
  'concept-draw3': { extraCards: conceptCards, deckAdd: conceptIds, draw: 3 },
  // Draw 2 for the first four turns, 3 from turn 5 on: the draw grows together with the mana curve.
  draw3late: { drawLate: { from: 5, extra: 1 } },
  'concept-costup-draw3': { extraCards: conceptCards, deckAdd: conceptIds, costs: { fireball: 3, 'shield-bash': 3, bastion: 3 }, draw: 3 },
}
