import { artifactDefinitions } from './artifacts'
import { cardUpgrades } from './cardUpgrades'
import { cardDefinition, cards, experimentalCards, goldCards } from './types'
import { defaultDungeonRoster } from './encountersV10'
import { createDungeonRewardOffer, deriveDungeonSeed, dungeonEncounter, dungeonNode, validateDungeonMap } from './campaign'
import type { DungeonRunState } from './campaign'
import { honestEconomies, knownEconomies } from './economy'
import type { EconomyConfig } from './economy'
import { CARVED_GENERATOR_VERSION, sectorOneConfig, validateSectorConfig } from './dungeonGenerator'
import { allSectorEventIds, eventIdsV2, sectorEncounters, sectorEventIds } from './sectorContent'
import { expansionElites, longSectorConfigs, longSectorEnemies, sectorLongConfig, sectorLongConfigV2, sectorLongConfigV3 } from './sectorLong'
import { createRoomVisit, roomActions } from './dungeonRooms'
import { cartRules, dinnerRules, roomRules } from './roomRules'
import { adventureSectors, bossHeal, bossRewardRules, createBossReward, currentClearance, waitsAtSectorExit } from './adventure'

export const RUN_SAVE_KEY = 'spellwhim.run.v1'
export const SAVE_SCHEMA_VERSION = 2
export const RULES_VERSION = 'combat-upgrades-1'
/** EXPERIMENT "Honest Turn" A: a run saved under these rules carries this version instead, so no other build reads it as its own. */
export const HONEST_RULES_VERSION = 'honest-turn-a-1'
/** B1 and B2 are separate generations: a save of one is never read as another's. */
const HONEST_B_RULES_VERSIONS: Readonly<Record<string, string>> = { 'honest-b1': 'honest-turn-b1-1', 'honest-b2': 'honest-turn-b2-1', 'honest-b1-long': 'honest-turn-b1-long-1', 'honest-b2-long': 'honest-turn-b2-long-1' }
export const GENERATOR_VERSION = 'dungeon-six-layers-1'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}'
  return JSON.stringify(value)
}

const sameEconomy = (a: unknown, b: unknown) => canonical(a) === canonical(b)
const honestEconomyOf = (value: unknown) => Object.values(honestEconomies).find(known => sameEconomy(known, value))
/** The rules generation a snapshot written under this economy must declare. */
export const rulesVersionFor = (economy: unknown): string => {
  const honest = honestEconomyOf(economy)
  return honest ? HONEST_B_RULES_VERSIONS[honest.id] ?? HONEST_RULES_VERSION : RULES_VERSION
}

function checksum(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16)
}

const FOUNDATION_CATALOG_VERSION = 'edd7267b'
const baseCatalogue = { cards, artifacts: artifactDefinitions, normal: defaultDungeonRoster.normal, elite: defaultDungeonRoster.elite, final: defaultDungeonRoster.final }
const baseCatalogueVersion = checksum(canonical(baseCatalogue))
/** Conservative automatic catalogue fingerprint plus explicit rule/generator versions. */
export const CATALOG_VERSION = checksum(canonical({ ...baseCatalogue, upgrades: cardUpgrades }))
export const SECTOR_CATALOG_VERSION = checksum(canonical({ base: CATALOG_VERSION, encounters: sectorEncounters, events: sectorEventIds }))
/** The long route adds three enemies and its own map rules; a save of it declares this instead, so no other build reads it as its own. */
export const LONG_SECTOR_CATALOG_VERSION = checksum(canonical({ base: SECTOR_CATALOG_VERSION, enemies: longSectorEnemies, config: sectorLongConfig }))
/** Long route configuration version 2 (Sector I Content Expansion v1): the second elite and the dinner event. Version-1 runs keep `LONG_SECTOR_CATALOG_VERSION` above, which no longer changes. */
export const LONG_SECTOR_CATALOG_VERSION_2 = checksum(canonical({ base: LONG_SECTOR_CATALOG_VERSION, elites: expansionElites, events: eventIdsV2, dinner: dinnerRules, config: sectorLongConfigV2 }))
/** Long route configuration version 3 (Runaway Cart, E06): the cart joins the event pool and leaves a boon for the next battle. Version-2 runs keep `LONG_SECTOR_CATALOG_VERSION_2`, which no longer changes. */
export const LONG_SECTOR_CATALOG_VERSION_3 = checksum(canonical({ base: LONG_SECTOR_CATALOG_VERSION_2, events: allSectorEventIds, cart: cartRules, config: sectorLongConfigV3 }))
/** The configuration version a new long run is generated under. */
export const CURRENT_LONG_CONFIG_VERSION = sectorLongConfigV3.version
/** A run that can hold gold also declares the gold catalogue it was played under; runs saved before gold keep the plain sector fingerprint. */
export const GOLD_CATALOG_VERSION = checksum(canonical(goldCards))
/** An adventure run (Sector Transition v1) also declares the adventure it was played under: the order of the sectors and the boss reward's numbers. Runs without a journey keep the fingerprints they had. */
export const JOURNEY_CATALOG_VERSION = checksum(canonical({ sectors: adventureSectors.map(sector => sector.id), rules: bossRewardRules }))
export const sectorCatalogFor = (campaignId: string | undefined, gold = false, campaignVersion: number = CURRENT_LONG_CONFIG_VERSION, journey = false) => {
  // An unknown long version has no fingerprint, so a save that names one can never match.
  const sector = campaignId === sectorLongConfig.id ? (campaignVersion === 1 ? LONG_SECTOR_CATALOG_VERSION : campaignVersion === 2 ? LONG_SECTOR_CATALOG_VERSION_2 : campaignVersion === 3 ? LONG_SECTOR_CATALOG_VERSION_3 : 'unknown-long-version-' + campaignVersion) : SECTOR_CATALOG_VERSION
  const withGold = gold ? checksum(canonical({ base: sector, gold: GOLD_CATALOG_VERSION })) : sector
  return journey ? checksum(canonical({ base: withGold, journey: JOURNEY_CATALOG_VERSION })) : withGold
}
export const ROOM_RULES_VERSION = roomRules.version + ':' + checksum(canonical(roomRules))

