import { acquiredCopy, confirmDeckOperation, dungeonNode, equipDungeonArtifact, offerDeckOperation } from './campaign'
import type { DungeonRunState } from './campaign'
import { bossHeal, currentClearance, sectorAfter, waitsAtSectorExit } from './adventure'
import type { AdventureSector, BossCardChoice, BossDevelopmentChoice, BossReward } from './adventure'
import { artifactDefinition } from './artifacts'
import { canUpgradeCard, resolveCardDefinition } from './cardProgression'
import { knownSectorEncounters } from './sectorLong'
import type { ArtifactId, CardId, HeroId } from './types'

/**
 * The transactions of a sector boss's reward (docs/design/sector-transition-boss-rewards-v1.md). Each is an immutable value-to-value function that
 * validates everything before it publishes anything, like the elite reward and the forge: an error leaves the run exactly as it was. Two tracks, closed
 * independently and each once: the gold card (take it, trade one of your own for it, or leave it) and the development (one artifact, one upgrade, or
 * nothing). When both are closed the camp mends the heroes, the boss's record moves into the ledger and the run waits at the sector's exit.
 */
export type BossCardCommand = { kind: 'take'; cardId: CardId } | { kind: 'replace'; cardId: CardId; instanceId: string } | { kind: 'skip' }
export type BossDevelopmentCommand = { kind: 'artifact'; artifactId: ArtifactId; ownerInstanceId: string; replaceInstanceId?: string } | { kind: 'upgrade'; instanceId: string } | { kind: 'skip' }

function openReward(run: DungeonRunState, offerId: string): BossReward {
  const reward = run.bossReward
  if (run.status !== 'active' || !run.journey || !reward || reward.id !== offerId) throw new Error('There is no such open boss reward')
  return reward
}

export function claimBossCard(run: DungeonRunState, offerId: string, command: BossCardCommand): DungeonRunState {
  const reward = openReward(run, offerId)
  if (reward.cardChoice) throw new Error('The boss card has already been decided')
  let next = run
  let choice: BossCardChoice
  if (command.kind === 'skip') choice = { kind: 'skip' }
  else {
    const offered = reward.cards.find(card => card.definitionId === command.cardId)
    if (!offered) throw new Error('This card was not in the boss reward offer')
    if (command.kind === 'take') {
      const copy = acquiredCopy(run, offered)
      next = { ...run, deck: [...run.deck, copy], nextCardId: run.nextCardId + 1 }
      choice = { kind: 'take', copy }
    } else {
      const removed = run.deck.find(card => card.instanceId === command.instanceId)
      if (!removed) throw new Error('The card to trade away is not in the deck')
      // The shared replacement transaction: one copy leaves, one arrives with a fresh ID, the source is spent and recorded.
      const source = `${reward.id}/card`
      next = confirmDeckOperation(offerDeckOperation(run, source, 'replace', reward.cards), source, removed.instanceId, offered)
      choice = { kind: 'replace', removed: { ...removed }, copy: { ...next.deck.find(card => card.instanceId === `${run.runId}/card/${run.nextCardId}`)! } }
    }
  }
  return settle({ ...next, bossReward: { ...reward, cardChoice: choice } })
}

export function claimBossDevelopment(run: DungeonRunState, offerId: string, command: BossDevelopmentCommand): DungeonRunState {
  const reward = openReward(run, offerId)
  if (reward.developmentChoice) throw new Error('The boss development has already been decided')
  let next = run
  let choice: BossDevelopmentChoice
  if (command.kind === 'skip') choice = { kind: 'skip' }
  else if (command.kind === 'artifact') {
    if (!reward.artifactIds.includes(command.artifactId)) throw new Error('This artifact was not in the boss reward offer')
    const replaced = command.replaceInstanceId ? run.artifacts.find(item => item.instanceId === command.replaceInstanceId) : undefined
    next = equipDungeonArtifact(run, command.artifactId, command.ownerInstanceId, command.replaceInstanceId, reward.id)
    choice = { kind: 'artifact', artifactId: command.artifactId, ownerInstanceId: command.ownerInstanceId, ...(replaced ? { replacedArtifactId: replaced.definitionId } : {}) }
  } else {
    const card = run.deck.find(item => item.instanceId === command.instanceId)
    if (!card || !canUpgradeCard(card)) throw new Error('Upgrade is unavailable for this card')
    const source = `${reward.id}/upgrade`
    next = confirmDeckOperation(offerDeckOperation(run, source, 'upgrade'), source, card.instanceId)
    choice = { kind: 'upgrade', instanceId: card.instanceId, definitionId: card.definitionId }
  }
  return settle({ ...next, bossReward: { ...reward, developmentChoice: choice } })
}

