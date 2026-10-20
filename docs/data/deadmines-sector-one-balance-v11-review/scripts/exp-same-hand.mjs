// Same opening hand, two enemy definitions: does PA change the correct first turn?
// For each seed the battle seed (hence the 8-card opening hand) is identical in V0 and PA. The oracle values every
// distinct turn-1 line in K determinized worlds (averaged). Reported: whether the best line differs, and the regret of
// playing the V0-best line against the PA enemy (in HP-equivalent, lambda = 3 HP per turn).
// Usage: node exp-same-hand.mjs <N> <seedStart> [K=3] [lambda=3] [variants=V0,PA]
import { writeFileSync, mkdirSync } from 'node:fs'
import { withGame } from './harness.mjs'
import { MODULES, makeLab } from './lib.mjs'
import { makeOracle } from './oracle.mjs'

const [nArg = '200', startArg = '42', kArg = '3', lArg = '3', variantsArg = 'V0,PA'] = process.argv.slice(2)
const N = Number(nArg), start = Number(startArg), K = Number(kArg), lambda = Number(lArg), [A, B] = variantsArg.split(',')
await withGame(MODULES, async m => {
  const lab = makeLab(m), o = makeOracle(lab)
  const value = (variant, id, seed) => {
    lab.apply(variant)
    const state = lab.battle(id, seed), table = new Map()
    for (let k = 0; k < K; k++) for (const c of o.evaluateTurn(state, { salt: 1000 + k })) {
      const key = c.seq.join(' '), row = table.get(key) ?? { seq: key, J: 0, n: 0, loss: 0, turns: 0, dmg: c.enemyDamage, armor: c.armorGain }
      row.J += o.J(c, lambda); row.loss += c.loss; row.turns += c.turns; row.n++
      table.set(key, row)
    }
    const rows = [...table.values()].filter(r => r.n === K).map(r => ({ ...r, J: r.J / K, loss: r.loss / K, turns: r.turns / K }))
    return { rows, hand: state.hand.map(x => x.definitionId), intent: lab.describe(state.enemy.nextAction) }
  }
  const out = []
  for (const e of m.sectorContent.sectorEncounters) for (let i = 0; i < N; i++) {
    const seed = start + i, a = value(A, e.id, seed), b = value(B, e.id, seed)
    const bestA = a.rows.reduce((x, y) => y.J < x.J ? y : x), bestB = b.rows.reduce((x, y) => y.J < x.J ? y : x)
    const aInB = b.rows.find(r => r.seq === bestA.seq)
    out.push({ encounter: e.id, seed, hand: a.hand, intentA: a.intent, intentB: b.intent, bestA: bestA.seq, bestB: bestB.seq,
      same: bestA.seq === bestB.seq, regretOfAinB: aInB ? aInB.J - bestB.J : null, regretOfBinA: (a.rows.find(r => r.seq === bestB.seq)?.J ?? NaN) - bestA.J,
      armorA: bestA.armor, armorB: bestB.armor, dmgA: bestA.dmg, dmgB: bestB.dmg })
  }
  mkdirSync(new URL('../results/raw/', import.meta.url), { recursive: true })
  writeFileSync(new URL(`../results/raw/samehand-${A}-${B}-${start}-${N}-K${K}-L${lambda}.json`, import.meta.url), JSON.stringify(out) + '\n')
  console.log('saved', out.length)
})
