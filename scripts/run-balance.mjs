import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'

const classic = ['aggressive', 'defensive', 'balanced']
const everything = [...classic, 'planner']

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

function resolveStrategies(name) {
  if (name === 'all') return everything
  if (name === 'baseline') return classic
  const list = name.split(',')
  if (list.some(strategy => !everything.includes(strategy))) throw new Error('--strategy: aggressive, defensive, balanced, planner, baseline (три классических), all или список через запятую')
  return list
}

const options = readArgs(process.argv.slice(2))
if (options.help) {
  console.log('npm run balance -- [--runs 200] [--seed 42] [--strategy all|baseline|planner|aggressive|defensive|balanced|a,b] [--json path] [--run seed]')
  console.log('  all — четыре стратегии (по умолчанию); baseline — три классические без планировщика.')
  process.exit(0)
}
const strategies = resolveStrategies(options.strategy)

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
    // Each strategy is timed on its own so planning cost is visible; the seed range is identical for all of them.
    const runs = []
    const timing = {}
    for (const strategy of strategies) {
      const started = performance.now()
      runs.push(...simulateBalance({ runs: options.runs, seed: options.seed, strategies: [strategy] }))
      const elapsed = performance.now() - started
      timing[strategy] = { totalMs: Math.round(elapsed), msPerRun: Number((elapsed / options.runs).toFixed(2)) }
    }
    const summary = summarizeBalance(runs)
    const f = (value, digits = 1) => value.toFixed(digits)
    console.log('SPELLWHIM — BALANCE REPORT')
    console.log(`Runs: ${options.runs} per strategy | seeds: ${options.seed}–${(options.seed + options.runs - 1) >>> 0} | strategies: ${strategies.join(', ')}`)

    console.log('Исход и здоровье:')
    console.table(summary.map(row => ({ strategy: row.strategy, victories: row.victories, defeats: row.defeats, timeout: row.timeouts, 'win %': f(row.winRate * 100), 'avg turns': f(row.averageTurns), 'median turns': row.medianTurns, 'Brann HP': f(row.averageBrannHp), 'Lira HP': f(row.averageLiraHp) })))

    console.log('Продолжительность боёв (средние ходы по встречам):')
    console.table(summary.map(row => Object.fromEntries([['strategy', row.strategy], ...row.encounterTurns.map((turns, index) => ['encounter ' + (index + 1), f(turns)])])))

    console.log('Карты, мана и комбинации (на ход игрока):')
    console.table(summary.map(row => ({ strategy: row.strategy, 'cards / turn': f(row.averageCardsPlayedPerTurn, 2), 'mana available': f(row.averageManaAvailablePerTurn, 2), 'mana spent': f(row.averageManaSpentPerTurn, 2), 'mana use %': f(row.manaUtilization * 100), 'links / turn': f(row.linkTriggersPerTurn, 2), 'hand start': f(row.averageHandSizeAtTurnStart, 2), 'hand after plays': f(row.averageHandSizeAfterActions, 2), 'full at start': row.fullHandAtTurnStart, 'blocked draws': row.blockedDraws })))

    console.log('Победы по встречам (победы / сколько дошло):')
    console.table(summary.flatMap(row => row.battlesReached.map((reached, index) => ({ strategy: row.strategy, encounter: index + 1, wins: row.battleWins[index], reached, 'win %': reached ? f(row.battleWins[index] / reached * 100) : '—' }))))

    const deaths = {}
    const cardTotals = {}
    const rewardTotals = {}
    const linkTotals = {}
    for (const run of runs) {
      if (run.status === 'defeat' && run.failedEncounter) deaths[run.strategy + ' / ' + run.failedEncounter] = (deaths[run.strategy + ' / ' + run.failedEncounter] ?? 0) + 1
      for (const [id, stats] of Object.entries(run.cards)) {
        cardTotals[id] ??= {}
        cardTotals[id][run.strategy] = (cardTotals[id][run.strategy] ?? 0) + stats.plays
      }
      for (const reward of run.rewards) {
        rewardTotals[reward] ??= {}
        rewardTotals[reward][run.strategy] = (rewardTotals[reward][run.strategy] ?? 0) + 1
      }
      for (const [name, count] of Object.entries(run.linkTriggers)) {
        linkTotals[name] ??= {}
        linkTotals[name][run.strategy] = (linkTotals[name][run.strategy] ?? 0) + count
      }
    }
    if (Object.keys(deaths).length) {
      console.log('Поражения по встречам:')
      console.table(Object.entries(deaths).map(([where, defeats]) => ({ where, defeats })))
    }

    console.log('Розыгрыши карт за поход (по стратегиям; последний столбец — планировщик минус balanced):')
    console.table(Object.entries(cardTotals).map(([card, byStrategy]) => {
      const row = { card }
      for (const strategy of strategies) row[strategy] = f((byStrategy[strategy] ?? 0) / options.runs, 2)
      if (strategies.includes('planner') && strategies.includes('balanced')) row['planner − balanced'] = f(((byStrategy.planner ?? 0) - (byStrategy.balanced ?? 0)) / options.runs, 2)
      return row
    }).sort((a, b) => Number(b[strategies[strategies.length - 1]]) - Number(a[strategies[strategies.length - 1]])))

    console.log('Срабатывания связок за поход:')
    console.table(Object.entries(linkTotals).map(([link, byStrategy]) => Object.fromEntries([['link', link], ...strategies.map(strategy => [strategy, f((byStrategy[strategy] ?? 0) / options.runs, 2)])])))

    console.log('Выбранные награды (выборов за 100 походов):')
    console.table(Object.entries(rewardTotals).map(([card, byStrategy]) => Object.fromEntries([['card', card], ...strategies.map(strategy => [strategy, f((byStrategy[strategy] ?? 0) / options.runs * 100, 0)])])))

    console.log('Вычислительная стоимость:')
    console.table(summary.map(row => ({ strategy: row.strategy, 'ms / run': timing[row.strategy].msPerRun, 'total ms': timing[row.strategy].totalMs, 'search nodes / turn': f(row.planningNodesPerTurn, 1), 'max nodes in a plan': row.planningMaxNodes, 'plans cut by node cap': row.planningTruncatedPlans })))

    if (options.json) {
      const report = { schemaVersion: 2, options: { runs: options.runs, seed: options.seed, strategies }, summary, timing, runs }
      await writeJson(options.json, report)
      console.log('JSON сохранён: ' + options.json)
    }
    if (runs.some(run => run.status === 'timeout')) process.exitCode = 2
  }
} finally {
  await server.close()
}
