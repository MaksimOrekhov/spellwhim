import swordStrike from '../assets/art/sword-strike-krea.webp'
import guard from '../assets/art/guard-krea.webp'
import parry from '../assets/art/parry-krea.webp'
import shieldBash from '../assets/art/shield-bash-krea.webp'
import interpose from '../assets/art/interpose-krea.webp'
import quickCut from '../assets/art/quick-cut-krea.webp'
import rend from '../assets/art/rend-krea.webp'
import reapingBlow from '../assets/art/reaping-blow-krea.webp'
import bastion from '../assets/art/bastion-krea.webp'
import stanceStrike from '../assets/art/stance-strike-krea.webp'
import woundClamp from '../assets/art/wound-clamp-krea.webp'
import coveringCounter from '../assets/art/covering-counter-krea.webp'
import crushingSwing from '../assets/art/crushing-swing-krea.webp'
import fireball from '../assets/art/fireball-krea.webp'
import frostbolt from '../assets/art/frostbolt-krea.webp'
import arcaneInsight from '../assets/art/arcane-insight-krea.webp'
import iceWard from '../assets/art/ice-ward-krea.webp'
import thunderbolt from '../assets/art/thunderbolt-krea.webp'
import boilBlood from '../assets/art/boil-blood-krea.webp'
import arcaneMark from '../assets/art/arcane-mark-krea.webp'
import iceEcho from '../assets/art/ice-echo-krea.webp'
import frostSeal from '../assets/art/frost-seal-krea.webp'
import bloodResonance from '../assets/art/blood-resonance-krea.webp'
import type { CardId } from '../game/types'

/**
 * Single place that maps a card to its illustration; hand and reward screens both read it.
 * Krea 2 Turbo set (user generations, 3:2, 1024×685 WebP, art pending final approval). Source PNGs are `src/assets/art/<id>.png`.
 * The previous JPEG/SVG illustrations stay in `src/assets/art/` (not imported) for rollback and comparison.
 */
export const cardArt: Partial<Record<CardId, string>> = {
  'sword-strike': swordStrike,
  'guard': guard,
  'parry': parry,
  'shield-bash': shieldBash,
  'interpose': interpose,
  'quick-cut': quickCut,
  'rend': rend,
  'reaping-blow': reapingBlow,
  'bastion': bastion,
  'stance-strike': stanceStrike,
  'wound-clamp': woundClamp,
  'covering-counter': coveringCounter,
  'crushing-swing': crushingSwing,
  'fireball': fireball,
  'frostbolt': frostbolt,
  'arcane-insight': arcaneInsight,
  'ice-ward': iceWard,
  'thunderbolt': thunderbolt,
  'boil-blood': boilBlood,
  'arcane-mark': arcaneMark,
  'ice-echo': iceEcho,
  'frost-seal': frostSeal,
  'blood-resonance': bloodResonance,
  // EXPERIMENT B2: temporary illustrations borrowed from the nearest card of the same class until real art exists (docs/design/honest-turn-b-experiment-v1.md).
  'frost-grip': frostbolt,
  'ice-breaker': shieldBash,
}
