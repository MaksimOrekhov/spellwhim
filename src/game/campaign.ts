import { createBattle } from './battle'
import { artifactDefinitions } from './artifacts'
import { cards, startingDeck } from './types'
import { economyEncounters, gameEconomy } from './economy'
import { defaultDungeonRoster } from './encountersV10'
import type { DungeonRoster } from './rosters'
import type { EconomyConfig } from './economy'
import { shuffle } from './deck'
import { canUpgradeCard, resolveCardDefinition, validateAcquisition } from './cardProgression'
import type { CardAcquisition } from './cardProgression'
import type { DeckInput, PersistentCard } from './types'
import type { ArtifactDefinition, ArtifactId, ArtifactInstance, BattleState, CardDefinition, CardId, EncounterDefinition, Hero, HeroId } from './types'

export interface CampaignBattleOptions {
  encounter?: EncounterDefinition
  heroes?: BattleState['heroes']
  deck?: DeckInput
  seed?: number
  battleId?: string
  economy?: EconomyConfig
  artifacts?: readonly ArtifactInstance[]
}

/** Shared campaign rules used by the playable app and the headless balance lab. */
export function createCampaignBattle(options: CampaignBattleOptions = {}): BattleState {
  const economy = options.economy ?? gameEconomy
  return createBattle(options.encounter ?? economyEncounters(economy)[0]!, options.heroes, {
    deck: options.deck ?? startingDeck,
    seed: options.seed,
    battleId: options.battleId,
    economy,
    artifacts: options.artifacts,
  })
}

/** The encounters of the economy's enemy package (v0.7 for the standard game). */
export function campaignEncounters(economy: EconomyConfig = gameEconomy): readonly EncounterDefinition[] {
  return economyEncounters(economy)
}

export function campaignEncounter(index: number, economy: EconomyConfig = gameEconomy): EncounterDefinition | undefined {
  return campaignEncounters(economy)[index]
}

/** Cards added by Combat Overhaul v0.2 (Bleeding). The legacy Balance Lab keeps its older reward pool so its control numbers do not move. */
export const OVERHAUL_CARD_IDS: readonly CardId[] = ['rend', 'reaping-blow', 'boil-blood']

/** Cards introduced by Card Pool Expansion v0.1; available to dungeon rewards, but not historical Balance Lab controls. */
export const CARD_POOL_EXPANSION_V01_IDS: readonly CardId[] = [
  'stance-strike', 'wound-clamp', 'covering-counter', 'crushing-swing',
  'arcane-mark', 'ice-echo', 'frost-seal', 'blood-resonance',
]

/** Keep older Balance Lab and challenge baselines stable as new reward cards are added. */
export const HISTORICAL_BALANCE_REWARD_EXCLUSIONS: readonly CardId[] = [...OVERHAUL_CARD_IDS, ...CARD_POOL_EXPANSION_V01_IDS]

export function campaignRewards(excluded: readonly CardId[] = []): CardDefinition[] {
  return cards.filter(card => card.reward && !excluded.includes(card.id))
}

/** Seeded reward offer shared by the app and Balance Lab. */
export function campaignRewardOptions(battle: BattleState, count = 3): CardDefinition[] {
  const random = { rngState: (battle.rngState ^ 0x51f15e) >>> 0 }
  return shuffle(random, campaignRewards(HISTORICAL_BALANCE_REWARD_EXCLUSIONS)).slice(0, Math.max(0, count))
}

export function addCampaignReward(deck: readonly CardId[], reward: CardDefinition): CardId[] {
  return [...deck, reward.id]
}

export type CampaignAdvance = { kind: 'reward'; nextEncounter: number } | { kind: 'complete' } | { kind: 'defeat' }

export function advanceCampaign(battle: BattleState, encounterIndex: number): CampaignAdvance {
  if (battle.result === 'defeat') return { kind: 'defeat' }
  if (battle.result !== 'victory') throw new Error('Campaign can advance only after a victory')
  return encounterIndex >= campaignEncounters(battle.economy).length - 1
    ? { kind: 'complete' }
    : { kind: 'reward', nextEncounter: encounterIndex + 1 }
}