export interface RunSnapshot {
  schemaVersion: 1 | 2
  rulesVersion: string
  generatorVersion: string
  catalogVersion: string
  roomRulesVersion?: string
  revision: number
  economy: EconomyConfig
  run: DungeonRunState
}

type Check = (value: unknown) => boolean
const text: Check = value => typeof value === 'string' && value.length > 0 && value.length <= 500
const integer = (min = 0, max = Number.MAX_SAFE_INTEGER): Check => value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const uint = integer(0, 0xffffffff)
const oneOf = (...values: unknown[]): Check => value => values.includes(value)
const nullable = (check: Check): Check => value => value === null || check(value)
const list = (check: Check, max = 10000): Check => value => Array.isArray(value) && value.length <= max && value.every(check)
function object(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const data = value as Record<string, unknown>
    return Object.keys(data).every(key => Object.prototype.hasOwnProperty.call(required, key) || Object.prototype.hasOwnProperty.call(optional, key))
      && Object.entries(required).every(([key, check]) => Object.prototype.hasOwnProperty.call(data, key) && check(data[key]))
      && Object.entries(optional).every(([key, check]) => !Object.prototype.hasOwnProperty.call(data, key) || check(data[key]))
  }
}
const cardId: Check = value => cards.some(card => card.id === value) || experimentalCards.some(card => card.id === value) || goldCards.some(card => card.id === value)
const artifactId: Check = value => artifactDefinitions.some(item => item.id === value)
const acquisition = object({ definitionId: cardId, upgrade: oneOf(0, 1) })
const hero = object({ id: oneOf('warrior', 'mage'), characterId: text, classId: oneOf('warrior', 'mage'), partySlot: oneOf('first', 'second'), instanceId: text, name: text, title: text, health: integer(0, 999), maxHealth: integer(1, 999), armor: oneOf(0), icon: text })
const node = object({ id: text, layer: integer(0, 30), column: value => typeof value === 'number' && value >= 0 && value < 8 && Number.isInteger(value * 2), type: oneOf('battle', 'elite', 'rest', 'final', 'forge', 'treasure', 'event'), edges: list(text, 8) }, { encounterId: text, encounterHealth: integer(1, 10000), rewardCount: integer(1, 5), healAmount: integer(0, 999), eventId: oneOf(...allSectorEventIds) })
const roomSelection = object({ action: oneOf('upgrade', 'remove', 'replace', 'card', 'risk', 'artifact', 'heal', 'ride', 'bypass', 'leave') }, { instanceId: text, heroId: oneOf('warrior', 'mage'), cardId: cardId, artifactId, heal: object({ warrior: integer(0, dinnerRules.heal), mage: integer(0, dinnerRules.heal) }) })
const room = object({ id: text, nodeId: text, type: oneOf('forge', 'treasure', 'event'), cards: list(acquisition, roomRules.cards), riskCard: nullable(acquisition), replacements: object({ warrior: list(acquisition, roomRules.replacementCandidates), mage: list(acquisition, roomRules.replacementCandidates) }), artifactIds: list(artifactId, roomRules.artifacts), riskSuccess: oneOf(true, false), selection: nullable(roomSelection) }, { eventId: oneOf(...allSectorEventIds) })
const persistentCard = object({ instanceId: text, definitionId: cardId, upgrade: oneOf(0, 1) })
const anyOf = (...checks: Check[]): Check => value => checks.some(check => check(value))
const sectorIdShape: Check = oneOf(...adventureSectors.map(sector => sector.id))
const bossCardChoice = anyOf(object({ kind: oneOf('take'), copy: persistentCard }), object({ kind: oneOf('replace'), removed: persistentCard, copy: persistentCard }), object({ kind: oneOf('skip') }))
const bossDevelopmentChoice = anyOf(object({ kind: oneOf('artifact'), artifactId, ownerInstanceId: text }, { replacedArtifactId: artifactId }), object({ kind: oneOf('upgrade'), instanceId: text, definitionId: cardId }), object({ kind: oneOf('skip') }))
const bossRewardShape = object({ id: text, nodeId: text, seed: uint, artifactSeed: uint, cards: list(acquisition, bossRewardRules.goldChoices), artifactIds: list(artifactId, bossRewardRules.artifactChoices), cardChoice: nullable(bossCardChoice), developmentChoice: nullable(bossDevelopmentChoice) }, { healed: object({ warrior: integer(0, bossRewardRules.healEach), mage: integer(0, bossRewardRules.healEach) }) })
const runShape = object({
  runId: text, nextCardId: integer(1), decisions: list(text),
  deckOperations: list(object({ sourceId: text, kind: oneOf('remove', 'replace', 'upgrade'), options: list(acquisition, 100), resolved: oneOf(true, false) })),
  battleEntry: nullable(object({ nodeId: text, seed: uint })),
  seed: uint, mapSeed: uint,
  map: object({ seed: uint, layers: list(list(node, 8), 31), startNodeIds: list(text, 8), finalNodeId: text }, { configuration: value => { try { validateSectorConfig(value as Parameters<typeof validateSectorConfig>[0]); return true } catch { return false } }, generation: object({ attempts: integer(1, 128), fallback: oneOf(false) }) }),
  currentNodeId: nullable(text), visitedNodeIds: list(text, 31), completedNodeIds: list(text, 31),
  deck: list(object({ instanceId: text, definitionId: cardId, upgrade: oneOf(0, 1) })),
  heroes: object({ warrior: hero, mage: hero }), artifacts: list(object({ instanceId: text, definitionId: artifactId, ownerInstanceId: text }), 2),
  status: oneOf('active', 'victory', 'defeat', 'sector-complete'),
  pendingReward: nullable(object({ id: text, nodeId: text, seed: uint, artifactSeed: uint, count: integer(1, 5), elite: oneOf(true, false), cards: list(acquisition, 5), artifactIds: list(artifactId, 3) }, { rarity: oneOf('gold') })),
}, { journey: object({ sectorId: sectorIdShape, cleared: list(object({ sectorId: sectorIdShape, reward: bossRewardShape }), adventureSectors.length) }), bossReward: bossRewardShape, pendingBattleEffects: list(object({ id: text, kind: oneOf('start-armor'), heroId: oneOf('warrior', 'mage'), amount: integer(1, cartRules.armor), sourceNodeId: text }), 4), goldRewards: oneOf(true), excludedRewards: list(cardId), excludedArtifacts: list(artifactId, 5), campaign: object({ id: text, version: integer(1) }), room: nullable(room), journal: list(object({ nodeId: text, kind: oneOf('upgrade', 'remove', 'replace', 'card', 'risk', 'artifact', 'heal', 'ride', 'bypass', 'leave', 'reward', 'skip', 'rest'), text }, { card: object({ instanceId: text, definitionId: cardId, upgrade: oneOf(0, 1) }), heroId: oneOf('warrior', 'mage') })) })

