import type { HitPart } from './types'

/**
 * One set of damage rules for card previews, card resolution, enemy forecasts and enemy execution.
 *
 * A hit is a list of parts in a fixed order: `base`, then additive modifiers in the order
 * class condition → status → artifact, then reductions (negative amounts: artifact reductions today, a future
 * "weakened" status). The running total never drops below zero, so a reduction is recorded as the amount it
 * actually removed. The total then meets armor and health through `splitDamage`, which is the only place where
 * armor absorption is computed. Callers differ only in what happens afterwards (an enemy keeps unabsorbed armor,
 * a hit hero loses all armor) and in which modifiers they collect; they never recompute the arithmetic.
 */
export interface Hit {
  total: number
  /** Parts with reductions already clamped to what they really removed. */
  parts: HitPart[]
}

export function composeHit(parts: readonly HitPart[]): Hit {
  let total = 0
  const effective: HitPart[] = []
  for (const part of parts) {
    const amount = Math.max(part.amount, -total)
    total += amount
    effective.push(amount === part.amount ? part : { ...part, amount })
  }
  return { total, parts: effective }
}

export const sumParts = (parts: readonly HitPart[], kind?: HitPart['kind']) =>
  parts.reduce((sum, part) => (kind === undefined || part.kind === kind) && part.amount > 0 ? sum + part.amount : sum, 0)

export interface DamageSplit {
  /** Taken by armor. */
  absorbed: number
  /** Taken from health, never more than the health left. */
  healthLoss: number
  /** The unabsorbed damage would leave nothing. */
  lethal: boolean
}

export function splitDamage(target: { armor: number; health: number }, damage: number): DamageSplit {
  const absorbed = Math.min(target.armor, damage)
  const remaining = Math.max(0, damage - absorbed)
  return { absorbed, healthLoss: Math.min(target.health, remaining), lethal: remaining >= target.health }
}