export function carriedHeroes(battle: BattleState): BattleState['heroes'] {
  return {
    warrior: { ...battle.heroes.warrior, armor: 0 },
    mage: { ...battle.heroes.mage, armor: 0 },
  }
}

export function heroHealth(heroes: BattleState['heroes']): Pick<Hero, 'health' | 'maxHealth'> {
  return { health: heroes.warrior.health + heroes.mage.health, maxHealth: heroes.warrior.maxHealth + heroes.mage.maxHealth }
}

// The playable dungeon campaign is kept here beside the legacy linear helpers still used by Balance Lab.
export const DUNGEON_LAYER_COUNT = 6
export const REST_HEAL_AMOUNT = 6
export const NORMAL_REWARD_CHOICES = 3
export const ELITE_REWARD_CHOICES = 5

export type DungeonNodeType = 'battle' | 'elite' | 'rest' | 'final'

export interface DungeonMapNode {
  id: string
  layer: number
  column: number
  type: DungeonNodeType
  edges: string[]
  encounterId?: string
  encounterHealth?: number
  rewardCount?: number
  healAmount?: number
}

export interface DungeonMap {
  seed: number
  layers: DungeonMapNode[][]
  startNodeIds: string[]
  finalNodeId: string
}

export type DungeonRunStatus = 'active' | 'victory' | 'defeat'

export interface DungeonRewardOffer {
  id: string
  nodeId: string
  /** Independent named seeds keep reward generation away from combat and deck RNG. */
  seed: number
  artifactSeed: number
  count: number
  elite: boolean
  cards: CardAcquisition[]
  artifactIds: ArtifactId[]
}

export interface DungeonRunState {
  runId: string
  nextCardId: number
  decisions: string[]
  deckOperations: DeckOperationOffer[]
  /** The remaining run fields are the immutable entry deck/heroes/artifacts while a battle is active. */
  battleEntry: { nodeId: string; seed: number } | null
  seed: number
  mapSeed: number
  map: DungeonMap
  currentNodeId: string | null
  visitedNodeIds: string[]
  completedNodeIds: string[]
  deck: PersistentCard[]
  heroes: BattleState['heroes']
  artifacts: ArtifactInstance[]
  status: DungeonRunStatus
  pendingReward: DungeonRewardOffer | null
  /** Cards that never appear in this run's reward offers (Balance Lab controls); empty in the game. */
  excludedRewards?: CardId[]
}

const dungeonLayerTypes: DungeonNodeType[][] = [
  ['battle', 'battle', 'battle'],
  ['rest', 'battle', 'battle'],
  ['battle', 'elite', 'battle'],
  ['battle', 'rest', 'battle'],
  ['battle', 'elite', 'battle'],
  ['battle', 'rest', 'battle'],
]

/** Derive an independent deterministic seed for a named part of the run. */
export function deriveDungeonSeed(seed: number, scope: string): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0)
  for (const character of scope) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function dungeonRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleValues<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!]
  }
  return result
}

function nodeId(layer: number, column: number): string { return `layer-${layer + 1}-column-${column + 1}` }