/** Every sector configuration a save may carry. */
const knownSectorConfigs = [sectorOneConfig, ...longSectorConfigs]

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('Повреждены данные сохранённого похода.')
}
const unique = (values: readonly unknown[]) => new Set(values).size === values.length

/** Validate before publication; never repair, regenerate content, discard cards or heal on load. */
export function validateRun(value: unknown): asserts value is DungeonRunState {
  requireValid(runShape(value))
  const run = value as DungeonRunState
  const sector = !!run.map.configuration
  const isCombat = (type: string) => ['battle', 'elite', 'final'].includes(type)
  requireValid(run.mapSeed === deriveDungeonSeed(run.seed, 'map') && run.map.seed === run.mapSeed)
  if (sector) requireValid(run.campaign?.id === run.map.configuration!.id && run.campaign?.version === run.map.configuration!.version && run.map.generation && run.journal && run.deck.length > 0)
  else requireValid(!run.campaign && run.room === undefined && run.journal === undefined && !run.map.generation && run.map.layers.length === 7 && run.map.layers.every((layer, i) => layer.length === (i === 6 ? 1 : 3)))
  requireValid(validateDungeonMap(run.map).length === 0)
  // A sector map is only ever one a known configuration generated: a save cannot bring its own pools (other enemies, events or elites) along.
  if (sector) requireValid(knownSectorConfigs.some(known => known.id === run.campaign!.id && known.version === run.campaign!.version && canonical(known) === canonical(run.map.configuration)))
  run.map.layers.forEach((layer, i) => layer.forEach((entry, j) => {
    requireValid(entry.layer === i && (sector || entry.column === (i === 6 ? 1 : j)) && unique(entry.edges))
    if (entry.type === 'rest') requireValid(entry.healAmount === 6 && entry.encounterId === undefined && entry.encounterHealth === undefined && entry.rewardCount === undefined)
    else if (isCombat(entry.type)) {
      dungeonEncounter(entry)
      requireValid(entry.healAmount === undefined && (entry.type === 'final' ? entry.rewardCount === undefined : entry.rewardCount === (entry.type === 'elite' ? 5 : 3)))
    } else requireValid(sector && entry.encounterId === undefined && entry.encounterHealth === undefined && entry.rewardCount === undefined && entry.healAmount === undefined)
    requireValid((entry.type === 'event') === (entry.eventId !== undefined))
  }))
  requireValid(unique(run.visitedNodeIds) && unique(run.completedNodeIds) && unique(run.decisions))
  requireValid(run.currentNodeId === (run.visitedNodeIds[run.visitedNodeIds.length - 1] ?? null))
  run.visitedNodeIds.forEach((id, index) => {
    const allowed = index === 0 ? run.map.startNodeIds : dungeonNode(run.map, run.visitedNodeIds[index - 1]!)?.edges
    requireValid(allowed?.includes(id))
  })
  requireValid(run.completedNodeIds.length >= run.visitedNodeIds.length - 1 && run.completedNodeIds.length <= run.visitedNodeIds.length)
  requireValid(run.completedNodeIds.every((id, i) => run.visitedNodeIds[i] === id))
  const current = run.currentNodeId ? dungeonNode(run.map, run.currentNodeId) : undefined
  const incomplete = !!current && !run.completedNodeIds.includes(current.id)
  requireValid(!!run.battleEntry === (incomplete && isCombat(current!.type)))
  requireValid(!!run.room === (incomplete && ['forge', 'treasure', 'event'].includes(current!.type)))
  if (run.room) {
    const expected = createRoomVisit(run, current!)
    requireValid(canonical({ ...run.room, selection: null }) === canonical(expected))
    requireValid(!run.room.selection || roomActions(run.room).includes(run.room.selection.action))
  }
  validateBattleEffects(run, sector, isCombat)
  validateJourney(run, sector)
  if (run.battleEntry) requireValid(run.battleEntry.nodeId === current?.id && run.battleEntry.seed === deriveDungeonSeed(run.seed, `battle:${current?.id}`))
  const heroes = Object.values(run.heroes)
  requireValid(unique(heroes.map(entry => entry.instanceId)) && unique(heroes.map(entry => entry.partySlot)))
  requireValid(run.heroes.warrior.id === 'warrior' && run.heroes.mage.id === 'mage')
  heroes.forEach(entry => requireValid(entry.health <= entry.maxHealth))
  requireValid(unique(run.deck.map(card => card.instanceId)))
  // Gold exists only in a run that offers it, once per definition and never upgraded.
  const goldInDeck = run.deck.filter(card => cardDefinition(card.definitionId).rarity === 'gold')
  requireValid(!run.goldRewards || sector)
  requireValid(goldInDeck.length === 0 || (!!run.goldRewards && unique(goldInDeck.map(card => card.definitionId)) && goldInDeck.every(card => card.upgrade === 0)))
  run.deck.forEach(card => {
    const prefix = run.runId + '/card/'
    const number = Number(card.instanceId.slice(prefix.length))
    requireValid(card.instanceId === prefix + number && integer(1, run.nextCardId - 1)(number))
  })
  requireValid(unique(run.artifacts.map(item => item.instanceId)) && unique(run.artifacts.map(item => item.definitionId)) && unique(run.artifacts.map(item => item.ownerInstanceId)))
  run.artifacts.forEach(item => requireValid(heroes.some(entry => entry.instanceId === item.ownerInstanceId) && !run.excludedArtifacts?.includes(item.definitionId)))
  const offer = run.pendingReward
  if (offer) {
    requireValid(run.status === 'active' && current && !incomplete && ['battle','elite'].includes(current.type))
    requireValid(offer.id === `${run.runId}/reward/${current.id}` && offer.nodeId === current.id && !run.decisions.includes(offer.id))
    requireValid(offer.seed === deriveDungeonSeed(run.seed, `reward:${current.id}`) && offer.artifactSeed === deriveDungeonSeed(run.seed, `artifact-reward:${current.id}`))
    requireValid(offer.elite === (current.type === 'elite') && offer.count === (offer.rarity === 'gold' ? offer.cards.length : offer.elite ? 5 : 3))
    requireValid(offer.cards.length === offer.count && unique(offer.cards.map(card => card.definitionId)) && unique(offer.artifactIds))
    requireValid(offer.cards.every(choice => offer.rarity === 'gold' ? goldCards.some(card => card.id === choice.definitionId) && choice.upgrade === 0 && !goldInDeck.some(owned => owned.definitionId === choice.definitionId) : cards.some(card => card.id === choice.definitionId && card.reward) && !run.excludedRewards?.includes(choice.definitionId)))
    // While an offer is pending the deck cannot change, so a gold run's elite offer must be exactly the one its seed and deck produce.
    requireValid(offer.rarity !== 'gold' || (!!run.goldRewards && offer.elite))
    if (run.goldRewards && offer.elite) requireValid(canonical(offer) === canonical(createDungeonRewardOffer(run, current)))
    requireValid(offer.elite ? offer.artifactIds.every(id => !run.artifacts.some(item => item.definitionId === id) && !run.excludedArtifacts?.includes(id)) : offer.artifactIds.length === 0)
  }
  requireValid(run.status === 'active' ? heroes.every(entry => entry.health > 0) && (!run.completedNodeIds.includes(run.map.finalNodeId) || !!run.bossReward) : !incomplete && !offer && !!current)
  if (run.status === 'victory' || run.status === 'sector-complete') requireValid((run.status === 'sector-complete') === sector && current?.id === run.map.finalNodeId && heroes.every(entry => entry.health > 0))
  if (run.status === 'defeat') requireValid(heroes.some(entry => entry.health === 0) && current?.type !== 'rest')
  requireValid(unique(run.deckOperations.map(item => item.sourceId)))
  run.deckOperations.forEach(service => {
    requireValid((service.kind === 'replace') === (service.options.length > 0))
    requireValid(service.resolved === run.decisions.includes(`deck:${service.sourceId}`))
  })
  const expectedDecisions = run.deckOperations.filter(item => item.resolved).map(item => `deck:${item.sourceId}`)
  run.completedNodeIds.forEach(id => {
    const entry = dungeonNode(run.map, id)!
    expectedDecisions.push(`${entry.type === 'rest' ? 'rest' : isCombat(entry.type) ? 'battle' : 'room'}:${id}`)
    if (['battle','elite'].includes(entry.type) && !(run.status === 'defeat' && id === current?.id) && offer?.nodeId !== id) expectedDecisions.push(`${run.runId}/reward/${id}`)
    // The boss's reward is one decision, written when both of its tracks are closed (the tracks themselves are the ledger's choices).
    if (entry.type === 'final' && waitsAtSectorExit(run.journey)) expectedDecisions.push(currentClearance(run.journey)!.reward.id)
  })
  requireValid(run.decisions.length === expectedDecisions.length && expectedDecisions.every(id => run.decisions.includes(id)))
  if (sector) {
    requireValid(unique(run.journal!.map(entry=>entry.nodeId)))
    run.journal!.forEach(entry=>requireValid(run.completedNodeIds.includes(entry.nodeId)))
    run.completedNodeIds.filter(id=>!isCombat(dungeonNode(run.map,id)!.type)).forEach(id=>requireValid(run.journal!.some(entry=>entry.nodeId===id)))
  }
}

