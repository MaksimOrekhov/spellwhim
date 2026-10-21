// Exact (non-simulated) facts about the current catalogue and the starting deck. Output: results/static.json + static.md
//   1. what the six Sector I enemies actually threaten (damage per cycle, who is hit, how many damaging actions);
//   2. hypergeometric facts about a random hand of the 18-card starter deck: classes, defence cards, and the largest
//      amount of armor one hero can receive in ONE turn at a given mana (the number every "armor expires" rule depends on).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { loadEngine } from './engine.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const E = await loadEngine()
const enemies = [...E.sector.sectorOneEnemies, E.sector.sectorOneElite, E.sector.rhahkZor]
const out = { enemies: [], hands: [] }

// ---- 1. enemies
const hitOf = a => (a.kind === 'prepare' ? { ...a.prepared, windup: true } : a)
for (const e of enemies) {
  const phases = [['фаза 1', e.behavior.phase1], ...(e.behavior.phase2 ? [['фаза 2', e.behavior.phase2]] : [])]
  for (const [ph, cycle] of phases) {
    let w = 0, m = 0, dmgActions = 0, windups = 0, quiet = 0
    for (const a of cycle) {
      const h = hitOf(a)
      if (h.kind === 'attack') { if (h.target === 'warrior') w += h.damage; else m += h.damage; dmgActions += 1; if (a.kind === 'prepare') windups += 1 }
      else if (h.kind === 'attack_all') { w += h.damage; m += h.damage; dmgActions += 1 }
      else quiet += 1
      if (a.kind === 'prepare') quiet += 1
    }
    out.enemies.push({ id: e.id, name: e.name, hp: e.maxHealth, phase: ph, actions: cycle.length + cycle.filter(a => a.kind === 'prepare').length, damagingActions: dmgActions, windups, cycleW: w, cycleM: m, share: w / (w + m), perActionTurn: (w + m) / (cycle.length + cycle.filter(a => a.kind === 'prepare').length) })
  }
}

// ---- 2. hands
const types = [...new Set(E.types.startingDeck)]
const defs = types.map(id => E.types.cardDefinition(id))
const armorFor = (d, hero) => {
  let a = 0
  for (const e of d.effects) {
    if (e.type !== 'armor') continue
    if (e.target === 'threatened') a += e.amount
    else if (e.target === 'class:mage' && hero === 'mage') a += e.amount
    else if (e.target === 'class:warrior' && hero === 'warrior') a += e.amount
  }
  return a
}
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r }
function best(counts, mana, hero) {
  // bounded knapsack: maximise armor on `hero` (the threatened one) for the given mana
  const dp = Array(mana + 1).fill(0)
  counts.forEach((c, i) => {
    const a = armorFor(defs[i], hero), cost = defs[i].cost
    for (let k = 0; k < c; k++) for (let m = mana; m >= cost; m--) dp[m] = Math.max(dp[m], dp[m - cost] + a)
  })
  return dp[mana]
}
const total = n => choose(18, n)
for (const n of [5, 6, 7, 8]) {
  const stat = { n, oneClass: 0, noArmorCard: 0, noWarriorCover: 0, noMageCover: 0, expDefenceCards: 0, byMana: {} }
  for (const mana of [3, 4, 5]) for (const hero of ['warrior', 'mage']) stat.byMana[mana + hero] = { ge6: 0, ge8: 0, ge10: 0, ge12: 0, ge13: 0, ge14: 0, mean: 0 }
  const counts = Array(types.length).fill(0)
  const walk = (i, left, weight) => {
    if (i === types.length) {
      if (left !== 0) return
      const p = weight / total(n)
      const cls = new Set(); let armorCards = 0, wcov = 0, mcov = 0
      counts.forEach((c, j) => { if (!c) return; cls.add(defs[j].className); if (defs[j].effects.some(e => e.type === 'armor')) armorCards += c; if (armorFor(defs[j], 'warrior') > 0) wcov += c; if (armorFor(defs[j], 'mage') > 0) mcov += c })
      if (cls.size === 1) stat.oneClass += p
      if (!armorCards) stat.noArmorCard += p
      if (!wcov) stat.noWarriorCover += p
      if (!mcov) stat.noMageCover += p
      stat.expDefenceCards += p * armorCards
      for (const mana of [3, 4, 5]) for (const hero of ['warrior', 'mage']) {
        const b = best(counts, mana, hero), s = stat.byMana[mana + hero]
        s.mean += p * b
        for (const t of [6, 8, 10, 12, 13, 14]) if (b >= t) s['ge' + t] += p
      }
      return
    }
    for (let c = 0; c <= Math.min(2, left); c++) { counts[i] = c; walk(i + 1, left - c, weight * choose(2, c)) }
    counts[i] = 0
  }
  walk(0, n, 1)
  out.hands.push(stat)
}
await E.close()

writeFileSync(resolve(here, '../results/static.json'), JSON.stringify(out, null, 1))
const pc = x => (100 * x).toFixed(1)
const md = []
md.push('### Что угрожает в Секторе I (текущий каталог)\n', '| враг | фаза | HP | ударных действий в цикле | из них замахов | урон по Вариану за цикл | по Джайне | доля Вариана | ходов в цикле | урон за ход игрока (среднее) |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|')
for (const e of out.enemies) md.push(`| ${e.name} | ${e.phase} | ${e.hp} | ${e.damagingActions} | ${e.windups} | ${e.cycleW} | ${e.cycleM} | ${pc(e.share)}% | ${e.actions} | ${e.perActionTurn.toFixed(1)} |`)
md.push('\n### Случайная рука из стартовой колоды (18 карт: 10 Воина / 8 Мага)\n', '| карт в руке | только один класс % | нет ни одной брони % | нет брони для Вариана % | нет брони для Джайны % | карт с броней в среднем |', '|---:|---:|---:|---:|---:|---:|')
for (const h of out.hands) md.push(`| ${h.n} | ${pc(h.oneClass)} | ${pc(h.noArmorCard)} | ${pc(h.noWarriorCover)} | ${pc(h.noMageCover)} | ${h.expDefenceCards.toFixed(2)} |`)
md.push('\n### Сколько брони можно дать ОДНОМУ герою за ход (лучшая раскладка маны из случайной руки)\n', '| карт в руке | мана | герой под ударом | в среднем | ≥6 % | ≥8 % | ≥10 % | ≥12 % | ≥13 % | ≥14 % |', '|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|')
for (const h of out.hands) for (const mana of [3, 4, 5]) for (const hero of ['warrior', 'mage']) { const s = h.byMana[mana + hero]; md.push(`| ${h.n} | ${mana} | ${hero === 'warrior' ? 'Вариан' : 'Джайна'} | ${s.mean.toFixed(1)} | ${pc(s.ge6)} | ${pc(s.ge8)} | ${pc(s.ge10)} | ${pc(s.ge12)} | ${pc(s.ge13)} | ${pc(s.ge14)} |`) }
writeFileSync(resolve(here, '../results/static.md'), md.join('\n') + '\n')
console.log(md.join('\n'))
