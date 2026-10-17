import type { BattleState, CardInstance } from './types'

// Mulberry32: the RNG state is part of the battle, so a seed replays every shuffle.
function nextRandom(state: BattleState): number {
  state.rngState = (state.rngState + 0x6d2b79f5) >>> 0
  let value = state.rngState
  value = Math.imul(value ^ value >>> 15, value | 1)
  value ^= value + Math.imul(value ^ value >>> 7, value | 61)
  return ((value ^ value >>> 14) >>> 0) / 4294967296
}

export function shuffle(state: BattleState, cards: readonly CardInstance[]): CardInstance[] {
  const deck = [...cards]
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const other = Math.floor(nextRandom(state) * (index + 1))
    ;[deck[index], deck[other]] = [deck[other]!, deck[index]!]
  }
  return deck
}

export function drawCards(state: BattleState, count: number): CardInstance[] {
  if (state.result) return []
  const drawn: CardInstance[] = []
  for (let index = 0; index < count; index += 1) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break
      state.drawPile = shuffle(state, state.discardPile)
      state.discardPile = []
    }
    const card = state.drawPile.shift()
    if (!card) break
    state.hand.push(card)
    drawn.push(card)
  }
  return drawn
}

export function discardHand(state: BattleState): void {
  state.discardPile.push(...state.hand)
  state.hand = []
}
