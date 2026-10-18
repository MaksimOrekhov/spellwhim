import swordStrikeArt from '../assets/art/sword-strike.jpg'
import fireballArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
import quickCutArt from '../assets/art/quick-cut.jpg'
import thunderboltArt from '../assets/art/thunderbolt.jpg'
import bastionArt from '../assets/art/bastion.jpg'
import parryArt from '../assets/art/parry.svg'
import shieldBashArt from '../assets/art/shield-bash.svg'
import interposeArt from '../assets/art/interpose.svg'
import frostboltArt from '../assets/art/frostbolt.svg'
import arcaneInsightArt from '../assets/art/arcane-insight.svg'
import iceWardArt from '../assets/art/ice-ward.svg'
import varianPortrait from '../assets/art/varian.jpg'
import jainaPortrait from '../assets/art/jaina.jpg'
import guardianPortrait from '../assets/art/guardian.jpg'
import type { CardId } from '../game/types'

export const cardArt: Record<CardId, string> = {
  'sword-strike': swordStrikeArt, fireball: fireballArt, guard: guardArt, 'quick-cut': quickCutArt, thunderbolt: thunderboltArt, bastion: bastionArt,
  parry: parryArt, 'shield-bash': shieldBashArt, interpose: interposeArt, frostbolt: frostboltArt, 'arcane-insight': arcaneInsightArt, 'ice-ward': iceWardArt,
}
export const portraits = { warrior: varianPortrait, mage: jainaPortrait, enemy: guardianPortrait }
