// One-off: turn Codex's committed sectorContent.ts (c344a4e) into plain data for in-memory experiments.
// Usage: git show c344a4e:src/game/sectorContent.ts > sc.ts && node extract-pa.mjs sc.ts
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
const full = readFileSync(process.argv[2], 'utf8')
// Only the enemy definitions; the remaining exports are event/type declarations.
const src = full.slice(0, full.indexOf('\n', full.indexOf('export const sectorEncounters')))
  .replace(/^import type.*$/m, '')
  .replace(/export const/g, 'const')
  .replace(/:\s*readonly EncounterDefinition\[\]/g, '')
  .replace(/:\s*EncounterDefinition/g, '')
  .replace(/ as const/g, '') +'\nexport default sectorEncounters\n'
const tmp = new URL('../config/.pa-tmp.mjs', import.meta.url)
writeFileSync(tmp, src)
try {
  const defs = (await import(tmp.href)).default
  writeFileSync(new URL('../config/pa-c344a4e.json', import.meta.url), JSON.stringify(defs, null, 2) + '\n')
  console.log(defs.map(d => d.id + ' ' + d.maxHealth).join('\n'))
} finally { rmSync(tmp) }
