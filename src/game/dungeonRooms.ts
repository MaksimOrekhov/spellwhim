import { acquiredCopy, confirmDeckOperation, deriveDungeonSeed, equipDungeonArtifact, offerDeckOperation } from './campaign'
import type { DeckOperationOffer, DungeonMapNode, DungeonRunState } from './campaign'
import { artifactDefinitions } from './artifacts'
import { canUpgradeCard } from './cardProgression'
import type { CardAcquisition } from './cardProgression'
import { nextRandom, shuffle } from './deck'
import { dinnerRules, roomRules } from './roomRules'
import { cardDefinition, cards } from './types'
import type { ArtifactId, HeroId, PersistentCard } from './types'
import type { SectorEventId } from './sectorContent'

export type RoomAction = 'upgrade' | 'remove' | 'replace' | 'card' | 'risk' | 'artifact' | 'heal' | 'leave'
/** `heal` (the dinner): health points handed to each hero. */
export interface RoomSelection { action: RoomAction; instanceId?: string; heroId?: HeroId; cardId?: string; artifactId?: ArtifactId; heal?: Record<HeroId, number> }
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
const heroIds: readonly HeroId[] = ['warrior', 'mage']
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
  if (room.eventId === 'suspicious-dinner') return ['heal', 'artifact', 'leave']
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
  if (action === 'heal') return dinnerHealBudget(run) > 0
  if (action === 'artifact') return run.room.artifactIds.length > 0 && (run.room.eventId !== 'suspicious-dinner' || Object.values(run.heroes).some(h => h.health > dinnerRules.trophyHealth))
  if (action === 'upgrade' && run.room.eventId === 'forgotten-forge' && !Object.values(run.heroes).some(h => h.health > roomRules.upgradeHealth)) return false
  return !['upgrade','remove','replace'].includes(action) || roomEligibleCards(run,action).length > 0
}

/** Health the dinner hands out now: the budget, or less when the party is hurt less than that. Zero means the heal is closed. */
export function dinnerHealBudget(run: Pick<DungeonRunState, 'heroes'>): number {
  return Math.min(dinnerRules.heal, heroIds.reduce((sum, id) => sum + Math.max(0, run.heroes[id].maxHealth - run.heroes[id].health), 0))
}

/** A plain starting split for the picker: point by point to whoever is lowest in share of maximum health. The player is free to change it. */
export function suggestDinnerHeal(run: Pick<DungeonRunState, 'heroes'>): Record<HeroId, number> {
  const heal: Record<HeroId, number> = { warrior: 0, mage: 0 }
  for (let left = dinnerHealBudget(run); left > 0; left -= 1) {
    const open = heroIds.filter(id => run.heroes[id].health + heal[id] < run.heroes[id].maxHealth)
    const lowest = open.sort((a, b) => (run.heroes[a].health + heal[a]) / run.heroes[a].maxHealth - (run.heroes[b].health + heal[b]) / run.heroes[b].maxHealth)[0]!
    heal[lowest] += 1
  }
  return heal
}

export interface DinnerPreview { valid: boolean; reason: string; heroes: Record<HeroId, { before: number; after: number; delta: number }> }
/**
 * What a dinner choice does to the party's health, from the one function both the picker and the transaction use, so the preview is the result.
 * A heal must use the whole budget (nothing is wasted while someone is hurt), never exceed a hero's maximum, and be whole numbers.
 */
export function dinnerPreview(run: Pick<DungeonRunState, 'heroes'>, selection: Pick<RoomSelection, 'action' | 'heal' | 'heroId'>): DinnerPreview {
  const delta: Record<HeroId, number> = { warrior: 0, mage: 0 }
  let reason = ''
  if (selection.action === 'heal') {
    const heal = selection.heal
    if (dinnerHealBudget(run) === 0) reason = 'Здоровье у всех полное'
    else if (!heal || heroIds.some(id => !Number.isInteger(heal[id]) || heal[id] < 0)) reason = 'Укажите, сколько здоровья получает каждый герой'
    else {
      heroIds.forEach(id => { delta[id] = heal[id] })
      if (heroIds.some(id => run.heroes[id].health + heal[id] > run.heroes[id].maxHealth)) reason = 'Здоровье не может превысить максимум'
      else if (heal.warrior + heal.mage !== dinnerHealBudget(run)) reason = 'Распределите всё лечение: ' + dinnerHealBudget(run) + ' HP'
    }
  } else if (selection.action === 'artifact') {
    const id = selection.heroId
    if (!id) reason = 'Выберите героя'
    else if (run.heroes[id].health <= dinnerRules.trophyHealth) reason = 'Герой не переживёт цену: нужно больше ' + dinnerRules.trophyHealth + ' HP'
    else delta[id] = -dinnerRules.trophyHealth
  }
  return { valid: reason === '', reason, heroes: { warrior: { before: run.heroes.warrior.health, after: run.heroes.warrior.health + delta.warrior, delta: delta.warrior }, mage: { before: run.heroes.mage.health, after: run.heroes.mage.health + delta.mage, delta: delta.mage } } }
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
  const dinner = room.eventId === 'suspicious-dinner'
  const paidUpgrade = room.eventId === 'forgotten-forge' && action === 'upgrade'
  const hero = command.heroId ? run.heroes[command.heroId] : undefined
  if (paidUpgrade && (!hero || hero.health <= roomRules.upgradeHealth)) throw new Error('Not enough health for this service')
  // Mark completion only in a local immutable value. Errors publish neither payment nor a spent source.
  let next: DungeonRunState = { ...run, room: null, completedNodeIds: [...run.completedNodeIds, room.nodeId], decisions: [...run.decisions, `room:${room.nodeId}`] }
  let text = room.type === 'treasure' ? 'Тайник оставлен без награды' : 'Комната покинута без изменений', changed: PersistentCard | undefined
  if (action === 'heal') {
    const preview = dinnerPreview(run, command)
    if (!preview.valid) throw new Error('Invalid dinner heal: ' + preview.reason)
    next = { ...next, heroes: { warrior: { ...run.heroes.warrior, health: preview.heroes.warrior.after }, mage: { ...run.heroes.mage, health: preview.heroes.mage.after } } }
    text = 'Ужин: ' + heroIds.filter(id => preview.heroes[id].delta > 0).map(id => run.heroes[id].name + ' +' + preview.heroes[id].delta + ' HP').join(', ')
  } else if (action === 'upgrade' || action === 'remove' || action === 'replace') {
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
    if (dinner && !dinnerPreview(run, command).valid) throw new Error('The chosen hero would not survive the trophy')
    next = equipDungeonArtifact(next, command.artifactId, hero.instanceId, command.replaceInstanceId, room.nodeId)
    if (dinner) next = { ...next, heroes: { ...next.heroes, [hero.id]: { ...next.heroes[hero.id], health: hero.health - dinnerRules.trophyHealth } } }
    text = `${hero.name}: ${artifactDefinitions.find(a => a.id === command.artifactId)!.name}${dinner ? ` (−${dinnerRules.trophyHealth} HP)` : ''}`
  }
  return { ...next, journal: [...(run.journal ?? []), { nodeId: room.nodeId, kind: action, text, ...(changed ? { card: { ...changed } } : {}) }] }
}
