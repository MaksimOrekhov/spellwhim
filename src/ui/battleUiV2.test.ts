import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { forecastEnemyAction } from '../game/battle'
import { statusViews } from '../game/statuses'
import { rhahkZor, sectorOneElite } from '../game/sectorContent'
import type { BattleState } from '../game/types'
import BattleBoard from '../components/BattleBoard.vue'
import StatusTray from '../components/StatusTray.vue'
import { battleScene, battleSceneIds } from './battleScenes'
import { enemyTier } from './enemyTier'
import { notesPlacement, COMPACT_BELOW, handMode } from './handLayout'
import { intentLabel, publicIntent } from './threatDisplay'
import { vitalsSpoken, vitalsView } from './vitals'

/** Battle UI v2 (docs/design/battle-ui-v2.md): the new composition must keep every readout honest and in reach. */
const intentOf = (state: BattleState) => publicIntent(forecastEnemyAction(state))
async function board(state: BattleState): Promise<string> {
  const phase = 'player' as const
  const animation = { phase, busy: false, effect: '', source: null, target: 'enemy', amount: 0, bonusDamage: 0, partnerArmor: 0, label: '', pulse: 0, actionId: null, impactTarget: null, incoming: null, vfx: null, reaction: {} }
  return renderToString(createSSRApp(BattleBoard, { state, phase, animation }))
}
beforeAll(() => { Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1920, innerHeight: 1080 } }) })

describe('health plate model', () => {
  it('draws health and the announced loss as percentages of the maximum', () => {
    expect(vitalsView(16, 25, 10)).toMatchObject({ pct: 64, ghostPct: 40, ghostFrom: 24, after: 6 })
  })
  it('never lets the ghost run past the health it comes out of, nor go negative', () => {
    expect(vitalsView(9, 18, 30)).toMatchObject({ pct: 50, ghostPct: 50, ghostFrom: 0, after: 0 })
    expect(vitalsView(9, 18, -4).ghostPct).toBe(0)
  })
  it('survives odd input: zero maximum, health above the maximum, no health', () => {
    expect(vitalsView(5, 0).pct).toBe(100)
    expect(vitalsView(40, 25).pct).toBe(100)
    expect(vitalsView(0, 25)).toMatchObject({ pct: 0, ghostPct: 0 })
  })
  it('warms the bar at a third of the health or less', () => {
    expect(vitalsView(8, 25).low).toBe(true)
    expect(vitalsView(20, 25).low).toBe(false)
  })
  it('speaks health, armor and the loss of this turn', () => {
    expect(vitalsSpoken('Вариан', 16, 25, 4, 10)).toBe('Вариан: здоровье 16 из 25, броня 4, в этот ход потеряет 10')
    expect(vitalsSpoken('Джайна', 18, 18, 0)).toBe('Джайна: здоровье 18 из 18')
  })
})

describe('enemy tier', () => {
  it('knows the elite and the boss by their stable ID, with or without the map-node suffix', () => {
    expect(enemyTier(sectorOneElite.id)).toBe('elite')
    expect(enemyTier(sectorOneElite.id + '/layer-5-column-1')).toBe('elite')
    expect(enemyTier(rhahkZor.id + '/final')).toBe('boss')
    expect(enemyTier('old-mines-raider')).toBe('normal')
    expect(enemyTier('something-unknown')).toBe('normal')
  })
  it('is on the scene as a class and on the enemy as a tag, and only for the elite and the boss', async () => {
    const normal = await board(battleScene('normal'))
    expect(normal).toContain('battle-scene--tier-normal')
    expect(normal).not.toContain('tier-tag')
    const elite = await board(battleScene('b-elite'))
    expect(elite).toContain('battle-scene--tier-elite')
    expect(elite).toContain('Элита')
    const boss = await board(battleScene('b-boss1'))
    expect(boss).toContain('battle-scene--tier-boss')
    expect(boss).toContain('Фаза I')
  })
})

describe('notes scroll placement', () => {
  const viewport = { width: 900, height: 600 }
  const card = { left: 340, top: 316, right: 525, bottom: 570 }
  it('goes beside the card, on the right while there is room', () => {
    expect(notesPlacement(card, viewport, 26, [])).toMatchObject({ side: 'right', offset: 539 })
  })
  it('goes to the left when the card is near the right edge', () => {
    const edge = notesPlacement({ left: 700, top: 316, right: 890, bottom: 570 }, viewport, 26, [])
    expect(edge.side).toBe('left')
    expect(edge.offset).toBe(viewport.width - (700 - 14))
  })
  it('may rise only to the lowest readout in its own columns', () => {
    const plate = { left: 600, top: 150, right: 780, bottom: 232 }
    const free = notesPlacement(card, viewport, 26, [])
    const capped = notesPlacement(card, viewport, 26, [plate])
    expect(free.maxHeight).toBe(600 - 26 - 8)
    expect(capped.maxHeight).toBe(600 - 26 - (232 + 3))
  })
  it('ignores readouts that are in other columns', () => {
    const farAway = { left: 20, top: 150, right: 120, bottom: 300 }
    expect(notesPlacement(card, viewport, 26, [farAway]).maxHeight).toBe(notesPlacement(card, viewport, 26, []).maxHeight)
  })
})