/**
 * The boons waiting for the next battle must be exactly the ones the run's history implies: one for each cart ride that no battle has followed yet, nothing else.
 * A save therefore cannot invent armor, keep a spent boon for another battle, or lose one that is still owed.
 */
function validateBattleEffects(run: DungeonRunState, sector: boolean, isCombat: (type: string) => boolean): void {
  const effects = run.pendingBattleEffects ?? []
  requireValid(run.pendingBattleEffects === undefined || (sector && effects.length > 0))
  const owed = new Map<string, { source: string; heroId: string }>()
  for (const entry of run.journal ?? []) {
    const node = dungeonNode(run.map, entry.nodeId)
    // Only a cart ride carries a hero, and every ride names one (the rider, whose name the entry's text must also contain).
    requireValid((entry.kind === 'ride') === (entry.heroId !== undefined))
    if (entry.kind !== 'ride') continue
    requireValid(node?.eventId === 'runaway-cart' && entry.text.includes(run.heroes[entry.heroId!].name))
    const later = run.completedNodeIds.slice(run.completedNodeIds.indexOf(entry.nodeId) + 1)
    if (run.status === 'active' && later.every(id => !isCombat(dungeonNode(run.map, id)!.type))) owed.set(`${run.runId}/effect/${entry.nodeId}`, { source: entry.nodeId, heroId: entry.heroId! })
  }
  requireValid(unique(effects.map(effect => effect.id)) && effects.length === owed.size)
  effects.forEach(effect => requireValid(owed.get(effect.id)?.source === effect.sourceNodeId && owed.get(effect.id)?.heroId === effect.heroId && effect.amount === cartRules.armor))
}

