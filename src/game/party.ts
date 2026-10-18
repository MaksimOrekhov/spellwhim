import type { BattleState, CardClassId, CardDefinition, HeroId } from './types'

/**
 * Who is who in the party. The engine still plays exactly two heroes and still keys them by the legacy `Hero.id`, but
 * rules that concern "the member who owns this class" go through the party that is actually in the battle, never through
 * a character name or a fixed Warrior + Mage pair.
 *
 * Contract for a class card:
 *  - the owner is the party member whose `classId` equals the card's `className`;
 *  - if exactly one member has that class, they are the owner;
 *  - if nobody has it, there is no owner; if several do (two heroes of one class), the owner is ambiguous.
 * Callers must treat `absent` and `ambiguous` as "the rule does not apply" and must not pick a hero silently.
 * Copies of cards carry no owner of their own (no per-copy ownership is needed for the current rules).
 */
export type Heroes = BattleState['heroes']
export type OwnerLookup = { ok: true; hero: HeroId } | { ok: false; reason: 'absent' | 'ambiguous' }

const slotOrder = { first: 0, second: 1 } as const

/** Hero keys in party-slot order (first slot, then second), the order used for area attacks and results. */
export function heroIdsInPartyOrder(heroes: Heroes): HeroId[] {
  const ids = Object.keys(heroes) as HeroId[]
  // This runs on every card preview of a simulation, so the two-member case avoids a sort.
  if (ids.length === 2) return slotOrder[heroes[ids[0]!].partySlot] <= slotOrder[heroes[ids[1]!].partySlot] ? ids : [ids[1]!, ids[0]!]
  return ids.sort((a, b) => slotOrder[heroes[a].partySlot] - slotOrder[heroes[b].partySlot])
}

export function heroesOfClass(heroes: Heroes, classId: CardClassId): HeroId[] {
  return heroIdsInPartyOrder(heroes).filter(id => heroes[id].classId === classId)
}

export function heroForClass(heroes: Heroes, classId: CardClassId): OwnerLookup {
  let found: HeroId | undefined
  let count = 0
  for (const id of Object.keys(heroes) as HeroId[]) {
    if (heroes[id].classId !== classId) continue
    found = id
    count += 1
  }
  if (count === 1) return { ok: true, hero: found! }
  return { ok: false, reason: count === 0 ? 'absent' : 'ambiguous' }
}

export function cardOwner(heroes: Heroes, card: Pick<CardDefinition, 'className'>): OwnerLookup {
  return heroForClass(heroes, card.className)
}

/** The other member of a two-hero party. */
export function partnerOf(heroes: Heroes, id: HeroId): HeroId {
  const ids = Object.keys(heroes) as HeroId[]
  if (ids.length !== 2 || !ids.includes(id)) throw new Error('A partner is defined only in a party of two')
  return ids[0] === id ? ids[1]! : ids[0]!
}

/** Resolves the target of an armor effect against the current party; `null` when a class target has no unique owner. */
export function resolveArmorTarget(heroes: Heroes, target: string, threatened: HeroId): HeroId | null {
  if (target === 'threatened') return threatened
  if (target === 'partner') return partnerOf(heroes, threatened)
  if (target.startsWith('class:')) {
    const lookup = heroForClass(heroes, target.slice('class:'.length) as CardClassId)
    return lookup.ok ? lookup.hero : null
  }
  return target in heroes ? target as HeroId : null
}

/**
 * Russian forms of character names for rule text. Temporary table until roster data carries them; unknown characters
 * fall back to the generic "героя" so text never names the wrong person.
 */
const characterForms: Record<string, { genitive: string }> = {
  varian: { genitive: 'Вариана' },
  jaina: { genitive: 'Джайны' },
}

export function characterGenitive(characterId: string): string {
  return characterForms[characterId]?.genitive ?? 'героя'
}
