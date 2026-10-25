import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { adventureSectors, bossRewardRules } from '../game/adventure'
import { claimBossCard, claimBossDevelopment } from '../game/bossReward'
import { dungeonRunPhase } from '../game/campaign'
import type { DungeonRunState } from '../game/campaign'
import { honestEconomies } from '../game/economy'
import { defaultRulesMode, startingDeckFor } from '../game/rulesMode'
import { artifactDefinition } from '../game/artifacts'
import { cardDefinition } from '../game/types'
import BattleResult from '../components/BattleResult.vue'
import BossReward from '../components/BossReward.vue'
import CampaignMap from '../components/CampaignMap.vue'
import MainMenu from '../components/MainMenu.vue'
import RunComplete from '../components/RunComplete.vue'
import SectorTransition from '../components/SectorTransition.vue'
import { bossSceneIds, createBossScene } from './bossScenes'
import { mapFace } from './mapDisplay'
import { cardChoiceText, developmentChoiceText, healText, sectorTitle } from './bossRewardDisplay'

/**
 * Sector Transition v1: the screens of the sector exit say exactly what the rules did. Every number on them comes from the run's own records
 * (`BossReward`) or from `bossRewardRules`; every sentence is checked against the state it describes.
 */
const economy = honestEconomies['honest-b2-long']
const deck = startingDeckFor(defaultRulesMode, '')
const render = (component: Component, props: Record<string, unknown> = {}) => renderToString(createSSRApp({ render: () => h(component, props) }))
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ')
const scene = (id: (typeof bossSceneIds)[number]) => createBossScene(id, economy, deck)
const rewardProps = (run: DungeonRunState) => ({ reward: run.bossReward, bossName: "Рак'Зор", deck: run.deck, heroes: run.heroes, ownedArtifacts: run.artifacts })

beforeAll(() => {
  // GameTooltip subscribes to window events while setting up; the server render has no window.
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1920, innerHeight: 1080 } })
})

describe('the boss scenes reach the exit through legal transactions', () => {
  it('the gate, the open reward and the exit are the three phases of the same route', () => {
    expect(dungeonRunPhase(scene('boss-gate'))).toBe('battle')
    expect(dungeonRunPhase(scene('boss-reward'))).toBe('boss-reward')
    expect(dungeonRunPhase(scene('boss-exit'))).toBe('transition')
    expect(scene('boss-reward').journey).toEqual({ sectorId: 'old-mines', cleared: [] })
  })
})

describe('the reward screen', () => {
  it('names the boss, offers the three gold cards and the two artifacts, and every action the player has', async () => {
    const run = scene('boss-reward')
    const html = text(await render(BossReward, rewardProps(run)))
    expect(html).toContain("НАГРАДА БОССА · РАК'ЗОР")
    for (const card of run.bossReward!.cards) expect(html, card.definitionId).toContain(cardDefinition(card.definitionId).name)
    for (const id of run.bossReward!.artifactIds) expect(html, id).toContain(artifactDefinition(id).name)
    for (const label of ['Добавить в колоду', 'Заменить свою карту…', 'Не брать золото', 'Отказаться от развития', 'Улучшить карту']) expect(html, label).toContain(label)
    expect(html).toContain('Золотая карта уникальна')
  })

  it('the camp\'s mending is the rules\' own number, from the heroes\' real health', async () => {
    const run = scene('boss-reward')
    const html = text(await render(BossReward, rewardProps(run)))
    expect(html).toContain(`до +${bossRewardRules.healEach} HP каждому`)
    expect(html).toContain(`Вариан Ринн: 19 → ${19 + bossRewardRules.healEach} HP`)
    expect(html).toContain(`Джайна Праудмур: 14 → ${14 + bossRewardRules.healEach} HP`)
    const healthy = { ...run, heroes: { warrior: { ...run.heroes.warrior, health: run.heroes.warrior.maxHealth - 1 }, mage: { ...run.heroes.mage, health: run.heroes.mage.maxHealth } } }
    const near = text(await render(BossReward, rewardProps(healthy)))
    expect(near).toContain(`Вариан Ринн: ${healthy.heroes.warrior.health} → ${healthy.heroes.warrior.maxHealth} HP`)
    expect(near).toContain(`Джайна Праудмур: ${healthy.heroes.mage.maxHealth} → ${healthy.heroes.mage.maxHealth} HP`)
  })

  it('a closed track shows what was decided and no longer offers its options', async () => {
    const open = scene('boss-reward')
    const taken = claimBossCard(open, open.bossReward!.id, { kind: 'take', cardId: open.bossReward!.cards[0]!.definitionId })
    const html = text(await render(BossReward, rewardProps(taken)))
    expect(html).toContain('добавлена в колоду')
    expect(html).not.toContain('Добавить в колоду')
    expect(html).not.toContain('Не брать золото')
    expect(html).toContain('Отказаться от развития')
    const both = claimBossDevelopment(open, open.bossReward!.id, { kind: 'skip' })
    expect(text(await render(BossReward, rewardProps(both)))).toContain('От развития отказались.')
  })

  it('says so when there is no gold left to offer, instead of an empty row', async () => {
    const run = scene('boss-reward')
    const empty = { ...run, bossReward: { ...run.bossReward!, cards: [] } }
    const html = text(await render(BossReward, rewardProps(empty)))
    expect(html).toContain('Все золотые карты уже в вашей колоде')
    expect(html).toContain('Дальше')
  })
})