describe('hand at 900×600', () => {
  it('keeps seven full cards in a fan instead of small tiles once the controls moved to one column', () => {
    // 7 cards of 147px in the ~725px that the hand row has: 65% of every card stays visible.
    const mode = handMode(7, 725, 147, 6)
    expect(mode.compact).toBe(false)
    expect(mode.layout.visible).toBeGreaterThanOrEqual(COMPACT_BELOW)
  })
  it('still switches to tiles for ten cards, where a fan would hide too much', () => {
    expect(handMode(10, 725, 147, 6).compact).toBe(true)
  })
})

describe('intent banner tab', () => {
  it('says when the effect lands: a hit at the end of the turn, a preparation on the next one', () => {
    expect(intentLabel(intentOf(battleScene('normal')))).toMatch(/в конце хода/)
    expect(intentLabel(intentOf(battleScene('prepared')))).toBe('Готовит удар · на следующем ходу')
  })
  it('calls a stopped blow stopped', () => {
    expect(intentLabel(intentOf(battleScene('b-broken')))).toBe('Удар сорван')
  })
  it('puts only public words on the tab of a preparation: no number at all', () => {
    for (const id of ['prepared', 'b-pierce-prepared']) expect(intentLabel(intentOf(battleScene(id as never)))).not.toMatch(/\d/)
  })
})

describe('status tray', () => {
  it('holds every active status, the rage and the artifact in one labelled group', async () => {
    const state = battleScene('b-crowded')
    const html = await renderToString(createSSRApp(StatusTray, { statuses: statusViews(state, 'enemy'), rage: state.enemy.power ?? 0, label: 'Состояния: враг' }))
    expect(html).toContain('aria-label="Состояния: враг"')
    expect(html).toContain('data-critical')
    for (const name of ['Противник уязвим', 'Противник истекает кровью', 'Ярость']) expect(html).toContain(name)
    expect((html.match(/<li/g) ?? []).length).toBe(statusViews(state, 'enemy').length + 1)
  })
  it('renders nothing for a participant without statuses', async () => {
    expect(await renderToString(createSSRApp(StatusTray, { statuses: [], label: 'x' }))).not.toContain('<ul')
  })
})

describe('the new board in every battle scene', () => {
  it('renders, marks its readouts as critical and keeps the Pixi anchors', async () => {
    for (const id of battleSceneIds) {
      const html = await board(battleScene(id))
      expect(html, id).toContain('data-fx-anchor="enemy"')
      expect(html, id).toContain('data-fx-anchor="warrior"')
      expect(html, id).toContain('data-fx-anchor="mage"')
      expect((html.match(/data-critical/g) ?? []).length, id).toBeGreaterThanOrEqual(4)
    }
  })
  it('shows the loss of a hit that lands and only a question mark for a preparation', async () => {
    const hit = await board(battleScene('normal'))
    expect(hit).toMatch(/−\d+/)
    const prepared = await board(battleScene('prepared'))
    expect(prepared).toContain('?')
    expect(prepared).not.toMatch(/class="loss"/)
  })
  it('gives each hero armor a socket even when there is none, and the numbers when there is', async () => {
    const none = await board(battleScene('normal'))
    expect(none).toContain('armor--empty')
    const armored = await board(battleScene('b-crowded'))
    expect(armored).toContain('aria-label="Броня 4"')
    expect(armored).toContain('aria-label="Броня 5"')
  })
})

describe('new scene components', () => {
  const files = import.meta.glob('../components/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const source = (name: string) => files[`../components/${name}.vue`]!.replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')
  it('do no combat math and never touch the engine forecast', () => {
    for (const name of ['StatChip', 'StatusTray', 'ArtifactChip', 'BattleBackdrop']) {
      expect(source(name), name).not.toMatch(/import (?!type)[^\n]*game\/(battle|damage|deck)'/)
      expect(source(name), name).not.toMatch(/splitDamage|composeHit|forecastEnemyAction|futureTargets|EnemyActionForecast|\.prepared\b/)
    }
  })
  it('keep the backdrop out of the way: it paints only, never takes the pointer, and is hidden from assistive tech', () => {
    const text = files['../components/BattleBackdrop.vue']!
    expect(text).toContain('pointer-events:none')
    expect(text).toContain('aria-hidden="true"')
  })
})
