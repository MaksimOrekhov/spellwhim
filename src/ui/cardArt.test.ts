import { describe, expect, it } from 'vitest'
import { cards } from '../game/types'
import { cardArt } from './cardArt'

const files = Object.keys(import.meta.glob('../assets/art/*.{png,webp}'))

/** Card IDs deliberately without Krea art (none today); keep the reason next to the ID. */
const missingKreaArt: readonly string[] = []

describe('card art registry', () => {
  it('maps every card to its own Krea WebP', () => {
    for (const card of cards) {
      if (missingKreaArt.includes(card.id)) continue
      const src = cardArt[card.id]
      expect(src, card.id).toBeTruthy()
      expect(src, card.id).toContain(`${card.id}-krea`)
      expect(src, card.id).toMatch(/\.webp/)
    }
  })

  it('never shares one illustration between cards', () => {
    const sources = cards.map(card => cardArt[card.id]).filter(Boolean)
    expect(new Set(sources).size).toBe(sources.length)
  })

  it('keeps source PNGs and optimized WebPs on disk', () => {
    for (const card of cards) {
      expect(files.includes(`../assets/art/${card.id}.png`), `${card.id}.png`).toBe(true)
      expect(files.includes(`../assets/art/${card.id}-krea.webp`), `${card.id}-krea.webp`).toBe(true)
    }
  })
})