/** Generate six encounter layers plus a guaranteed final node. All edges move forward one layer. */
export function createDungeonMap(seed: number, economy: EconomyConfig = gameEconomy, roster: DungeonRoster = defaultDungeonRoster): DungeonMap {
  const random = dungeonRandom(seed)
  const encounters = campaignEncounters(economy)
  if (encounters.length < 1) throw new Error('Dungeon maps need a final encounter')
  const finalEncounter = roster.final ?? encounters[encounters.length - 1]!

  const layers: DungeonMapNode[][] = []
  dungeonLayerTypes.forEach((types, layerIndex) => {
    const arrangedTypes = layerIndex === 0 ? [...types] : shuffleValues(types, random)
    layers.push(arrangedTypes.map((type, column): DungeonMapNode => {
      const id = nodeId(layerIndex, column)
      if (type === 'rest') {
        return { id, layer: layerIndex, column, type, edges: [], healAmount: REST_HEAL_AMOUNT }
      }
      const pool = type === 'elite'
        ? roster.eliteForLayer(layerIndex)
        : roster.normal.filter(encounter => roster.poolForLayer(layerIndex).includes(encounter.id))
      const previousIds = new Set(layers[layerIndex - 1]?.filter(previous => Math.abs(previous.column - column) <= 1).map(previous => previous.encounterId))
      const withoutAdjacentRepeat = pool.filter(encounter => !previousIds.has(encounter.id))
      const choices = withoutAdjacentRepeat.length ? withoutAdjacentRepeat : pool
      const baseEncounter = choices[Math.floor(random() * choices.length)]!
      const healthScale = roster.healthScale(type, layerIndex, column, random)
      const health = Math.max(1, Math.round(baseEncounter.maxHealth * healthScale))
      const rewardCount = type === 'elite' ? ELITE_REWARD_CHOICES : NORMAL_REWARD_CHOICES
      return {
        id, layer: layerIndex, column, type,
        edges: [], encounterId: baseEncounter.id, encounterHealth: health, rewardCount,
      }
    }))
  })

  const finalNode: DungeonMapNode = {
    id: 'final', layer: DUNGEON_LAYER_COUNT, column: 1, type: 'final',
    edges: [], encounterId: finalEncounter.id, encounterHealth: finalEncounter.maxHealth,
  }
  layers.push([finalNode])

  for (let layerIndex = 0; layerIndex < DUNGEON_LAYER_COUNT; layerIndex += 1) {
    const current = layers[layerIndex]!
    const next = layers[layerIndex + 1]!
    for (const node of current) {
      node.edges = next.filter(target => layerIndex === DUNGEON_LAYER_COUNT - 1 || Math.abs(target.column - node.column) <= 1).map(target => target.id)
    }
  }

  return { seed: seed >>> 0, layers, startNodeIds: layers[0]!.map(node => node.id), finalNodeId: finalNode.id }
}

export function dungeonNode(map: DungeonMap, id: string): DungeonMapNode | undefined {
  return map.layers.flat().find(node => node.id === id)
}

/** Resolve a generated encounter as data without changing the shared enemy package. */
export function dungeonEncounter(node: DungeonMapNode, economy: EconomyConfig = gameEconomy, roster: DungeonRoster = defaultDungeonRoster): EncounterDefinition {
  if (!node.encounterId || node.encounterHealth === undefined || (node.type !== 'battle' && node.type !== 'elite' && node.type !== 'final')) {
    throw new Error(`Node ${node.id} does not contain a battle`)
  }
  const base = [...roster.normal, ...roster.elite, ...(roster.final ? [roster.final] : [])].find(encounter => encounter.id === node.encounterId)
    ?? campaignEncounters(economy).find(encounter => encounter.id === node.encounterId)
  if (!base) throw new Error(`Unknown encounter ${node.encounterId}`)
  return {
    ...base,
    id: `${base.id}/${node.id}`,
    maxHealth: node.encounterHealth,
  }
}

export function createDungeonRun(seed: number, economy: EconomyConfig = gameEconomy, deck: readonly CardId[] = startingDeck, roster: DungeonRoster = defaultDungeonRoster, runId: string = crypto.randomUUID()): DungeonRunState {
  const runSeed = seed >>> 0
  const mapSeed = deriveDungeonSeed(runSeed, 'map')
  const preview = createCampaignBattle({ seed: deriveDungeonSeed(runSeed, 'starting-heroes'), economy, battleId: runId + '/party' })
  return {
    runId, nextCardId: deck.length + 1, decisions: [], deckOperations: [], battleEntry: null,
    seed: runSeed, mapSeed, map: createDungeonMap(mapSeed, economy, roster), currentNodeId: null,
    visitedNodeIds: [], completedNodeIds: [], deck: deck.map((definitionId, index) => ({ instanceId: `${runId}/card/${index + 1}`, definitionId, upgrade: 0 })), artifacts: [],
    heroes: { warrior: { ...preview.heroes.warrior }, mage: { ...preview.heroes.mage } },
    status: 'active', pendingReward: null,
  }
}

