import { createBattle } from './battle'
import { cards, startingDeck } from './types'
import { economyEncounters, gameEconomy } from './economy'
import { dungeonEncounterById, eliteEncounterCatalog, encounterPoolForLayer, normalEncounterCatalog } from './encountersV09'
import type { EconomyConfig } from './economy'
import { shuffle } from './deck'
import type { BattleState, CardDefinition, CardId, EncounterDefinition, Hero, HeroId } from './types'

export interface CampaignBattleOptions {
  encounter?: EncounterDefinition
  heroes?: BattleState['heroes']
  deck?: readonly CardId[]
  seed?: number
  battleId?: string
  economy?: EconomyConfig
}

/** Shared campaign rules used by the playable app and the headless balance lab. */
export function createCampaignBattle(options: CampaignBattleOptions = {}): BattleState {
  const economy = options.economy ?? gameEconomy
  return createBattle(options.encounter ?? economyEncounters(economy)[0]!, options.heroes, {
    deck: options.deck ?? startingDeck,
    seed: options.seed,
    battleId: options.battleId,
    economy,
  })
}

/** The encounters of the economy's enemy package (v0.7 for the standard game). */
export function campaignEncounters(economy: EconomyConfig = gameEconomy): readonly EncounterDefinition[] {
  return economyEncounters(economy)
}

export function campaignEncounter(index: number, economy: EconomyConfig = gameEconomy): EncounterDefinition | undefined {
  return campaignEncounters(economy)[index]
}

export function campaignRewards(): CardDefinition[] {
  return cards.filter(card => card.reward)
}

/** Seeded reward offer shared by the app and Balance Lab. */
export function campaignRewardOptions(battle: BattleState, count = 3): CardDefinition[] {
  const random = { rngState: (battle.rngState ^ 0x51f15e) >>> 0 }
  return shuffle(random, campaignRewards()).slice(0, Math.max(0, count))
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
  nodeId: string
  seed: number
  count: number
  elite: boolean
}

export interface DungeonRunState {
  seed: number
  mapSeed: number
  map: DungeonMap
  currentNodeId: string | null
  visitedNodeIds: string[]
  completedNodeIds: string[]
  deck: CardId[]
  heroes: BattleState['heroes']
  status: DungeonRunStatus
  pendingReward: DungeonRewardOffer | null
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
export function createDungeonMap(seed: number, economy: EconomyConfig = gameEconomy): DungeonMap {
  const random = dungeonRandom(seed)
  const encounters = campaignEncounters(economy)
  if (encounters.length < 1) throw new Error('Dungeon maps need a final encounter')
  const finalEncounter = encounters[encounters.length - 1]!

  const layers: DungeonMapNode[][] = []
  dungeonLayerTypes.forEach((types, layerIndex) => {
    const arrangedTypes = layerIndex === 0 ? [...types] : shuffleValues(types, random)
    layers.push(arrangedTypes.map((type, column): DungeonMapNode => {
      const id = nodeId(layerIndex, column)
      if (type === 'rest') {
        return { id, layer: layerIndex, column, type, edges: [], healAmount: REST_HEAL_AMOUNT }
      }
      const pool = type === 'elite'
        ? eliteEncounterCatalog
        : normalEncounterCatalog.filter(encounter => encounterPoolForLayer(layerIndex).includes(encounter.id))
      const previousIds = new Set(layers[layerIndex - 1]?.filter(previous => Math.abs(previous.column - column) <= 1).map(previous => previous.encounterId))
      const withoutAdjacentRepeat = pool.filter(encounter => !previousIds.has(encounter.id))
      const choices = withoutAdjacentRepeat.length ? withoutAdjacentRepeat : pool
      const baseEncounter = choices[Math.floor(random() * choices.length)]!
      const healthScale = type === 'elite'
        ? (layerIndex >= 4 ? 1.06 : 1)
        : layerIndex === 0 ? [0.78, 0.82, 0.86][column]! : 0.84 + Math.min(layerIndex, 5) * 0.025 + random() * 0.04
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
export function dungeonEncounter(node: DungeonMapNode, economy: EconomyConfig = gameEconomy): EncounterDefinition {
  if (!node.encounterId || node.encounterHealth === undefined || (node.type !== 'battle' && node.type !== 'elite' && node.type !== 'final')) {
    throw new Error(`Node ${node.id} does not contain a battle`)
  }
  const base = dungeonEncounterById(node.encounterId) ?? campaignEncounters(economy).find(encounter => encounter.id === node.encounterId)
  if (!base) throw new Error(`Unknown encounter ${node.encounterId}`)
  return {
    ...base,
    id: `${base.id}/${node.id}`,
    maxHealth: node.encounterHealth,
  }
}

export function createDungeonRun(seed: number, economy: EconomyConfig = gameEconomy, deck: readonly CardId[] = startingDeck): DungeonRunState {
  const runSeed = seed >>> 0
  const mapSeed = deriveDungeonSeed(runSeed, 'map')
  const preview = createCampaignBattle({ seed: deriveDungeonSeed(runSeed, 'starting-heroes'), economy })
  return {
    seed: runSeed, mapSeed, map: createDungeonMap(mapSeed, economy), currentNodeId: null,
    visitedNodeIds: [], completedNodeIds: [], deck: [...deck],
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
  return { ...run, currentNodeId: id, visitedNodeIds: [...run.visitedNodeIds, id] }
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
  const heroes = carriedRunHeroes(battle)
  const base = { ...run, heroes, completedNodeIds: addCompletedNode(run, current.id), pendingReward: null }
  if (battle.result === 'defeat') return { ...base, status: 'defeat' }
  if (current.type === 'final') return { ...base, status: 'victory' }
  return {
    ...base,
    pendingReward: {
      nodeId: current.id,
      seed: deriveDungeonSeed(run.seed, `reward:${current.id}`),
      count: current.type === 'elite' ? ELITE_REWARD_CHOICES : NORMAL_REWARD_CHOICES,
      elite: current.type === 'elite',
    },
  }
}

export function dungeonRewardOptions(run: DungeonRunState): CardDefinition[] {
  const offer = run.pendingReward
  if (!offer) return []
  const random = { rngState: offer.seed >>> 0 }
  return shuffle(random, campaignRewards()).slice(0, offer.count)
}

export function claimDungeonReward(run: DungeonRunState, reward: CardDefinition): DungeonRunState {
  if (!run.pendingReward || !campaignRewards().some(card => card.id === reward.id)) throw new Error('There is no matching dungeon reward to claim')
  return { ...run, deck: addCampaignReward(run.deck, reward), pendingReward: null }
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
  return { ...run, heroes, completedNodeIds: addCompletedNode(run, current.id) }
}

/** Structural and route constraints; used in tests and optional dev tools. */
export function validateDungeonMap(map: DungeonMap): string[] {
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
      const pool = encounterPoolForLayer(node.layer)
      if (!pool.includes(node.encounterId)) errors.push(`Normal encounter ${node.encounterId} is not available on layer ${node.layer + 1}`)
    }
    if (node.type === 'elite' && !eliteEncounterCatalog.some(encounter => encounter.id === node.encounterId)) errors.push(`Elite node ${node.id} does not use an elite encounter`)
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
