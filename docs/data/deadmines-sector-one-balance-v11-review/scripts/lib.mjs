// Independent review library for Sector I balance v1.1.
// Battles run only through the real engine (createCampaignBattle, playCard, endTurn). Variant enemy
// definitions are installed in memory; game sources are never written.
import { readFileSync } from 'node:fs'

export const MODULES = ['campaign', 'sectorContent', 'battle', 'balance', 'balancePlanner', 'cardProgression', 'types', 'economy', 'dungeonRoutePolicy', 'dungeonRooms']
const json = p => JSON.parse(readFileSync(new URL(p, import.meta.url)))
export const PA = json('../config/pa-c344a4e.json')
export const V0_FROZEN = json('../config/v0-codex-frozen.json')

const bump = (a, single, group) => a.kind === 'prepare' ? { ...a, prepared: bump(a.prepared, single, group) }
  : a.kind === 'attack' ? { ...a, damage: a.damage + single } : a.kind === 'attack_all' ? { ...a, damage: a.damage + group } : { ...a }
/** V0 = 1afabb3, V1 = +2/+1, PA = c344a4e (Codex V2), V3 = PA with phase II "В8 → Маг" moved before the preparation. */
export function definitions(variant) {
  const v0 = structuredClone(V0_FROZEN)
  if (variant === 'V0') return v0
  if (variant === 'V1') return v0.map(e => ({ ...e, behavior: Object.fromEntries(Object.entries(e.behavior).map(([k, xs]) => [k, xs.map(a => bump(a, 2, 1))])) }))
  const pa = structuredClone(PA)
  if (variant === 'PA') return pa
  if (variant === 'V3') { const b = pa.find(e => e.id === 'old-mines-rhahk-zor').behavior, p = b.phase2; b.phase2 = [p[0], { ...p[2], target: 'mage' }, p[1], p[3]]; return pa }
  // Review probes for the boss (data only, never applied to the game). Same verbs, same threshold rule.
  const zor = pa.find(e => e.id === 'old-mines-rhahk-zor'), p2 = zor.behavior.phase2   // [О5в, П(М11), В8, З2]
  if (variant === 'Z1') { zor.behavior.phase2 = [p2[1], p2[0], p2[2], p2[3]]; return pa }            // П(М11) → О5 → В8 → З2
  if (variant === 'Z2') { zor.maxHealth = 76; return pa }                                            // PA, HP 76 (threshold 38)
  if (variant === 'Z3') { zor.maxHealth = 76; zor.behavior.phase2 = [p2[1], p2[0], p2[2], p2[3]]; return pa }
  if (variant === 'Z4') { zor.behavior.phase2 = [p2[0], p2[1], p2[3], p2[2]]; return pa }            // О5 → П(М11) → З2 → В8: no change to the first two
  // Prepared GROUP strike instead of the single prepared hit on Jaina: armor must be split between both heroes.
  const groupPrep = { kind: 'prepare', name: 'Замах через плечо', prepared: { kind: 'attack_all', name: 'Летящий молот', damage: 7, primaryTarget: 'mage' } }
  if (variant === 'Z6') { zor.behavior.phase2 = [p2[0], groupPrep, p2[2], p2[3]]; return pa }
  if (variant === 'Z7') { zor.maxHealth = 76; zor.behavior.phase2 = [p2[0], groupPrep, p2[2], p2[3]]; return pa }
  if (variant === 'Z5') { zor.behavior.phase1 = [zor.behavior.phase1[0], zor.behavior.phase1[1], zor.behavior.phase1[2]]; return pa } // phase I without З4
  throw Error('Unknown variant ' + variant)
}

export const heroIds = ['warrior', 'mage']
export const sum = xs => xs.reduce((a, b) => a + b, 0)
export const mean = xs => xs.length ? sum(xs) / xs.length : NaN
export const pct = (k, n) => n ? 100 * k / n : NaN

