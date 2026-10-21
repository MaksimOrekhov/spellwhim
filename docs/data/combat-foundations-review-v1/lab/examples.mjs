// Prints real turns from the engine: the hand, the announced enemy action and the Pareto frontier of everything the party
// could do (damage to the enemy vs health lost). Used to write the worked examples of the report, so no example is invented.
//   node docs/data/combat-foundations-review-v1/lab/examples.mjs <ruleId> <enemyIndex> <seed> [turns=2] [dmgScale=1] [hpScale=1]
//   enemy index: 0..3 normals, 4 Johnson, 5 Rak'Zor.  <ruleId> is a key of RULESETS or CONCEPTS.
import { loadEngine, planTurn, pick, POLICIES, playBattle, playOne, endRound, economyFor, scaleEncounter, tensionOf } from './engine.mjs'
import { RULESETS, concepts } from './experiments.mjs'

const [ruleId, enemyIndex = '0', seed = '1', turns = '2', scale = '1', hpScale = '1'] = process.argv.slice(2)
const E = await loadEngine()
const r = RULESETS[ruleId] ?? concepts(E)[ruleId]
if (!r) throw new Error('unknown ruleset ' + ruleId)
const enemies = [...E.sector.sectorOneEnemies, E.sector.sectorOneElite, E.sector.rhahkZor]
const enc = scaleEncounter(enemies[Number(enemyIndex)], { dmg: Number(scale), hp: Number(hpScale) })
const x = r.extras
const name = id => E.types.cardDefinition(id.replace(/^relay:/, '').split(':')[0]).name
const cardName = id => name(s.hand.find(c => c.instanceId === id)?.definitionId ?? 'guard')
const step = q => (q.kind === 'card' ? name(q.key) + (q.variant ? '*' : '') : q.key.startsWith('power:') ? 'Приём ' + (q.key.endsWith('warrior') ? 'Вариана' : 'Джайны') + ' (3 брони)' : q.key)
const hero = id => (id === 'warrior' ? 'Вариан' : 'Джайна')
const act = a => {
  const h = a.kind === 'prepare' ? a.prepared : a
  const t = h.kind === 'attack' ? hero(h.target) : h.kind === 'attack_all' ? 'оба (гл. ' + hero(h.primaryTarget) + ')' : ''
  return a.kind === 'prepare' ? `ЗАМАХ «${a.name}» → по ${t} (размер скрыт)` : a.kind === 'attack' || a.kind === 'attack_all' ? `«${a.name}»: ${a.damage} по ${t}` : `«${a.name}»: +${a.armor} брони врагу`
}
const s = E.campaign.createCampaignBattle({ encounter: enc, deck: r.deck ?? E.types.startingDeck, seed: Number(seed), economy: economyFor(E, r), battleId: 'ex/' + seed })
x?.init?.(s)
const policy = POLICIES.balanced
for (let t = 1; t <= Number(turns) && !s.result; t++) {
  x?.turnStart?.(s)
  const hand = s.hand.map(c => name(c.definitionId) + ' (' + E.progression.resolveCardDefinition(c).cost + ')').sort()
  console.log(`\n=== ${enc.name}, ход ${s.turn}: мана ${s.mana}, враг ${s.enemy.health}/${s.enemy.maxHealth}${s.enemy.armor ? ' бр.' + s.enemy.armor : ''}, Вариан ${s.heroes.warrior.health} (бр.${s.heroes.warrior.armor}), Джайна ${s.heroes.mage.health} (бр.${s.heroes.mage.armor})`)
  console.log('Намерение: ' + act(s.enemy.nextAction))
  console.log('Рука: ' + hand.join(', '))
  const plan = planTurn(E, s, r)
  const byKey = new Map()
  for (const l of plan.leaves) {
    const k = (l.seq.map(step).join(' → ') || '(ничего)') + (l.keep.length ? '  [в резерв: ' + l.keep.map(cardName).join(', ') + ']' : '')
    const prev = byKey.get(k)
    if (!prev || l.hp < prev.hp) byKey.set(k, { k, dmg: l.dmg, hp: l.hp, win: l.victory, keep: l.keep.length })
  }
  const all = [...byKey.values()]
  const frontier = all.filter(a => !all.some(b => b !== a && b.dmg >= a.dmg && b.hp <= a.hp && (b.dmg > a.dmg || b.hp < a.hp))).sort((a, b) => a.hp - b.hp || b.dmg - a.dmg)
  console.log(`Линий: ${all.length}. Граница (урон врагу ↑ / потеря HP ↓):`)
  for (const f of frontier.slice(0, 8)) console.log(`  урон ${f.dmg.toFixed(1)} · потеря ${f.hp} HP${f.win ? ' · УБИВАЕТ' : ''} · ${f.k}`)
  const picks = Object.values(POLICIES).map(p => ({ p: p.name, l: pick(plan.leaves, p) }))
  for (const { p, l } of picks) console.log(`  [${p}] → ${l.seq.map(step).join(' → ') || '(ничего)'}${l.keep.length ? ' [в резерв: ' + l.keep.map(cardName).join(', ') + ']' : ''} (урон ${l.dmg.toFixed(1)}, −${l.hp} HP)`)
  const tn = tensionOf(plan.leaves)
  if (tn) console.log(`  свободная защита: ${tn.free ? 'да' : 'нет'} · безопасной линии нет: ${tn.unsafe ? 'да' : 'нет'} · разные боты → разные линии: ${tn.diverge ? 'да' : 'нет'}`)
  // advance the live battle with the balanced policy
  let guard = 0, keep = []
  while (!s.result && guard++ < 40) {
    const p = planTurn(E, s, r); const b = pick(p.leaves, policy); keep = b.keep ?? []
    if (!b.seq.length) break
    let replan = false
    for (const q of b.seq) { if (q.kind === 'card') playOne(E, s, q.id, q.variant, x); else x.actions(E, s).find(o => o.key === q.key).apply(s); if (q.draws) { replan = true; break } }
    if (!replan) break
  }
  if (!s.result) { x?.beforeEnd?.(E, s, null); endRound(E, s, r, keep) }
}
await E.close()
