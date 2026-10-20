import { withGame } from './harness.mjs'
import { MODULES, makeSim, avg, winPct } from './sim.mjs'

const N = Number(process.argv[2] ?? 200)
const which = process.argv[3] ?? 'all'
await withGame(MODULES, async (m) => {
  const s = makeSim(m)
  const strategies = ['aggressive', 'balanced', 'defensive', 'planner']
  const table = (label, rows) => console.log(label.padEnd(44), `win ${String(winPct(rows)).padStart(5)}%  turns ${avg(rows, 'turns')}  lossW ${avg(rows, 'lossW')}  lossM ${avg(rows, 'lossM')}  hits ${avg(rows, 'attacksLanded')}  rawThreat ${avg(rows, 'rawThreat')}  freeTurns ${avg(rows, 'freeTurns')}  mana% ${avg(rows, 'manaUsePct')}  def% ${(100*avg(rows,'defShare')).toFixed(0)}  handLeft ${avg(rows,'handLeft')}`)
  const runSet = (enc, opts, strat) => Array.from({ length: N }, (_, i) => s.fight(s.battle(enc, { ...opts, seed: 42 + i }), strat))

  if (which === 'all' || which === 'base') {
    console.log('\n== C1 baseline, deck 18, full HP ==')
    for (const e of s.all) for (const st of strategies) table(`${e.id} ${st}`, runSet(e, {}, st))
  }
  if (which === 'all' || which === 'hp') {
    console.log('\n== C2 entry HP (W/M) — elite & boss ==')
    for (const e of [s.byId('old-mines-johnson'), s.byId('old-mines-rhahk-zor')]) for (const hp of [[25, 18], [16, 12], [12, 8], [8, 6], [6, 4]]) for (const st of ['aggressive', 'balanced', 'defensive', 'planner']) table(`${e.id} ${hp.join('/')} ${st}`, runSet(e, { health: hp }, st))
  }
  if (which === 'all' || which === 'deck') {
    console.log('\n== C1b deck size 14/16 (balanced & aggressive) ==')
    for (const d of [14, 16]) for (const e of [s.byId('old-mines-overseer'), s.byId('old-mines-johnson'), s.byId('old-mines-rhahk-zor')]) for (const st of ['aggressive', 'balanced', 'defensive']) table(`${e.id} deck${d} ${st}`, runSet(e, { deck: s.decks[d] }, st))
  }
  if (which === 'all' || which === 'rotate') {
    console.log('\n== C3 cycle rotation: start the pattern at index k (balanced / defensive) ==')
    for (const e of s.all) {
      const n = e.behavior.phase1.length
      for (let k = 0; k < n; k++) {
        s.resetEnemies()
        const p1 = e.behavior.phase1
        s.setEnemy(e.id, { behavior: { ...e.behavior, phase1: [...p1.slice(k), ...p1.slice(0, k)] } })
        for (const st of ['balanced', 'defensive']) table(`${e.id} start@${k}(${p1[k].kind}) ${st}`, runSet(s.byId(e.id), {}, st))
      }
    }
    s.resetEnemies()
  }
  if (which === 'all' || which === 'items') {
    console.log('\n== C4 items vs Rak\'Zor & Johnson at 16/12 entry ==')
    const loadouts = { none: [], wedgeWhistle: [['reliable-wedge', 'mage'], ['shift-whistle', 'warrior']], pulleySpool: [['double-pulley', 'warrior'], ['tension-spool', 'mage']] }
    for (const e of [s.byId('old-mines-johnson'), s.byId('old-mines-rhahk-zor')]) for (const [name, items] of Object.entries(loadouts)) for (const st of ['aggressive', 'balanced']) table(`${e.id} ${name} ${st}`, runSet(e, { health: [16, 12], artifacts: items }, st))
  }
})