/**
 * The adventure above the sector. A journey belongs to the long Old Mines run of the game; the boss of its sector is down exactly when its reward is open
 * (the run still active) or closed (the run waiting at the exit), and a reward is checked against the run: the offer is the one its seed, the deck and the
 * artifacts the party had produce, and every choice left its mark in the deck, the artifacts and the spent deck services. A boss reward cannot be invented,
 * edited, repeated or left half-done. Sector II and III have no content and no validator yet, so a journey can only be in the first sector.
 */
function validateJourney(run: DungeonRunState, sector: boolean): void {
  const journey = run.journey
  requireValid(!run.bossReward || !!journey)
  if (!journey) return
  requireValid(sector && run.goldRewards === true && run.campaign?.id === sectorLongConfig.id)
  const index = adventureSectors.findIndex(entry => entry.id === journey.sectorId)
  requireValid(index === 0 && adventureSectors[index]!.configs.some(known => known.id === run.campaign!.id && known.version === run.campaign!.version))
  const parked = waitsAtSectorExit(journey)
  requireValid(canonical(journey.cleared.map(entry => entry.sectorId)) === canonical(adventureSectors.slice(0, index + (parked ? 1 : 0)).map(entry => entry.id)))
  const bossDown = run.completedNodeIds.includes(run.map.finalNodeId)
  requireValid(!(run.bossReward && parked) && (!run.bossReward || run.status === 'active') && (run.status === 'sector-complete') === parked && run.status !== 'victory')
  requireValid(run.status === 'defeat' || bossDown === (!!run.bossReward || parked))
  const reward = run.bossReward ?? currentClearance(journey)?.reward
  if (!reward) return
  const open = !!run.bossReward
  requireValid(!run.pendingReward && reward.nodeId === run.map.finalNodeId && reward.id === `${run.runId}/boss-reward/${run.map.finalNodeId}`)
  const { cardChoice: card, developmentChoice: development } = reward
  if (open) requireValid(reward.healed === undefined && (card === null || development === null) && !run.decisions.includes(reward.id))
  else {
    const healed = reward.healed
    requireValid(!!healed && card !== null && development !== null && run.decisions.includes(reward.id))
    // The camp mended exactly what the rules allowed from the health the heroes had before it.
    const before = (id: 'warrior' | 'mage') => ({ health: run.heroes[id].health - healed![id], maxHealth: run.heroes[id].maxHealth })
    requireValid(before('warrior').health >= 0 && before('mage').health >= 0 && canonical(bossHeal({ warrior: before('warrior'), mage: before('mage') })) === canonical(healed))
    requireValid(!!run.journal?.some(entry => entry.nodeId === reward.nodeId && entry.kind === 'reward'))
  }
  // The offer is a function of the run seed and of what the party held when the boss fell: undo the choices to see what that was.
  const gained = card && card.kind !== 'skip' ? card.copy : undefined
  const deckBefore = [...run.deck.filter(copy => copy.instanceId !== gained?.instanceId), ...(card?.kind === 'replace' ? [card.removed] : [])]
  const artifactsBefore = [
    ...run.artifacts.filter(item => !(development?.kind === 'artifact' && item.definitionId === development.artifactId && item.ownerInstanceId === development.ownerInstanceId)).map(item => item.definitionId),
    ...(development?.kind === 'artifact' && development.replacedArtifactId ? [development.replacedArtifactId] : []),
  ]
  const { cardChoice: _a, developmentChoice: _b, healed: _c, ...offer } = reward
  const { cardChoice: _d, developmentChoice: _e, ...wanted } = createBossReward({ runId: run.runId, runSeed: run.seed, nodeId: reward.nodeId, deck: deckBefore, ownedArtifacts: artifactsBefore, excludedArtifacts: run.excludedArtifacts })
  requireValid(canonical(offer) === canonical(wanted))
  const holds = (copy: { instanceId: string }) => run.deck.some(owned => canonical(owned) === canonical(copy))
  const fromOffer = (copy: { definitionId: string; upgrade: number }) => reward.cards.some(option => option.definitionId === copy.definitionId && option.upgrade === copy.upgrade)
  const spent = (suffix: string, kind: string) => run.deckOperations.some(service => service.sourceId === `${reward.id}/${suffix}` && service.kind === kind && service.resolved)
  const sources = run.deckOperations.filter(service => service.sourceId.startsWith(reward.id + '/')).map(service => service.sourceId)
  requireValid(canonical(sources) === canonical([card?.kind === 'replace' ? `${reward.id}/card` : null, development?.kind === 'upgrade' ? `${reward.id}/upgrade` : null].filter(Boolean)))
  if (card?.kind === 'take') requireValid(holds(card.copy) && fromOffer(card.copy))
  if (card?.kind === 'replace') {
    const number = Number(card.removed.instanceId.slice((run.runId + '/card/').length))
    requireValid(holds(card.copy) && fromOffer(card.copy) && spent('card', 'replace') && !run.deck.some(owned => owned.instanceId === card.removed.instanceId) && card.removed.instanceId === `${run.runId}/card/${number}` && integer(1, run.nextCardId - 1)(number))
  }
  if (development?.kind === 'upgrade') {
    const target = run.deck.find(copy => copy.instanceId === development.instanceId)
    requireValid(spent('upgrade', 'upgrade') && target?.definitionId === development.definitionId && target.upgrade === 1)
  }
  if (development?.kind === 'artifact') {
    requireValid(reward.artifactIds.includes(development.artifactId) && run.artifacts.some(item => item.instanceId === `${run.runId}/artifact/${reward.id}/${development.artifactId}` && item.definitionId === development.artifactId && item.ownerInstanceId === development.ownerInstanceId))
    requireValid(development.replacedArtifactId === undefined || !run.artifacts.some(item => item.definitionId === development.replacedArtifactId))
  }
}

