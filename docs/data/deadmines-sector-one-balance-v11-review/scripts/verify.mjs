// 1) frozen V0 == origin/main catalogue, 2) PA == Codex config V2 == committed c344a4e, 3) isolated-battle reproduction.
import { withGame } from './harness.mjs'
import { MODULES, makeLab, definitions, mean, pct } from './lib.mjs'
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const codexConfig = process.env.CODEX_PKG ? await import(pathToFileURL(resolve(process.env.CODEX_PKG, 'scripts/config.mjs')).href) : null
const canon = v => JSON.stringify(v)
await withGame(MODULES, async m => {
  const lab = makeLab(m), out = {}
  out.v0MatchesCheckout = canon(m.sectorContent.sectorEncounters) === canon(definitions('V0'))
  if (codexConfig) for (const [mine, theirs] of [['V0', 'V0'], ['V1', 'V1'], ['PA', 'V2'], ['V3', 'V3']]) out['codex' + theirs] = canon(definitions(mine)) === canon(codexConfig.definitions(theirs))
  const N = Number(process.argv[2] ?? 300)
  out.battles = {}
  for (const v of ['V0', 'PA']) {
    lab.apply(v)
    for (const e of m.sectorContent.sectorEncounters) for (const s of ['aggressive', 'balanced', 'defensive']) {
      const rows = Array.from({ length: N }, (_, i) => lab.fight(lab.battle(e.id, 42 + i), s))
      out.battles[`${v} ${e.id} ${s}`] = { win: pct(rows.filter(r => r.result === 'victory').length, N), turns: +mean(rows.map(r => r.turns)).toFixed(3), lossW: +mean(rows.map(r => r.lossW)).toFixed(3), lossM: +mean(rows.map(r => r.lossM)).toFixed(3), mana: +(100 * mean(rows.map(r => r.manaSpent)) / mean(rows.map(r => r.manaAvailable))).toFixed(1) }
    }
  }
  console.log(JSON.stringify(out, null, 1))
  writeFileSync(new URL('../results/verify.json', import.meta.url), JSON.stringify(out, null, 1) + '\n')
})
