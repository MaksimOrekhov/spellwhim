import { computed, shallowRef } from 'vue'
import { createBattle, endTurn, payCardCost, resolveCardEffect } from '../game/battle'
import { cards as cardPool } from '../game/types'
import type { CardDefinition, CardId, EncounterDefinition } from '../game/types'

export function useBattle() {
  const state = shallowRef(createBattle())
  const log = shallowRef('Ваш ход. Разыграйте карты, затем завершите ход.')
  const playedCards = shallowRef<ReadonlySet<CardId>>(new Set())
  const ownedCards = shallowRef<CardDefinition[]>(cardPool.slice(0, 3))
  const hand = shallowRef<CardDefinition[]>([])
  const drawPile = shallowRef<CardDefinition[]>([])
  const discardPile = shallowRef<CardDefinition[]>([])
  const cards = computed(() => hand.value)
  const drawCount = computed(() => drawPile.value.length)
  const discardCount = computed(() => discardPile.value.length)
  const isOver = computed(() => state.value.result !== null)

  function shuffle(deck: CardDefinition[]): CardDefinition[] {
    const shuffled = [...deck]
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!]
    }
    return shuffled
  }

  function drawCards(count: number): void {
    const drawn: CardDefinition[] = []
    while (drawn.length < count) {
      if (drawPile.value.length === 0) {
        if (discardPile.value.length === 0) break
        drawPile.value = shuffle(discardPile.value)
        discardPile.value = []
      }
      const card = drawPile.value.shift()
      if (!card) break
      drawn.push(card)
    }
    hand.value = [...hand.value, ...drawn]
  }

  function discardHand(): void {
    discardPile.value = [...discardPile.value, ...hand.value]
    hand.value = []
  }

  function cloneState() {
    return {
      ...state.value,
      heroes: {
        warrior: { ...state.value.heroes.warrior },
        mage: { ...state.value.heroes.mage },
      },
      enemy: { ...state.value.enemy },
    }
  }

  function beginPlay(card: CardDefinition): boolean {
    if (playedCards.value.has(card.id) || !hand.value.some(inHand => inHand.id === card.id)) return false
    const next = cloneState()
    const payment = payCardCost(next, card)
    if (!payment.ok) {
      log.value = payment.reason === 'mana' ? 'Недостаточно маны для этого заклинания.' : 'Бой уже завершён.'
      return false
    }
    state.value = next
    playedCards.value = new Set([...playedCards.value, card.id])
    log.value = `${card.name} разыгрывается…`
    return true
  }

  function resolvePlay(card: CardDefinition): void {
    const next = cloneState()
    const outcome = resolveCardEffect(next, card)
    if (!outcome.ok) return
    state.value = next
    hand.value = hand.value.filter(inHand => inHand.id !== card.id)
    if (outcome.draw) drawCards(outcome.draw)
    discardPile.value = [...discardPile.value, card]
    if (next.result === 'victory') discardHand()
    if (outcome.damage) log.value = outcome.draw ? `${card.name}: ${outcome.damage} урона по знаку! Добор карты.` : card.kind === 'spell' ? `${card.name}: ${outcome.damage} урона. Цель отмечена для Бранна.` : `${card.name}: ${outcome.damage} урона!`
    else {
      const target = next.heroes[next.enemy.intent]
      const partner = next.heroes[next.enemy.intent === 'warrior' ? 'mage' : 'warrior']
      log.value = `${target.name}: +${outcome.armor} брони. ${partner.name}: +${outcome.partnerArmor} брони.`
    }
  }

  function finishTurn(): void {
    discardHand()
    const next = cloneState()
    endTurn(next)
    state.value = next
    playedCards.value = new Set()
    if (!next.result) drawCards(3)
    log.value = next.result === 'defeat' ? 'Страж одолел героев…' : `Ваш ход. Страж теперь нацелится на ${next.heroes[next.enemy.intent].name}.`
  }

  function startBattle(encounter: EncounterDefinition): void {
    state.value = createBattle(encounter, state.value.heroes)
    playedCards.value = new Set()
    drawPile.value = shuffle(ownedCards.value)
    discardPile.value = []
    hand.value = []
    drawCards(3)
    log.value = `${encounter.name} преграждает путь.`
  }

  function addCard(card: CardDefinition): void {
    if (ownedCards.value.some(owned => owned.id === card.id)) return
    ownedCards.value = [...ownedCards.value, card]
  }

  function restart(): void {
    state.value = createBattle()
    log.value = 'Ваш ход. Разыграйте карты, затем завершите ход.'
    playedCards.value = new Set()
    ownedCards.value = cardPool.slice(0, 3)
    drawPile.value = shuffle(ownedCards.value)
    discardPile.value = []
    hand.value = []
  }

  return { state, log, isOver, cards, ownedCards, playedCards, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, addCard, restart }
}
