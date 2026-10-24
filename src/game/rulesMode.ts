import { honestEconomies } from './economy'
import type { EconomyConfig, HonestEconomyId } from './economy'
import { deckVariantIds, honestDeck, isDeckVariant } from './honestDecks'
import type { DeckVariantId } from './honestDecks'
import { RUN_SAVE_KEY } from './runSave'
import type { CardId } from './types'

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
  /** EXPERIMENT B2: the mode starts with the Frost and Steel cards in its deck. */
  frost?: true
  /** The starting deck of a new run when the address does not ask for another variant; absent: the standard deck. */
  defaultDeck?: DeckVariantId
}

export const rulesModes: readonly RulesMode[] = [
  { id: 'control', title: 'Текущие правила', note: 'контроль', economy: null, saveKey: RUN_SAVE_KEY },
  { id: 'honest-a08', title: 'Честный ход A', note: 'враги бьют ×0,8', economy: honestEconomies['honest-a08'], saveKey: RUN_SAVE_KEY + '.honest-a08' },
  { id: 'honest-a09', title: 'Честный ход A', note: 'враги бьют ×0,9', economy: honestEconomies['honest-a09'], saveKey: RUN_SAVE_KEY + '.honest-a09' },
  { id: 'honest-b1', title: 'Честный ход B1', note: 'новые угрозы', economy: honestEconomies['honest-b1'], saveKey: RUN_SAVE_KEY + '.honest-b1', defaultDeck: 'armor10' },
  { id: 'honest-b2', title: 'Честный ход B2', note: 'мороз и сталь', economy: honestEconomies['honest-b2'], saveKey: RUN_SAVE_KEY + '.honest-b2', frost: true, defaultDeck: 'armor8' },
  { id: 'honest-b1-long', title: 'Честный ход B1 · длинный сектор', note: '10 посещений', economy: honestEconomies['honest-b1-long'], saveKey: RUN_SAVE_KEY + '.honest-b1-long', defaultDeck: 'armor10' },
  { id: 'honest-b2-long', title: 'Честный ход B2 · длинный сектор', note: '10 посещений', economy: honestEconomies['honest-b2-long'], saveKey: RUN_SAVE_KEY + '.honest-b2-long', frost: true, defaultDeck: 'armor8' },
]

/**
 * The rules the game is played under (Decision Log X04): Honest Turn B2 on the long Sector I. Its internal id, economy and save slot
 * (`spellwhim.run.v1.honest-b2-long`) are exactly the ones its playtest runs were saved under, so those runs continue unchanged.
 */
export const defaultRulesMode: RulesMode = rulesModes.find(mode => mode.id === 'honest-b2-long')!

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
const aliases = (mode: RulesMode) => [mode.id, mode.id.replace('honest-a', 'honest'), mode.id.replace('honest-', '')].map(normalise)

/** Reads `?rules=`; an unknown or missing value is the former control game. This is the laboratory resolver: the game itself starts from `resolveLaunch`. */
export function resolveRulesMode(search: string): RulesMode {
  const asked = new URLSearchParams(search).get('rules')
  const wanted = asked ? normalise(asked) : ''
  return rulesModes.find(mode => wanted !== '' && aliases(mode).includes(wanted)) ?? rulesModes[0]!
}

/** The link of a ruleset; with a seed it opens the same map and the same battle seeds under the other rules, for a side-by-side comparison. */
export const rulesModeHref = (id: RulesModeId, seed: number | null = null, deck: DeckVariantId | null = null): string =>
  '?rules=' + id + (seed === null ? '' : '&seed=' + (seed >>> 0)) + (deck === null ? '' : '&deck=' + deck)

/** `?seed=` fixes the seed of the next run that is started (a whole number up to 2^32-1); anything else is ignored. */
export function requestedSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || !/^[0-9]+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value <= 0xffffffff ? value : null
}

/** `?deck=armor10|armor8|armor6`: the starting deck of the next run of an experimental mode; anything else keeps the mode's own choice. */
export function requestedDeckVariant(search: string): DeckVariantId | null {
  const raw = new URLSearchParams(search).get('deck')
  return isDeckVariant(raw) ? raw : null
}

/** The deck variant a new run of `mode` starts with, or `null` for the standard game (and for A, whose deck is the standard one). */
export function deckVariantFor(mode: RulesMode, search: string): DeckVariantId | null {
  if (!mode.economy || (!mode.defaultDeck && !mode.frost)) return null
  return requestedDeckVariant(search) ?? mode.defaultDeck ?? 'armor10'
}

/** The cards of a new run's starting deck; `undefined` means the standard deck. */
export function startingDeckFor(mode: RulesMode, search: string): CardId[] | undefined {
  const variant = deckVariantFor(mode, search)
  return variant ? honestDeck(variant, mode.frost === true) : undefined
}

export { deckVariantIds }

/** The address parameter that opens a laboratory mode in a development build, e.g. `?dev-rules=honest-a08&seed=7`. */
export const LAB_PARAM = 'dev-rules'

export interface Launch {
  mode: RulesMode
  /** A development build was asked, by `?dev-rules=`, to play another set of rules (or to repeat a seed and deck). Never true in production or Tauri. */
  lab: boolean
  /** The address parameters that count: `?rules=`-style for the laboratory resolvers when `lab`, empty otherwise, so `?seed=`, `?deck=` and `?economy=` cannot reach a normal game. */
  search: string
}

/**
 * What a page load plays. Everything but a development build with an explicit `?dev-rules=` is the default game, whatever the address says:
 * the old `?rules=`, `?deck=`, `?seed=` and `?economy=` links no longer change a normal game. An unknown `dev-rules` value is ignored.
 */
export function resolveLaunch(search: string, developer: boolean): Launch {
  const params = new URLSearchParams(search)
  const asked = developer ? params.get(LAB_PARAM) : null
  if (asked !== null) {
    params.delete(LAB_PARAM)
    params.set('rules', asked)
    const labSearch = '?' + params.toString()
    const mode = resolveRulesMode(labSearch)
    if (mode.id !== 'control' || normalise(asked) === 'control') return { mode, lab: true, search: labSearch }
  }
  return { mode: defaultRulesMode, lab: false, search: '' }
}
