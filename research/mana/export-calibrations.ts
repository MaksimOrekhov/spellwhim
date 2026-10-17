/** Collects every calibration (enemy HP/damage scales per model, lever and variant) into the committed calibrations.json. */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join('research', 'mana', 'results')
const out: unknown[] = []
for (const dir of readdirSync(root).filter(d => d.startsWith('calib-'))) {
  const tag = dir.slice('calib-'.length)
  for (const file of readdirSync(join(root, dir)).filter(f => f.endsWith('.json'))) {
    const c = JSON.parse(readFileSync(join(root, dir, file), 'utf8')) as { model: string; lever: string; variant?: string; hp: number[]; dmg: number; iterations: number; summary: { winPct: number; encounterTurns: number[]; hpLostPerBattle: number[] } }
    out.push({
      tag, model: c.model, lever: c.lever, variant: c.variant ?? 'base', hp: c.hp, dmg: c.dmg, iterations: c.iterations,
      // The planner's own result at calibration time (seeds 42-161): target is 4/5/8 turns and ~20 HP lost.
      plannerTurns: c.summary.encounterTurns.map(x => Math.round(x * 10) / 10), plannerHpLost: Math.round(c.summary.hpLostPerBattle.reduce((a, b) => a + b, 0) * 10) / 10, plannerWinPct: Math.round(c.summary.winPct),
    })
  }
}
out.sort((a, b) => JSON.stringify([(a as { tag: string }).tag, (a as { model: string }).model, (a as { lever: string }).lever]).localeCompare(JSON.stringify([(b as { tag: string }).tag, (b as { model: string }).model, (b as { lever: string }).lever])))
writeFileSync(join('research', 'mana', 'calibrations.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} calibrations exported; committed file present: ${existsSync(join('research', 'mana', 'calibrations.json'))}`)
