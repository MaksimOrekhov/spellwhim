import { acquiredCopy, confirmDeckOperation, deriveDungeonSeed, equipDungeonArtifact, offerDeckOperation } from './campaign'
import type { DeckOperationOffer, DungeonMapNode, DungeonRunState } from './campaign'
import { artifactDefinitions } from './artifacts'
import { canUpgradeCard } from './cardProgression'
import type { CardAcquisition } from './cardProgression'
import { nextRandom, shuffle } from './deck'
import { roomRules } from './roomRules'
import { cardDefinition, cards } from './types'
import type { ArtifactId, HeroId, PersistentCard } from './types'
import type { SectorEventId } from './sectorContent'

export type RoomAction = 'upgrade' | 'remove' | 'replace' | 'card' | 'risk' | 'artifact' | 'leave'
export interface RoomSelection { action: RoomAction; instanceId?: string; heroId?: HeroId; cardId?: string; artifactId?: ArtifactId }
export interface RoomVisit {
  id: string
  nodeId: string
  type: 'forge' | 'treasure' | 'event'
  eventId?: SectorEventId
  cards: CardAcquisition[]
  riskCard: CardAcquisition | null
  replacements: Record<HeroId, CardAcquisition[]>
  artifactIds: ArtifactId[]
  riskSuccess: boolean
  selection: RoomSelection | null
}
export interface RunJournalEntry { nodeId: string; kind: RoomAction | 'reward' | 'skip' | 'rest'; text: string; card?: PersistentCard }
const offer = <T>(seed: number, pool: readonly T[], count: number) => shuffle({ rngState: seed }, pool).slice(0, count)

export function createRoomVisit(run: DungeonRunState, node: DungeonMapNode): RoomVisit {
  if (!['forge', 'treasure', 'event'].includes(node.type)) throw new Error('Not a service room')
  const seed = (scope: string) => deriveDungeonSeed(run.seed, `${scope}:${node.id}`)
  const rewards = cards.filter(c => c.reward && !run.excludedRewards?.includes(c.id))
  const cardOffers = offer(seed('room-cards'), rewards, roomRules.cards).map(c => ({ definitionId: c.id, upgrade: 0 as const }))
  const replacement = (className: HeroId) => offer(seed(`room-replace:${className}`), rewards.filter(c => c.className === className), roomRules.replacementCandidates).map(c => ({ definitionId: c.id, upgrade: 0 as const }))
  return {
    id: `${run.runId}/room/${node.id}`, nodeId: node.id, type: node.type as RoomVisit['type'], ...(node.eventId ? { eventId: node.eventId } : {}),
    cards: cardOffers, riskCard: cardOffers[0] ? { ...cardOffers[0], upgrade: 1 } : null, replacements: { warrior: replacement('warrior'), mage: replacement('mage') },
    artifactIds: offer(seed('room-artifacts'), artifactDefinitions.filter(a => !run.artifacts.some(item => item.definitionId === a.id) && !run.excludedArtifacts?.includes(a.id)), roomRules.artifacts).map(a => a.id),
    riskSuccess: nextRandom({ rngState: seed('event-outcome') }) < roomRules.riskChance, selection: null,
  }
}

export function roomActions(room: RoomVisit): RoomAction[] {
  if (room.type === 'forge') return ['upgrade', 'remove', 'replace', 'leave']
  if (room.type === 'treasure') return ['artifact', 'card', 'leave']
  if (room.eventId === 'forgotten-forge') return ['remove', 'upgrade', 'leave']
  if (room.eventId === 'powder-store') return ['card', 'risk', 'leave']
  if (room.eventId === 'goblin-trade') return ['remove', 'replace', 'leave']
  throw new Error('Unknown event')
}

export function roomEligibleCards(run: DungeonRunState, action: RoomAction): PersistentCard[] {
  return run.deck.filter(c => action === 'upgrade' ? canUpgradeCard(c) : ['remove','replace'].includes(action) && (run.room?.type !== 'event' || c.upgrade === 0) && (action !== 'remove' || run.deck.length > 1) && (action !== 'replace' || roomReplacementOptions(run,c).length > 0))
}

/** One shared boundary for rules, UI and saved candidate truncation. All current cards are ordinary. */
export function roomReplacementOptions(run: DungeonRunState, previous: PersistentCard): CardAcquisition[] {
  const className = cardDefinition(previous.definitionId).className
  return (run.room?.replacements[className] ?? []).filter(c => {
    const definition = cardDefinition(c.definitionId)
    return c.upgrade === 0 && definition.reward && definition.className === className && c.definitionId !== previous.definitionId && !run.excludedRewards?.includes(c.definitionId)
  }).slice(0,roomRules.replacements)
}

export function roomActionAvailable(run: DungeonRunState, action: RoomAction): boolean {
  if (!run.room || !roomActions(run.room).includes(action)) return false
  if (action === 'risk') return !!run.room.riskCard && Object.values(run.heroes).every(h => h.health > roomRules.riskHealth)
  if (action === 'card') return run.room.cards.length > 0
  if (action === 'artifact') return run.room.artifactIds.length > 0
  if (action === 'upgrade' && run.room.eventId === 'forgotten-forge' && !Object.values(run.heroes).some(h => h.health > roomRules.upgradeHealth)) return false
  return !['upgrade','remove','replace'].includes(action) || roomEligibleCards(run,action).length > 0
}

