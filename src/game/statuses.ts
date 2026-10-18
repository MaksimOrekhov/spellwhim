import type { BattleState, BattleStatuses, StatusCarrierId, StatusId, StatusInstance } from './types'

/**
 * Status Foundation v0.1 — the single description and the single store of battle statuses.
 *
 * A status is a definition (this file) plus instances held by carriers in `BattleState.statuses`. The definition says
 * how the stored number is read, how re-application combines, which events act on or spend it and what the UI needs.
 * The three trigger groups of the design research map onto these rules:
 *  - a hit taken by the carrier (`hitBonus`): for the enemy the hit comes from a player card, for a hero from an
 *    enemy action — one rule, resolved by `damage.ts` for previews, forecasts and execution alike;
 *  - a point of the turn (`tick`): evaluated by the engine at a named phase of `endTurn` (declared, not yet used);
 *  - removal (`cleanse`, `removeStatus`, `clearStatuses`): independent of triggers.
 * Gameplay today contains exactly one status, Vulnerability, held by the enemy.
 */

export type StatusPolarity = 'negative' | 'positive'
/** Which kinds of carrier may hold the status. */
export type StatusCarrierKind = 'enemy' | 'hero'
/** `charges`: spent one at a time. `intensity`: a strength that a tick applies and then decays. */
export type StatusReading = 'charges' | 'intensity'
/** `refresh`: re-applying never exceeds the larger value. `add`: re-applying adds, up to `maxValue`. */
export type StatusStacking = 'refresh' | 'add'
export type StatusTriggerGroup = 'player-card' | 'enemy-action' | 'turn-tick'
/** UI key; the Vue layer maps it to an actual icon, so definitions carry no markup. */
export type StatusIconKey = 'vulnerability'

/** A point of the turn at which the engine evaluates tick rules. Only phases that exist in `endTurn` are listed. */
export type StatusTickPhase = 'enemy-turn-start'

export interface StatusTick {
  phase: StatusTickPhase
  /** The status deals its current value as damage to its carrier. */
  damage: boolean
  /** Whether that damage skips armor, like a wound that armor cannot stop. */
  ignoresArmor: boolean
  /** How much the value drops after the tick; the status ends at 0. */
  decay: number
}

export interface StatusDefinition {
  id: StatusId
  name: string
  shortName: string
  description: string
  /** Extra line for tooltips about persistence. */
  note?: string
  /** Screen-reader label by kind of carrier. */
  spoken: Record<StatusCarrierKind, string>
  polarity: StatusPolarity
  carriers: readonly StatusCarrierKind[]
  reading: StatusReading
  stacking: StatusStacking
  maxValue: number
  /** Flat damage added to the next damaging hit the carrier takes, before armor; that hit spends one charge. */
  hitBonus?: number
  tick?: StatusTick
  icon: StatusIconKey
}

export const statusDefinitions: Record<StatusId, StatusDefinition> = {
  vulnerability: {
    id: 'vulnerability', name: 'Уязвимость', shortName: 'Уязвим',
    description: 'Следующая наносящая урон карта получает +3 урона и снимает Уязвимость.',
    note: 'Состояние сохраняется между ходами.',
    spoken: { enemy: 'Противник уязвим', hero: 'Герой уязвим' },
    polarity: 'negative', carriers: ['enemy', 'hero'], reading: 'charges', stacking: 'refresh', maxValue: 1, hitBonus: 3, icon: 'vulnerability',
  },
}

/** Definition order is the canonical order for displaying and applying statuses of one carrier. */
const definitionOrder = (): StatusId[] => Object.keys(statusDefinitions) as StatusId[]

export function statusDefinition(id: StatusId): StatusDefinition {
  const definition = statusDefinitions[id]
  if (!definition) throw new Error('Unknown status: ' + id)
  return definition
}

/** Which trigger group spends or runs the rule of this status on this carrier (see the file comment). */
export function triggerGroup(id: StatusId, carrier: StatusCarrierId): StatusTriggerGroup {
  const definition = statusDefinition(id)
  if (definition.tick && !definition.hitBonus) return 'turn-tick'
  return carrier === 'enemy' ? 'player-card' : 'enemy-action'
}

type StatusHolder = Pick<BattleState, 'statuses'>
const carrierKeys: readonly StatusCarrierId[] = ['enemy', 'warrior', 'mage']

export function createStatuses(): BattleStatuses {
  return { enemy: [], warrior: [], mage: [] }
}

export function cloneStatuses(statuses: BattleStatuses): BattleStatuses {
  const copy = (list: StatusInstance[]) => list.map(item => ({ ...item }))
  return { enemy: copy(statuses.enemy), warrior: copy(statuses.warrior), mage: copy(statuses.mage) }
}

function canCarry(definition: StatusDefinition, carrier: StatusCarrierId): boolean {
  return definition.carriers.includes(carrier === 'enemy' ? 'enemy' : 'hero')
}

function instanceOf(state: StatusHolder, carrier: StatusCarrierId, id: StatusId): StatusInstance | undefined {
  return state.statuses[carrier].find(item => item.id === id)
}

export function statusValue(state: StatusHolder, carrier: StatusCarrierId, id: StatusId): number {
  return instanceOf(state, carrier, id)?.value ?? 0
}

export function carrierHasStatus(state: StatusHolder, carrier: StatusCarrierId, id: StatusId): boolean {
  return statusValue(state, carrier, id) > 0
}

