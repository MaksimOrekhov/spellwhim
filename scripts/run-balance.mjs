import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createServer } from 'vite'

function readArgs(args) {
  const options = { runs: 200, seed: 42, strategy: 'all', json: null, run: null }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--runs') options.runs = Number(args[++i])
    else if (arg === '--seed') options.seed = Number(args[++i]) >>> 0
    else if (arg === '--strategy') options.strategy = args[++i]
    else if (arg === '--json') options.json = args[++i] ?? 'balance-report.json'
    else if (arg === '--run') options.run = Number(args[++i]) >>> 0
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error('Неизвестный аргумент: ' + arg)
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs должен быть положительным целым числом')
  return options
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2) + '\n')
}

const options = readArgs(process.argv.slice(2))
if (options.help) {
  console.log('npm run balance -- [--runs 200] [--seed 42] [--strategy all|aggressive|defensive|balanced] [--json path] [--run seed]')
  process.exit(0)
}
const allStrategies = ['aggressive', 'defensive', 'balanced']
const strategies = options.strategy === 'all' ? allStrategies : [options.strategy]
if (strategies.some(strategy => !allStrategies.includes(strategy))) throw new Error('--strategy: aggressive, defensive, balanced или all')

const server = await createServer({
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, ws: false, hmr: false },
  appType: 'custom',
})
try {
  const { simulateBalance, simulateRun, summarizeBalance } = await server.ssrLoadModule('/src/game/balance.ts')
  if (options.run !== null) {
    const run = simulateRun(options.run, strategies[0])
    console.log(JSON.stringify(run, null, 2))
    if (options.json) await writeJson(options.json, run)
    process.exitCode = run.status === 'timeout' ? 2 : 0
  } else {
    const runs = simulateBalance({ runs: options.runs, seed: options.seed, strategies })
    const summary = summarizeBalance(runs)
    console.log('SPELLWHIM — BALANCE REPORT')
    console.log(`Runs: ${options.runs} per strategy | seeds: ${options.seed}–${(options.seed + options.runs - 1) >>> 0}`)
    console.table(summary.map(row => ({ strategy: row.strategy, victories: row.victories, defeats: row.defeats, timeout: row.timeouts, 'win %': (row.winRate * 100).toFixed(1), 'avg turns': row.averageTurns.toFixed(1), 'cards / turn': row.averageCardsPlayedPerTurn.toFixed(2), 'avg hand': row.averageHandSize.toFixed(2), 'full hand turns': row.fullHandTurns, 'blocked draws': row.blockedDraws, 'median turns': row.medianTurns, 'Brann HP': row.averageBrannHp.toFixed(1), 'Lira HP': row.averageLiraHp.toFixed(1) })))

    console.log('Победы по встречам (победы / сколько дошло):')
    console.table(summary.flatMap(row => row.battlesReached.map((reached, index) => ({ strategy: row.strategy, encounter: index + 1, wins: row.battleWins[index], reached, 'win %': reached ? (row.battleWins[index] / reached * 100).toFixed(1) : '—' }))))

    const deaths = {}
    const cardTotals = {}
    const rewardTotals = {}
    const linkTotals = {}
    for (const run of runs) {
      if (run.failedEncounter) deaths[run.failedEncounter] = (deaths[run.failedEncounter] ?? 0) + (run.status === 'defeat' ? 1 : 0)
      for (const [id, stats] of Object.entries(run.cards)) cardTotals[id] = (cardTotals[id] ?? 0) + stats.plays
      for (const reward of run.rewards) rewardTotals[reward] = (rewardTotals[reward] ?? 0) + 1
      for (const [name, count] of Object.entries(run.linkTriggers)) linkTotals[name] = (linkTotals[name] ?? 0) + count
    }
    console.log('Поражения по встречам:')
    console.table(Object.entries(deaths).map(([encounter, defeats]) => ({ encounter, defeats })))
    console.log('Сыгранные карты:')
    console.table(Object.entries(cardTotals).map(([card, plays]) => ({ card, plays })).sort((a, b) => b.plays - a.plays))
    console.log('Выбранные награды:')
    console.table(Object.entries(rewardTotals).map(([card, choices]) => ({ card, choices })))
    console.log('Срабатывания связок:')
    console.table(Object.entries(linkTotals).map(([link, triggers]) => ({ link, triggers })))
    if (options.json) {
      const report = { schemaVersion: 1, options: { runs: options.runs, seed: options.seed, strategies }, summary, runs }
      await writeJson(options.json, report)
      console.log('JSON сохранён: ' + options.json)
    }
    if (runs.some(run => run.status === 'timeout')) process.exitCode = 2
  }
} finally {
  await server.close()
}
