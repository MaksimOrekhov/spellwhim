// MODELS of mechanics the engine does not have. Each factory returns hooks consumed by engine.mjs; they edit only cloned lab
// state. None of this is game code. Heuristics (what a bot keeps in reserve, how it values a draw) are stated where they occur.
//
// Hook summary:  init(s) · turnStart(s) · actions(E,s) -> [{key,apply(c)}] · variant(E,s,card,def) -> definitionId|null
//                afterPlay(E,s,def) · beforeEnd(E,s) · reserve(E,leaf) -> instanceIds · value(E,leaf,keep)

const ensure = s => (s.__x ??= {})

export function combine(...parts) {
  const hooks = {}
  for (const name of ['init', 'turnStart', 'afterPlay', 'beforeEnd']) {
    const fs = parts.map(p => p[name]).filter(Boolean)
    if (fs.length) hooks[name] = (...a) => fs.forEach(f => f(...a))
  }
  const acts = parts.map(p => p.actions).filter(Boolean)
  if (acts.length) hooks.actions = (E, s) => acts.flatMap(f => f(E, s))
  for (const name of ['variant', 'reserve']) { const f = parts.map(p => p[name]).find(Boolean); if (f) hooks[name] = f }
  const sts = parts.map(p => p.stats).filter(Boolean)
  if (sts.length) hooks.stats = s => Object.assign({}, ...sts.map(f => f(s)))
  const vals = parts.map(p => p.value).filter(Boolean)
  if (vals.length) hooks.value = (...a) => vals.reduce((t, f) => t + f(...a), 0)
  if (parts.some(p => p.orderSensitive)) hooks.orderSensitive = true
  return hooks
}

const impact = def => def.effects.reduce((t, e) => t + (e.type === 'damage' ? e.amount : e.type === 'armor' ? e.amount * 0.8 : e.type === 'draw' ? 2 : e.type === 'status' ? 2 : 0), 0)

/** Keep up to `n` unplayed cards through the end-of-turn discard (the "Резерв" slot). The bot keeps the highest-impact cards
 * it could not afford; a kept card is worth 60 % of its impact next turn. */
export function reserve(n = 1) {
  const pickKeep = (E, leaf) => leaf.hand.map(c => ({ c, v: impact(E.progression.resolveCardDefinition(c)) })).sort((a, b) => b.v - a.v).slice(0, n).map(o => o.c.instanceId)
  return {
    reserve: pickKeep,
    value: (E, leaf, keep) => keep.reduce((t, id) => t + 0.6 * impact(E.progression.resolveCardDefinition(leaf.hand.find(c => c.instanceId === id) ?? { definitionId: 'guard' })), 0),
  }
}

/** "Срыв замаха": if the party removed at least `threshold` enemy health this turn while the enemy is preparing a strike,
 * the strike announced next turn is `cut` weaker. The windup size is hidden, so the bot only knows the rule. */
export function windupBreak({ threshold = 10, cut = 3 } = {}) {
  return {
    turnStart: s => { ensure(s).hp0 = s.enemy.health },
    stats: s => ({ windups: s.__x?.windups ?? 0, windupsBroken: s.__x?.broken ?? 0 }),
    beforeEnd: (E, s) => {
      if (s.result) return
      const a = s.enemy.nextAction
      if (a.kind === 'prepare') { s.__x.windups = (s.__x.windups ?? 0) + 1; if (s.__x.hp0 - s.enemy.health >= threshold) s.__x.broken = (s.__x.broken ?? 0) + 1 }
      if (a.kind === 'prepare' && s.__x.hp0 - s.enemy.health >= threshold) s.enemy.nextAction = { ...a, prepared: { ...a.prepared, damage: Math.max(1, a.prepared.damage - cut) } }
    },
  }
}

/** "Клятва": once per turn a hero may pay `hp` health for `mana` extra mana this turn. */
export function bloodPact({ hp = 3, mana = 2, perTurn = 1 } = {}) {
  return {
    turnStart: s => { ensure(s).pact = 0 },
    actions: (E, s) => (ensure(s).pact >= perTurn ? [] : ['warrior', 'mage'].filter(h => s.heroes[h].health > hp).map(h => ({ key: 'pact:' + h, apply: c => { c.heroes[h].health -= hp; c.mana += mana; ensure(c).pact += 1; ensure(c).paid = (ensure(c).paid ?? 0) + hp; return true } }))),
  }
}

/** Class-agnostic "always available" defence: per hero per turn, pay `cost` mana for `armor` armor. */
export function heroPowers({ armor = 3, cost = 1 } = {}) {
  return {
    turnStart: s => { ensure(s).powers = {} },
    actions: (E, s) => ['warrior', 'mage'].filter(h => !ensure(s).powers?.[h] && s.mana >= cost).map(h => ({ key: 'power:' + h, apply: c => { if (c.mana < cost) return false; c.mana -= cost; c.heroes[h].armor += armor; (ensure(c).powers ??= {})[h] = true; return true } })),
  }
}

/** Upper bound of a "team link": every card with a damage or armor number gets `bonus` more when the previous card of the turn
 * belonged to the other class. Real designs would flag only a few cards; if this ceiling does not change play, a subset will not. */
export function relay({ bonus = 2 } = {}) {
  const make = (E, d) => {
    const id = 'relay:' + d.id
    if (!E.types.cards.some(c => c.id === id)) {
      const v = structuredClone(d)
      v.id = id
      const eff = v.effects.find(e => e.type === 'damage' && !e.when) ?? v.effects.find(e => e.type === 'armor')
      if (eff) eff.amount += bonus
      E.types.cards.push(v)
    }
    return id
  }
  return {
    orderSensitive: true,
    turnStart: s => { ensure(s).lastClass = null },
    variant: (E, s, card, d) => (ensure(s).lastClass && ensure(s).lastClass !== d.className && d.effects.some(e => (e.type === 'damage' && !e.when) || e.type === 'armor') ? make(E, d) : null),
    afterPlay: (E, s, def) => { ensure(s).lastClass = def.className },
  }
}

/** Moves the boss's phase threshold from 50 % to `fraction` of its health (the engine flips at 50 %; this flips earlier and restarts the phase-2 cycle). */
export function phaseAt(fraction = 0.6) {
  const flip = s => { if (s.enemy.phase === 1 && s.enemy.behavior.phase2 && s.enemy.health <= fraction * s.enemy.maxHealth) { s.enemy.phase = 2; s.enemy.behaviorIndex = 0 } }
  return { turnStart: flip, afterPlay: (E, s) => flip(s) }
}

/** "Обвал": the moment the boss crosses into phase 2 it gains `armor` armor (capped at 8 like every enemy). The announced action is untouched. */
export function phaseArmor(armor = 6) {
  const flip = s => { if (s.enemy.phase === 2 && !ensure(s).flipped) { s.__x.flipped = true; s.enemy.armor = Math.min(8, s.enemy.armor + armor) } }
  return { afterPlay: (E, s) => flip(s), beforeEnd: (E, s) => flip(s) }
}