describe('the transition screen', () => {
  it('sums up the sector, the trophies and the road: three sectors, the next one closed', async () => {
    const run = scene('boss-exit')
    const html = text(await render(SectorTransition, { run }))
    expect(html).toContain('Старые штольни пройдены')
    expect(html).toContain("Рак'Зор повержен")
    for (const sector of adventureSectors) expect(html, sector.name).toContain(sector.name)
    expect(html).toContain('Сектор 1 · Пройден')
    expect(html).toContain('Сектор 2 · Следующий')
    expect(html).toContain('Сектор 3 · Впереди')
    expect(html).toContain('Путь в сектор «Гоблинские мастерские» пока закрыт')
    expect(html).toContain('Главное меню')
    // The screen invites to nothing it cannot do.
    expect(html).not.toContain('Войти')
    expect(html).not.toContain('Начать новый поход')
  })

  it('every trophy line is the record of the ledger, in the same words as the reward screen', async () => {
    const run = scene('boss-exit')
    const reward = run.journey!.cleared[0]!.reward
    const html = text(await render(SectorTransition, { run }))
    expect(html).toContain(cardChoiceText(reward.cardChoice!))
    expect(html).toContain(developmentChoiceText(reward.developmentChoice!, run.heroes))
    expect(html).toContain(healText(reward.healed!, run.heroes))
    expect(reward.healed).toEqual({ warrior: bossRewardRules.healEach, mage: bossRewardRules.healEach })
    expect(html).toContain(`${run.heroes.warrior.health} / ${run.heroes.warrior.maxHealth} HP`)
    expect(html).toContain(`${run.deck.length} Карт в колоде`)
  })

  it('names the sector by its place in the adventure', () => {
    expect(sectorTitle('old-mines')).toBe('Сектор I · Старые штольни')
    expect(sectorTitle('secret-cove')).toBe('Сектор III · Тайная бухта')
  })
})

describe('the other screens that know about the exit', () => {
  it('the boss fight\'s result promises the trophies on an adventure run and the summary otherwise', async () => {
    const trophies = text(await render(BattleResult, { result: 'victory', continueLabel: 'Забрать трофеи босса', final: true, trophies: true }))
    expect(trophies).toContain('Осталось выбрать трофеи босса')
    expect(trophies).toContain('Забрать трофеи босса')
    expect(trophies).not.toContain('итоги похода')
    const plain = text(await render(BattleResult, { result: 'victory', continueLabel: 'Завершить сектор I', final: true }))
    expect(plain).toContain('итоги похода')
  })

  it('the menu says where a run waiting at the exit stands, and a plain active run keeps its old words', async () => {
    const exit = text(await render(MainMenu, { saved: { active: true, atExit: true }, canReturn: false, notice: '', unreadable: false }))
    expect(exit).toContain('Отряд ждёт у выхода из пройденного сектора')
    expect(exit).toContain('Продолжить поход')
    const active = text(await render(MainMenu, { saved: { active: true }, canReturn: false, notice: '', unreadable: false }))
    expect(active).toContain('Отряд ждёт у последней комнаты')
    expect(active).not.toContain('выхода из пройденного сектора')
  })

  it('the map\'s boss hint no longer promises the end of the adventure', () => {
    const hint = mapFace({ type: 'final' }, false).hint
    expect(hint).toContain('Победа завершает сектор')
    expect(hint).not.toContain('развязке')
  })

  it('the map of an adventure run is the map as before, without the boss\'s name', async () => {
    const run = scene('boss-gate')
    const html = await render(CampaignMap, { map: run.map, run })
    expect(html).not.toContain("Рак'Зор")
    expect(html).not.toContain('Трофеи')
  })

  it('a run without a journey still ends in the old summary', async () => {
    const run = { ...scene('boss-exit'), journey: undefined }
    const html = text(await render(RunComplete, { result: 'victory', run }))
    expect(html).toContain('Старые штольни очищены')
  })
})