export class IncompatibleSave extends Error {}

/** Experimental economies exist only for the sector run, and a run keeps exactly the exclusions its economy declares. */
function requireRunMatchesEconomy(run: DungeonRunState, economy: unknown): void {
  const honest = honestEconomyOf(economy)
  if (honest) requireValid(!!run.campaign && canonical(run.excludedArtifacts) === canonical(honest.excludedArtifacts))
  else requireValid(run.excludedArtifacts === undefined)
  // The long route belongs to its own economies and they to it: no run changes its length by being loaded under other rules.
  requireValid((economy as EconomyConfig | undefined)?.sectorRoute === 'long' ? run.campaign?.id === sectorLongConfig.id : run.campaign?.id !== sectorLongConfig.id)
}
export function encodeSnapshot(run: DungeonRunState, economy: EconomyConfig, revision: number): string {
  validateRun(run)
  requireValid(integer(1)(revision))
  requireValid(knownEconomies().some(known => sameEconomy(known, economy)))
  requireRunMatchesEconomy(run, economy)
  const payload: RunSnapshot = { schemaVersion: SAVE_SCHEMA_VERSION, rulesVersion: rulesVersionFor(economy), generatorVersion: run.map.configuration?.generatorVersion ?? GENERATOR_VERSION, catalogVersion: run.campaign ? sectorCatalogFor(run.campaign.id, !!run.goldRewards, run.campaign.version, !!run.journey) : CATALOG_VERSION, ...(run.campaign ? {roomRulesVersion:ROOM_RULES_VERSION} : {}), revision, economy, run }
  return JSON.stringify({ payload, checksum: checksum(canonical(payload)) })
}

