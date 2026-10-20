import { withGame } from './harness.mjs'
import { MODULES, makeSim, avg, winPct } from './sim.mjs'

const N = Number(process.argv[2] ?? 200)
const variant = process.argv[3] ?? 'V0'
const part = process.argv[4] ?? 'all'

// Candidate tunings for FUTURE experiments (applied in memory only).
const variants = {
  V0: {},
  // +2 to every hit (+1 per target for group hits), HP unchanged
  'V1-dmg': 'dmg+2',
  // Proposal A: remove "free opening" turns on the slow enemies, +1 damage, modest HP on elite/boss
  'PA': {
    'old-mines-raider': { maxHealth: 32, behavior: { phase1: [{ kind: 'attack', name: 'Тычок киркой', damage: 6, target: 'mage' }, { kind: 'attack', name: 'Удар рукоятью', damage: 6, target: 'warrior' }, { kind: 'defend', name: 'За вагонетку', armor: 3 }] } },
    'old-mines-digger': { maxHealth: 36, behavior: { phase1: [{ kind: 'attack', name: 'Размашистый удар', damage: 7, target: 'warrior' }, { kind: 'attack', name: 'Обратный замах', damage: 7, target: 'mage' }, { kind: 'prepare', name: 'Поднимает кирку', prepared: { kind: 'attack', name: 'Удар забойщика', damage: 12, target: 'warrior' } }] } },
    'old-mines-watchman': { maxHealth: 34, behavior: { phase1: [{ kind: 'prepare', name: 'Целится в Джайну', prepared: { kind: 'attack', name: 'Прицельный болт', damage: 11, target: 'mage' } }, { kind: 'attack', name: 'Проверочный выстрел', damage: 6, target: 'warrior' }, { kind: 'recover', name: 'Перезаряжает за щитом', armor: 3 }] } },
    'old-mines-overseer': { maxHealth: 40, behavior: { phase1: [{ kind: 'prepare', name: 'Берёт разбег', prepared: { kind: 'attack', name: 'Тяжёлый молот', damage: 13, target: 'warrior' } }, { kind: 'attack', name: 'Тычок локтем', damage: 6, target: 'mage' }, { kind: 'defend', name: 'Прячет подбородок', armor: 6 }] } },
    'old-mines-johnson': { maxHealth: 64, behavior: { phase1: [{ kind: 'prepare', name: 'Опирается на кирку', prepared: { kind: 'attack', name: 'Удар мастера', damage: 14, target: 'warrior' } }, { kind: 'attack', name: 'Летящий обломок', damage: 7, target: 'mage' }, { kind: 'defend', name: 'Шахтёрская закалка', armor: 6 }, { kind: 'attack_all', name: 'Обвал породы', damage: 4, primaryTarget: 'mage' }] } },
    'old-mines-rhahk-zor': { maxHealth: 70, behavior: {
      phase1: [{ kind: 'attack', name: 'Проверка каски', damage: 7, target: 'warrior' }, { kind: 'prepare', name: 'Заносит молот', prepared: { kind: 'attack', name: 'Удар бригадира', damage: 13, target: 'warrior' } }, { kind: 'attack', name: 'Обломок породы', damage: 6, target: 'mage' }, { kind: 'recover', name: 'Переводит дух', armor: 4 }],
      phase2: [{ kind: 'attack_all', name: 'Дрожь штолен', damage: 5, primaryTarget: 'warrior' }, { kind: 'prepare', name: 'Замах через плечо', prepared: { kind: 'attack', name: 'Летящий молот', damage: 11, target: 'mage' } }, { kind: 'attack', name: 'Гнев бригадира', damage: 8, target: 'warrior' }, { kind: 'recover', name: 'Вытаскивает молот', armor: 2 }] } },
  },
}