export function availableDungeonNodes(run: DungeonRunState): DungeonMapNode[] {
  if (run.status !== 'active' || run.pendingReward) return []
  if (run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId)) return []
  const sourceIds = run.currentNodeId ? dungeonNode(run.map, run.currentNodeId)?.edges ?? [] : run.map.startNodeIds
  return sourceIds.filter(id => !run.visitedNodeIds.includes(id)).map(id => dungeonNode(run.map, id)).filter((node): node is DungeonMapNode => !!node)
}

export function enterDungeonNode(run: DungeonRunState, id: string): DungeonRunState {
  if (!availableDungeonNodes(run).some(node => node.id === id)) throw new Error(`Node ${id} is not an available next step`)
  const node = dungeonNode(run.map, id)!
  return { ...run, currentNodeId: id, visitedNodeIds: [...run.visitedNodeIds, id], battleEntry: node.type === 'rest' ? null : { nodeId: id, seed: deriveDungeonSeed(run.seed, `battle:${id}`) } }
}

export function dungeonRunPhase(run: DungeonRunState): 'map' | 'battle' | 'reward' | 'rest' | 'complete' {
  if (run.status !== 'active') return 'complete'
  if (run.pendingReward) return 'reward'
  if (run.battleEntry) return 'battle'
  if (run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId)) return 'rest'
  return 'map'
}

/** Rebuild only from the unchanged entry state, never from partially paid combat/animation state. */
export function restoreDungeonBattle(run: DungeonRunState, economy: EconomyConfig = gameEconomy, battleId: string = crypto.randomUUID()): BattleState {
  if (!run.battleEntry || dungeonRunPhase(run) !== 'battle') throw new Error('No battle entry to restore')
  const node = dungeonNode(run.map, run.battleEntry.nodeId)!
  return createCampaignBattle({ encounter: dungeonEncounter(node, economy), heroes: run.heroes, deck: run.deck, artifacts: run.artifacts, seed: run.battleEntry.seed, battleId })
}

function carriedRunHeroes(battle: BattleState): BattleState['heroes'] {
  return {
    warrior: { ...battle.heroes.warrior, armor: 0 },
    mage: { ...battle.heroes.mage, armor: 0 },
  }
}

function addCompletedNode(run: DungeonRunState, id: string): string[] {
  return run.completedNodeIds.includes(id) ? run.completedNodeIds : [...run.completedNodeIds, id]
}

export function resolveDungeonBattle(run: DungeonRunState, battle: BattleState): DungeonRunState {
  const current = run.currentNodeId ? dungeonNode(run.map, run.currentNodeId) : undefined
  if (run.status !== 'active' || !current || current.type === 'rest' || run.completedNodeIds.includes(current.id) || battle.result === null) {
    throw new Error('There is no unresolved dungeon battle to finish')
  }
  if (battle.enemy.encounterId !== `${current.encounterId}/${current.id}` || Object.values(run.heroes).some(hero => battle.heroes[hero.id].instanceId !== hero.instanceId)) throw new Error('Stale battle result from another room or run')
  const heroes = carriedRunHeroes(battle)
  const base = { ...run, heroes, completedNodeIds: addCompletedNode(run, current.id), pendingReward: null, battleEntry: null, decisions: [...run.decisions, `battle:${current.id}`] }
  if (battle.result === 'defeat') return { ...base, status: 'defeat' }
  if (current.type === 'final') return { ...base, status: 'victory' }
  return {
    ...base,
    pendingReward: createDungeonRewardOffer(run, current),
  }
}

function seededOffer<T>(seed: number, pool: readonly T[], count: number): T[] {
  return shuffle({ rngState: seed >>> 0 }, pool).slice(0, count)
}

