import { honestEconomies } from './economy'
import type { EconomyConfig, HonestEconomyId } from './economy'
import { RUN_SAVE_KEY } from './runSave'

/**
 * Which battle rules a page load plays. The standard game is the default and the only thing a plain address opens:
 * an experiment starts only when the address asks for it (`?rules=honest-a08`), so nobody enters one by accident.
 * Every experiment keeps its runs in a slot of its own, so playing it never touches the standard campaign's save.
 */
export type RulesModeId = 'control' | HonestEconomyId

export interface RulesMode {
  id: RulesModeId
  title: string
  note: string
  /** `null` is the standard game: its economy comes from the usual launch parameters. */
  economy: EconomyConfig | null
  saveKey: string
}

export const rulesModes: readonly RulesMode[] = [
  { id: 'control', title: 'Текущие правила', note: 'контроль', economy: null, saveKey: RUN_SAVE_KEY },
  { id: 'honest-a08', title: 'Честный ход A', note: 'враги бьют ×0,8', economy: honestEconomies['honest-a08'], saveKey: RUN_SAVE_KEY + '.honest-a08' },
  { id: 'honest-a09', title: 'Честный ход A', note: 'враги бьют ×0,9', economy: honestEconomies['honest-a09'], saveKey: RUN_SAVE_KEY + '.honest-a09' },
]

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases = (mode: RulesMode) => [mode.id, mode.id.replace('honest-a', 'honest'), mode.id.replace('honest-', '')].map(normalise)

/** Reads `?rules=`; an unknown or missing value is the standard game. */
export function resolveRulesMode(search: string): RulesMode {
  const asked = new URLSearchParams(search).get('rules')
  const wanted = asked ? normalise(asked) : ''
  return rulesModes.find(mode => wanted !== '' && aliases(mode).includes(wanted)) ?? rulesModes[0]!
}

/** The link of a ruleset; with a seed it opens the same map and the same battle seeds under the other rules, for a side-by-side comparison. */
export const rulesModeHref = (id: RulesModeId, seed: number | null = null): string => '?rules=' + id + (seed === null ? '' : '&seed=' + (seed >>> 0))

/** `?seed=` fixes the seed of the next run that is started (a whole number up to 2^32-1); anything else is ignored. */
export function requestedSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || !/^[0-9]+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value <= 0xffffffff ? value : null
}