export interface ApplyStatusResult { applied: boolean; value: number }

/** Adds a status by its stacking rule. Carriers the definition does not allow, and non-positive amounts, change nothing. */
export function applyStatus(state: StatusHolder, carrier: StatusCarrierId, id: StatusId, amount = 1): ApplyStatusResult {
  const definition = statusDefinition(id)
  const existing = instanceOf(state, carrier, id)
  if (!canCarry(definition, carrier) || amount <= 0) return { applied: false, value: existing?.value ?? 0 }
  const requested = definition.stacking === 'add' ? (existing?.value ?? 0) + amount : Math.max(existing?.value ?? 0, amount)
  const value = Math.min(definition.maxValue, requested)
  if (existing) existing.value = value
  else {
    state.statuses[carrier].push({ id, value })
    // Canonical order keeps displays, signatures and processing independent of the order of application.
    const order = definitionOrder()
    state.statuses[carrier].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }
  return { applied: true, value }
}

/** Spends `amount` of a status; it disappears at 0. Returns whether anything was spent. */
export function consumeStatus(state: StatusHolder, carrier: StatusCarrierId, id: StatusId, amount = 1): boolean {
  const existing = instanceOf(state, carrier, id)
  if (!existing || amount <= 0) return false
  existing.value -= amount
  if (existing.value <= 0) state.statuses[carrier] = state.statuses[carrier].filter(item => item !== existing)
  return true
}

export function removeStatus(state: StatusHolder, carrier: StatusCarrierId, id: StatusId): boolean {
  const before = state.statuses[carrier].length
  state.statuses[carrier] = state.statuses[carrier].filter(item => item.id !== id)
  return state.statuses[carrier].length !== before
}

/** Removes every status of one carrier, or of all carriers (end of battle). */
export function clearStatuses(state: StatusHolder, carrier?: StatusCarrierId): void {
  for (const key of carrier ? [carrier] : Object.keys(state.statuses) as StatusCarrierId[]) state.statuses[key] = []
}

/** Removes the statuses of one polarity from a carrier and reports which ones left (a future "cleanse" effect). */
export function cleanse(state: StatusHolder, carrier: StatusCarrierId, polarity: StatusPolarity = 'negative'): StatusId[] {
  const removed = state.statuses[carrier].filter(item => statusDefinition(item.id).polarity === polarity).map(item => item.id)
  state.statuses[carrier] = state.statuses[carrier].filter(item => !removed.includes(item.id))
  return removed
}

/** Canonical text of every status on every carrier, for dedupe keys and observable seeds. Empty when none exist. */
export function statusSignature(state: StatusHolder, skip?: { carrier: StatusCarrierId; id: StatusId }): string {
  let text = ''
  // Hot path of the simulations: nothing is allocated while the board holds no (other) status.
  for (const carrier of carrierKeys) {
    for (const item of state.statuses[carrier]) {
      if (skip && skip.carrier === carrier && skip.id === item.id) continue
      text += (text ? ',' : '') + carrier + ':' + item.id + '=' + item.value
    }
  }
  return text
}

export interface StatusView {
  id: StatusId
  carrier: StatusCarrierId
  name: string
  shortName: string
  description: string
  note?: string
  spoken: string
  polarity: StatusPolarity
  reading: StatusReading
  value: number
  icon: StatusIconKey
  trigger: StatusTriggerGroup
}

/** Display model: plain data in canonical order, with no Vue and no icon assets, for any number of statuses per carrier. */
export function statusViews(state: StatusHolder, carrier: StatusCarrierId): StatusView[] {
  return state.statuses[carrier].map(item => {
    const definition = statusDefinition(item.id)
    return {
      id: item.id, carrier, name: definition.name, shortName: definition.shortName, description: definition.description, note: definition.note, spoken: definition.spoken[carrier === 'enemy' ? 'enemy' : 'hero'],
      polarity: definition.polarity, reading: definition.reading, value: item.value, icon: definition.icon, trigger: triggerGroup(item.id, carrier),
    }
  })
}

export interface HitBonus { id: StatusId; label: string; amount: number }

/** Statuses on `carrier` that add damage to the next damaging hit it takes, in canonical order. */
export function hitBonuses(state: StatusHolder, carrier: StatusCarrierId): HitBonus[] {
  const list = state.statuses[carrier]
  if (list.length === 0) return noBonuses
  return list.flatMap(item => {
    const definition = statusDefinition(item.id)
    return definition.hitBonus ? [{ id: item.id, label: definition.name, amount: definition.hitBonus }] : []
  })
}
const noBonuses: HitBonus[] = Object.freeze([]) as unknown as HitBonus[]

export interface DueTick { id: StatusId; value: number; tick: StatusTick }

/** Tick rules of this carrier that belong to `phase`, in canonical order. */
export function dueTicks(state: StatusHolder, carrier: StatusCarrierId, phase: StatusTickPhase): DueTick[] {
  if (state.statuses[carrier].length === 0) return []
  return state.statuses[carrier].flatMap(item => {
    const tick = statusDefinition(item.id).tick
    return tick && tick.phase === phase ? [{ id: item.id, value: item.value, tick }] : []
  })
}

/** Lowers the value after a tick; the status ends at 0. */
export function decayStatus(state: StatusHolder, carrier: StatusCarrierId, id: StatusId, amount: number): void {
  consumeStatus(state, carrier, id, amount)
}
