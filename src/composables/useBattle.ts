import { computed, shallowRef } from 'vue'
import { createBattle, endTurn, previewCard, resolveCardPlay, startCardPlay } from '../game/battle'
import { cardDefinition, startingDeck } from '../game/types'
import type { BattleState, CardDefinition, CardId, CardInstance, CardPreview, EncounterDefinition } from '../game/types'

export interface HandCardView {
  instanceId: string
  card: CardDefinition
  preview: CardPreview
  playable: boolean
}

export function useBattle(options: { seed?: number; deck?: readonly CardId[] } = {}) {
  let seed = (options.seed ?? Date.now()) >>> 0
  let battleSequence = 0
  let runGeneration = 0
  const ownedDeck = shallowRef<CardId[]>([...(options.deck ?? startingDeck)])
  const ownedCards = computed(() => ownedDeck.value.map(cardDefinition))
  function newBattle(encounter?: EncounterDefinition, heroes?: BattleState['heroes']) {
    const sequence = battleSequence++
    return createBattle(encounter, heroes, {
      seed: (seed + sequence) >>> 0,
      battleId: 'run/' + seed + '/generation/' + runGeneration + '/battle/' + sequence,
      deck: ownedDeck.value,
    })
  }
  const current = shallowRef(newBattle())
  const state = computed(() => current.value)
  const log = shallowRef('Ваш ход. Разыграйте карты, затем завершите ход.')
  const isOver = computed(() => current.value.result !== null)
  const drawCount = computed(() => current.value.drawPile.length)
  const discardCount = computed(() => current.value.discardPile.length)

  function cardView(instance: CardInstance, preview?: CardPreview): HandCardView {
    const card = cardDefinition(instance.definitionId)
    return {
      instanceId: instance.instanceId, card,
      preview: preview ?? previewCard(current.value, card),
      playable: !isOver.value && !current.value.pending && current.value.mana >= card.cost,
    }
  }
  const cards = computed(() => current.value.hand.map(instance => cardView(instance)))
  const pendingCard = computed(() => current.value.pending ? cardView(current.value.pending.card, current.value.pending.preview) : null)

  function beginPlay(instanceId: string) {
    const next = structuredClone(current.value)
    const result = startCardPlay(next, instanceId)
    if (!result.ok) {
      log.value = result.reason === 'mana' ? 'Недостаточно маны.' : 'Сейчас нельзя разыграть эту карту.'
      return null
    }
    current.value = next
    log.value = cardDefinition(result.play.card.definitionId).name + ' разыгрывается…'
    return result.play
  }

  function resolvePlay(actionId: string) {
    const next = structuredClone(current.value)
    const result = resolveCardPlay(next, actionId)
    if (!result.ok) return
    current.value = next
    log.value = result.outcome.links.length ? 'Связка! ' + result.outcome.damage + ' урона.' : 'Карта разыграна.'
    return result
  }

  function finishTurn(): void {
    const next = structuredClone(current.value)
    if (!endTurn(next)) return
    current.value = next
    log.value = next.result === 'defeat' ? 'Отряд пал…' : next.result === 'victory' ? 'Противник повержен.' : 'Ваш ход. Намерение: ' + next.enemy.nextAction.name + '.'
  }

  function startBattle(encounter: EncounterDefinition): void {
    current.value = newBattle(encounter, current.value.heroes)
    log.value = encounter.name + ' преграждает путь.'
  }

  function addCard(card: CardDefinition): void {
    // Copies are intentional; every encounter gives each one a distinct instance ID.
    ownedDeck.value = [...ownedDeck.value, card.id]
  }

  function restart(): void {
    seed = (options.seed ?? Date.now()) >>> 0
    battleSequence = 0
    runGeneration += 1
    ownedDeck.value = [...(options.deck ?? startingDeck)]
    current.value = newBattle()
    log.value = 'Ваш ход. Разыграйте карты, затем завершите ход.'
  }

  return { state, log, isOver, cards, pendingCard, ownedCards, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart }
}