function requireRoom(run: DungeonRunState, id: string): RoomVisit {
  if (run.status !== 'active' || !run.room || run.room.id !== id || run.currentNodeId !== run.room.nodeId || run.completedNodeIds.includes(run.room.nodeId) || run.pendingReward || run.battleEntry) throw new Error('Invalid or already resolved room')
  return run.room
}

/** UI selection is a saved draft; cancelling never spends the room. */
export function selectRoom(run: DungeonRunState, id: string, selection: RoomSelection | null): DungeonRunState {
  const room = requireRoom(run, id)
  if (selection && !roomActions(room).includes(selection.action)) throw new Error('Unavailable room action')
  return { ...run, room: { ...room, selection: selection ? { ...selection } : null } }
}

export interface RoomCommand extends RoomSelection { roomId: string; replaceInstanceId?: string }
export function resolveRoom(run: DungeonRunState, command: RoomCommand): DungeonRunState {
  const room = requireRoom(run, command.roomId), action = command.action
  if (!roomActions(room).includes(action)) throw new Error('Unavailable room action')
  const paidUpgrade = room.eventId === 'forgotten-forge' && action === 'upgrade'
  const hero = command.heroId ? run.heroes[command.heroId] : undefined
  if (paidUpgrade && (!hero || hero.health <= roomRules.upgradeHealth)) throw new Error('Not enough health for this service')
  // Mark completion only in a local immutable value. Errors publish neither payment nor a spent source.
  let next: DungeonRunState = { ...run, room: null, completedNodeIds: [...run.completedNodeIds, room.nodeId], decisions: [...run.decisions, `room:${room.nodeId}`] }
  let text = room.type === 'treasure' ? 'Тайник оставлен без награды' : 'Комната покинута без изменений', changed: PersistentCard | undefined
  if (action === 'upgrade' || action === 'remove' || action === 'replace') {
    const previous = roomEligibleCards(run, action).find(c => c.instanceId === command.instanceId)
    if (!previous) throw new Error('Unavailable card instance')
    const options = action === 'replace' ? roomReplacementOptions(run,previous) : []
    const replacement = options.find(c => c.definitionId === command.cardId)
    const source = room.id
    next = confirmDeckOperation(offerDeckOperation(next, source, action as DeckOperationOffer['kind'], options), source, previous.instanceId, replacement)
    changed = next.deck.find(c => c.instanceId === previous.instanceId) ?? (action === 'replace' ? next.deck.find(c => c.instanceId === `${run.runId}/card/${run.nextCardId}`) : undefined)
    text = action === 'upgrade' ? `Улучшено: ${cardDefinition(previous.definitionId).name}${paidUpgrade ? ` (−${roomRules.upgradeHealth} HP: ${hero!.name})` : ''}` : action === 'remove' ? `Удалено: ${cardDefinition(previous.definitionId).name}${previous.upgrade ? ' ↑' : ''}` : `Замена: ${cardDefinition(previous.definitionId).name}${previous.upgrade ? ' ↑' : ''} → ${cardDefinition(replacement!.definitionId).name}`
    if (paidUpgrade) next = { ...next, heroes: { ...next.heroes, [hero!.id]: { ...hero!, health: hero!.health - roomRules.upgradeHealth } } }
  } else if (action === 'card' || action === 'risk') {
    if (action === 'risk' && Object.values(run.heroes).some(h => h.health <= roomRules.riskHealth)) throw new Error('Risk could kill a hero')
    const acquisition = action === 'risk' ? room.riskCard : room.cards.find(c => c.definitionId === command.cardId)
    if (!acquisition) throw new Error('Card not in this room offer')
    if (action === 'risk' && !room.riskSuccess) {
      next = { ...next, heroes: { warrior: { ...run.heroes.warrior, health: run.heroes.warrior.health-roomRules.riskHealth }, mage: { ...run.heroes.mage, health: run.heroes.mage.health-roomRules.riskHealth } } }
      text = `Порох отсырел и хлопнул: оба героя потеряли по ${roomRules.riskHealth} HP. Карты нет.`
    } else {
      changed = acquiredCopy(next, acquisition)
      next = { ...next, deck: [...next.deck, changed], nextCardId: next.nextCardId+1 }
      text = `Получено: ${cardDefinition(changed.definitionId).name}${changed.upgrade ? ' ↑' : ''}`
    }
  } else if (action === 'artifact') {
    if (!command.artifactId || !room.artifactIds.includes(command.artifactId) || !hero) throw new Error('Invalid artifact offer or owner')
    next = equipDungeonArtifact(next, command.artifactId, hero.instanceId, command.replaceInstanceId, room.nodeId)
    text = `${hero.name}: ${artifactDefinitions.find(a => a.id === command.artifactId)!.name}`
  }
  return { ...next, journal: [...(run.journal ?? []), { nodeId: room.nodeId, kind: action, text, ...(changed ? { card: { ...changed } } : {}) }] }
}
