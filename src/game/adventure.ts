import { artifactDefinitions } from './artifacts'
import { availableGoldCards, canUpgradeCard } from './cardProgression'
import type { CardAcquisition } from './cardProgression'
import { shuffle } from './deck'
import type { SectorConfig } from './dungeonGenerator'
import { deriveDungeonSeed } from './dungeonSeed'
import { longSectorConfigs, sectorLongConfigV3 } from './sectorLong'
import type { ArtifactId, HeroId, PersistentCard } from './types'

/**
 * The adventure above the sector: Old Mines → Goblin Workshops → Secret Cove (GDD §8, "три сектора"). Nothing here plays a battle. The registry names
 * the sectors in order and says which of them can be generated yet; the ledger (`RunJourney`) is what a run remembers about the sectors it has left;
 * the boss reward is what an intermediate boss gives on the way out (GDD §6 "промежуточные боссы", §15 "после боссов I и II").
 * This module stays below `campaign.ts`: it reads no run, so the run types can name its records.
 */
export type SectorId = 'old-mines' | 'goblin-workshops' | 'secret-cove'

export interface AdventureSector {
  id: SectorId
  /** What the player reads: the map header, the transition screen, the menu. */
  name: string
  /** One line about the place, safe to show before the sector is open. */
  tagline: string
  /** Every configuration a saved run of this sector may carry. A sector without any has no content yet. */
  configs: readonly SectorConfig[]
  /** What a new run of the sector is generated under. `null`: the sector is planned but has nothing to play. */
  current: SectorConfig | null
}

/** The order of the adventure. Sector I is the long Old Mines route (B2 Long); the other two are planned and carry no configuration, enemy or boss yet. */
export const adventureSectors: readonly AdventureSector[] = [
  { id: 'old-mines', name: 'Старые штольни', tagline: 'Тёмные штреки, где Братство Справедливости прячет свои задумки', configs: longSectorConfigs, current: sectorLongConfigV3 },
  { id: 'goblin-workshops', name: 'Гоблинские мастерские', tagline: 'Гул станков и запах горелого пороха', configs: [], current: null },
  { id: 'secret-cove', name: 'Тайная бухта', tagline: 'Подземная гавань, откуда виден выход', configs: [], current: null },
]

export const sectorOf = (id: SectorId): AdventureSector => adventureSectors.find(sector => sector.id === id)!
export const sectorNumber = (id: SectorId): number => adventureSectors.findIndex(sector => sector.id === id) + 1
/** The sector after `id`, or `undefined` after the last one. */
export const sectorAfter = (id: SectorId): AdventureSector | undefined => adventureSectors[adventureSectors.findIndex(sector => sector.id === id) + 1]
/** A sector the party can walk into: it has a configuration to generate. */
export const sectorIsPlayable = (sector: AdventureSector): boolean => sector.current !== null

/**
 * Boss reward v1. Every number is PROTOTYPE (GDD §6, §15): a gold card from three (add, replace one of your own, or leave it), and apart from it
 * either one personal artifact from two or one upgrade of an ordinary card, and the camp mends up to `healEach` health of each hero (model A/B of §15
 * after the first two bosses). The tracks close independently; the heal comes when both are closed.
 */
export const bossRewardRules = { version: 'boss-reward-1', goldChoices: 3, artifactChoices: 2, healEach: 4 } as const

/** What the player did with the boss's gold card. A taken or replacing copy is kept whole, so a save can be checked against the deck. */
export type BossCardChoice =
  | { kind: 'take'; copy: PersistentCard }
  | { kind: 'replace'; removed: PersistentCard; copy: PersistentCard }
  | { kind: 'skip' }
/** What the player did with the development track: one artifact (and the one it displaced), one upgrade, or nothing. */
export type BossDevelopmentChoice =
  | { kind: 'artifact'; artifactId: ArtifactId; ownerInstanceId: string; replacedArtifactId?: ArtifactId }
  | { kind: 'upgrade'; instanceId: string; definitionId: PersistentCard['definitionId'] }
  | { kind: 'skip' }

/**
 * One boss's reward. While a track is `null` it is still open. The record lives in `DungeonRunState.bossReward` until both tracks are closed, then moves
 * into the sector's entry of the ledger with `healed` written, so the same reward can be neither claimed nor healed twice.
 */
