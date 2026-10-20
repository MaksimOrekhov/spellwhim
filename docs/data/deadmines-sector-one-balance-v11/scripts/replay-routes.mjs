// Reproduce affected studies after fixing revealed-encounter TELEMETRY, never parameters.
// Existing numeric outcomes are compared before replacing the reports.
import { readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const job = process.argv[2] ?? 'primary'
const groups = {
  primary: [['main', 'classic', 'V0,V1,V2'], ['main', 'classic', 'V3'], ['holdout', 'classic', 'V0,V1,V2,V3'], ['main', 'planner', 'V0,V1,V2'], ['main', 'planner', 'V3'], ['holdout', 'planner', 'V0,V1,V2,V3']],
  elite: ['main', 'holdout'].map(s => [s, 'elite', 'V0,V1,V2']),
  rest: ['main', 'holdout'].map(s => [s, 'rest', 'V0,V1,V2']),
  extra: ['main', 'holdout'].flatMap(s => ['routes-extra', 'development', 'elite-noart'].map(p => [s, p, 'V0,V2'])),
}
if (!groups[job]) throw Error('Unknown replay group')
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'byEnemy').map(([k,v]) => [k,canonical(v)]))
  return value
}
const audit = []
for (const [split, phase, variants] of groups[job]) {
  const n = phase === 'planner' ? 60 : 300
  const name = `${split}-${phase}-${variants.replaceAll(',', '-')}-${n}`
  const path = new URL('../results/' + name + '.json', import.meta.url)
  const before = JSON.parse(await readFile(path, 'utf8'))
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('run.mjs', import.meta.url)), '--split', split, '--phase', phase, '--variants', variants], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0) throw Error(result.stderr || result.stdout)
  const after = JSON.parse(await readFile(path, 'utf8'))
  if (JSON.stringify(canonical(before)) !== JSON.stringify(canonical(after))) throw Error('Non-telemetry summary changed: ' + name)
  audit.push({ name, numericOutcomesUnchanged: true, revealedEncounterRecorded: true })
  console.log('replayed', name, 'identical outcomes')
}
await writeFile(new URL('../results/replay-' + job + '.json', import.meta.url), JSON.stringify(audit, null, 2) + '\n')
