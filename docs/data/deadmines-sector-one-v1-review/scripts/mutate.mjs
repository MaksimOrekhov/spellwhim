// Mutation probe on an exported copy (scratchpad/mut). Each mutant: apply one literal replacement, run vitest, restore.
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const root = process.argv[2]
const mutants = [
  ['paid upgrade threshold <=3 -> <=4', 'src/game/dungeonRooms.ts', 'hero.health <= 3', 'hero.health <= 4'],
  ['risk guard <=2 -> <=1 (risk may kill)', 'src/game/dungeonRooms.ts', "h.health <= 2)) throw new Error('Risk could kill", "h.health <= 1)) throw new Error('Risk could kill"],
  ['risk failure spares the warrior', 'src/game/dungeonRooms.ts', 'warrior: { ...run.heroes.warrior, health: run.heroes.warrior.health-2 }', 'warrior: { ...run.heroes.warrior }'],
  ['risk success 70% -> 30%', 'src/game/dungeonRooms.ts', '< 0.7, selection', '< 0.3, selection'],
  ['event may remove/replace upgraded copies', 'src/game/dungeonRooms.ts', "(run.room?.type !== 'event' || c.upgrade === 0)", 'true'],
  ['replacement offers 4 instead of 3', 'src/game/dungeonRooms.ts', '.filter(c => c.definitionId !== previous.definitionId).slice(0, 3)', '.filter(c => c.definitionId !== previous.definitionId).slice(0, 4)'],
  ['room card offer 3 -> 2', 'src/game/dungeonRooms.ts', "!run.excludedRewards?.includes(c.id)), 3)", "!run.excludedRewards?.includes(c.id)), 2)"],
  ['treasure artifacts 2 -> 1', 'src/game/dungeonRooms.ts', 'a.id)), 2).map(a => a.id)', 'a.id)), 1).map(a => a.id)'],
  ['paid upgrade costs 2 instead of 3', 'src/game/dungeonRooms.ts', 'health: hero!.health - 3', 'health: hero!.health - 2'],
  ['save: drop room-offer integrity check', 'src/game/runSave.ts', 'requireValid(canonical({ ...run.room, selection: null }) === canonical(expected))', 'void expected'],
  ['save: drop journal ledger checks', 'src/game/runSave.ts', 'requireValid(unique(run.journal!.map(entry=>entry.nodeId)))', 'void 0'],
  ['validator: drop forced-elite check', 'src/game/dungeonGenerator.ts', "fail(n.id===map.finalNodeId || n.edges.some(id=>safe.has(id)), 'Forced future elite')", 'void 0'],
  ['validator: drop development guarantee', 'src/game/dungeonGenerator.ts', "fail(safe.has(start)&&(!c.requireDevelopment||development.has(start)), 'No safe development route')", 'void 0'],
  ['validator: drop battle budget', 'src/game/dungeonGenerator.ts', "fail(budget.elites<=c.maxElites && budget.battles<=c.maxBattles,'Combat budget exceeded')", "fail(budget.elites<=c.maxElites,'Combat budget exceeded')"],
  ['validator: drop elite budget', 'src/game/dungeonGenerator.ts', "fail(budget.elites<=c.maxElites && budget.battles<=c.maxBattles,'Combat budget exceeded')", "fail(budget.battles<=c.maxBattles,'Combat budget exceeded')"],
  ['validator: drop reachability', 'src/game/dungeonGenerator.ts', "fail(nodes.every(n=>reached.has(n.id)&&reachesBoss.has(n.id)), 'Unreachable room or dead end')", 'void 0'],
  ['generator: row-2 required list ignored', 'src/game/dungeonGenerator.ts', 'n.type = spec.required?.[j] ?? ordered', 'n.type = ordered'],
  ['artifact slot: silent replacement', 'src/game/campaign.ts', 'if (occupied && occupied.instanceId !== replaceInstanceId) throw', 'if (false) throw'],
  ['Johnson HP 60 -> 30', 'src/game/sectorContent.ts', "title: 'Смена ещё не окончена', maxHealth: 60", "title: 'Смена ещё не окончена', maxHealth: 30"],
  ['boss phase II removed', 'src/game/sectorContent.ts', "phase2: [{ kind: 'attack_all', name: 'Дрожь штолен'", "phase9: [{ kind: 'attack_all', name: 'Дрожь штолен'"],
]
const results = []
for (const [name, file, from, to] of mutants) {
  const path = root + '/' + file, orig = readFileSync(path, 'utf8')
  if (!orig.includes(from)) { results.push([name, 'PATTERN NOT FOUND']); continue }
  writeFileSync(path, orig.replace(from, to))
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=dot'], { cwd: root, encoding: 'utf8', shell: true, timeout: 300000 })
  writeFileSync(path, orig)
  const out = (r.stdout + r.stderr)
  const failed = /Tests\s+.*?(\d+) failed/.exec(out.replace(/\x1b\[[0-9;]*m/g, ''))?.[1]
  results.push([name, r.status === 0 ? 'SURVIVED' : `killed (${failed ?? '?'} failing)`])
  console.log(name.padEnd(48), results.at(-1)[1])
}
