import fallbackPortrait from '../assets/art/guardian.jpg'
import cutpurse from '../assets/art/enemy-defias-cutpurse-krea.webp'
import overseer from '../assets/art/enemy-mine-overseer-krea.webp'
import powderRunner from '../assets/art/enemy-goblin-powder-runner-krea.webp'
import lookout from '../assets/art/enemy-defias-lookout-krea.webp'
import tinkerer from '../assets/art/enemy-foundry-tinkerer.jpg'
import deckhand from '../assets/art/enemy-defias-deckhand-krea.webp'
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
  // Campaign battles append a map-node suffix (for example `defias-lookout/layer-3-column-2`)
  // to keep encounter instances distinct. Art remains keyed by the stable catalog ID.
  const stableEncounterId = encounterId.replace(/\/layer-\d+-column-\d+$/, '')
  const src = portraits[stableEncounterId]
  return src ? { src, fallback: false } : { src: fallbackPortrait, fallback: true }
}
