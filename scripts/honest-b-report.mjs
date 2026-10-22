// Turns docs/data/honest-turn-b/*.json into the tables of the report.
//   node scripts/honest-b-report.mjs                      all sections as Markdown on stdout
//   node scripts/honest-b-report.mjs --inject <file.md>   fills every <!--TABLE:name--> marker (and refreshes <!--BEGIN:name-->…<!--END:name--> blocks) in the file
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const args = process.argv.slice(2)
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'docs/data/honest-turn-b'
const inject = args.includes('--inject') ? args[args.indexOf('--inject') + 1] : null
const read = name => existsSync(`${dir}/${name}.json`) ? JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8')) : null
const enemies = read('enemies'), profiles = read('enemy-profiles'), phases = read('boss-phases'), hands = read('hands'), frost = read('frost'), runs = read('runs'), manifest = read('manifest')
const pct = value => Math.round(value * 100) + '%'
const table = (header, rows) => [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map(row => `| ${row.join(' | ')} |`)].join('\n')
const modeName = { 'honest-a08': 'A ×0,8', 'honest-b1': 'B1', 'honest-b2': 'B2' }
const strategyOrder = ['planner', 'planner-careful', 'balanced', 'defensive', 'aggressive', 'armor-all', 'offense-all']
const enemyOrder = ['raider', 'digger', 'watchman', 'overseer', 'johnson', 'rhahk-zor']
const enemyRu = { raider: 'Налётчик', digger: 'Забойщик', watchman: 'Дозорный', overseer: 'Громила', johnson: 'Джонсон', 'rhahk-zor': 'Рак’Зор' }
const sections = {}

