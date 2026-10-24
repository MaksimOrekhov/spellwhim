import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from '../game/battle'
import { createSectorRun, dungeonRunPhase, enterDungeonNode, availableDungeonNodes, resolveDungeonBattle, restoreDungeonBattle } from '../game/campaign'
import { honestEconomies } from '../game/economy'
import { resolveRoom } from '../game/dungeonRooms'
import { defaultRulesMode, startingDeckFor } from '../game/rulesMode'
import { rhahkZor } from '../game/sectorContent'
import { cardDefinition } from '../game/types'
import type { BattleState, CardId, HeroId } from '../game/types'
import BattleHelp from '../components/BattleHelp.vue'
import BattleResult from '../components/BattleResult.vue'
import DeckViewer from '../components/DeckViewer.vue'
import DungeonRoom from '../components/DungeonRoom.vue'
import HandCard from '../components/HandCard.vue'
import RunComplete from '../components/RunComplete.vue'
import { battleScene } from './battleScenes'
import { cardNotes } from './cardDisplay'
import { cardsText, manaText } from './cardOperations'
import { armorNote, rulesInfoOf, useRules } from './rulesInfo'
import { createSectorScene } from './sectorScenes'
import { heroesStruckNow, intentTooltip, publicIntent, traitLines } from './threatDisplay'

/**
 * UX, Bug & Legacy Audit v1 (docs/reviews/ux-consistency-legacy-audit-v1.md): every hint fixed by the audit is checked against what the
 * engine really does, and every screen text against the action its button performs.
 */
const game = honestEconomies['honest-b2-long']
const names = { warrior: 'Вариан Ринн', mage: 'Джайна Праудмур' }
const render = (component: Component, props: Record<string, unknown> = {}) => renderToString(createSSRApp({ render: () => h(component, props) }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const attributes = (html: string) => [...html.matchAll(/aria-label="([^"]*)"/g)].map(match => match[1]!).join('\n')

beforeAll(() => {
  // GameTooltip subscribes to window events while setting up; the server render has no window.
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1920, innerHeight: 1080 } })
})

/** A B2 Long battle whose deck holds only copies of one card, against the default test encounter (it opens with a preparation on Varian). */
function gameBattle(card: CardId): BattleState {
  return createBattle(undefined, undefined, { economy: game, seed: 3, deck: Array.from({ length: 18 }, () => card) })
}

describe('interrupt: the hint counts what the engine counts', () => {
  it('only health the enemy loses advances the interrupt, and the hint says so', () => {
    const state = battleScene('b-interrupt')
    state.enemy.hurt = 0
    state.enemy.armor = 6
    state.mana = 4
    state.hand = [{ instanceId: 'audit/fireball', definitionId: 'fireball' }]
    const healthBefore = state.enemy.health
    expect(playCard(state, 'audit/fireball').ok).toBe(true)
    // Fireball deals 8: 6 go into armor, 2 into health, and only those 2 count.
    expect(healthBefore - state.enemy.health).toBe(2)
    expect(state.enemy.hurt).toBe(2)
    const tooltip = intentTooltip(publicIntent(forecastEnemyAction(state)), names).join('\n')
    expect(tooltip).toContain('отнимите у врага 20 здоровья за ход (сейчас 2)')
    expect(tooltip).toContain('Урон по броне врага не в счёт')
    expect(tooltip).not.toMatch(/нанесите врагу \d+ урона/)
  })

  it('the battle help explains the same rule', async () => {
    const help = text(await render(BattleHelp))
    expect(help).toContain('отнять у врага указанное количество здоровья')
    expect(help).toContain('Урон по броне врага не в счёт')
  })
})

