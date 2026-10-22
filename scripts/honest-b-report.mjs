// Turns docs/data/honest-turn-b/*.json into the tables of the report (Markdown on stdout). Usage: node scripts/honest-b-report.mjs [dir]
import { readFileSync, existsSync } from 'node:fs'

const dir = process.argv[2] ?? 'docs/data/honest-turn-b'
const read = name => existsSync(`${dir}/${name}.json`) ? JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8')) : null
const enemies = read('enemies'), profiles = read('enemy-profiles'), phases = read('boss-phases'), hands = read('hands'), frost = read('frost'), runs = read('runs'), manifest = read('manifest')
const pct = value => Math.round(value * 100) + '%'
const table = (header, rows) => [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n')
const modeName = { 'honest-a08': 'A ×0,8', 'honest-b1': 'B1', 'honest-b2': 'B2' }
const strategyOrder = ['planner', 'planner-careful', 'balanced', 'defensive', 'aggressive', 'armor-all', 'offense-all']
const enemyOrder = ['raider', 'digger', 'watchman', 'overseer', 'johnson', 'rhahk-zor']
const enemyRu = { raider: 'Налётчик', digger: 'Забойщик', watchman: 'Дозорный', overseer: 'Громила', johnson: 'Джонсон', 'rhahk-zor': 'Рак’Зор' }
const out = []
if (manifest) out.push(`<!-- ${JSON.stringify(manifest)} -->`)

if (enemies) {
  out.push('### Лучший способ играть против каждого врага (оценка: 0 за поражение, иначе доля сохранённого здоровья)\n')
  const rows = []
  for (const enemy of enemyOrder) {
    const cells = [enemyRu[enemy]]
    for (const mode of Object.keys(modeName)) {
      const list = enemies.filter(item => item.mode === mode && item.enemy === enemy)
      const best = [...list].sort((a, b) => b.value - a.value)[0]
      const reflex = list.find(item => item.strategy === 'armor-all'), offense = list.find(item => item.strategy === 'offense-all'), defensive = list.find(item => item.strategy === 'defensive'), planner = list.find(item => item.strategy === 'planner')
      cells.push(`**${best.strategy}** ${best.value.toFixed(2)}`, `${planner.value.toFixed(2)} / ${defensive.value.toFixed(2)} / ${reflex.value.toFixed(2)} / ${offense.value.toFixed(2)}`)
    }
    rows.push(cells)
  }
  out.push(table(['Враг', ...Object.values(modeName).flatMap(name => [`${name}: лучшая`, `${name}: планировщик / защитник / вся броня / без защиты`])], rows))
  out.push('\n### Полные результаты боёв (победы, ходы, потери Вариана и Джайны)\n')
  for (const mode of Object.keys(modeName)) {
    out.push(`**${modeName[mode]}** (${manifest?.defaultDecks[mode]})\n`)
    out.push(table(['Враг', ...strategyOrder.map(strategy => strategy)], enemyOrder.map(enemy => [enemyRu[enemy], ...strategyOrder.map(strategy => { const item = enemies.find(row => row.mode === mode && row.enemy === enemy && row.strategy === strategy); return `${pct(item.win)} · ${item.turns} х · ${item.lostV}/${item.lostJ}` })])))
    out.push('')
  }
}
if (profiles) {
  out.push('### Как отряд отвечает на удар (планировщик): мана на защиту и нападение в ход удара\n')
  out.push(table(['Режим', 'Враг', 'мана на защиту', 'мана на нападение', 'броня выдана → поглощена', 'КПД брони', 'срыв удался', 'Обморожение спасло', 'броня Вариана / Джайны', 'обе брони в ход удара', 'доля потерь Вариана'],
    profiles.map(item => [modeName[item.mode], enemyRu[item.enemy], item.defenseManaOnStrike, item.offenseManaOnStrike, `${item.armorGrantedOnStrike} → ${item.armorAbsorbedOnStrike}`, pct(item.armorEfficiency), item.interruptTried ? pct(item.interruptBroken) : '—', item.chillSavedOnStrike, `${item.armorFromWarriorCards} / ${item.armorFromMageCards}`, pct(item.bothHeroesArmored), pct(item.warriorShareOfLoss)])))
}
if (phases) {
  out.push('\n### Рак’Зор по фазам (планировщик)\n')
  out.push(table(['Режим', 'Фаза', 'ходов', 'потеря за ход', 'потеря Вариана / Джайны', 'мана: защита / нападение', 'броня выдана → поглощена', 'КПД брони', 'урон врагу за ход'],
    phases.map(item => [modeName[item.mode], item.phase === 1 ? 'I' : 'II', item.turnsPerBattle, item.lossPerTurn, `${item.lostV} / ${item.lostJ}`, `${item.defenseMana} / ${item.offenseMana}`, `${item.armorGranted} → ${item.armorAbsorbed}`, pct(item.armorEfficiency), item.damageDealt])))
}
if (hands) {
  out.push('\n### Одна рука, один удар: насколько можно обезопаситься (400 случайных стартовых рук)\n')
  for (const mode of ['honest-b1', 'honest-b2']) {
    out.push(`**${modeName[mode]}**\n`)
    const rows = []
    for (const threat of [...new Set(hands.map(item => item.threat))]) {
      const cells = [hands.find(item => item.threat === threat).label]
      for (const deck of ['armor10', 'armor8', 'armor6']) { const item = hands.find(row => row.mode === mode && row.deck === deck && row.threat === threat); cells.push(`${pct(item.fullyBlockable)} · ${item.meanMinLoss} · ${item.p90MinLoss}`) }
      rows.push(cells)
    }
    out.push(table(['Удар', 'броня 10: без потерь · средняя потеря · 90-й перцентиль', 'броня 8', 'броня 6'], rows))
    out.push('')
  }
  const dmg = hands.filter(item => item.mode === 'honest-b1' && item.threat === 'light-warrior')
  out.push('Максимальный урон врагу за ход (все 4 маны на нападение), по колодам B1: ' + dmg.map(item => `${item.deck}: медиана ${item.maxDamageP50}, 75% ${item.maxDamageP75}, 90% ${item.maxDamageP90}`).join('; '))
}
if (frost) {
  out.push('\n### Мороз и сталь в одной руке\n')
  out.push(table(['Колода', 'Удар', 'рук с хваткой', 'хватка снижает потерю', 'на сколько', 'рук с обеими картами', 'настоящий выбор', 'раскол всегда лучше', 'держать всегда лучше', 'цена раскола, здоровья'],
    frost.map(item => [item.deck, item.threat, item.handsWithGrip, pct(item.frostCutsLoss), item.meanCut, item.handsWithBoth, pct(item.realChoice), pct(item.shatterAlwaysBest), pct(item.holdAlwaysBest), item.extraLossToShatter])))
}
if (runs) {
  out.push('\n### Полные походы сектора I (одни и те же seed в каждом режиме)\n')
  const rows = runs.map(item => [modeName[item.mode], item.deck, item.strategy, item.runs, pct(item.win), item.battlesPerRun, `${item.healthEndV} / ${item.healthEndJ}`, `${item.lostV} / ${item.lostJ}`, Object.entries(item.diedAt).map(([k, v]) => `${enemyRu[k] ?? k}:${v}`).join(' ')])
  out.push(table(['Режим', 'Колода', 'Игрок', 'Походов', 'Побед', 'Боёв', 'Здоровье в конце В / Д', 'Потеряно В / Д', 'Погибли на'], rows))
}
console.log(out.join('\n'))
