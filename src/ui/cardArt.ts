import swordStrike from '../assets/art/sword-strike.jpg'
import fireball from '../assets/art/fireball.jpg'
import guard from '../assets/art/guard.jpg'
import quickCut from '../assets/art/quick-cut.jpg'
import thunderbolt from '../assets/art/thunderbolt.jpg'
import bastion from '../assets/art/bastion.jpg'
import parry from '../assets/art/parry.svg'
import shieldBash from '../assets/art/shield-bash.svg'
import interpose from '../assets/art/interpose.svg'
import frostbolt from '../assets/art/frostbolt.svg'
import arcaneInsight from '../assets/art/arcane-insight.svg'
import iceWard from '../assets/art/ice-ward.svg'
import type { CardId } from '../game/types'

/** Single place that maps a card to its illustration; hand and reward screens both read it. */
/** New v0.1 illustrations stay out of the game until the pilot set is approved. Components render a clear art-pending fallback. */
export const cardArt: Partial<Record<CardId, string>> = {
  'sword-strike': swordStrike, fireball, guard, 'quick-cut': quickCut, thunderbolt, bastion, parry,
  'shield-bash': shieldBash, interpose, frostbolt, 'arcane-insight': arcaneInsight, 'ice-ward': iceWard,
  // Temporary illustrations for the Bleeding cards: new art is a separate task (see docs/combat-overhaul-v02.md).
  rend: quickCut, 'reaping-blow': swordStrike, 'boil-blood': fireball,
}