if (enemies) {
  const rows = enemyOrder.map(enemy => {
    const cells = [enemyRu[enemy]]
    for (const mode of Object.keys(modeName)) {
      const list = enemies.filter(item => item.mode === mode && item.enemy === enemy)
      const best = [...list].sort((a, b) => b.value - a.value)[0]
      const get = strategy => list.find(item => item.strategy === strategy).value.toFixed(2)
      cells.push(`**${best.strategy}** ${best.value.toFixed(2)}`, `${get('planner-careful')} / ${get('defensive')} / ${get('armor-all')} / ${get('offense-all')}`)
    }
    return cells
  })
  sections.best = table(['Враг', ...Object.values(modeName).flatMap(name => [`${name}: лучший игрок`, `${name}: осторожный планировщик / защитник / вся броня / без защиты`])], rows)
  for (const mode of Object.keys(modeName)) {
    sections['full-' + mode] = table(['Враг', ...strategyOrder], enemyOrder.map(enemy => [enemyRu[enemy], ...strategyOrder.map(strategy => { const item = enemies.find(row => row.mode === mode && row.enemy === enemy && row.strategy === strategy); return `${pct(item.win)} · ${item.turns} · ${item.lostV}/${item.lostJ}` })]))
  }
}
if (profiles) {
  sections.profile = table(['Режим', 'Враг', 'мана на защиту', 'мана на нападение', 'броня: выдано → поглощено', 'КПД брони', 'срыв удался', 'Обморожение сняло', 'обе героя в броне'],
    profiles.map(item => [modeName[item.mode], enemyRu[item.enemy], item.defenseManaOnStrike, item.offenseManaOnStrike, `${item.armorGrantedOnStrike} → ${item.armorAbsorbedOnStrike}`, pct(item.armorEfficiency), item.interruptTried ? pct(item.interruptBroken) : '—', item.chillSavedOnStrike, pct(item.bothHeroesArmored)]))
  sections.protect = table(['Режим', 'Враг', 'Вариан: броня от своих карт', 'Вариан: броня от карт Джайны', 'Джайна: броня от карт Вариана', 'Джайна: броня от своих карт', 'Мороз (карта Джайны)', 'ход удара, где помогли карты Вариана', 'где помогли карты Джайны', 'потеряно В / Д'],
    profiles.map(item => [modeName[item.mode], enemyRu[item.enemy], item.armorOnVarianFromVarian, item.armorOnVarianFromJaina, item.armorOnJainaFromVarian, item.armorOnJainaFromJaina, item.chillSavedOnStrike, pct(item.varianCardsHelped), pct(item.jainaCardsHelped), `${item.varianLossPerBattle} / ${item.jainaLossPerBattle}`]))
  sections.idle = table(['Режим', 'Враг', 'ходов с ≥3 неистраченной маны и playable-картой в руке'], profiles.map(item => [modeName[item.mode], enemyRu[item.enemy], pct(item.manaLeftTurns3Plus)]))
}
if (phases) {
  sections.phases = table(['Режим', 'Фаза', 'ходов', 'потеря за ход', 'потеря Вариана / Джайны', 'мана: защита / нападение', 'броня: выдано → поглощено', 'КПД брони', 'урон врагу за ход'],
    phases.map(item => [modeName[item.mode], item.phase === 1 ? 'I' : 'II', item.turnsPerBattle, item.lossPerTurn, `${item.lostV} / ${item.lostJ}`, `${item.defenseMana} / ${item.offenseMana}`, `${item.armorGranted} → ${item.armorAbsorbed}`, pct(item.armorEfficiency), item.damageDealt]))
}
if (hands) {
  for (const mode of ['honest-b1', 'honest-b2']) {
    const rows = [...new Set(hands.map(item => item.threat))].map(threat => {
      const cells = [hands.find(item => item.threat === threat).label]
      for (const deck of ['armor10', 'armor8', 'armor6']) { const item = hands.find(row => row.mode === mode && row.deck === deck && row.threat === threat); cells.push(`${pct(item.fullyBlockable)} · ${item.meanMinLoss} · ${item.p90MinLoss} · ${pct(item.loses9Plus)}`) }
      return cells
    })
    sections['hands-' + mode] = table(['Удар', 'броня 10', 'броня 8', 'броня 6'], rows)
  }
  sections.damage = table(['Колода', 'медиана', '75%', '90%'], ['armor10', 'armor8', 'armor6'].map(deck => { const item = hands.find(row => row.mode === 'honest-b1' && row.deck === deck && row.threat === 'light-warrior'); return [deck, item.maxDamageP50, item.maxDamageP75, item.maxDamageP90] }))
  sections['safe-damage'] = table(['Удар', 'броня 10: урон врагу при безопасной игре / допуская потерю 3', 'броня 8', 'броня 6'], [...new Set(hands.map(item => item.threat))].map(threat => [hands.find(item => item.threat === threat).label, ...['armor10', 'armor8', 'armor6'].map(deck => { const item = hands.find(row => row.mode === 'honest-b1' && row.deck === deck && row.threat === threat); return `${item.damageWhenSafest} / ${item.damageAllowing3}` })]))
}
if (frost) {
  sections.frost = table(['Колода', 'Удар', 'рук с хваткой', 'хватка снижает потерю', 'на сколько', 'рук с обеими картами', 'настоящий выбор', 'раскол всегда лучше', 'держать всегда лучше', 'цена раскола, здоровья'],
    frost.filter(item => item.deck === 'armor8').map(item => [item.deck, item.threat, item.handsWithGrip, pct(item.frostCutsLoss), item.meanCut, item.handsWithBoth, pct(item.realChoice), pct(item.shatterAlwaysBest), pct(item.holdAlwaysBest), item.extraLossToShatter]))
}
if (runs) {
  const row = item => [modeName[item.mode], item.deck, item.strategy, item.runs, pct(item.win), item.battlesPerRun, `${item.healthEndV} / ${item.healthEndJ}`, `${item.lostV} / ${item.lostJ}`, Object.entries(item.diedAt).map(([k, v]) => `${enemyRu[k] ?? k}:${v}`).join(' ')]
  const head = ['Режим', 'Колода', 'Игрок', 'Походов', 'Побед', 'Боёв', 'Здоровье в конце В / Д', 'Потеряно В / Д', 'Погибли на']
  sections.runs = table(head, runs.filter(item => ['planner-careful', 'defensive'].includes(item.strategy)).map(row))
  sections['runs-all'] = table(head, runs.map(row))
  sections['runs-summary'] = table(['Режим / колода', 'осторожный планировщик', 'планировщик', 'защитник', 'сбалансированный'],
    [['honest-a08', 'armor10'], ['honest-a08', 'armor8'], ['honest-a08', 'armor6'], ['honest-b1', 'armor10'], ['honest-b1', 'armor8'], ['honest-b1', 'armor6'], ['honest-b2', 'armor10'], ['honest-b2', 'armor8'], ['honest-b2', 'armor6']].map(([mode, deck]) => [`${modeName[mode]} · ${deck}`, ...['planner-careful', 'planner', 'defensive', 'balanced'].map(strategy => { const item = runs.find(entry => entry.mode === mode && entry.deck === deck && entry.strategy === strategy); return item ? pct(item.win) : '—' })]))
}

if (inject) {
  const raw = readFileSync(inject, 'utf8')
  const crlf = raw.includes('\r\n')
  let text = raw.replace(/\r\n/g, '\n')
  text = text.replace(/<!--BEGIN:([\w-]+)-->[\s\S]*?<!--END:\1-->/g, (_, name) => `<!--TABLE:${name}-->`)
  const missing = []
  text = text.replace(/<!--TABLE:([\w-]+)-->/g, (_, name) => { if (!sections[name]) { missing.push(name); return `<!--TABLE:${name}-->` } return `<!--BEGIN:${name}-->\n${sections[name]}\n<!--END:${name}-->` })
  writeFileSync(inject, crlf ? text.replace(/\n/g, '\r\n') : text)
  if (missing.length) console.error('No data for: ' + missing.join(', '))
  else console.log('Injected ' + Object.keys(sections).length + ' sections into ' + inject)
} else {
  console.log([manifest ? `<!-- ${JSON.stringify(manifest)} -->` : '', ...Object.entries(sections).map(([name, body]) => `<!--SECTION:${name}-->\n${body}`)].join('\n\n'))
}
