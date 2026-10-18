import fallbackPortrait from '../assets/art/guardian.jpg'
import cutpurse from '../assets/art/enemy-defias-cutpurse.jpg'
import overseer from '../assets/art/enemy-mine-overseer.jpg'
import powderRunner from '../assets/art/enemy-goblin-powder-runner.jpg'
import lookout from '../assets/art/enemy-defias-lookout.jpg'
import tinkerer from '../assets/art/enemy-foundry-tinkerer.jpg'
import deckhand from '../assets/art/enemy-defias-deckhand.jpg'
import veteran from '../assets/art/enemy-defias-veteran.jpg'
import foundryChief from '../assets/art/enemy-goblin-foundry-chief.jpg'
import twilightHeart from '../assets/art/enemy-twilight-heart.jpg'

/** Provisional Codex drafts are keyed by stable encounter ID for UI testing; no portrait is marked final/approved. */
export const enemyPortraitsByEncounterId: Readonly<Partial<Record<string, string>>> = Object.freeze({
  'defias-cutpurse': cutpurse,
  'mine-overseer': overseer,
  'goblin-powder-runner': powderRunner,
  'defias-lookout': lookout,
  'foundry-tinkerer': tinkerer,
  'defias-deckhand': deckhand,
  'defias-veteran': veteran,
  'goblin-foundry-chief': foundryChief,
  'twilight-heart': twilightHeart,
})

export interface ResolvedEnemyPortrait {
  src: string
  fallback: boolean
}

/** Portrait identity follows the stable encounter ID; missing art keeps the existing guardian fallback. */
export function resolveEnemyPortrait(
  encounterId: string,
  portraits: Readonly<Partial<Record<string, string>>> = enemyPortraitsByEncounterId,
): ResolvedEnemyPortrait {
  const src = portraits[encounterId]
  return src ? { src, fallback: false } : { src: fallbackPortrait, fallback: true }
}
