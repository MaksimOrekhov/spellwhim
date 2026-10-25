import { artifactDefinition } from '../game/artifacts'
import type { BossCardChoice, BossDevelopmentChoice, SectorId } from '../game/adventure'
import { sectorNumber, sectorOf } from '../game/adventure'
import { resolveCardDefinition } from '../game/cardProgression'
import type { Hero, HeroId, PersistentCard } from '../game/types'

/**
 * Words for the boss reward, from the one record the rules write (`BossReward`): the reward screen shows them as the player decides, the transition
 * screen as the recap, so both say the same thing. No rules here.
 */
const nameOf = (copy: PersistentCard) => resolveCardDefinition(copy).name + (copy.upgrade ? ' ↑' : '')

export function cardChoiceText(choice: BossCardChoice): string {
  if (choice.kind === 'take') return `«${nameOf(choice.copy)}» добавлена в колоду.`
  if (choice.kind === 'replace') return `«${nameOf(choice.copy)}» заняла место «${nameOf(choice.removed)}».`
  return 'Золотая карта не взята.'
}

export function developmentChoiceText(choice: BossDevelopmentChoice, heroes: Record<HeroId, Pick<Hero, 'name' | 'instanceId'>>): string {
  if (choice.kind === 'artifact') {
    const owner = Object.values(heroes).find(hero => hero.instanceId === choice.ownerInstanceId)
    return `«${artifactDefinition(choice.artifactId).name}» — у героя ${owner ? owner.name : 'отряда'}.`
  }
  if (choice.kind === 'upgrade') return `Улучшена карта «${resolveCardDefinition({ definitionId: choice.definitionId, upgrade: 0 }).name}».`
  return 'От развития отказались.'
}

export function healText(healed: Record<HeroId, number>, heroes: Record<HeroId, Pick<Hero, 'name'>>): string {
  const mended = (['warrior', 'mage'] as HeroId[]).filter(id => healed[id] > 0).map(id => `${heroes[id].name} +${healed[id]} HP`)
  return mended.length ? mended.join(', ') : 'Здоровье у обоих было полным.'
}

export const sectorTitle = (sectorId: SectorId): string => `Сектор ${['I', 'II', 'III'][sectorNumber(sectorId) - 1]} · ${sectorOf(sectorId).name}`
