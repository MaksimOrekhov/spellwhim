// Pure model of a health plate: what the bar draws for a given health, and the one sentence a screen reader gets.
// The ghost is the health an ANNOUNCED hit (or the Bleeding tick) is about to take; the caller passes 0 for a strike that is
// still being prepared, because its size is not public yet.

export interface VitalsView {
  /** Width of the current health, 0–100. */
  pct: number
  /** Width of the segment about to be lost, 0–100; never wider than the health it comes out of. */
  ghostPct: number
  /** Where the ghost starts, 0–100 (it hangs on the right edge of the current health). */
  ghostFrom: number
  /** At or under a third of the health: the bar warms up. */
  low: boolean
  /** Health left after the announced loss (0 when it is lethal). */
  after: number
}

export function vitalsView(health: number, max: number, ghost = 0): VitalsView {
  const safeMax = Math.max(1, max)
  const current = Math.max(0, Math.min(safeMax, health))
  const pct = current / safeMax * 100
  const loss = Math.max(0, Math.min(current, ghost))
  const ghostPct = loss / safeMax * 100
  return { pct, ghostPct, ghostFrom: pct - ghostPct, low: current / safeMax <= 0.35, after: current - loss }
}

export function vitalsSpoken(name: string, health: number, max: number, armor: number, ghost = 0): string {
  return `${name}: здоровье ${health} из ${max}${armor ? ', броня ' + armor : ''}${ghost ? ', в этот ход потеряет ' + ghost : ''}`
}