export interface BossReward {
  id: string
  nodeId: string
  /** Independent named seeds keep the boss offer away from combat, deck and ordinary reward streams. */
  seed: number
  artifactSeed: number
  /** The gold cards on offer: unique definitions the deck did not hold when the boss fell. */
  cards: CardAcquisition[]
  artifactIds: ArtifactId[]
  cardChoice: BossCardChoice | null
  developmentChoice: BossDevelopmentChoice | null
  /** Written when both tracks are closed: the health each hero got back. */
  healed?: Record<HeroId, number>
}

/** A sector the run has left (or is leaving): which one, and what its boss gave. */
export interface ClearedSector { sectorId: SectorId; reward: BossReward }

/**
 * What a run remembers of the adventure. `sectorId` is the sector the run is in; `cleared` lists the sectors whose boss reward is closed, in order.
 * A run whose current sector is already in `cleared` is waiting at that sector's exit (see `waitsAtSectorExit`).
 * Runs saved before the transition carry no journey and end at the first boss as they always did.
 */
export interface RunJourney { sectorId: SectorId; cleared: ClearedSector[] }

export const newJourney = (): RunJourney => ({ sectorId: adventureSectors[0]!.id, cleared: [] })

/** The sector's boss has fallen, its reward is closed, and the party stands at the exit. */
export const waitsAtSectorExit = (journey: RunJourney | undefined): boolean => !!journey && journey.cleared.some(entry => entry.sectorId === journey.sectorId)

/** The reward of the sector the run is in, once closed. */
export const currentClearance = (journey: RunJourney | undefined): ClearedSector | undefined => journey?.cleared.find(entry => entry.sectorId === journey.sectorId)

export interface BossRewardInputs {
  runId: string
  /** The run's seed: the offer is a function of it, the boss node and what the party owns, nothing else. */
  runSeed: number
  nodeId: string
  /** The permanent deck as it stands when the boss falls; only the definitions matter. */
  deck: readonly Pick<PersistentCard, 'definitionId'>[]
  ownedArtifacts: readonly ArtifactId[]
  excludedArtifacts?: readonly ArtifactId[]
}

const seededOffer = <T>(seed: number, pool: readonly T[], count: number): T[] => shuffle({ rngState: seed >>> 0 }, pool).slice(0, count)

/**
 * The boss's offer: up to three gold cards the deck does not hold (the elite's rule, `availableGoldCards`) and up to two artifacts the party does not
 * carry. The same inputs always give the same offer, which is how a save is checked against forgery. Both tracks start open.
 */
export function createBossReward(input: BossRewardInputs): BossReward {
  const seed = deriveDungeonSeed(input.runSeed, `boss-reward:${input.nodeId}`)
  const artifactSeed = deriveDungeonSeed(input.runSeed, `boss-artifact:${input.nodeId}`)
  const artifacts = artifactDefinitions.filter(item => !input.ownedArtifacts.includes(item.id) && !input.excludedArtifacts?.includes(item.id))
  return {
    id: `${input.runId}/boss-reward/${input.nodeId}`, nodeId: input.nodeId, seed, artifactSeed,
    cards: seededOffer(seed, availableGoldCards(input.deck), bossRewardRules.goldChoices).map(card => ({ definitionId: card.id, upgrade: 0 as const })),
    artifactIds: seededOffer(artifactSeed, artifacts, bossRewardRules.artifactChoices).map(item => item.id),
    cardChoice: null, developmentChoice: null,
  }
}

/** What the camp would mend now: up to `healEach` of each hero's missing health, never past the maximum. The transaction uses this very function. */
export function bossHeal(heroes: Record<HeroId, Pick<{ health: number; maxHealth: number }, 'health' | 'maxHealth'>>): Record<HeroId, number> {
  const mend = (hero: { health: number; maxHealth: number }) => Math.max(0, Math.min(bossRewardRules.healEach, hero.maxHealth - hero.health))
  return { warrior: mend(heroes.warrior), mage: mend(heroes.mage) }
}

/** Is there an ordinary card the development track could upgrade? */
export const canUpgradeAny = (deck: readonly Pick<PersistentCard, 'definitionId' | 'upgrade'>[]): boolean => deck.some(canUpgradeCard)
