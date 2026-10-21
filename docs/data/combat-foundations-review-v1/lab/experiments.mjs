import { rules } from './engine.mjs'
import { combine, reserve, windupBreak, bloodPact, heroPowers, relay, phaseAt, phaseArmor } from './extras.mjs'
import { armorCap, weak, punish, formation, registerCards, swapDeck, CHILL, CHILL_BOLT, PUNISH, PUNISH_PLUS } from './extras2.mjs'

export const cellKey = c => [c.rules.id, c.policy, c.shape.name, 'dmg' + (c.scale?.dmg ?? 1), 'hp' + (c.scale?.hp ?? 1), 'w' + (c.scale?.windup ?? 1), c.heroHp ? 'h' + c.heroHp.join('-') : ''].filter(Boolean).join('|')

const late3 = { perTurn: 2, boost: { fromTurn: 5, amount: 3 } }
export const RULESETS = {
  // Current game (main 8d4ffd6): hand and armor persist.
  R0: rules('R0', { label: 'main: рука 8, добор 2/3, мана 3-4-5, всё сохраняется', hand: 8, draw: late3, mana: [3, 4, 5], discard: false, armor: 'persist' }),
  // Single-factor probes on the current game.
  R0c: rules('R0c', { label: 'R0 + броня сгорает к ходу героев', hand: 8, draw: late3, mana: [3, 4, 5], discard: false, armor: 'turn' }),
  D0: rules('D0', { label: 'R0 + сброс руки + сгорание брони (добор 2/3: «сломанная» экономика)', hand: 8, draw: late3, mana: [3, 4, 5], discard: true, armor: 'turn' }),
  // The four candidate packages of the original research.
  P1: rules('P1', { label: 'P1: 5 карт, мана 3, сброс, броня сгорает', hand: 5, mana: [3] }),
  P2: rules('P2', { label: 'P2: 6 карт, мана 3→4, сброс, броня сгорает', hand: 6, mana: [3, 4] }),
  // Grid points around them.
  H5M4: rules('H5M4', { label: '5 карт, мана 4', hand: 5, mana: [4] }),
  H5M34: rules('H5M34', { label: '5 карт, мана 3→4', hand: 5, mana: [3, 4] }),
  H5M345: rules('H5M345', { label: '5 карт, мана 3→4→5', hand: 5, mana: [3, 4, 5] }),
  H6M3: rules('H6M3', { label: '6 карт, мана 3', hand: 6, mana: [3] }),
  H6M4: rules('H6M4', { label: '6 карт, мана 4', hand: 6, mana: [4] }),
  H7M4: rules('H7M4', { label: '7 карт, мана 4', hand: 7, mana: [4] }),
  H8M4: rules('H8M4', { label: '8 карт, мана 4', hand: 8, mana: [4] }),
  H4M3: rules('H4M3', { label: '4 карты, мана 3', hand: 4, mana: [3] }),
  H4M2: rules('H4M2', { label: '4 карты, мана 2', hand: 4, mana: [2] }),
}

const S3 = { name: 'S3', normals: 2, elite: false }
const S4 = { name: 'S4', normals: 2, elite: true }
const SB = { name: 'boss', normals: 0, elite: false }

const cell = (r, policy, shape, extra = {}) => ({ rules: RULESETS[r] ?? r, policy, shape, ...extra })

/** The three prototype concepts of the report, on the common base 7 cards / mana 4 / discard / armor cleared each turn. */
export function concepts(E) {
  registerCards(E, [CHILL, CHILL_BOLT, PUNISH, PUNISH_PLUS])
  const base = { hand: 7, mana: [4] }
  const W2 = swapDeck(E.types.startingDeck, [['arcane-insight', 'chill', 2], ['sword-strike', 'punish', 2]])
  return {
    A: rules('A', { ...base, label: 'A · Честный ход' }),
    B: rules('B', { ...base, label: 'B · Мороз и сталь: Ослабление + Добить + Резерв', extras: combine(reserve(1), weak(), punish()), deck: W2 }),
    C: rules('C', { ...base, label: 'C · Приёмы героев + Резерв', extras: combine(reserve(1), heroPowers({ armor: 3, cost: 1 })) }),
  }
}