await withGame(MODULES, async (m) => {
  const s = makeSim(m)
  s.resetEnemies()
  const v = variants[variant] ?? variant
  const k = /^dmg\+(\d)$/.exec(String(v))?.[1]
  if (k !== undefined) for (const e of s.all) { const bump = a => a.kind === 'attack' ? { ...a, damage: a.damage + Number(k) } : a.kind === 'attack_all' ? { ...a, damage: a.damage + Math.ceil(Number(k) / 2) } : a.kind === 'prepare' ? { ...a, prepared: bump(a.prepared) } : a; s.setEnemy(e.id, { behavior: { phase1: e.behavior.phase1.map(bump), ...(e.behavior.phase2 ? { phase2: e.behavior.phase2.map(bump) } : {}) } }) }
  else for (const [id, patch] of Object.entries(v)) s.setEnemy(id, patch)
  console.log(`\n### variant ${variant}`)
  const line = (label, rows) => console.log(label.padEnd(46), `n ${rows.length} done ${String(winPct(rows)).padStart(5)}%  battles ${avg(rows, 'battles')} elites ${avg(rows, 'elites')}  endHP ${avg(rows, 'endW')}/${avg(rows, 'endM')}  preBoss ${avg(rows, 'preBossW')}/${avg(rows, 'preBossM')}  bossLoss ${avg(rows, 'bossLossW')}/${avg(rows, 'bossLossM')} bossTurns ${avg(rows, 'bossTurns')}  minHP% ${(100 * avg(rows, 'minFrac')).toFixed(0)}  turns ${avg(rows, 'turns')}`)
  if (part === 'all' || part === 'enemies') {
    const strategies = ['aggressive', 'balanced', 'defensive', 'planner']
    for (const e of s.all) for (const st of strategies) {
      const rows = Array.from({ length: N }, (_, i) => s.fight(s.battle(s.byId(e.id), { seed: 42 + i }), st))
      console.log(`${e.id} ${st}`.padEnd(40), `win ${winPct(rows)}% turns ${avg(rows, 'turns')} loss ${avg(rows, 'lossW')}/${avg(rows, 'lossM')}`)
    }
  }
  if (part === 'all' || part === 'routes') {
    for (const deck of [18, 14]) for (const policy of ['safe', 'mixed', 'risky']) for (const strategy of ['aggressive', 'balanced', 'defensive']) for (const noArtifacts of [false, true]) {
      const rows = Array.from({ length: N }, (_, i) => s.route(42 + i, { policy, strategy, deck: s.decks[deck], noArtifacts }))
      line(`d${deck} ${policy} ${strategy}${noArtifacts ? ' noArt' : ''}`, rows)
    }
  }
  if (part === 'routes18') {
    for (const [policy, strategy] of [['safe','defensive'],['mixed','balanced'],['risky','balanced'],['mixed','aggressive'],['risky','aggressive'],['mixed','planner']]) {
      const n = strategy === 'planner' ? Math.min(N, 100) : N
      const rows = Array.from({ length: n }, (_, i) => s.route(42 + i, { policy, strategy }))
      line(`d18 ${policy} ${strategy}`, rows)
    }
  }
  if (part === 'all' || part === 'elite') {
    console.log('-- elite value: same seeds, forced through elite vs forced around it (mixed policy otherwise) --')
    for (const strategy of ['aggressive', 'balanced', 'defensive', 'planner']) for (const noArtifacts of [false, true]) {
      const n = strategy === 'planner' ? Math.min(N, 100) : N
      const yes = [], no = []
      for (let i = 0; i < n; i++) { const a = s.route(42 + i, { policy: 'mixed', strategy, noArtifacts, forceElite: 'yes' }), b = s.route(42 + i, { policy: 'mixed', strategy, noArtifacts, forceElite: 'no' }); if (a && b) { yes.push(a); no.push(b) } }
      line(`${strategy}${noArtifacts ? ' noArt' : ''} ELITE`, yes); line(`${strategy}${noArtifacts ? ' noArt' : ''} no-elite`, no)
    }
  }
})
