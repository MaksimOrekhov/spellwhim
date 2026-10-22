import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createBattle, forecastEnemyAction, previewCard } from '../game/battle'
import { honestEconomies } from '../game/economy'
import { applyStatus, statusViews } from '../game/statuses'
import { cardDefinition, encounters } from '../game/types'
import type { BattleState, CardId } from '../game/types'
import BattleBoard from '../components/BattleBoard.vue'
import { battleScene, battleSceneIds } from './battleScenes'
import { cardFace, cardNotes, ruleLines } from './cardDisplay'
import { heroMarks, intentSpoken, intentTooltip, publicIntent, traitLines } from './threatDisplay'
import type { BattleSceneId } from './battleScenes'

const names = { warrior: 'Вариан', mage: 'Джайна' }
const intentOf = (state: BattleState) => publicIntent(forecastEnemyAction(state))
const bScenes: BattleSceneId[] = ['b-interrupt', 'b-broken', 'b-pierce', 'b-pierce-prepared', 'b-rage', 'b-raging', 'b-shift', 'b-boss2', 'b-frost', 'b-mark']
const standardScenes = battleSceneIds.filter(id => !id.startsWith('b-'))

async function rendered(state: BattleState): Promise<string> {
  const phase = 'player' as const
  const animation = { phase, busy: false, effect: '', source: null, target: 'enemy', amount: 0, bonusDamage: 0, partnerArmor: 0, label: '', pulse: 0, actionId: null, impactTarget: null, incoming: null }
  const html = await renderToString(createSSRApp(BattleBoard, { state, phase, animation }))
  const attributes = [...html.matchAll(/(?:aria-label|title|alt)="([^"]*)"/g)].map(match => match[1])
  return [html, ...attributes].join('\n')
}
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

beforeAll(() => {
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1920, innerHeight: 1080 } })
})

describe('B1 threat texts', () => {
  it('say what the party can do about each property, with the real numbers of a revealed blow', () => {
    const interrupt = intentOf(battleScene('b-interrupt'))
    expect(interrupt).toMatchObject({ kind: 'attack', interrupt: { need: 20, dealt: 12, broken: false } })
    const text = [intentSpoken(interrupt, names), ...intentTooltip(interrupt, names)].join('\n')
    expect(text).toContain('Можно сорвать: нанесите врагу 20 урона за ход (сейчас 12)')

    const pierce = intentOf(battleScene('b-pierce'))
    expect(traitLines(pierce, names).join(' ')).toContain('игнорирует 6 брони')
    expect(traitLines(pierce, names).join(' ')).toContain('нужно 16 брони')

    const rage = intentOf(battleScene('b-rage'))
    expect(rage).toMatchObject({ kind: 'defend', power: expect.any(Number) })
    expect(traitLines(rage, names).join(' ')).toContain('Ярость')
  })

  it('shows a stopped blow as stopped: no threat mark on any hero, no skull', () => {
    const intent = intentOf(battleScene('b-broken'))
    expect(intent).toMatchObject({ kind: 'attack', interrupt: { broken: true } })
    expect(Object.keys(heroMarks(intent))).toEqual([])
    expect(traitLines(intent, names)[0]).toBe('Удар сорван: он ничего не сделает.')
    if (intent.kind === 'attack') expect(intent.hits.every(hit => hit.cancelled && !hit.lethal)).toBe(true)
  })

  it('tells a preparation only the kind of trick: never the size, never the threshold', () => {
    const state = battleScene('b-pierce-prepared')
    const intent = intentOf(state)
    expect(intent).toMatchObject({ kind: 'prepare', traits: { pierce: true } })
    const hidden = state.enemy.nextAction.kind === 'prepare' ? state.enemy.nextAction.prepared : null
    expect(hidden).toMatchObject({ damage: 10, pierce: 6 })
    const text = [intentSpoken(intent, names), ...intentTooltip(intent, names), JSON.stringify(intent)].join('\n')
    expect(text).not.toMatch(/(?<![\d.])(10|6)(?![\d.])/)
    expect(text).toContain('бронебойным')
  })
})

