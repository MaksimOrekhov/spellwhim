import type { Motion } from './types'

export type MotionPreference = 'auto' | 'full' | 'reduced'

/**
 * How much motion the battle effects may use. The system setting (prefers-reduced-motion) decides unless a preference overrides it.
 * There is no settings screen yet; a future one only has to call `setMotionPreference`. The lab can force a mode with `&motion=`.
 */
let preference: MotionPreference = 'auto'

export function setMotionPreference(value: MotionPreference): void { preference = value }
export function getMotionPreference(): MotionPreference { return preference }

export function systemPrefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function currentMotion(): Motion {
  if (preference === 'full') return 'full'
  if (preference === 'reduced') return 'reduced'
  return systemPrefersReducedMotion() ? 'reduced' : 'full'
}
