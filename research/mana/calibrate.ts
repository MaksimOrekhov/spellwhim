import { runCampaign } from './core'
import type { BotId, ResearchConfig } from './core'
import { redesigned } from './encounters'
import { cfg } from './suites'
import { variants } from './variants'
import { summarize } from './stats'
import type { Summary } from './stats'

export type Lever = 'hp' | 'escalate' | 'reactive' | 'pattern' | 'boss'
export const levers: Lever[] = ['hp', 'escalate', 'reactive', 'pattern', 'boss']

/** Builds a configuration for a mana model + difficulty lever at the given per-encounter HP scales and damage scale. */
export function leverConfig(model: string, lever: Lever, hp: number[], dmg: number, variant = 'base'): ResearchConfig {
  const rest = variants[variant]
  if (!rest) throw new Error('unknown variant ' + variant)
  const id = `${model}${variant === 'base' ? '' : '+' + variant}|${lever}|hp${hp.map(x => x.toFixed(2)).join('/')}|d${dmg.toFixed(2)}`
  const base = { hpScale: hp, damageScale: dmg }
  const enemy =
    lever === 'hp' ? base
      : lever === 'escalate' ? { ...base, rampStart: 4, rampEvery: 2, rampBonus: 1 }
        : lever === 'reactive' ? { ...base, reactiveArmorDivisor: 4 }
          : lever === 'pattern' ? { ...base, encounters: redesigned }
            // 'boss': redesigned patterns, and only the final encounter gets escalation (+1 per 2 turns from turn 5) and reactive armor.
            : { ...base, encounters: redesigned, rampStart: 5, rampEvery: 2, rampBonus: 1, rampScope: [2], reactiveArmorDivisor: 4, reactiveScope: [2] }
  return cfg(id, model, { enemy, ...rest })
}

export interface Calibration { model: string; lever: Lever; variant?: string; hp: number[]; dmg: number; summary: Summary; iterations: number }

function evaluate(config: ResearchConfig, bot: BotId, runs: number, seed: number): Summary {
  const records = Array.from({ length: runs }, (_, i) => runCampaign((seed + i) >>> 0, bot, config))
  return summarize(records, bot, config.id)
}

/**
 * Finds enemy HP scales (per encounter) and a damage scale such that the planner needs ~`turns` turns per battle
 * and the party loses ~`loss` HP over the campaign. Fixed seeds, so the search is deterministic.
 */
export function calibrate(model: string, lever: Lever, turns: number[], loss: number, bot: BotId = 'plan-even', runs = 120, seed = 42, variant = 'base'): Calibration {
  let hp = [1.5, 1.5, 1.5]
  let dmg = 1.25
  let summary = evaluate(leverConfig(model, lever, hp, dmg, variant), bot, runs, seed)
  let iterations = 0
  for (; iterations < 7; iterations += 1) {
    hp = hp.map((h, i) => Math.min(8, Math.max(0.5, h * Math.pow(turns[i]! / Math.max(0.8, summary.encounterTurns[i]!), 0.9))))
    summary = evaluate(leverConfig(model, lever, hp, dmg, variant), bot, runs, seed)
    const total = summary.hpLostPerBattle.reduce((x, y) => x + y, 0)
    dmg = Math.min(3, Math.max(0.4, dmg * Math.pow(loss / Math.max(1, total), 0.7)))
    summary = evaluate(leverConfig(model, lever, hp, dmg, variant), bot, runs, seed)
    const t = summary.encounterTurns
    const total2 = summary.hpLostPerBattle.reduce((x, y) => x + y, 0)
    if (t.every((x, i) => Math.abs(x - turns[i]!) < 0.25) && Math.abs(total2 - loss) < 1.5) break
  }
  return { model, lever, variant, hp: hp.map(x => Math.round(x * 100) / 100), dmg: Math.round(dmg * 100) / 100, summary, iterations: iterations + 1 }
}
