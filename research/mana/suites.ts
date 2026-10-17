import { manaModels } from './core'
import type { BotId, ResearchConfig } from './core'

export interface Job { config: ResearchConfig; bot: BotId }
export interface Suite { id: string; title: string; jobs: () => Job[] }

export const greedyBots: BotId[] = ['greedy-aggressive', 'greedy-defensive', 'greedy-balanced']
export const plannerBots: BotId[] = ['plan-aggro', 'plan-even', 'plan-safe']
export const allBots: BotId[] = [...greedyBots, ...plannerBots]

export function cfg(id: string, mana: string, rest: Partial<ResearchConfig> = {}): ResearchConfig {
  return { id, mana: manaModels[mana]!, ...rest }
}
export function cross(configs: ResearchConfig[], bots: BotId[]): Job[] {
  return configs.flatMap(config => bots.map(bot => ({ config, bot })))
}

export const suites: Record<string, Suite> = {}
export function register(suite: Suite): void { suites[suite.id] = suite }

/* S0: calibration / smoke. */
register({
  id: 's0', title: 'Калибровка',
  jobs: () => cross(['A', 'B', 'C'].map(m => cfg(m, m)), ['greedy-balanced', 'plan-even']),
})

/* S1: mana models with unchanged cards and enemies. */
register({
  id: 's1', title: 'Модели маны при неизменных картах и врагах',
  jobs: () => cross(['A', 'B', 'C', 'D', 'D0', 'F4', 'F5', 'P4', 'K', 'E', 'E2', 'G', 'G1'].map(m => cfg(m, m)), allBots),
})
