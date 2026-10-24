import { computed, shallowRef } from 'vue'
import { endTurn, previewCard, resolveCardPlay, startCardPlay } from '../game/battle'
import { addCampaignReward, createCampaignBattle } from '../game/campaign'
import { gameEconomy } from '../game/economy'
import type { EconomyConfig } from '../game/economy'
import type { ArtifactInstance } from '../game/types'
import { cardDefinition, startingDeck } from '../game/types'
import { resolveCardDefinition } from '../game/cardProgression'
import type { DeckInput } from '../game/types'
import type { BattleState, CardDefinition, CardId, CardInstance, CardPreview, EncounterDefinition, HeroId } from '../game/types'

export interface HandCardView {
  instanceId: string
  card: CardDefinition
  preview: CardPreview
  playable: boolean
}

export function useBattle(options: { seed?: number; deck?: readonly CardId[]; runDeck?: () => DeckInput; economy?: EconomyConfig } = {}) {
  const economy = options.economy ?? gameEconomy
  let seed = (options.seed ?? Date.now()) >>> 0
  let battleSequence = 0
  let runGeneration = 0
  // Standalone legacy laboratories own definitions; the app always reads the authoritative run deck.
  const legacyDeck = shallowRef<CardId[]>([...(options.deck ?? startingDeck)])
  const deck = () => options.runDeck?.() ?? legacyDeck.value
  const ownedCards = computed(() => deck().map(card => typeof card === 'string' ? cardDefinition(card) : resolveCardDefinition(card)))
  const sessionId = crypto.randomUUID()
  function previewBattle() {
    return createCampaignBattle({ deck: deck(), seed, economy, battleId: sessionId + '/generation/' + runGeneration + '/preview' })
  }
  // The map needs hero state, but its preview battle must not consume the first real battle seed.
  const current = shallowRef(previewBattle())
  const state = computed(() => current.value)
  const log = shallowRef('Ваш ход. Разыграйте карты, затем завершите ход.')
  const isOver = computed(() => current.value.result !== null)
  const drawCount = computed(() => current.value.drawPile.length)
  const discardCount = computed(() => current.value.discardPile.length)

  function cardView(instance: CardInstance, preview?: CardPreview): HandCardView {
    const card = resolveCardDefinition(instance)
    return {
      instanceId: instance.instanceId, card,
      preview: preview ?? previewCard(current.value, card),
      playable: !isOver.value && !current.value.pending && current.value.mana >= card.cost,
    }
  }
  const cards = computed(() => current.value.hand.map(instance => cardView(instance)))
  const pendingCard = computed(() => current.value.pending ? cardView(current.value.pending.card, current.value.pending.preview) : null)

  function beginPlay(instanceId: string, armorFocus?: HeroId) {
    const next = structuredClone(current.value)
    const result = startCardPlay(next, instanceId, armorFocus)
    if (!result.ok) {
      log.value = result.reason === 'mana' ? 'Недостаточно маны.' : 'Сейчас нельзя разыграть эту карту.'
      return null
    }
    current.value = next
    log.value = resolveCardDefinition(result.play.card).name + ' разыгрывается…'
    return result.play
  }

  function resolvePlay(actionId: string) {
    const next = structuredClone(current.value)
    const result = resolveCardPlay(next, actionId)
    if (!result.ok) return
    current.value = next
    log.value = next.artifactNotices.length
      ? next.artifactNotices.join(' · ')
      : result.outcome.bonuses.length ? result.outcome.bonuses.join(' · ') + ': ' + result.outcome.damage + ' урона.' : 'Карта разыграна.'
    return result
  }

  function finishTurn(): void {
    const next = structuredClone(current.value)
    if (!endTurn(next)) return
    current.value = next
    log.value = next.result === 'defeat' ? 'Отряд пал…' : next.result === 'victory' ? 'Противник повержен.' : 'Ваш ход. Намерение: ' + next.enemy.nextAction.name + '.'
  }

  function startBattle(encounter: EncounterDefinition, heroes?: BattleState['heroes'], battleSeed?: number, nodeId?: string, artifacts: readonly ArtifactInstance[] = []): void {
    const sequence = battleSequence++
    current.value = createCampaignBattle({
      encounter, heroes: heroes ?? current.value.heroes, deck: deck(),
      seed: battleSeed ?? (seed + sequence) >>> 0, economy,
      battleId: sessionId + '/generation/' + runGeneration + '/battle/' + sequence + '/' + (nodeId ?? ''),
      artifacts,
    })
    log.value = encounter.name + ' преграждает путь.'
  }

  function addCard(card: CardDefinition): void {
    if (options.runDeck) throw new Error('Change the persistent run deck through campaign operations')
    legacyDeck.value = addCampaignReward(legacyDeck.value, card)
  }

  function restart(nextSeed = options.seed ?? Date.now()): void {
    seed = nextSeed >>> 0
    battleSequence = 0
    runGeneration += 1
    legacyDeck.value = [...(options.deck ?? startingDeck)]
    current.value = previewBattle()
    log.value = 'Ваш ход. Разыграйте карты, затем завершите ход.'
  }

  return { state, log, isOver, cards, pendingCard, ownedCards, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart }
}