export function makeLab(m) {
  const { campaign: c, battle: b, balance, balancePlanner: planner, cardProgression: p, types } = m
  const decks = {
    18: [...types.startingDeck],
    14: ['sword-strike', 'sword-strike', 'fireball', 'guard', 'guard', 'parry', 'shield-bash', 'interpose', 'frostbolt', 'frostbolt', 'arcane-insight', 'ice-ward', 'ice-ward', 'thunderbolt'],
  }
  decks[16] = [...decks[14], 'parry', 'arcane-insight']
  const def = inst => p.resolveCardDefinition(inst)
  const enc = id => m.sectorContent.sectorEncounters.find(e => e.id === id)
  function apply(variant) {
    for (const e of definitions(variant)) {
      const target = enc(e.id)
      for (const k of Object.keys(target)) delete target[k]
      Object.assign(target, structuredClone(e))
    }
  }
  function battle(encounterId, seed, { deck = 18, health = [25, 18], artifacts = [] } = {}) {
    const heroes = c.createCampaignBattle({ seed, battleId: 'review/party' }).heroes
    heroIds.forEach((id, i) => { heroes[id].health = health[i] })
    const items = artifacts.map(([definitionId, owner], i) => ({ instanceId: 'review/item/' + i, definitionId, ownerInstanceId: heroes[owner].instanceId }))
    return c.createCampaignBattle({ encounter: enc(encounterId), heroes, seed, deck: Array.isArray(deck) ? deck : decks[deck], economy: m.economy.gameEconomy, battleId: 'review/battle', artifacts: items })
  }

  // ---------- policies: (state) => instanceId | undefined; created per battle ----------
  const classic = name => () => ({ next: s => balance.chooseCard(s, name, 'public')?.instanceId })
  const fill = () => ({ next: s => (balance.chooseCard(s, 'aggressive', 'public') ?? balance.chooseCard(s, 'balanced', 'public'))?.instanceId })
  /**
   * Research-only "tempo" policy (not a game bot). Fair information: public intent only (prepared size unknown).
   * Spends every point of mana; ranks cards by damage per mana, counts the damage half of hybrid cards
   * (Parry on a revealed attack, Shield Bash), plays Vulnerability before the biggest follow-up, and spends
   * armor only (a) to stop a revealed lethal/heavy hit or (b) when no damaging card is affordable.
   * It never values armor for its own sake, so it stays an attacking line rather than a disguised balanced bot.
   */
  const tempo = () => ({
    next(s) {
      const threat = b.forecastEnemyAction(s)   // only revealed hits: a preparation has no current targets
      const playable = s.hand.filter(x => def(x).cost <= s.mana)
      if (!playable.length) return undefined
      const scored = playable.map(x => {
        const d = def(x), pv = b.previewCard(s, d)
        const dmg = Math.min(pv.damage + pv.statusDamage, s.enemy.health + s.enemy.armor)
        const lethal = dmg >= s.enemy.health + s.enemy.armor && dmg > 0
        const vuln = pv.appliedStatuses.includes('vulnerability') && !b.hasStatus(s, 'vulnerability') ? 2.5 : 0
        const draw = pv.draw * 3
        const block = threat.targets.reduce((t, h) => t + Math.min(pv.armor[h.target], Math.max(0, h.healthLoss)), 0)
        const lethalIn = threat.targets.some(h => h.healthLoss >= s.heroes[h.target].health)
        return { x, d, dmg, lethal, block, lethalIn, value: (dmg + vuln + 0.6 * pv.statusFuture + draw) / Math.max(1, d.cost) + (d.cost === 0 ? 2 : 0) }
      })
      const kill = scored.find(r => r.lethal); if (kill) return kill.x.instanceId
      // Only a revealed hit that would kill or take ≥ 60% of the target's health is blocked.
      const danger = threat.targets.some(h => h.healthLoss >= s.heroes[h.target].health || h.healthLoss >= 0.6 * s.heroes[h.target].health)
      if (danger) { const g = scored.filter(r => r.block > 0).sort((a, b) => b.block - a.block || b.dmg - a.dmg)[0]; if (g) return g.x.instanceId }
      const attack = scored.filter(r => r.dmg > 0 || r.d.effects.some(e => e.type === 'draw' || e.type === 'status')).sort((a, b) => b.value - a.value)[0]
      if (attack) return attack.x.instanceId
      return scored.sort((a, b) => b.block - a.block)[0]?.x.instanceId   // leftover mana: any armor
    },
  })
  const plannerPolicy = () => { const t = planner.createTurnPlanner(); return { next: s => t.next(s) } }
  const policies = { aggressive: classic('aggressive'), balanced: classic('balanced'), defensive: classic('defensive'), 'aggressive-fill': fill, tempo, planner: plannerPolicy }

  // ---------- instrumented fight ----------
  function fight(state, policyName, { trace = false, maxTurns = 30 } = {}) {
    const pol = typeof policyName === 'string' ? policies[policyName]() : policyName
    const entry = heroIds.map(h => state.heroes[h].health), maxHP = state.enemy.maxHealth
    const o = { turns: 0, manaAvailable: 0, manaSpent: 0, plays: 0, defensePlays: 0, defenseMana: 0, hybridPlays: 0, armorGranted: [0, 0], armorAbsorbed: [0, 0], armorWasted: [0, 0], hitsTaken: [0, 0], unusedManaWithDamage: 0,
      phaseTurn: null, phaseCause: null, phase2Executed: 0, phase2Attacks: 0, phase2Kinds: [], killedOnPrepare: 0, preserved: null, lossByPhase: [[0, 0], [0, 0]], firstHitTurn: null, cardPlays: {}, armorByCard: {}, turnsLog: trace ? [] : undefined }
    while (!state.result && o.turns < maxTurns) {
      o.turns++
      const declared = state.enemy.nextAction, declaredPhase = state.enemy.nextActionPhase, phaseBefore = state.enemy.phase
      o.manaAvailable += state.mana
      // Mana contest: damage-capable cards in hand vs mana. A turn is "contested" when the hand's damage
      // cards cost more than the mana available, so armor bought now delays damage.
      const dmgCards = state.hand.filter(x => b.previewCard(state, def(x)).damage > 0)
      const dmgManaStart = sum(dmgCards.map(x => def(x).cost)), manaStart = state.mana
      let defManaTurn = 0, dmgManaTurn = 0, defWhileDamageAffordable = 0
      const t = trace ? { turn: state.turn, mana: state.mana, hp: heroIds.map(h => state.heroes[h].health), armor: heroIds.map(h => state.heroes[h].armor), enemy: [state.enemy.health, state.enemy.armor], intent: describe(declared), intentPhase: declaredPhase, hand: state.hand.map(x => x.definitionId + (x.upgrade ? '+' : '')), plays: [] } : null
      for (let n = 0; n < 40 && !state.result; n++) {
        const id = pol.next(state)
        if (!id) break
        const inst = state.hand.find(x => x.instanceId === id), d = def(inst), before = state.mana, armor = heroIds.map(h => state.heroes[h].armor)
        const pv = b.previewCard(state, d)
        const affordableDamage = state.hand.some(y => y !== inst && def(y).cost <= state.mana && b.previewCard(state, def(y)).damage > 0)
        if (pv.damage > 0) dmgManaTurn += d.cost; else if (d.kind === 'defense') { defManaTurn += d.cost; if (affordableDamage) defWhileDamageAffordable += d.cost }
        const r = b.playCard(state, id)
        if (!r.ok) throw Error('Illegal play ' + r.reason)
        o.plays++; o.manaSpent += before - state.mana
        const granted = heroIds.map((h, i) => Math.max(0, state.heroes[h].armor - armor[i]))
        granted.forEach((g, i) => { o.armorGranted[i] += g })
        o.cardPlays[d.id] = (o.cardPlays[d.id] ?? 0) + 1
        if (sum(granted)) o.armorByCard[d.id] = [(o.armorByCard[d.id]?.[0] ?? 0) + granted[0], (o.armorByCard[d.id]?.[1] ?? 0) + granted[1]]
        if (d.kind === 'defense') { o.defensePlays++; o.defenseMana += d.cost }
        if (pv.damage > 0 && sum(granted) > 0) o.hybridPlays++
        if (phaseBefore === 1 && state.enemy.phase === 2 && o.phaseTurn === null) { o.phaseTurn = o.turns; o.phaseCause = 'card' }
        if (t) t.plays.push(d.id + (inst.upgrade ? '+' : '') + `→${state.enemy.health}`)
      }
      // The announced action (and a preparation's target) must never change during the player's turn.
      if (state.enemy.nextAction !== declared && JSON.stringify(state.enemy.nextAction) !== JSON.stringify(declared)) throw Error('Announced intent changed')
      if (!state.result && state.hand.some(x => def(x).cost <= state.mana && b.previewCard(state, def(x)).damage > 0)) o.unusedManaWithDamage += state.mana
      const leftDamage = state.result ? 0 : state.hand.filter(x => b.previewCard(state, def(x)).damage > 0).length
      ;(o.contest ??= []).push({ turn: o.turns, mana: manaStart, dmgManaStart, contested: dmgManaStart > manaStart, dmgMana: dmgManaTurn, defMana: defManaTurn, defWhileDamageAffordable, leftDamage, killed: !!state.result })
      if (state.result) { if (declared.kind === 'prepare') o.killedOnPrepare++; if (t) o.turnsLog.push(t); break }
      const fc = b.forecastEnemyAction(state), hp0 = heroIds.map(h => state.heroes[h].health), ar0 = heroIds.map(h => state.heroes[h].armor), phaseBeforeTick = state.enemy.phase
      b.endTurn(state)
      if (phaseBeforeTick === 1 && state.enemy.phase === 2 && o.phaseTurn === null) { o.phaseTurn = o.turns; o.phaseCause = 'tick' }
      if (declared.kind === 'prepare' && !state.result && JSON.stringify(state.enemy.nextAction) !== JSON.stringify(declared.prepared)) throw Error('Preparation changed target')
      // Bleeding can kill before the action: then the action did not happen.
      const executed = !(state.result === 'victory')
      if (executed) {
        if (declaredPhase === 2) { o.phase2Executed++; o.phase2Kinds.push(declared.kind); if (fc.targets.length) o.phase2Attacks++ }
        if (o.phaseTurn !== null && o.preserved === null) o.preserved = declaredPhase === 1 ? 1 : 0
        for (const hit of fc.targets) {
          const i = heroIds.indexOf(hit.target)
          o.hitsTaken[i]++; o.armorAbsorbed[i] += hit.absorbed; o.armorWasted[i] += Math.max(0, ar0[i] - hit.absorbed)
          if (o.firstHitTurn === null && hit.attack > 0) o.firstHitTurn = o.turns
        }
        heroIds.forEach((h, i) => { o.lossByPhase[declaredPhase - 1][i] += hp0[i] - state.heroes[h].health })
      }
      if (t) { t.after = { hp: heroIds.map(h => state.heroes[h].health), enemy: [state.enemy.health, state.enemy.armor] }; o.turnsLog.push(t) }
    }
    const end = heroIds.map(h => state.heroes[h].health)
    return { ...o, result: state.result ?? 'timeout', lossW: entry[0] - end[0], lossM: entry[1] - end[1], endW: end[0], endM: end[1], enemyLeft: state.enemy.health, armorLeft: heroIds.map(h => state.heroes[h].armor), maxHP }
  }
  function describe(a) {
    if (a.kind === 'prepare') return 'П(' + describe(a.prepared) + ')'
    if (a.kind === 'attack') return (a.target === 'warrior' ? 'В' : 'М') + a.damage
    if (a.kind === 'attack_all') return 'О' + a.damage + (a.primaryTarget === 'warrior' ? 'в' : 'м')
    return 'З' + a.armor
  }
  return { apply, battle, fight, policies, decks, def, enc, describe, c, b, balance, planner, p, types }
}