export function decodeSnapshot(raw: string): RunSnapshot {
  const data: unknown = JSON.parse(raw)
  requireValid(object({ payload: value => !!value && typeof value === 'object', checksum: text })(data))
  const envelope = data as { payload: RunSnapshot; checksum: string }
  const snapshot = envelope.payload
  requireValid(object({ schemaVersion: integer(1), rulesVersion: text, generatorVersion: text, catalogVersion: text, revision: integer(1), economy: () => true, run: () => true }, {roomRulesVersion:text})(snapshot))
  const legacy = baseCatalogueVersion === FOUNDATION_CATALOG_VERSION && snapshot.schemaVersion === 1 && !honestEconomyOf(snapshot.economy) && snapshot.rulesVersion === 'combat-progression-1' && snapshot.catalogVersion === FOUNDATION_CATALOG_VERSION && snapshot.generatorVersion === GENERATOR_VERSION
  const sector = snapshot.run && typeof snapshot.run === 'object' && !!snapshot.run.campaign
  if (sector && snapshot.roomRulesVersion !== ROOM_RULES_VERSION) throw new IncompatibleSave('Сохранение использует другую версию правил комнат. Исходные данные оставлены в хранилище и доступны для скачивания; нужен новый поход или совместимая версия игры.')
  if (!legacy && (![1,2].includes(snapshot.schemaVersion) || (sector && snapshot.schemaVersion !== 2) || snapshot.rulesVersion !== rulesVersionFor(snapshot.economy) || snapshot.generatorVersion !== (sector ? CARVED_GENERATOR_VERSION : GENERATOR_VERSION) || snapshot.catalogVersion !== (sector ? sectorCatalogFor(snapshot.run.campaign?.id, !!snapshot.run.goldRewards, snapshot.run.campaign?.version, !!snapshot.run.journey) : CATALOG_VERSION))) throw new IncompatibleSave('Сохранение создано для другой версии игры. Оно оставлено в хранилище; начните новый поход или вернитесь к совместимой версии.')
  requireValid(object({ schemaVersion: oneOf(1,2), rulesVersion: text, generatorVersion: text, catalogVersion: text, revision: integer(1), economy: value => knownEconomies().some(known => sameEconomy(known, value)), run: () => true }, {roomRulesVersion:text})(snapshot))
  requireValid(envelope.checksum === checksum(canonical(snapshot)))
  validateRun(snapshot.run)
  requireRunMatchesEconomy(snapshot.run, snapshot.economy)
  if (legacy) {
    const acquisitions = [...snapshot.run.deck, ...(snapshot.run.pendingReward?.cards ?? []), ...snapshot.run.deckOperations.flatMap(offer => offer.options)]
    if (acquisitions.some(card => card.upgrade !== 0)) throw new IncompatibleSave('Старое сохранение содержит неподдержанное улучшение. Исходные данные доступны для скачивания; нужен прежний каталог игры.')
    return { ...snapshot, rulesVersion: RULES_VERSION, catalogVersion: CATALOG_VERSION }
  }
  return snapshot
}