/** Both tracks closed: mend the heroes, write the ledger and the journal, and leave the sector. Otherwise the run is returned as it is. */
function settle(run: DungeonRunState): DungeonRunState {
  const reward = run.bossReward!
  if (!reward.cardChoice || !reward.developmentChoice) return run
  const healed = bossHeal(run.heroes)
  const heroes: DungeonRunState['heroes'] = {
    warrior: { ...run.heroes.warrior, health: run.heroes.warrior.health + healed.warrior },
    mage: { ...run.heroes.mage, health: run.heroes.mage.health + healed.mage },
  }
  const { bossReward: _closed, ...rest } = run
  const closed: BossReward = { ...reward, healed }
  const journey = run.journey!
  const boss = knownSectorEncounters.find(item => item.id === dungeonNode(run.map, reward.nodeId)?.encounterId)
  const cardChoice = closed.cardChoice!
  const gained = cardChoice.kind === 'skip' ? undefined : cardChoice.copy
  return {
    ...rest, heroes, status: 'sector-complete', decisions: [...run.decisions, reward.id],
    journey: { ...journey, cleared: [...journey.cleared, { sectorId: journey.sectorId, reward: closed }] },
    ...(run.journal ? { journal: [...run.journal, { nodeId: reward.nodeId, kind: 'reward' as const, text: bossJournalText(run, closed, boss?.name ?? 'Босс'), ...(gained ? { card: { ...gained } } : {}) }] } : {}),
  }
}

/** One line for the route history: what the boss left, in the order of the screen. */
export function bossJournalText(run: Pick<DungeonRunState, 'heroes'>, reward: BossReward, bossName: string): string {
  const card = reward.cardChoice
  const development = reward.developmentChoice
  const parts = [
    card?.kind === 'take' ? `золотая карта «${resolveCardDefinition(card.copy).name}»`
      : card?.kind === 'replace' ? `золотая карта «${resolveCardDefinition(card.copy).name}» вместо «${resolveCardDefinition(card.removed).name}${card.removed.upgrade ? ' ↑' : ''}»`
      : 'золотая карта не взята',
    development?.kind === 'artifact' ? `артефакт «${artifactDefinition(development.artifactId).name}»`
      : development?.kind === 'upgrade' ? `улучшена карта «${resolveCardDefinition({ definitionId: development.definitionId, upgrade: 0 }).name}»`
      : 'развитие не выбрано',
  ]
  if (reward.healed) {
    const mended = (['warrior', 'mage'] as HeroId[]).filter(id => reward.healed![id] > 0).map(id => `${run.heroes[id].name} +${reward.healed![id]} HP`)
    parts.push(mended.length ? `привал у выхода: ${mended.join(', ')}` : 'привал у выхода: все здоровы')
  }
  return `${bossName}: ${parts.join('; ')}`
}

/** What waits behind the exit: the next sector, whether it can be entered, and a word for the screen. */
export interface SectorGate { next: AdventureSector | null; open: boolean }
export function sectorGate(run: Pick<DungeonRunState, 'journey' | 'status'>): SectorGate {
  const next = run.journey ? sectorAfter(run.journey.sectorId) ?? null : null
  return { next, open: !!next && next.current !== null && run.status === 'sector-complete' && waitsAtSectorExit(run.journey) }
}

/** The ledger entry of the sector the run is leaving, once its reward is closed. */
export const sectorClearance = (run: Pick<DungeonRunState, 'journey'>) => currentClearance(run.journey)
