import { writeFileSync } from 'node:fs'
// Experiment D: probability of assembling an archetype from card rewards (pure Monte Carlo; mirrors the 21-card reward pool).
const pool = ['parry', 'shield-bash', 'interpose', 'frostbolt', 'arcane-insight', 'ice-ward', 'quick-cut', 'thunderbolt', 'rend', 'reaping-blow', 'boil-blood', 'bastion', 'stance-strike', 'wound-clamp', 'covering-counter', 'crushing-swing', 'arcane-mark', 'ice-echo', 'frost-seal', 'blood-resonance']
if (!pool.includes('blood-resonance')) throw new Error('pool')
const full = [...pool]
const archetypes = {
  bleed: { cards: new Set(['rend', 'ice-echo', 'reaping-blow', 'blood-resonance', 'boil-blood', 'wound-clamp', 'frost-seal']), ok: d => count(d, ['rend', 'ice-echo']) >= 2 && count(d, ['reaping-blow', 'blood-resonance', 'boil-blood', 'wound-clamp', 'frost-seal']) >= 2 },
  armorPayoff: { cards: new Set(['thunderbolt', 'stance-strike']), ok: d => count(d, ['thunderbolt', 'stance-strike']) >= 3 },
}
const count = (deck, ids) => deck.filter(id => ids.includes(id)).length
let seed = 12345
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let v = seed; v = Math.imul(v ^ v >>> 15, v | 1); v ^= v + Math.imul(v ^ v >>> 7, v | 61); return ((v ^ v >>> 14) >>> 0) / 4294967296 }
const sample = (list, n) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, n) }
function trial(arch, rewards, elites, size, biased) {
  const deck = []
  const events = [...Array(rewards).fill(size), ...Array(elites).fill(5)]
  for (const n of events) {
    let offer = sample(full, n)
    // Deck-aware offers: once the deck holds an archetype card, one slot is redrawn from that archetype half the time.
    if (biased && deck.some(id => arch.cards.has(id)) && rand() < 0.5) offer[0] = sample([...arch.cards], 1)[0]
    const pick = offer.find(id => arch.cards.has(id))
    if (pick) deck.push(pick)
  }
  return arch.ok(deck)
}
const rows = []
for (const [name, arch] of Object.entries(archetypes)) for (const [label, rewards, elites] of [['текущий поход (≈4 обычн.+1 элита)', 4, 1], ['средний (≈9+3)', 9, 3], ['длинный (≈13+4)', 13, 4]]) for (const size of [3, 4]) for (const biased of [false, true]) {
  const n = 20000
  let ok = 0
  for (let i = 0; i < n; i += 1) ok += trial(arch, rewards, elites, size, biased) ? 1 : 0
  rows.push({ archetype: name, run: label, offer: size, deckAware: biased, chance: (100 * ok / n).toFixed(1) + '%' })
}
console.table(rows)
writeFileSync(new URL('./synergy-odds.json', import.meta.url), JSON.stringify(rows, null, 1))
