// Rak'Zor 70 → 76 HP: small confirmation on the committed catalogue (everything else is PA v1.1).
// Uses Codex's unchanged harness/simulation; "70" = the selected V2 definitions, "76" = the game catalogue as committed.
// From the repository root: node docs/data/deadmines-sector-one-balance-v11-rakzor76/compare.mjs
import { writeFile } from 'node:fs/promises'
import { withGame } from '../deadmines-sector-one-v1-review/scripts/harness.mjs'
import { definitions, splits } from '../deadmines-sector-one-balance-v11/scripts/config.mjs'
import { simulation, modules, summarize } from '../deadmines-sector-one-balance-v11/scripts/simulation.mjs'

const strategies = ['aggressive', 'balanced', 'defensive']
await withGame(modules, async m => {
  const sim = simulation(m)
  const game = structuredClone(m.sectorContent.sectorEncounters)
  const v2 = definitions('V2')
  // The only intended difference between the two catalogues.
  const diff = game.flatMap((e, i) => JSON.stringify(e) === JSON.stringify(v2[i]) ? [] : [{ id: e.id, maxHealth: [v2[i].maxHealth, e.maxHealth], restEqual: JSON.stringify({ ...e, maxHealth: 0 }) === JSON.stringify({ ...v2[i], maxHealth: 0 }) }])
  if (diff.length !== 1 || diff[0].id !== 'old-mines-rhahk-zor' || !diff[0].restEqual) throw Error('Unexpected catalogue difference: ' + JSON.stringify(diff))
  const install = defs => { for (const e of defs) Object.assign(m.sectorContent.sectorEncounters.find(x => x.id === e.id), structuredClone(e)) }
  const pick = s => ({ n: s.n, winPct: +s.winPct.toFixed(2), turns: +s.turns.toFixed(3), endW: +s.endW.toFixed(2), endM: +s.endM.toFixed(2), ...(s.phase2Actions !== undefined ? { phase2Actions: +s.phase2Actions.toFixed(3), preparationsKilled: +s.preparationsKilled.toFixed(3) } : {}), ...(s.bossTurns !== undefined ? { bossTurns: +s.bossTurns.toFixed(3) } : {}) })
  const out = { difference: diff, battles: {}, routes: {} }
  for (const [label, defs] of [['70', v2], ['76', game]]) {
    install(defs)
    for (const [split, spec] of Object.entries(splits)) for (const strategy of strategies) {
      const fights = Array.from({ length: spec.n }, (_, i) => ({ ...sim.fight(sim.battle(m.sectorContent.rhahkZor, spec.start + i), strategy) }))
      const s = summarize(fights)
      out.battles[`${label}|${split}|${strategy}`] = { ...pick(s), lossW: +(25 - s.endW).toFixed(2), lossM: +(18 - s.endM).toFixed(2), noPhase2Action: +(100 * fights.filter(f => f.phase2Actions === 0).length / spec.n).toFixed(2) }
      const runs = Array.from({ length: spec.n }, (_, i) => sim.route(spec.start + i, { policy: 'mixed', strategy }))
      out.routes[`${label}|${split}|mixed|${strategy}`] = pick(summarize(runs.map(({ run, preRest, ...r }) => r)))
    }
  }
  install(game)
  await writeFile(new URL('results.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
  for (const [k, v] of Object.entries(out.battles)) console.log('battle', k, JSON.stringify(v))
  for (const [k, v] of Object.entries(out.routes)) console.log('route ', k, JSON.stringify(v))
})