function createDungeonRewardOffer(run: DungeonRunState, node: DungeonMapNode): DungeonRewardOffer {
  const elite = node.type === 'elite'
  const seed = deriveDungeonSeed(run.seed, `reward:${node.id}`)
  const artifactSeed = deriveDungeonSeed(run.seed, `artifact-reward:${node.id}`)
  const count = elite ? ELITE_REWARD_CHOICES : NORMAL_REWARD_CHOICES
  const artifactPool = elite ? artifactDefinitions.filter(definition => !run.artifacts.some(owned => owned.definitionId === definition.id)) : []
  return {
    id: `${run.runId}/reward/${node.id}`,
    nodeId: node.id, seed, artifactSeed, count, elite,
    cards: seededOffer(seed, campaignRewards(run.excludedRewards), count).map(card => ({ definitionId: card.id, upgrade: 0 })),
    artifactIds: seededOffer(artifactSeed, artifactPool, Math.min(3, artifactPool.length)).map(item => item.id),
  }
}

export function dungeonRewardOptions(run: DungeonRunState): CardDefinition[] {
  const offer = run.pendingReward
  if (!offer) return []
  return offer.cards.map(resolveCardDefinition)
}

export function dungeonArtifactOptions(run: DungeonRunState): ArtifactDefinition[] {
  const offer = run.pendingReward
  if (!offer?.elite) return []
  return offer.artifactIds.map(id => artifactDefinitions.find(item => item.id === id)).filter((item): item is ArtifactDefinition => !!item)
}

export function claimDungeonReward(run: DungeonRunState, reward: CardDefinition, offerId = run.pendingReward?.id): DungeonRunState {
  const choice = run.pendingReward?.cards.find(card => card.definitionId === reward.id)
  if (run.status !== 'active' || !run.pendingReward || run.pendingReward.id !== offerId || !choice) throw new Error('This card was not in the current dungeon reward offer')
  const copy = acquiredCopy(run, choice)
  return { ...run, deck: [...run.deck, copy], nextCardId: run.nextCardId + 1, decisions: [...run.decisions, run.pendingReward.id], pendingReward: null }
}

export function skipDungeonReward(run: DungeonRunState, offerId: string): DungeonRunState {
  if (run.status !== 'active' || !run.pendingReward || run.pendingReward.id !== offerId || run.pendingReward.elite) throw new Error('There is no ordinary reward to skip')
  return { ...run, decisions: [...run.decisions, offerId], pendingReward: null }
}

export function claimDungeonArtifact(run: DungeonRunState, artifactId: ArtifactId, ownerInstanceId: string, replaceInstanceId?: string, offerId = run.pendingReward?.id): DungeonRunState {
  const offer = run.pendingReward
  const definition = artifactDefinitions.find(item => item.id === artifactId)
  const owner = Object.values(run.heroes).find(hero => hero.instanceId === ownerInstanceId)
  if (run.status !== 'active' || !offer?.elite || offer.id !== offerId || !offer.artifactIds.includes(artifactId) || !definition) throw new Error('This artifact was not in the current elite reward offer')
  if (run.artifacts.some(item => item.definitionId === artifactId)) throw new Error('Duplicate artifacts are not allowed in one run')
  if (!owner) throw new Error('Artifact owner is not a member of this run')
  const occupied = run.artifacts.find(item => item.ownerInstanceId === ownerInstanceId)
  if (occupied && occupied.instanceId !== replaceInstanceId) throw new Error('The chosen hero already has an artifact; confirm its replacement')
  if (!occupied && replaceInstanceId) throw new Error('There is no artifact in this hero slot to replace')
  const artifacts = occupied ? run.artifacts.filter(item => item.instanceId !== occupied.instanceId) : [...run.artifacts]
  artifacts.push({ instanceId: `${run.runId}/artifact/${offer.nodeId}/${artifactId}`, definitionId: artifactId, ownerInstanceId })
  if (artifacts.length > 2) throw new Error('A party can carry at most two artifacts')
  return { ...run, artifacts, pendingReward: null, decisions: [...run.decisions, offer.id] }
}