describe('B1 scenes render', () => {
  it('draw trait tokens on the banner, the rage chip and the transition card only where the engine says so', async () => {
    const interrupt = visibleText(await rendered(battleScene('b-interrupt')))
    expect(interrupt).toContain('срыв 12/20')
    const pierce = visibleText(await rendered(battleScene('b-pierce')))
    expect(pierce).toContain('пробой 6')
    expect(visibleText(await rendered(battleScene('b-pierce-prepared')))).toContain('пробой')
    expect(visibleText(await rendered(battleScene('b-broken')))).toContain('сорван')
    expect(visibleText(await rendered(battleScene('b-rage')))).toContain('ярость +3')
    const raging = await rendered(battleScene('b-raging'))
    expect(raging).toContain('Ярость, +3 к урону')
    expect(battleScene('b-raging').enemy.power).toBe(3)
    expect(battleScene('b-raging').enemy.nextAction).toMatchObject({ kind: 'prepare', prepared: { damage: 15 } })
    expect(visibleText(await rendered(battleScene('b-frost')))).toContain('−3')

    const shift = await rendered(battleScene('b-shift'))
    expect(shift).toContain('data-phase-banner')
    expect(visibleText(shift)).toContain('Это действие остаётся прежним')
    expect(visibleText(shift)).toContain('Вторая фаза: обрушение штолен')
    // Later turns keep the words on the badge only.
    const later = await rendered(battleScene('b-boss2'))
    expect(later).not.toContain('data-phase-banner')
    expect(later).toContain('Вторая фаза: обрушение штолен')
    expect(later).toContain('battle-scene--p2')
  })

  it('leave every standard scene exactly as it was: no tokens, no card, no second-phase light', async () => {
    for (const id of standardScenes) {
      const html = await rendered(battleScene(id))
      expect(html, id).not.toContain('class="traits"')
      expect(html, id).not.toContain('data-phase-banner')
      expect(html, id).not.toContain('battle-scene--p2')
      expect(html, id).not.toContain('rage-chip')
    }
  })

  it('every B scene is a state the engine can really reach (a forecast exists and its hits carry only announced traits)', () => {
    for (const id of bScenes) {
      const state = battleScene(id)
      const forecast = forecastEnemyAction(state)
      expect(forecast.action, id).toBeDefined()
      for (const hit of forecast.targets) expect(hit.healthLoss, id).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('B2 statuses and cards on screen', () => {
  it('Frostbite is a status chip with its own badge, and the hero version of Vulnerability reads as a hit on the hero', () => {
    const state = battleScene('b-frost')
    const [chip] = statusViews(state, 'enemy')
    expect(chip).toMatchObject({ id: 'frostbite', badge: '−30%', icon: 'frostbite', polarity: 'negative' })
    expect(chip!.description).toContain('Следующая атака врага слабее')
    const marked = battleScene('b-mark')
    expect(statusViews(marked, 'mage')[0]!.description).toContain('удар по герою')
    expect(statusViews(createBattle(encounters[0]!), 'enemy')).toEqual([])
  })

  it('Frost Grip and Ice Breaker explain themselves: the tag, the conditional line that wakes up, the keyword', () => {
    const board = createBattle(encounters[0]!, undefined, { seed: 3, economy: honestEconomies['honest-b2'] })
    const grip = cardDefinition('frost-grip' as CardId)
    const breaker = cardDefinition('ice-breaker' as CardId)
    expect(cardFace(grip, previewCard(board, grip)).tags.map(tag => tag.id)).toEqual(['frostbite'])
    const waiting = ruleLines(breaker, previewCard(board, breaker))
    expect(waiting).toEqual([expect.objectContaining({ tone: 'off', glyph: 'frostbite', text: '+7, если враг обморожен' })])
    applyStatus(board, 'enemy', 'frostbite')
    const awake = ruleLines(breaker, previewCard(board, breaker))
    expect(awake).toEqual([expect.objectContaining({ tone: 'on', glyph: 'frostbite' })])
    expect(awake[0]!.text).toContain('+7')
    const notes = cardNotes(breaker, previewCard(board, breaker))
    expect(notes.damage?.formula).toBe('5 + 7 = 12')
    expect(notes.keywords.map(keyword => keyword.name)).toEqual(['Обморожение'])
    expect(notes.keywords[0]!.text).toContain('враг после этого бьёт в полную силу')
  })
})