export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SaveResult { ok: boolean; message: string }
export interface LoadResult { snapshot: RunSnapshot | null; message: string; blocked: boolean }

/** Small synchronous snapshots work in browser and Tauri webviews. Each setItem is atomic. */
/** `key` is the slot: the standard game keeps `RUN_SAVE_KEY`, every experimental ruleset has its own, so none touches the others' saves. */
export function createRunSaveStore(storage: () => SaveStorage, key: string = RUN_SAVE_KEY) {
  let revision = 0
  let exported = ''
  function load(): LoadResult {
    const valid: { snapshot: RunSnapshot; key: string; raw: string }[] = []
    const errors: Error[] = []
    const originals: { key: string; raw: string }[] = []
    for (const slot of [key, key + '.backup']) {
      try {
        const raw = storage().getItem(slot)
        if (raw !== null) {
          originals.push({ key: slot, raw })
          valid.push({ snapshot: decodeSnapshot(raw), key: slot, raw })
        }
      } catch (error) { errors.push(error instanceof Error ? error : new Error(String(error))) }
    }
    exported = originals.length ? JSON.stringify({ records: originals }) : ''
    // An incompatible generation must never silently roll back to an older compatible campaign.
    const incompatible = errors.find(error => error instanceof IncompatibleSave)
    if (incompatible) return { snapshot: null, message: incompatible.message, blocked: true }
    valid.sort((a, b) => b.snapshot.revision - a.snapshot.revision)
    const latest = valid[0]
    if (!latest) return { snapshot: null, message: errors.length ? 'Не удалось прочитать сохранение. Данные оставлены в хранилище. Можно повторить загрузку или начать новый поход.' : '', blocked: errors.length > 0 }
    revision = latest.snapshot.revision
    exported = latest.raw
    return { snapshot: latest.snapshot, message: errors.length || latest.key.endsWith('.backup') ? 'Поход восстановлен из резервной копии. Проверьте последнее действие.' : '', blocked: false }
  }
  function save(run: DungeonRunState, economy: EconomyConfig): SaveResult {
    try {
      const raw = encodeSnapshot(run, economy, revision + 1)
      exported = raw
      // The previous mirrored generation survives failure of the primary atomic write.
      storage().setItem(key, raw)
      revision += 1
      // Mirror the committed snapshot too: corruption of one record cannot resurrect a spent reward.
      storage().setItem(key + '.backup', raw)
      return { ok: true, message: '' }
    } catch {
      return { ok: false, message: 'Прогресс не удалось надёжно сохранить. Не закрывайте игру: повторите сохранение или скачайте копию. Хранилище может быть недоступно или переполнено.' }
    }
  }
  return { load, save, exportSnapshot: () => exported }
}