export function resolveDungeonRest(run: DungeonRunState, heroId: HeroId | null): DungeonRunState {
  const current = run.currentNodeId ? dungeonNode(run.map, run.currentNodeId) : undefined
  if (run.status !== 'active' || !current || current.type !== 'rest' || run.completedNodeIds.includes(current.id)) {
    throw new Error('There is no unresolved rest node')
  }
  const heroes = { warrior: { ...run.heroes.warrior }, mage: { ...run.heroes.mage } }
  if (heroId) {
    const hero = heroes[heroId]
    if (hero.health >= hero.maxHealth) throw new Error('Choose a hero who can be healed')
    hero.health = Math.min(hero.maxHealth, hero.health + (current.healAmount ?? REST_HEAL_AMOUNT))
  }
  return { ...run, heroes, completedNodeIds: addCompletedNode(run, current.id), decisions: [...run.decisions, `rest:${current.id}`] }
}

/** One immutable rest transaction. The existing upgrade service owns copy validation and the 0→1 operation. */
export function upgradeDungeonRest(run: DungeonRunState, instanceId: string, sourceId: string): DungeonRunState {
  if (sourceId !== `${run.runId}/${run.currentNodeId}`) throw new Error('Stale rest command')
  const completed = resolveDungeonRest(run, null)
  const operation = offerDeckOperation(completed, sourceId, 'upgrade')
  return confirmDeckOperation(operation, sourceId, instanceId)
}

export interface DeckOperationOffer {
  sourceId: string
  kind: 'remove' | 'replace' | 'upgrade'
  options: CardAcquisition[]
  resolved: boolean
}

function betweenRooms(run: DungeonRunState): void {
  if (run.status !== 'active' || run.pendingReward || run.battleEntry || (run.currentNodeId && !run.completedNodeIds.includes(run.currentNodeId))) throw new Error('Deck operations require an active run between rooms')
}

function acquiredCopy(run: DungeonRunState, card: CardAcquisition): PersistentCard {
  validateAcquisition(card)
  return { definitionId: card.definitionId, upgrade: card.upgrade, instanceId: `${run.runId}/card/${run.nextCardId}` }
}

/** Registers a fixed service once. Selection/cancellation is transient; it never spends the source. */
export function offerDeckOperation(run: DungeonRunState, sourceId: string, kind: DeckOperationOffer['kind'], options: readonly CardAcquisition[] = []): DungeonRunState {
  betweenRooms(run)
  if (!sourceId || !['remove', 'replace', 'upgrade'].includes(kind) || run.deckOperations.some(offer => offer.sourceId === sourceId)) throw new Error('Deck operation source already exists or is invalid')
  if ((kind === 'replace') !== (options.length > 0)) throw new Error('Only replacement services have card offers')
  options.forEach(validateAcquisition)
  return { ...run, deckOperations: [...run.deckOperations, { sourceId, kind, options: options.map(card => ({ ...card })), resolved: false }] }
}

/** Immutable transaction: validate every input before publishing any removal, acquisition or spent source. */
export function confirmDeckOperation(run: DungeonRunState, sourceId: string, instanceId: string, replacement?: CardAcquisition, canUpgrade: (card: Readonly<PersistentCard>) => boolean = canUpgradeCard): DungeonRunState {
  betweenRooms(run)
  const offer = run.deckOperations.find(item => item.sourceId === sourceId && !item.resolved)
  const index = run.deck.findIndex(card => card.instanceId === instanceId)
  if (!offer || index < 0) throw new Error('Invalid or already resolved deck operation')
  const previous = run.deck[index]!
  const deck = [...run.deck]
  let nextCardId = run.nextCardId
  if (offer.kind === 'replace') {
    if (!replacement || !offer.options.some(card => card.definitionId === replacement.definitionId && card.upgrade === replacement.upgrade)) throw new Error('Card was not in the replacement offer')
    deck[index] = acquiredCopy(run, replacement)
    nextCardId += 1
  } else if (offer.kind === 'upgrade') {
    if (replacement || previous.upgrade !== 0 || !canUpgrade({ ...previous })) throw new Error('Upgrade is unavailable or already applied')
    deck[index] = { ...previous, upgrade: 1 }
  } else {
    if (replacement) throw new Error('Removal cannot acquire a card')
    deck.splice(index, 1)
  }
  return { ...run, deck, nextCardId, deckOperations: run.deckOperations.map(item => item === offer ? { ...item, resolved: true } : item), decisions: [...run.decisions, `deck:${sourceId}`] }
}