export function experiments(E) {
  registerCards(E, [CHILL, CHILL_BOLT, PUNISH, PUNISH_PLUS])
  const W1 = swapDeck(E.types.startingDeck, [['arcane-insight', 'chill', 2]])
  const W2 = swapDeck(E.types.startingDeck, [['arcane-insight', 'chill', 2], ['sword-strike', 'punish', 2]])
  const pols = ['tempo', 'balanced', 'careful']
  const ex = {}
  ex.baseline = { cells: [...pols].flatMap(p => [cell('R0', p, S3), cell('R0', p, S4)]) }
  ex.grid = {
    cells: ['R0', 'R0c', 'D0', 'P1', 'P2', 'H5M4', 'H5M34', 'H5M345', 'H6M3', 'H6M4', 'H7M4', 'H8M4', 'H4M3', 'H4M2'].flatMap(r => pols.map(p => cell(r, p, S4))),
  }
  ex.factors = {
    cells: (() => {
      const out = []
      for (const hand of [5, 6, 7, 8]) for (const [mn, mana] of [['3', [3]], ['4', [4]], ['34', [3, 4]], ['345', [3, 4, 5]]]) for (const armor of ['turn', 'persist']) {
        const r = rules('F' + hand + 'M' + mn + (armor === 'turn' ? 'c' : 'p'), { label: hand + ' карт, мана ' + mana.join('→') + ', сброс, броня ' + (armor === 'turn' ? 'сгорает' : 'сохраняется'), hand, mana, armor })
        for (const p of ['balanced', 'careful']) out.push(cell(r, p, S4))
      }
      return out
    })(),
  }
  ex.pressure = {
    cells: ['R0', 'H7M4', 'H6M4', 'P2'].flatMap(r => [0.5, 0.75, 1, 1.25, 1.5].flatMap(d => ['tempo', 'careful'].map(p => cell(r, p, S4, { scale: { dmg: d } })))),
  }
  ex.length = {
    cells: ['R0', 'H7M4'].flatMap(r => [1, 1.25, 1.5, 1.75, 2].flatMap(h => ['tempo', 'careful'].map(p => cell(r, p, S4, { scale: { hp: h } })))),
  }
  const base = { hand: 6, mana: [4] }
  const withX = (id, label, x) => rules(id, { ...base, label, extras: x })
  ex.extras = {
    cells: [
      rules('H6M4', { ...base, label: 'база: 6 карт, мана 4' }),
      withX('+Резерв1', 'база + Резерв 1', combine(reserve(1))),
      withX('+Резерв2', 'база + Резерв 2', combine(reserve(2))),
      withX('+Срыв10/3', 'база + Срыв замаха (10 урона → −3)', combine(windupBreak({ threshold: 10, cut: 3 }))),
      withX('+Срыв14/4', 'база + Срыв замаха (14 урона → −4)', combine(windupBreak({ threshold: 14, cut: 4 }))),
      withX('+Связка+2', 'база + связка классов (потолок, +2 на каждой карте)', combine(relay({ bonus: 2 }))),
    ].flatMap(r => pols.map(p => cell(r, p, S4))),
  }
  ex.iso = {
    cells: [
      rules('H6M4', { ...base, label: 'база: 6 карт, мана 4' }),
      withX('+Резерв1', 'база + Резерв 1', combine(reserve(1))),
      withX('+Срыв10/3', 'база + Срыв замаха (10 урона → −3)', combine(windupBreak({ threshold: 10, cut: 3 }))),
      withX('+Срыв14/4', 'база + Срыв замаха (14 урона → −4)', combine(windupBreak({ threshold: 14, cut: 4 }))),
      withX('+Связка+2', 'база + связка классов (потолок, +2)', combine(relay({ bonus: 2 }))),
    ].flatMap(r => [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6].flatMap(d => pols.map(p => cell(r, p, S4, { scale: { dmg: d } })))),
  }
  const B = { hand: 6, mana: [4] }
  const rx = (id, label, extras, deck, spec = {}) => rules(id, { ...B, label, extras, deck, ...spec })
  ex.armor = {
    cells: [6, 7].flatMap(hand => ['turn', 'half', 'persist'].flatMap(armor => [1, 0.8].flatMap(w => pols.map(p => cell(rules('A' + hand + armor, { hand, mana: [4], armor, label: hand + ' карт, мана 4, броня: ' + armor }), p, S4, { scale: { windup: w } }))))),
  }
  ex.mech2 = {
    cells: [
      rx('база', 'база: 6 карт, мана 4', null, null),
      rx('+Ослабление', 'база + Ослабление (2 Тайных предвидения → 2 Оцепенения)', combine(weak()), W1),
      rx('+Ослабл.+Добить', 'база + Ослабление + Добить ослабленного', combine(weak(), punish()), W2),
      rx('+Строй', 'база + Строй (последний ходивший — впереди)', combine(formation()), null),
      rx('+Строй(1)', 'база + Строй, обмен местами за 1 ману', combine(formation({ swapCost: 1 })), null),
      rx('+Приёмы3', 'база + приёмы героев (1 мана → 3 брони)', combine(heroPowers({ armor: 3, cost: 1 })), null),
      rx('+Резерв1+Приёмы3', 'база + Резерв 1 + приёмы героев', combine(reserve(1), heroPowers({ armor: 3, cost: 1 })), null),
      rx('+Резерв1+Ослабл.+Добить', 'база + Резерв 1 + Ослабление + Добить', combine(reserve(1), weak(), punish()), W2),
      rx('+Клятва4/1', 'база + Клятва (4 HP → +1 мана, HP бота ×3)', combine(bloodPact({ hp: 4, mana: 1 })), null),
      rx('+Клятва6/2', 'база + Клятва (6 HP → +2 маны, HP бота ×3)', combine(bloodPact({ hp: 6, mana: 2 })), null),
    ].flatMap(r => [1, 1.15, 1.3, 1.45].flatMap(d => pols.map(p => cell(r, p, S4, { scale: { dmg: d } })))),
  }
  ex.pace = {
    cells: [6, 7].flatMap(hand => [1.5, 2].flatMap(h => [0.6, 0.7, 0.8, 0.9].flatMap(d => pols.map(p => cell(rules('H' + hand + 'M4', { hand, mana: [4] }), p, S4, { scale: { hp: h, dmg: d } }))))),
  }
  ex.phase2 = {
    cells: [cell('R0', 'balanced', SB), cell('H6M4', 'balanced', SB), cell('H6M4', 'careful', SB), cell('H6M4', 'tempo', SB),
      ...['balanced', 'careful', 'tempo'].map(p => cell(rules('H6M4+обвал6', { ...B, label: 'база + «Обвал»: +6 брони боссу при переходе', extras: combine(phaseArmor(6)) }), p, SB)),
      ...['balanced', 'careful', 'tempo'].map(p => cell(rules('H6M4+фаза60', { ...B, label: 'база + порог фазы 60 %', extras: combine(phaseAt(0.6)) }), p, SB))],
  }
  const K = concepts(E)
  ex.final = {
    cells: [K.A, K.B, K.C].flatMap(r => [[1.75, 0.7], [1.75, 0.8], [2, 0.7], [2, 0.8]].flatMap(([h, d]) => [S3, S4].flatMap(shape => pols.map(p => cell(r, p, shape, { scale: { hp: h, dmg: d } }))))),
  }
  ex.final2 = {
    cells: [K.B, K.C].flatMap(r => [0.9, 1.0, 1.1, 1.2].flatMap(d => pols.map(p => cell(r, p, S4, { scale: { hp: 1.75, dmg: d } })))),
  }
  const P = (id, label, hand, draw, extras) => rules(id, { label, hand, draw: { perTurn: draw }, mana: [3, 4, 5], discard: false, armor: 'persist', extras })
  const lateBoost = { perTurn: 2, boost: { fromTurn: 5, amount: 3 } }
  ex.r0fam = {
    cells: [
      RULESETS.R0,
      P('L6d2', 'Хартстоун-стиль: рука 6, добор 2, мана 3→4→5, всё сохраняется', 6, 2),
      P('L5d2', 'рука 5, добор 2', 5, 2),
      P('L6d1', 'рука 6, добор 1', 6, 1),
      rules('R0cap6', { label: 'R0 + предел брони 6 на героя', hand: 8, draw: lateBoost, mana: [3, 4, 5], discard: false, armor: 'persist', extras: combine(armorCap(6)) }),
      rules('R0cap4', { label: 'R0 + предел брони 4 на героя', hand: 8, draw: lateBoost, mana: [3, 4, 5], discard: false, armor: 'persist', extras: combine(armorCap(4)) }),
      P('L6d2cap6', 'рука 6, добор 2, предел брони 6', 6, 2, combine(armorCap(6))),
    ].flatMap(r => [1, 1.1, 1.2, 1.3, 1.4, 1.5].flatMap(d => pols.map(p => cell(r, p, S4, { scale: { dmg: d } })))),
  }
  return ex
}
