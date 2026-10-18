import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createServer } from 'vite'

const strategiesAll = ['aggressive', 'defensive', 'balanced', 'planner']

function readArgs(args) {
  const options = { runs: 200, seed: 1000, strategy: 'all', configs: ['A'], json: null, curve: false, deaths: false, detail: false, trace: null, full: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--runs') options.runs = Number(args[++i])
    else if (arg === '--seed') options.seed = Number(args[++i]) >>> 0
    else if (arg === '--strategy') options.strategy = args[++i]
    else if (arg === '--configs') options.configs = args[++i].split(',')
    else if (arg === '--json') options.json = args[++i]
    else if (arg === '--curve') options.curve = true
    else if (arg === '--deaths') options.deaths = true
    else if (arg === '--detail') options.detail = true
    else if (arg === '--full') options.full = true
    else if (arg === '--trace') options.trace = Number(args[++i]) >>> 0
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error('Неизвестный аргумент: ' + arg)
  }
  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error('--runs должен быть положительным целым числом')
  return options
}

const options = readArgs(process.argv.slice(2))
if (options.help) {
  console.log('npm run economy -- [--configs A,B/B,U/C,U] [--runs 200] [--seed 1000] [--strategy all|planner|a,b] [--curve] [--deaths] [--detail] [--json path] [--trace seed]')
  console.log('  Конфигурации: A, B, U — готовые пакеты (кривая + враги v0.7 + поздний добор);')
  console.log('  B/B, B/C, B/D, U/B, U/C, U/D, A/C … — этапы сравнения (A: как есть; B: только кривая; C: + враги v0.7; D: + поздний добор);')
  console.log('  U/v06/late3 — любая комбинация кривая/враги/добор. --trace seed печатает ходы одного похода (одна конфигурация, одна стратегия).')
  process.exit(0)
}
const strategies = options.strategy === 'all' ? strategiesAll : options.strategy.split(',')