describe('armor that lasts one enemy turn', () => {
  it('warns on the card when the enemy does not hit the hero this turn, and the engine indeed lets that armor go unused', () => {
    // The guardian opens with a preparation: no blow lands this enemy turn.
    const state = gameBattle('guard')
    expect(state.enemy.nextAction.kind).toBe('prepare')
    const struck = heroesStruckNow(publicIntent(forecastEnemyAction(state)))
    expect(struck).toEqual([])
    const idle = (['warrior', 'mage'] as HeroId[]).filter(id => !struck.includes(id))
    const guard = cardDefinition('guard')
    const notes = cardNotes(guard, previewCard(state, guard), 'board', true, idle)
    expect(notes.conditions.map(line => line.text)).toContain('В этот ход враг не бьёт по Вариану: эта броня исчезнет в конце его хода, ничего не поглотив.')

    const health = { ...state.heroes.warrior }
    expect(playCard(state, state.hand[0]!.instanceId).ok).toBe(true)
    expect(state.heroes.warrior.armor).toBe(4)
    endTurn(state)
    expect(state.heroes.warrior.armor).toBe(0)
    expect(state.heroes.warrior.health).toBe(health.health)
  })

  it('stays quiet when the blow lands this turn on the hero who gets the armor', () => {
    const state = gameBattle('guard')
    endTurn(state)
    // The prepared blow is now revealed: it lands on Varian at the end of this turn.
    const struck = heroesStruckNow(publicIntent(forecastEnemyAction(state)))
    expect(struck).toEqual(['warrior'])
    const guard = cardDefinition('guard')
    const notes = cardNotes(guard, previewCard(state, guard), 'board', true, (['warrior', 'mage'] as HeroId[]).filter(id => !struck.includes(id)))
    expect(notes.conditions.some(line => line.text.startsWith('В этот ход враг не бьёт'))).toBe(false)
  })

  it('names the partner whose share would expire against a single-target blow', () => {
    const state = gameBattle('ice-ward')
    endTurn(state)
    const struck = heroesStruckNow(publicIntent(forecastEnemyAction(state)))
    const ward = cardDefinition('ice-ward')
    const notes = cardNotes(ward, previewCard(state, ward), 'board', true, (['warrior', 'mage'] as HeroId[]).filter(id => !struck.includes(id)))
    expect(notes.conditions.map(line => line.text)).toContain('В этот ход враг не бьёт по Джайне: эта броня исчезнет в конце его хода, ничего не поглотив.')
  })

  it('never warns under rules where armor waits for a hit', () => {
    const state = gameBattle('guard')
    const guard = cardDefinition('guard')
    expect(cardNotes(guard, previewCard(state, guard), 'board', false, ['warrior', 'mage']).conditions.some(line => line.text.startsWith('В этот ход враг не бьёт'))).toBe(false)
  })
})

describe('enemy armor tooltip', () => {
  it('does not say enemy armor fades after a hit on a hero: the engine keeps it across the enemy turn', () => {
    const state = gameBattle('sword-strike')
    state.enemy.armor = 5
    endTurn(state)
    expect(state.enemy.armor).toBe(5)
    const note = armorNote('enemy', { armorExpires: true })
    expect(note).not.toContain('герою')
    expect(note).toContain('держится, пока её не пробьют')
    expect(armorNote('hero', { armorExpires: true })).toContain('Исчезает, когда враг закончит свой ход')
  })
})

describe('rules the screens assume without a provider', () => {
  it('are the rules of the game itself (X04), not the pre-X04 control', async () => {
    let seen: ReturnType<typeof useRules> | null = null
    await renderToString(createSSRApp({ setup() { seen = useRules(); return () => null } }))
    expect(seen).toEqual(rulesInfoOf(game, { frost: true }))
    expect(seen).toMatchObject({ discardsHand: true, armorExpires: true, openingHand: 7, mana: 4, newThreats: true, frost: true })
  })
})

describe('battle help', () => {
  it('describes the current rules and none of the outdated promises', async () => {
    const help = text(await render(BattleHelp))
    expect(help).not.toContain('Точно целиться не нужно')
    expect(help).not.toContain('Защита всегда прикрывает героя под прицелом')
    expect(help).not.toContain('переживший')
    expect(help).not.toContain('сгорают')
    expect(help).toContain('карта с бронёй спросит, кого прикрыть')
    expect(help).toContain('1–9 и 0')
    expect(help).toContain('новая рука из 7 карт; несыгранные карты уходят в сброс. Мана — 4 каждый ход.')
    expect(help).toContain('Если герой переживёт такой удар, он станет Уязвимым')
  })
})

describe('threat texts', () => {
  it('never decline a hero name wrongly: the name opens each line', () => {
    const pierce = traitLines(publicIntent(forecastEnemyAction(battleScene('b-pierce'))), names).join('\n')
    expect(pierce).toMatch(/(Вариан Ринн|Джайна Праудмур) — бронебойный удар/)
    expect(pierce).not.toMatch(/(Вариан Ринн|Джайна Праудмур) нужно/)
    const mark = traitLines(publicIntent(forecastEnemyAction(battleScene('b-mark'))), names).join('\n')
    expect(mark).not.toContain('Уязвим —')
  })

  it('no longer tells a both-heroes hit is covered by Stance and Bastion', () => {
    const both = intentTooltip(publicIntent(forecastEnemyAction(battleScene('both'))), names).join('\n')
    expect(both).not.toContain('Стойка защищает')
    expect(both).toContain('спросит, кого прикрыть')
  })
})

