// Combat Foundations Review — research harness.
//
// Everything here plays through the REAL engine (createBattle / playCard / endTurn / forecastEnemyAction). The game files
// are never edited: rule variants are expressed as (a) a different EconomyConfig (mana curve, draw schedule, opening hand),
// (b) a thin wrapper around `endTurn` (discard the hand, clear armor) and (c) scaled copies of the encounter data.
// Mechanics that the engine does not have (reserve slot, blood pact, relay bonus, windup break ...) are MODELS in extras.mjs:
// small hooks that edit the cloned state. They are labelled as models in the report; none of them is game code.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

export async function loadEngine() {
  const server = await createServer({ root: REPO, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
  const load = name => server.ssrLoadModule('/src/game/' + name + '.ts')
  const [battle, types, economy, campaign, sector, progression, damage] = await Promise.all(['battle', 'types', 'economy', 'campaign', 'sectorContent', 'cardProgression', 'damage'].map(load))
  return { server, battle, types, economy, campaign, sector, progression, damage, close: () => server.close() }
}

// ---------------------------------------------------------------------------------------------------------------- rules

/**
 * A ruleset = what the engine cannot express through data alone.
 *  hand/draw/mana  : EconomyConfig fields (opening hand, cards per turn, mana curve; the last mana value repeats)
 *  discard         : unplayed cards go to the discard pile when the player ends the turn
 *  armor           : 'persist' (current game: armor stays until that hero is hit) | 'turn' (armor is cleared when the next player turn begins) | 'half' (halved, rounded down)
 *  extras          : modelled mechanics (extras.mjs)
 */
export function rules(id, spec) {
  return { id, label: spec.label ?? id, opening: spec.hand, draw: spec.draw ?? { perTurn: spec.hand }, mana: spec.mana, discard: spec.discard ?? true, armor: spec.armor ?? 'turn', extras: spec.extras ?? null, deck: spec.deck ?? null }
}

export function economyFor(E, r) {
  const base = E.economy.gameEconomy
  return { ...base, id: r.id, label: r.label, manaByTurn: [...r.mana], drawSchedule: { ...r.draw }, openingHand: r.opening, enemyHealthScale: 1 }
}

/** Plain-data copy of an encounter with scaled damage / health. Behaviour objects are copied, never shared with the game catalogue. */
export function scaleEncounter(enc, { dmg = 1, hp = 1, windup = 1 } = {}) {
  const e = structuredClone(enc)
  e.maxHealth = Math.max(1, Math.round(e.maxHealth * hp))
  const hit = (h, k = 1) => { if (h && 'damage' in h) h.damage = Math.max(1, Math.round(h.damage * dmg * k)) }
  const act = a => { if (a.kind === 'prepare') hit(a.prepared, windup); else hit(a) }
  e.behavior.phase1.forEach(act)
  e.behavior.phase2?.forEach(act)
  return e
}

/** End of the player's turn under a ruleset. `keepIds` are the cards a reserve rule keeps. Returns the same boolean as endTurn. */
export function endRound(E, s, r, keepIds = []) {
  if (r.discard && !s.result) {
    const keep = s.hand.filter(c => keepIds.includes(c.instanceId))
    s.discardPile.push(...s.hand.filter(c => !keepIds.includes(c.instanceId)))
    s.hand = keep
  }
  const ok = E.battle.endTurn(s)
  if (ok && !s.result && r.armor === 'turn') { s.heroes.warrior.armor = 0; s.heroes.mage.armor = 0 }
  if (ok && !s.result && r.armor === 'half') { s.heroes.warrior.armor = Math.floor(s.heroes.warrior.armor / 2); s.heroes.mage.armor = Math.floor(s.heroes.mage.armor / 2) }
  return ok
}

// ---------------------------------------------------------------------------------------------------------------- policy

/** score = (damage to the enemy) - lambda * (health lost) - low * (health below 10 left on a hero) + terminal values. lambda is the only "personality". */
export const POLICIES = {
  tempo: { name: 'tempo', lambda: 0.45, low: 0.5 },
  balanced: { name: 'balanced', lambda: 1.0, low: 0.5 },
  careful: { name: 'careful', lambda: 2.4, low: 0.5 },
}
/** Health a hero pays on purpose (a pact) counts this many times more than health the enemy takes: it cannot be played around later. */
export const PAID_FACTOR = 2
export const leafScore = (l, policy) => l.dmg + l.drawn * 1.3 + l.keepArmor + l.held + l.extra - policy.lambda * (l.hp + PAID_FACTOR * l.paid) - policy.low * l.lowPen + (l.victory ? 1e4 : 0) - (l.death ? 1e5 : 0)

const pureDamage = def => def.effects.every(e => e.type === 'damage' && !e.when) && !def.damageBonus
const pureArmor = def => def.effects.every(e => e.type === 'armor')
const sig = card => card.definitionId + ':' + (card.upgrade ?? 0)

/** Plays one card through the engine, optionally as a research variant definition; the instance gets its real id back afterwards. */
export function playOne(E, s, id, variant, x) {
  const card = s.hand.find(c => c.instanceId === id)
  const orig = card.definitionId
  if (variant) card.definitionId = variant
  const def = E.progression.resolveCardDefinition(card)
  const res = E.battle.playCard(s, id)
  for (const zone of [s.hand, s.discardPile, s.exhausted, s.drawPile]) for (const c of zone) if (c.instanceId === id) c.definitionId = orig
  if (res.ok) x?.afterPlay?.(E, s, def)
  return { res, def }
}

/**
 * Exhaustive search of the player's turn on copies of the live state.
 * Draw effects are not looked through: inside the search both piles are empty, so a draw card gives nothing and is valued by a
 * constant; the real draw happens when the first line is executed and the turn is re-planned. The order of the draw pile is never read.
 * With `discard` rules and no reserve only maximal lines are scored (playing one more card can never hurt when the hand is thrown away);
 * otherwise every prefix is a candidate, because holding a card back is a real option.
 */
export function planTurn(E, live, r, extra = {}) {
  const x = r.extras
  const root = structuredClone(live)
  root.drawPile = []; root.discardPile = []
  const maximalOnly = r.discard && !x?.reserve
  const cap = extra.maxNodes ?? 30000
  const leaves = []
  let nodes = 0
  const defOf = c => E.progression.resolveCardDefinition(c)

  function evaluate(s, seq, drawn) {
    const healthLost = root.enemy.health - s.enemy.health
    const armorStripped = Math.max(0, root.enemy.armor - s.enemy.armor)
    const leaf = structuredClone(s)
    x?.beforeEnd?.(E, leaf, root)
    const keep = !leaf.result && x?.reserve ? x.reserve(E, leaf) : []
    endRound(E, leaf, r, keep)
    const lost = { warrior: Math.max(0, root.heroes.warrior.health - leaf.heroes.warrior.health), mage: Math.max(0, root.heroes.mage.health - leaf.heroes.mage.health) }
    const victory = leaf.result === 'victory' || s.result === 'victory'
    const death = leaf.result === 'defeat'
    let keepArmor = 0
    if (r.armor === 'persist' && !leaf.result) {
      const nxt = leaf.enemy.nextAction
      const threat = nxt.kind === 'attack' ? [nxt.target] : nxt.kind === 'attack_all' ? ['warrior', 'mage'] : nxt.kind === 'prepare' && nxt.prepared.kind === 'attack' ? [nxt.prepared.target] : []
      for (const id of ['warrior', 'mage']) keepArmor += leaf.heroes[id].armor * (threat.includes(id) ? 0.9 : 0.4)
    }
    const paid = (s.__x?.paid ?? 0) - (root.__x?.paid ?? 0)
    const lowPen = Math.max(0, 10 - leaf.heroes.warrior.health) + Math.max(0, 10 - leaf.heroes.mage.health)
    leaves.push({ seq, paid, lowPen, dmg: healthLost + 0.3 * armorStripped, hp: lost.warrior + lost.mage, lost, drawn, keepArmor, held: r.discard ? 0 : leaf.hand.length * 0.35, extra: x?.value ? x.value(E, leaf, keep) : 0, victory, death, keep })
  }

  function dfs(s, seq, last, drawn) {
    nodes += 1
    const options = []
    if (!s.result && nodes < cap) {
      const seen = new Set()
      for (const card of s.hand) {
        const d = defOf(card)
        if (d.cost > s.mana) continue
        const variant = x?.variant ? x.variant(E, s, card, d) : null
        const key = sig(card) + (variant ? '*' : '')
        if (seen.has(key)) continue
        seen.add(key)
        options.push({ type: 'card', card, d, key, variant })
      }
      if (x?.actions) for (const a of x.actions(E, s)) options.push({ type: 'extra', ...a })
    }
    // Optional extras (a pact, a hero power) never force a line to continue: only playable cards do.
    if (!maximalOnly || !options.some(o => o.type === 'card')) evaluate(s, seq, drawn)
    for (const o of options) {
      if (o.type === 'card' && last?.type === 'card' && !o.variant && !last.variant && ((pureDamage(last.d) || pureArmor(last.d)) && (pureDamage(o.d) || pureArmor(o.d))) && o.key < last.key && !x?.orderSensitive) continue
      const c = structuredClone(s)
      let nDraw = 0
      if (o.type === 'card') {
        const { res } = playOne(E, c, o.card.instanceId, o.variant, x)
        if (!res.ok) continue
        nDraw = o.d.effects.filter(e => e.type === 'draw').reduce((a, e) => a + e.amount, 0)
        dfs2(c, [...seq, { kind: 'card', id: o.card.instanceId, key: o.key, variant: o.variant, draws: nDraw > 0 }], o, drawn + nDraw)
      } else {
        if (!o.apply(c)) continue
        dfs2(c, [...seq, { kind: 'extra', key: o.key, draws: false }], { type: 'extra', key: o.key }, drawn)
      }
    }
  }
  function dfs2(c, seq, last, drawn) { c.drawPile.length = 0; c.discardPile.length = 0; dfs(c, seq, last, drawn) }
  dfs(root, [], null, 0)
  return { leaves, nodes, truncated: nodes >= cap }
}

export const pick = (leaves, policy) => leaves.reduce((b, l) => (leafScore(l, policy) > leafScore(b, policy) ? l : b), leaves[0])

/** Tension of one decision: how much damage must be given up for safety. See report §4. */
export function tensionOf(leaves) {
  if (!leaves.length) return null
  const winning = leaves.some(l => l.victory)
  const minHp = Math.min(...leaves.map(l => l.hp))
  const maxD = Math.max(...leaves.map(l => l.dmg))
  const dSafe = Math.max(...leaves.filter(l => l.hp === minHp).map(l => l.dmg))
  const hpAtMax = Math.min(...leaves.filter(l => l.dmg === maxD).map(l => l.hp))
  const free = minHp === 0 && dSafe === maxD
  const unsafe = minHp > 0
  const picks = Object.values(POLICIES).map(p => pick(leaves, p))
  const distinct = new Set(picks.map(l => Math.round(l.dmg) + '/' + l.hp)).size
  return { winning, minHp, trade: maxD - dSafe, dHp: hpAtMax - minHp, free, unsafe, contested: !free && !unsafe, allDead: leaves.every(l => l.death), distinct, diverge: distinct > 1 }
}

// ---------------------------------------------------------------------------------------------------------------- battle

export function playBattle(E, { encounter, heroes, deck, seed, rules: r, policy, maxTurns = 40 }) {
  const x = r.extras
  const economy = economyFor(E, r)
  const s = E.campaign.createCampaignBattle({ encounter, heroes, deck, seed, economy, battleId: 'lab/' + seed })
  x?.init?.(s)
  const rec = { turns: 0, hpLost: { warrior: 0, mage: 0 }, enemyHits: 0, plays: 0, manaSpent: 0, manaAvail: 0, armorGiven: 0, tension: [], handAtStart: 0, playable: 0, bothClassTurns: 0, extraUses: 0, keptCards: 0, variantPlays: 0, xstats: null, p2: 0 }
  while (!s.result && rec.turns < maxTurns) {
    rec.turns += 1
    x?.turnStart?.(s)
    rec.manaAvail += s.mana
    rec.handAtStart += s.hand.length
    rec.playable += s.hand.filter(c => E.progression.resolveCardDefinition(c).cost <= s.mana).length
    const hitting = s.enemy.nextAction.kind === 'attack' || s.enemy.nextAction.kind === 'attack_all'
    let first = true
    let keep = []
    const classes = new Set()
    for (let guard = 0; guard < 40 && !s.result; guard += 1) {
      const plan = planTurn(E, s, r)
      if (first && hitting) { const t = tensionOf(plan.leaves); if (t && !t.winning) rec.tension.push(t) }
      first = false
      const best = pick(plan.leaves, policy)
      keep = best.keep ?? []
      if (!best || best.seq.length === 0) break
      let replan = false
      for (const step of best.seq) {
        if (step.kind === 'card') {
          const manaBefore = s.mana
          const armorBefore = s.heroes.warrior.armor + s.heroes.mage.armor
          const { res, def } = playOne(E, s, step.id, step.variant, x)
          if (!res.ok) throw new Error('illegal play ' + step.key + ' ' + res.reason)
          if (step.variant) rec.variantPlays += 1
          rec.plays += 1; rec.manaSpent += manaBefore - s.mana
          rec.armorGiven += Math.max(0, s.heroes.warrior.armor + s.heroes.mage.armor - armorBefore)
          classes.add(def.className)
        } else {
          const a = x.actions(E, s).find(o => o.key === step.key)
          if (!a || !a.apply(s)) throw new Error('illegal extra ' + step.key)
          rec.extraUses += 1
        }
        if (step.draws) { replan = true; break }
      }
      if (!replan) break
    }
    if (classes.size === 2) rec.bothClassTurns += 1
    if (s.result) break
    const before = { warrior: s.heroes.warrior.health, mage: s.heroes.mage.health }
    if (hitting) rec.enemyHits += 1
    if (s.enemy.nextActionPhase === 2) rec.p2 += 1
    x?.beforeEnd?.(E, s, null)
    if (keep.length) rec.keptCards += keep.length
    endRound(E, s, r, keep)
    rec.hpLost.warrior += Math.max(0, before.warrior - s.heroes.warrior.health)
    rec.hpLost.mage += Math.max(0, before.mage - s.heroes.mage.health)
  }
  rec.xstats = x?.stats ? x.stats(s) : null
  rec.paid = s.__x?.paid ?? 0
  rec.result = s.result ?? 'timeout'
  rec.heroesEnd = { warrior: s.heroes.warrior.health, mage: s.heroes.mage.health }
  rec.final = s
  return rec
}

export function summarizeTension(list) {
  const n = list.length
  if (!n) return { n: 0 }
  const avg = f => list.reduce((a, t) => a + f(t), 0) / n
  return { n, pctFree: avg(t => +t.free), pctUnsafe: avg(t => +t.unsafe), pctContested: avg(t => +t.contested), meanTrade: avg(t => t.trade), meanDHp: avg(t => t.dHp), pctAllDead: avg(t => +t.allDead), pctDiverge: avg(t => +t.diverge) }
}
