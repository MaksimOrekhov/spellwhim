import { cfg, cross, register } from './suites'

const hpScales = [1, 1.5, 2, 2.5, 3]
const dmgScales = [1, 1.25, 1.5]

/* S2: enemy HP / damage scaling grid for the main mana models. */
register({
  id: 's2', title: 'Сетка HP и урона врагов',
  jobs: () => {
    const configs = ['A', 'B', 'C', 'D', 'F4', 'G', 'PG'].flatMap(m => hpScales.flatMap(h => dmgScales.map(d => cfg(`${m}|hp${h}|dmg${d}`, m, { enemy: { hpScale: h, damageScale: d } }))))
    return cross(configs, ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'])
  },
})

/* S3: iso-tension comparison. Enemy HP/damage are calibrated per mana model (and difficulty lever) so that fights last
 * ~4/5/8 turns and the party loses ~20 of 43 HP against the planner bot; then every bot is evaluated on held-out seeds. */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { leverConfig } from './calibrate'
import type { Calibration, Lever } from './calibrate'
import type { BotId } from './core'
import { allBots } from './suites'

export function loadCalibrations(tag: string): Calibration[] {
  const dir = join('research', 'mana', 'results', 'calib-' + tag)
  if (existsSync(dir)) return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as Calibration)
  // Fresh checkout: fall back to the committed parameters (research/mana/calibrations.json).
  const committed = join('research', 'mana', 'calibrations.json')
  if (!existsSync(committed)) return []
  return (JSON.parse(readFileSync(committed, 'utf8')) as (Calibration & { tag: string })[]).filter(c => c.tag === tag)
}
export function calibratedJobs(tag: string, bots: BotId[], filter: (c: Calibration) => boolean = () => true) {
  return cross(loadCalibrations(tag).filter(filter).map(c => leverConfig(c.model, c.lever as Lever, c.hp, c.dmg, c.variant ?? 'base')), bots)
}
register({ id: 's3', title: 'Равное напряжение: все модели маны', jobs: () => calibratedJobs('std', allBots, c => c.lever === 'hp') })
register({ id: 's3b', title: 'Рычаги сложности при равной длине боя', jobs: () => calibratedJobs('std', ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced'], c => c.lever !== 'hp' || ['A', 'B', 'D', 'G', 'PG'].includes(c.model)) })

/* S4: card costs / concept cards, S5: draw & hand. Each variant has its own calibrated enemies (equal fight length and HP loss). */
const mainBots: BotId[] = ['plan-even', 'plan-aggro', 'plan-safe', 'greedy-balanced']
const tagJobs = (tags: string[], models: string[]) => tags.flatMap(tag => calibratedJobs(tag, mainBots, c => c.lever === 'hp' && models.includes(c.model)))
register({ id: 's4', title: 'Стоимость карт и концепты 3–5 маны', jobs: () => tagJobs(['std', 'v-concept', 'v-costup', 'v-concept-costup'], ['A', 'B', 'C', 'D', 'G', 'BG']) })
register({ id: 's5', title: 'Добор и размер руки', jobs: () => tagJobs(['std', 'v-draw3', 'v-draw4', 'v-open6draw3', 'v-concept-draw3'], ['A', 'B', 'C', 'D', 'G']) })

/* S3c: additional shapes of the ramp and hybrid models, calibrated like S3. */
register({ id: 's3c', title: 'Дополнительные формы роста и гибриды', jobs: () => calibratedJobs('std2', allBots, c => c.lever === 'hp') })

/* S6: finalists on fresh held-out seeds (20000+): every model x {base cards, new cost curve, new cost curve + draw 3}. */
register({
  id: 's6', title: 'Финалисты на свежих seed',
  jobs: () => tagJobs(['std', 'std2', 'v-concept-costup', 'v-concept-costup-draw3'], ['A', 'B', 'C', 'D', 'S', 'U', 'G', 'G1', 'PG1', 'BG1']),
})

/* S7: campaign-level progression: the mana cap itself grows with the route (4 / 5 / 6), ramp restarts every fight. */
register({ id: 's7', title: 'Потолок маны растёт по маршруту', jobs: () => tagJobs(['std3', 'v-concept-draw3', 'v-draw3'], ['KR']) })

/* S8: unspent-mana bank only makes sense when something costs more than the turn's mana: test it with the concept cards. */
register({ id: 's8', title: 'Копилка маны с дорогими картами', jobs: () => tagJobs(['v-concept'], ['A', 'B', 'E', 'E2', 'G']) })

/* S9: boss design: redesigned patterns everywhere, escalation + reactive armor only on the final encounter. */
register({ id: 's9', title: 'Дизайн босса: паттерны + давление только на боссе', jobs: () => calibratedJobs('boss', mainBots, () => true) })

/* S10: the package: redesigned patterns + boss-only pressure (lever 'boss') on fresh seeds (30000+), with and without draw 3. */
register({
  id: 's10', title: 'Пакет: паттерны + давление босса, финалисты',
  jobs: () => [...calibratedJobs('boss', mainBots, c => ['A', 'B', 'U', 'S', 'G1', 'UG1'].includes(c.model)), ...calibratedJobs('boss-draw3', mainBots, () => true), ...calibratedJobs('boss-draw3late', mainBots, () => true)],
})

/* S11: the one-shot "culmination" burst (+2 mana on a turn of the player's choosing, once per battle). */
register({ id: 's11', title: 'Кульминация: разовый всплеск маны', jobs: () => calibratedJobs('surge', ['plan-even', 'plan-aggro', 'plan-safe'], () => true) })