const f = (value, digits = 1) => Number(value).toFixed(digits)
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { simulateBalance, simulateRun, summarizeEconomy } = await server.ssrLoadModule('/src/game/balance.ts')
  const { economyFromSpec } = await server.ssrLoadModule('/src/game/economy.ts')
  const configs = options.configs.map(spec => ({ spec, economy: economyFromSpec(spec) }))

  if (options.trace !== null) {
    const { economy } = configs[0]
    const run = simulateRun(options.trace, strategies[0], { economy, trace: true })
    console.log(`Конфигурация ${economy.id} (${economy.label}), seed ${options.trace}, ${strategies[0]}: ${run.status}`)
    for (const battle of run.battles) {
      console.log(`\n=== ${battle.encounterName}: ${battle.result}, ходов ${battle.turns} ===`)
      for (const turn of battle.trace) {
        console.log(`Ход ${turn.turn} · мана ${turn.mana} · враг ${turn.enemy.health} HP, броня ${turn.enemy.armor} · Вариан ${turn.heroes.warrior.health} (бр. ${turn.heroes.warrior.armor}) · Джайна ${turn.heroes.mage.health} (бр. ${turn.heroes.mage.armor})`)
        console.log(`  Рука: ${turn.hand.join(', ')}`)
        console.log(`  Намерение врага: ${turn.intent}`)
        for (const play of turn.plays) console.log(`  → ${play.name} (${play.cost}): урон ${play.damage}${play.armor.warrior || play.armor.mage ? `, броня Б${play.armor.warrior}/Л${play.armor.mage}` : ''}${play.drawn ? `, добор ${play.drawn}` : ''}${play.bonuses.length ? `, бонус: ${play.bonuses.join(', ')}` : ''}`)
        console.log(`  После: враг ${turn.afterPlays.enemy.health} HP/${turn.afterPlays.enemy.armor} бр. · Вариан бр. ${turn.afterPlays.heroes.warrior.armor} · Джайна бр. ${turn.afterPlays.heroes.mage.armor}`)
      }
    }
    process.exit(0)
  }

  const rows = []
  const all = {}
  for (const { spec, economy } of configs) {
    for (const strategy of strategies) {
      const runs = simulateBalance({ runs: options.runs, seed: options.seed, strategies: [strategy], economy })
      const [summary] = summarizeEconomy(runs, economy)
      all[spec + ' · ' + strategy] = { economy: economy.id, summary, ...(options.full ? { runs } : {}) }
      const e = summary.encounters
      rows.push({
        config: spec, strategy, 'win %': f(summary.wins / summary.runs * 100),
        'turns 1/2/3': e.map(x => f(x.turns)).join(' / '),
        'enemy acts': e.map(x => f(x.enemyActions)).join(' / '),
        'Varian HP end': e.map(x => f(x.healthEnd.warrior, 0)).join(' / '),
        'Jaina HP end': e.map(x => f(x.healthEnd.mage, 0)).join(' / '),
        'run end V/J': f(summary.runEnd.varian, 1) + ' / ' + f(summary.runEnd.jaina, 1),
        'close calls %': e.map(x => f(x.closeCalls * 100, 0)).join(' / '),
        'mana avail': f(summary.mana.availablePerTurn, 2), spent: f(summary.mana.spentPerTurn, 2),
        'unused %': f(summary.mana.turnsWithUnused * 100, 0), 'hoard %': f(summary.mana.turnsHoarding * 100, 0), 'starved %': f(summary.mana.turnsStarved * 100, 0),
        'at top %': f(summary.mana.turnsAtTop * 100, 0),
        'top reached %': e.map(x => f(x.reachedTopMana * 100, 0)).join(' / '),
        cards: f(summary.cardsPerTurn, 2), 'hand s→e': f(summary.handStart, 1) + '→' + f(summary.handEnd, 1),
        'blocked/battle': f(summary.blockedDrawsPerBattle, 2), 'vulnerability setups/battle': f(summary.vulnerabilitySetupsPerBattle, 2), 'vulnerability triggers/turn': f(summary.vulnerabilityTriggersPerTurn, 2), 'wait turns/trigger': f(summary.vulnerabilityWaitTurnsPerTrigger, 2), 'Jaina armor bonus/battle': f(summary.armorBonusTriggersPerBattle, 2),
      })
    }
  }
  console.log(`Runs: ${options.runs} per strategy | seeds: ${options.seed}–${(options.seed + options.runs - 1) >>> 0}`)
  console.table(rows)
  if (options.deaths) {
    for (const [name, entry] of Object.entries(all)) {
      const deaths = Object.entries(entry.summary.deaths).sort((a, b) => b[1] - a[1])
      if (deaths.length) { console.log('Поражения: ' + name); console.table(deaths.map(([cause, count]) => ({ cause, count }))) }
    }
  }
  if (options.detail) {
    for (const [name, entry] of Object.entries(all)) {
      const s = entry.summary
      console.log('Подробно: ' + name)
      console.table([{ 'vulnerability triggers/turn': f(s.vulnerabilityTriggersPerTurn, 2), 'setups/battle': f(s.vulnerabilitySetupsPerBattle, 2), 'wait/trigger': f(s.vulnerabilityWaitTurnsPerTrigger, 2), 'Jaina armor bonuses/battle': f(s.armorBonusTriggersPerBattle, 2), 'defense mana %': f(s.defenseManaShare * 100, 0), 'empty-hand turns %': f(s.emptyHandTurns * 100, 1), 'Jaina low ≤5 % (1/2/3)': s.encounters.map(x => f(x.mageLow * 100, 0)).join('/'), 'Varian low ≤5 %': s.encounters.map(x => f(x.varianLow * 100, 0)).join('/'), 'Jaina fell': s.encounters.map(x => x.mageFell).join('/'), 'Varian fell': s.encounters.map(x => x.varianFell).join('/') }])
      console.table(s.byIntent.map(row => ({ intent: row.kind, turns: row.turns, 'damage/turn': f(row.damage, 1), 'armor/turn': f(row.armorGained, 1), 'defense mana': f(row.defenseMana, 2), cards: f(row.cards, 2), 'armored %': f(row.armoredShare * 100, 0), 'HP lost': f(row.healthLost, 1) })))
    }
  }
  if (options.curve) {
    for (const [name, entry] of Object.entries(all)) {
      console.log('Кривая по ходам: ' + name + ' (по боям, где этот ход был сыгран)')
      console.table(entry.summary.turnCurve.map(row => ({ turn: row.turn, battles: row.battles, mana: f(row.maxMana, 1), spent: f(row.spent, 2), cards: f(row.cards, 2), 'hand start': f(row.handStart, 1), 'hand end': f(row.handEnd, 1), vulnerability: f(row.vulnerabilityTriggers, 2), 'HP lost': f(row.healthLost, 1) })))
    }
  }
  if (options.json) {
    await mkdir(dirname(options.json), { recursive: true })
    await writeFile(options.json, JSON.stringify({ options, results: all }, null, 2) + '\n')
    console.log('JSON сохранён: ' + options.json)
  }
} finally {
  await server.close()
}