/** Structural and route constraints; used in tests and optional dev tools. */
export function validateDungeonMap(map: DungeonMap, roster: DungeonRoster = defaultDungeonRoster): string[] {
  const errors: string[] = []
  const nodes = map.layers.flat()
  const byId = new Map(nodes.map(node => [node.id, node]))
  if (byId.size !== nodes.length) errors.push('Node IDs must be unique')
  const final = byId.get(map.finalNodeId)
  if (!final || final.type !== 'final') errors.push('A final node must exist')
  if (map.layers.length !== DUNGEON_LAYER_COUNT + 1) errors.push('Map must have six layers plus the final node')
  if (map.startNodeIds.length < 2) errors.push('The map must offer a real first choice')

  for (const node of nodes) {
    if (node.type === 'elite' && node.layer < 2) errors.push(`Elite ${node.id} appears before layer 3`)
    if (node.type === 'battle' && node.encounterId) {
      const pool = roster.poolForLayer(node.layer)
      if (!pool.includes(node.encounterId)) errors.push(`Normal encounter ${node.encounterId} is not available on layer ${node.layer + 1}`)
    }
    if (node.type === 'elite' && !roster.eliteForLayer(node.layer).some(encounter => encounter.id === node.encounterId)) {
      errors.push(`Elite node ${node.id} does not use the elite assigned to layer ${node.layer + 1}`)
    }
    if (node.type !== 'final' && node.edges.length === 0) errors.push(`Node ${node.id} is a dead end`)
    for (const targetId of node.edges) {
      const target = byId.get(targetId)
      if (!target || target.layer <= node.layer) errors.push(`Edge ${node.id} → ${targetId} is invalid`)
    }
  }

  const reachesFinalMemo = new Map<string, boolean>()
  const visiting = new Set<string>()
  const reachesFinal = (id: string): boolean => {
    if (id === map.finalNodeId) return true
    const cached = reachesFinalMemo.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return false
    visiting.add(id)
    const canReach = (byId.get(id)?.edges ?? []).some(reachesFinal)
    visiting.delete(id)
    reachesFinalMemo.set(id, canReach)
    return canReach
  }
  for (const startId of map.startNodeIds) if (!reachesFinal(startId)) errors.push(`Start node ${startId} cannot reach the final`)
  for (const node of nodes) if (node.type !== 'final' && !reachesFinal(node.id)) errors.push(`Node ${node.id} cannot reach the final`)

  const inspectPaths = (id: string, battleCount: number, eliteCount: number): void => {
    const node = byId.get(id)
    if (!node) return
    const battles = battleCount + (node.type === 'battle' || node.type === 'elite' || node.type === 'final' ? 1 : 0)
    const elites = eliteCount + Number(node.type === 'elite')
    if (elites > 2) errors.push(`Route through ${id} has more than two elites`)
    if (node.type === 'final') {
      if (battles < 4) errors.push('A route has fewer than four battles including the final')
      return
    }
    for (const next of node.edges) inspectPaths(next, battles, elites)
  }
  for (const startId of map.startNodeIds) inspectPaths(startId, 0, 0)
  return [...new Set(errors)]
}

/** Enumerate the small map's legal paths for headless route comparisons. */
export function enumerateDungeonPaths(map: DungeonMap): DungeonMapNode[][] {
  const paths: DungeonMapNode[][] = []
  const visit = (node: DungeonMapNode, path: DungeonMapNode[]) => {
    const nextPath = [...path, node]
    if (node.type === 'final') { paths.push(nextPath); return }
    for (const nextId of node.edges) {
      const next = dungeonNode(map, nextId)
      if (next) visit(next, nextPath)
    }
  }
  for (const startId of map.startNodeIds) {
    const start = dungeonNode(map, startId)
    if (start) visit(start, [])
  }
  return paths
}
