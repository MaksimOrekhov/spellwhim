import type { Motion } from './types'

export type MotionPreference = 'auto' | 'full' | 'reduced'

/**
 * How much motion the battle effects may use. The system setting (prefers-reduced-motion) decides unless a preference overrides it.
 * There is no settings screen yet; a future one only has to call `setMotionPreference`. The lab can force a mode with `&motion=`.
 */
let preference: MotionPreference = 'auto'
const listeners = new Set<() => void>()

export function setMotionPreference(value: MotionPreference): void { preference = value; listeners.forEach(listener => listener()) }
export function getMotionPreference(): MotionPreference { return preference }

/** Ambient layers also follow live OS changes and lab overrides, with symmetric cleanup. */
export function observeMotion(listener: () => void): () => void {
  listeners.add(listener)
  const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  media?.addEventListener('change', listener)
  return () => { listeners.delete(listener); media?.removeEventListener('change', listener) }
}

export function systemPrefersReducedMotion(): boolean {
  try { return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function currentMotion(): Motion {
  if (preference === 'full') return 'full'
  if (preference === 'reduced') return 'reduced'
  return systemPrefersReducedMotion() ? 'reduced' : 'full'
}
