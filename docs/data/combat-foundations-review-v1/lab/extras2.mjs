// Second batch of modelled mechanics: "Ослабление" (a Weak-style enemy status) and "Строй" (Roguebook-style front/back by last actor).
// Same contract as extras.mjs: hooks that edit cloned lab state only; none of this is game code.
import { combine } from './extras.mjs'

const ensure = s => (s.__x ??= {})
const other = h => (h === 'warrior' ? 'mage' : 'warrior')

/** Research-only card definitions, registered into the module's catalogue of the current process. */
export function registerCards(E, defs) {
  for (const d of defs) if (!E.types.cards.some(c => c.id === d.id)) E.types.cards.push(d)
}

export const CHILL = {
  id: 'chill', name: 'Ледяное оцепенение', className: 'mage', cost: 1, kind: 'spell', tags: [], icon: '❄', reward: true,
  description: 'Ослабляет врага: его следующая атака наносит на 3 меньше (расходуется на атаке, сохраняется в тихие ходы).',
  effects: [{ type: 'draw', amount: 0 }],
}
export const CHILL_BOLT = {
  id: 'chill-bolt', name: 'Морозный росчерк', className: 'mage', cost: 1, kind: 'spell', tags: ['offensive-spell'], icon: '❄', reward: true,
  description: '3 урона. Ослабляет врага (его следующая атака −3).',
  effects: [{ type: 'damage', amount: 3 }],
}

export const PUNISH = {
  id: 'punish', name: 'Добить ослабленного', className: 'warrior', cost: 1, kind: 'attack', tags: ['strike'], icon: '⚔', reward: true,
  description: '5 урона. По ослабленному врагу — 9.',
  effects: [{ type: 'damage', amount: 5 }],
}
export const PUNISH_PLUS = { ...PUNISH, id: 'punish+', effects: [{ type: 'damage', amount: 9 }] }
/** Status handshake: a Warrior card that is stronger while the Mage's Weak is on the enemy. */
export function punish() {
  return { variant: (E, s, card, d) => (d.id === 'punish' && s.__x?.weak ? 'punish+' : null), orderSensitive: true }
}
export function swapDeck(base, pairs) {
  const deck = [...base]
  for (const [from, to, n] of pairs) for (let i = 0, k = 0; i < deck.length && k < n; i++) if (deck[i] === from) { deck[i] = to; k++ }
  return deck
}

/**
 * Weak-style status on the enemy: cards whose id is in `sources` put it on; the enemy's next damaging action is reduced by `cut` per hit
 * and the status is spent. It is NOT cleared by the quiet actions (prepare / defend / recover), so it survives the armor-clear rule,
 * which is the point: it lets the party invest in a coming strike during the windup turn.
 */
export function weak({ cut = 3, sources = ['chill', 'chill-bolt'] } = {}) {
  return {
    turnStart: s => { ensure(s) },
    afterPlay: (E, s, def) => { if (sources.includes(def.id)) ensure(s).weak = 1 },
    beforeEnd: (E, s) => {
      if (s.result || !ensure(s).weak) return
      const a = s.enemy.nextAction
      if (a.kind === 'attack' || a.kind === 'attack_all') { s.enemy.nextAction = { ...a, damage: Math.max(0, a.damage - cut) }; s.__x.weak = 0; s.__x.weakUsed = (s.__x.weakUsed ?? 0) + 1 }
    },
    stats: s => ({ weakUsed: s.__x?.weakUsed ?? 0 }),
  }
}

/**
 * Formation: the hero who acted last stands in front. An enemy attack whose data target is the warrior is a "front" attack and one whose
 * target is the mage is a "back" attack, so with the Warrior in front the game is exactly the current one. Playing a card of the other
 * class puts that hero in front and swaps who receives each kind of attack. `swapCost` > 0 adds a paid "swap" action.
 */
export function formation({ swapCost = 0 } = {}) {
  const resolve = (s, role) => (ensure(s).front === 'mage' ? other(role) : role)
  const sync = s => {
    const a = s.enemy.nextAction
    const h = a.kind === 'prepare' ? a.prepared : a
    if (h.kind === 'attack') s.enemy.focus = resolve(s, h.target)
    else if (h.kind === 'attack_all') s.enemy.focus = resolve(s, h.primaryTarget)
  }
  return {
    orderSensitive: true,
    init: s => { ensure(s).front = 'warrior' },
    turnStart: s => sync(s),
    afterPlay: (E, s, def) => { ensure(s).front = def.className === 'mage' ? 'mage' : 'warrior'; sync(s) },
    actions: (E, s) => (swapCost > 0 && s.mana >= swapCost ? [{ key: 'swap', apply: c => { c.mana -= swapCost; ensure(c).front = other(ensure(c).front); sync(c); return true } }] : []),
    beforeEnd: (E, s) => {
      if (s.result) return
      const a = s.enemy.nextAction
      if (a.kind === 'attack') s.enemy.nextAction = { ...a, target: resolve(s, a.target) }
      else if (a.kind === 'attack_all') s.enemy.nextAction = { ...a, primaryTarget: resolve(s, a.primaryTarget) }
    },
  }
}

/** Soft cap for banked armor: nothing above `cap` stays on a hero after a card (models "armor is capped at N"). */
export function armorCap(cap) {
  return { afterPlay: (E, s) => { for (const h of ['warrior', 'mage']) if (s.heroes[h].armor > cap) s.heroes[h].armor = cap } }
}

export { combine }