describe('battle result', () => {
  it('a defeat leads to the run summary, and the button says so', async () => {
    const fresh = createSectorRun(5, game, startingDeckFor(defaultRulesMode, ''))
    const run = enterDungeonNode(fresh, fresh.map.startNodeIds[0]!)
    const battle = restoreDungeonBattle(run, game)
    battle.heroes.mage.health = 0
    battle.result = 'defeat'
    expect(dungeonRunPhase(resolveDungeonBattle(run, battle))).toBe('complete')
    const html = text(await render(BattleResult, { result: 'defeat' }))
    expect(html).toContain('К итогам похода')
    expect(html).not.toContain('Начать заново')
  })

  it('a victory speaks of the mines, not of the old forest', async () => {
    const plain = text(await render(BattleResult, { result: 'victory', continueLabel: 'Выбрать награду' }))
    expect(plain).not.toContain('Чаща')
    expect(plain).toContain('Выбрать награду')
    const boss = text(await render(BattleResult, { result: 'victory', continueLabel: 'Завершить сектор I', final: true }))
    expect(boss).toContain('Сектор пройден')
    expect(boss).toContain('Завершить сектор I')
  })
})

describe('run summary', () => {
  it('shows the real boss and offers both a new run and the menu', async () => {
    let run = createSectorScene('complete')
    const sector = text(await render(RunComplete, { result: 'victory', run }))
    expect(sector).toContain(rhahkZor.title)
    expect(sector).toContain('Главное меню')
    expect(sector).toContain('Начать новый поход')
    run = { ...run, status: 'defeat' }
    const defeat = text(await render(RunComplete, { result: 'defeat', run }))
    expect(defeat).not.toContain('Сумеречное сердце')
    expect(defeat).toContain('Главное меню')
  })
})

describe('deck viewer', () => {
  it('closes with a neutral label and lists each card once with its count', async () => {
    const run = createSectorRun(5, game, startingDeckFor(defaultRulesMode, ''))
    const deck = [...run.deck, { ...run.deck[0]!, instanceId: 'audit/extra-1' }, { ...run.deck[1]!, instanceId: 'audit/extra-2' }, { ...run.deck[2]!, instanceId: 'audit/extra-3' }]
    const html = await render(DeckViewer, { deck })
    expect(text(html)).toContain('Колода отряда · 21 карта')
    expect(text(html)).toContain('Закрыть')
    expect(text(html)).not.toContain('Вернуться к награде')
    expect(text(html)).not.toMatch(/Копия \d/)
    expect(attributes(html)).not.toMatch(/(^|\D)1 маны/)
  })
})

describe('Russian numerals', () => {
  it('agree with the number', () => {
    expect([1, 2, 5, 11, 21, 22].map(manaText)).toEqual(['1 мана', '2 маны', '5 маны', '11 маны', '21 мана', '22 маны'])
    expect([1, 3, 18, 21, 14, 104].map(cardsText)).toEqual(['1 карта', '3 карты', '18 карт', '21 карта', '14 карт', '104 карты'])
  })

  it('a hand card reads its cost correctly to a screen reader', async () => {
    const state = gameBattle('sword-strike')
    const card = cardDefinition('sword-strike')
    const html = await render(HandCard, { card, instanceId: 'audit/1', preview: previewCard(state, card), block: null, playing: false, index: 0 })
    expect(attributes(html)).toContain('Удар мечом, 1 мана.')
  })
})

describe('rooms', () => {
  it('say why an option is closed', async () => {
    const run = createSectorScene('powder-store')
    const weak = { ...run, heroes: { warrior: { ...run.heroes.warrior, health: 2 }, mage: { ...run.heroes.mage, health: 9 } } }
    const html = text(await render(DungeonRoom, { run: weak }))
    expect(html).toContain('Каждому герою нужно больше 2 HP')
    expect(html).not.toContain('Нет доступной цели или недостаточно здоровья')
  })

  it('leaving a service room is not called giving up a reward, and the journal is written in the past tense', async () => {
    const run = createSectorScene('forge')
    const html = text(await render(DungeonRoom, { run }))
    expect(html).toContain('Уйти, ничего не меняя')
    const left = resolveRoom(run, { roomId: run.room!.id, action: 'leave' })
    expect(left.journal![left.journal!.length - 1]!.text).toBe('Комната покинута без изменений')
    const treasure = createSectorScene('treasure')
    const leftTreasure = resolveRoom(treasure, { roomId: treasure.room!.id, action: 'leave' })
    expect(leftTreasure.journal![leftTreasure.journal!.length - 1]!.text).toBe('Тайник оставлен без награды')
    expect(availableDungeonNodes(left).length).toBeGreaterThan(0)
  })
})
