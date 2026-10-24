import type { BattleBackground } from '../ui/battleBackground'

export type AmbientProfile = 'mine' | 'crystal' | 'forge' | 'forge-fury'

/** Presentation only: no encounter forecast or hidden intent enters the ambience. */
export function ambientProfile(background: BattleBackground, phase: number): AmbientProfile {
  if (background.id === 'deadmines-rakzor-forge') return phase === 2 ? 'forge-fury' : 'forge'
  return background.id === 'deadmines-elite-crystal' ? 'crystal' : 'mine'
}

export const ambientParticleCount: Record<AmbientProfile, number> = { mine: 16, crystal: 18, forge: 22, 'forge-fury': 26 }
