// Research oracle: exhaustive whole-turn enumeration + policy rollouts. Not a game bot.
// Information model: "experienced player". Deck order is hidden (planner.determinize reshuffles the unknown
// draw pile from the observable situation); the enemy's deterministic cycle is assumed learned, so rollouts
// play the real enemy. Each candidate end-of-turn state is valued by one rollout of the base policy to the end
// of the battle in the same determinized world (common random numbers across candidates).
import { heroIds } from './lib.mjs'

export function makeOracle(lab) {
  const { b, planner, def } = lab
  const key = s => [s.mana, s.hand.map(x => x.definitionId + (x.upgrade ? '+' : '')).sort().join(','), s.enemy.health, s.enemy.armor, s.enemy.phase,
    JSON.stringify(s.statuses.enemy), heroIds.map(h => s.heroes[h].health + ':' + s.heroes[h].armor).join(','), s.drawPile.length, s.rngState,
    s.artifacts.map(a => a.usedThisBattle + ':' + a.lastTriggeredTurn).join(',')].join('|')

  /** All distinct reachable end-of-turn states (stopping is always allowed). */
  function enumerate(root, cap = 4000) {
    const out = [], seen = new Set([key(root)])
    const walk = (s, seq) => {
      out.push({ seq, state: s })
      if (out.length >= cap || s.result) return
      const tried = new Set()
      for (const x of s.hand) {
        const k = x.definitionId + (x.upgrade ? '+' : '')
        if (tried.has(k) || def(x).cost > s.mana) continue
        tried.add(k)
        const child = planner.cloneBattleState(s)
        if (!b.playCard(child, x.instanceId).ok) continue
        const ck = key(child)
        if (seen.has(ck)) continue
        seen.add(ck)
        walk(child, [...seq, k])
      }
    }
    walk(root, [])
    return out
  }

  /** Rollout to the end of the battle; returns turns from now (the current turn counts as 1) and HP lost. */
  function rollout(state, basePolicy, entryHP, maxTurns = 30) {
    const s = planner.cloneBattleState(state)
    const pol = lab.policies[basePolicy]()
    let turns = 1
    if (!s.result) b.endTurn(s)
    while (!s.result && turns < maxTurns) {
      turns++
      for (let n = 0; n < 40 && !s.result; n++) { const id = pol.next(s); if (!id) break; b.playCard(s, id) }
      if (!s.result) b.endTurn(s)
    }
    const loss = heroIds.map((h, i) => entryHP[i] - Math.max(0, s.heroes[h].health))
    return { win: s.result === 'victory', turns, lossW: loss[0], lossM: loss[1], loss: loss[0] + loss[1] }
  }

  /**
   * Values every candidate of the current turn. `lambda` = HP the player would pay to finish one turn sooner.
   * J = HP lost to the end of the battle + lambda·turns + 200 on defeat (lower is better).
   */
  function evaluateTurn(real, { basePolicy = 'balanced', salt = 0, cap } = {}) {
    const root = planner.determinize(real, salt)
    const entry = heroIds.map(h => real.heroes[h].health)
    const startHealth = root.enemy.health + root.enemy.armor
    const cands = enumerate(root, cap).map(c => {
      const r = rollout(c.state, basePolicy, entry)
      const armorGain = heroIds.map(h => c.state.heroes[h].armor - root.heroes[h].armor)
      const enemyDamage = startHealth - (c.state.enemy.health + c.state.enemy.armor)
      return { seq: c.seq, ...r, armorGain, enemyDamage, manaLeft: c.state.mana, cards: [...c.seq].sort().join(',') }
    })
    return cands
  }
  // Rollout ties are common (integer turns and HP). Ties are broken toward progress made THIS turn (damage, then
  // armor): holding cards back is never preferred merely because the rollout would play them later.
  const J = (c, lambda) => c.loss + lambda * c.turns + (c.win ? 0 : 200) - 1e-3 * c.enemyDamage - 5e-4 * (c.armorGain[0] + c.armorGain[1])
  function pick(cands, lambda) { return cands.reduce((best, c) => J(c, lambda) < J(best, lambda) - 1e-9 ? c : best) }

  /** A turn policy: plans the whole turn with the oracle and replays the sequence on the real state; replans after draws. */
  function policy(lambda, opts = {}) {
    let plan = null, planTurn = -1, handSig = ''
    const sig = s => s.hand.map(x => x.instanceId).sort().join('|')
    const decisions = []
    return {
      decisions,
      next(s) {
        if (s.result) return undefined
        if (!plan || planTurn !== s.turn || handSig !== sig(s)) {
          const cands = evaluateTurn(s, { ...opts, salt: s.turn * 7919 + decisions.length })
          const best = pick(cands, lambda)
          if (opts.onDecision) opts.onDecision(s, cands, best, lambda)
          decisions.push(best.seq.length)
          plan = [...best.seq]; planTurn = s.turn
        }
        while (plan.length) {
          const want = plan.shift()
          const x = s.hand.find(c => c.definitionId + (c.upgrade ? '+' : '') === want && def(c).cost <= s.mana)
          if (!x) continue
          handSig = sig({ hand: s.hand.filter(c => c !== x) })
          return x.instanceId
        }
        return undefined
      },
    }
  }
  return { enumerate, rollout, evaluateTurn, pick, J, policy }
}

/** Per-decision diagnostics computed from one candidate set (see report §3). */
export function decisionMetrics(cands, lambda, J) {
  const best = cands.reduce((a, c) => J(c, lambda) < J(a, lambda) ? c : a)
  // "Greedy damage": what a player who only reads his own cards would do: max damage now, then max armor.
  const greedy = cands.reduce((a, c) => c.enemyDamage > a.enemyDamage || (c.enemyDamage === a.enemyDamage && c.armorGain[0] + c.armorGain[1] > a.armorGain[0] + a.armorGain[1]) ? c : a)
  const turtle = cands.reduce((a, c) => c.armorGain[0] + c.armorGain[1] > a.armorGain[0] + a.armorGain[1] || (c.armorGain[0] + c.armorGain[1] === a.armorGain[0] + a.armorGain[1] && c.enemyDamage > a.enemyDamage) ? c : a)
  const fastest = Math.min(...cands.filter(c => c.win).map(c => c.turns))
  const safest = Math.min(...cands.filter(c => c.win).map(c => c.loss))
  const safeOnFastest = Math.min(...cands.filter(c => c.win && c.turns === fastest).map(c => c.loss))
  const fastOnSafest = Math.min(...cands.filter(c => c.win && c.loss === safest).map(c => c.turns))
  const sameCards = cands.filter(c => c.cards === best.cards)
  const orderSpread = Math.max(...sameCards.map(c => J(c, lambda))) - J(best, lambda)
  return {
    n: cands.length,
    regretGreedy: J(greedy, lambda) - J(best, lambda),
    regretTurtle: J(turtle, lambda) - J(best, lambda),
    // Trade-off exists when the quickest winning line costs HP that a slower line saves.
    tradeoffHP: safeOnFastest - safest,
    tradeoffTurns: fastOnSafest - fastest,
    orderSpread,
    bestDefense: best.armorGain[0] + best.armorGain[1] > 0,
    bestArmorM: best.armorGain[1],
    bestSeq: best.seq.join(' '), greedySeq: greedy.seq.join(' '),
  }
}
