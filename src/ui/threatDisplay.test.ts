import { beforeAll, describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { endTurn, forecastEnemyAction, playCard } from '../game/battle'
import { applyStatus, statusViews } from '../game/statuses'
import BattleBoard from '../components/BattleBoard.vue'
import { battleScene, battleSceneIds } from './battleScenes'
import { heroMarks, intentSpoken, intentTooltip, lethalHeroes, markSpoken, publicIntent } from './threatDisplay'
import type { BattleSceneId } from './battleScenes'
import type { BattleState } from '../game/types'

const files = import.meta.glob('../components/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
/** Component source without comments, so the guards read code only. */
const source = (name: string) => files[`../components/${name}.vue`]!.replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')

const names = { warrior: 'Вариан', mage: 'Джайна' }
const intentOf = (state: BattleState) => publicIntent(forecastEnemyAction(state))
/** Every string a player or a screen reader can get from the intent of this state. */
function allTexts(state: BattleState): string {
  const intent = intentOf(state)
  const marks = Object.values(heroMarks(intent)).map(mark => markSpoken(mark!, names[mark!.hero]))
  return [intentSpoken(intent, names), ...intentTooltip(intent, names), ...marks].join('\n')
}
const hasNumber = (text: string, value: number) => new RegExp(`(?<![\\d.])${value}(?![\\d.])`).test(text)

/** Visible text and every accessible-name attribute of the rendered scene. */
async function rendered(state: BattleState): Promise<string> {
  const phase = 'player' as const
  const animation = { phase, busy: false, effect: 'none', source: null, target: 'enemy', amount: 0, bonusDamage: 0, partnerArmor: 0, label: '', pulse: 0, actionId: null, impactTarget: null, incoming: null }
  const html = await renderToString(createSSRApp(BattleBoard, { state, phase, animation }))
  const attributes = [...html.matchAll(/(?:aria-label|title|alt)="([^"]*)"/g)].map(match => match[1])
  return [html.replace(/<[^>]*>/g, ' '), ...attributes].join('\n')
}

beforeAll(() => {
  // GameTooltip subscribes to window events while setting up; the server render has no window.
  Object.assign(globalThis, { window: { addEventListener() {}, removeEventListener() {}, innerWidth: 1920, innerHeight: 1080 } })
})

describe('public intent', () => {
  it('reads every number from the forecast, for every battle scene that announces a hit', () => {
    for (const id of battleSceneIds) {
      const state = battleScene(id)
      const forecast = forecastEnemyAction(state)
      const intent = publicIntent(forecast)
      if (intent.kind !== 'attack' && intent.kind !== 'attack_all') continue
      expect(intent.hits.length, id).toBe(forecast.targets.length)
      for (const hit of forecast.targets) {
        const shown = intent.hits.find(item => item.hero === hit.target)!
        expect(shown, id).toMatchObject({ healthLoss: hit.healthLoss, attack: hit.attack, absorbed: hit.absorbed, lethal: hit.lethal })
        // A blow the party has stopped (B1) marks nobody.
        if (shown.cancelled) expect(heroMarks(intent)[hit.target], id).toBeUndefined()
        else expect(heroMarks(intent)[hit.target], id).toMatchObject({ when: 'now', healthLoss: hit.healthLoss })
      }
    }
  })

  it('shows a plain attack on Varian and on Jaina with the exact loss and the right target', () => {
    const onWarrior = intentOf(battleScene('warrior'))
    const onMage = intentOf(battleScene('normal'))
    expect(onWarrior).toMatchObject({ kind: 'attack', hits: [{ hero: 'warrior' }] })
    expect(onMage).toMatchObject({ kind: 'attack', hits: [{ hero: 'mage' }] })
    expect(Object.keys(heroMarks(onMage))).toEqual(['mage'])
    const forecast = forecastEnemyAction(battleScene('normal'))
    expect(onMage.kind === 'attack' && onMage.hits[0]!.healthLoss).toBe(forecast.targets[0]!.healthLoss)
  })

  it('tells the two heroes of an attack on both apart, armor included', () => {
    const state = battleScene('both')
    state.heroes.warrior.armor = 3
    const intent = intentOf(state)
    expect(intent.kind).toBe('attack_all')
    const [warrior, mage] = intent.kind === 'attack_all' ? intent.hits : []
    expect(warrior!.hero).toBe('warrior')
    expect(mage!.hero).toBe('mage')
    expect(warrior!.absorbed).toBeGreaterThan(0)
    expect(warrior!.healthLoss).toBeLessThan(mage!.healthLoss)
    expect(warrior!.attack).toBe(mage!.attack)
  })

  it('counts armor for the current hit and shows a fully absorbed hit as blocked', () => {
    const intent = intentOf(battleScene('absorbed'))
    expect(intent.kind === 'attack' && intent.hits[0]).toMatchObject({ hero: 'warrior', blocked: true, healthLoss: 0 })
    expect(heroMarks(intent).warrior).toMatchObject({ when: 'now', blocked: true })
  })

  it('declares a lethal hit only for an attack that lands now', () => {
    expect(lethalHeroes(intentOf(battleScene('lethal')))).toEqual(['mage'])
    expect(lethalHeroes(intentOf(battleScene('normal')))).toEqual([])
    // The second-phase scene announces a preparation that WOULD kill: nothing lethal is public yet.
    const prepared = battleScene('phase2')
    expect(forecastEnemyAction(prepared).futureTargets.some(hit => hit.lethal)).toBe(true)
    expect(intentOf(prepared).kind).toBe('prepare')
    expect(lethalHeroes(intentOf(prepared))).toEqual([])
  })

  it('changes the announced hit after a protective card is played', () => {
    const state = battleScene('both')
    const before = intentOf(state)
    const bastion = { instanceId: 'scene/bastion', definitionId: 'bastion' as const }
    state.hand = [bastion]
    expect(playCard(state, bastion.instanceId).ok).toBe(true)
    const after = intentOf(state)
    const loss = (intent: typeof before, hero: 'warrior' | 'mage') => intent.kind === 'attack_all' ? intent.hits.find(hit => hit.hero === hero)!.healthLoss : -1
    expect(loss(before, 'warrior')).toBeGreaterThan(0)
    expect(loss(after, 'warrior')).toBe(0)
    expect(loss(after, 'mage')).toBeLessThan(loss(before, 'mage'))
  })

  it('maps the other actions to one number each', () => {
    const state = battleScene('normal')
    state.enemy.nextAction = { kind: 'defend', name: 'Щит', armor: 4 }
    expect(intentOf(state)).toMatchObject({ kind: 'defend', armor: 4 })
    state.enemy.nextAction = { kind: 'recover', name: 'Передышка', armor: 2 }
    expect(intentOf(state)).toMatchObject({ kind: 'recover', armor: 2 })
    expect(Object.keys(heroMarks(intentOf(state)))).toEqual([])
  })
})

describe('a prepared strike hides its size', () => {
  const ids: BattleSceneId[] = ['prepared', 'phase2']

  it('has no numeric field in the public intent or in the hero marks', () => {
    for (const id of ids) {
      const state = battleScene(id)
      const intent = intentOf(state)
      expect(intent.kind, id).toBe('prepare')
      expect(Object.keys(intent).sort(), id).toEqual(['blow', 'kind', 'name', 'phase', 'targets'])
      const marks = heroMarks(intent)
      expect(Object.keys(marks).length, id).toBeGreaterThan(0)
      for (const mark of Object.values(marks)) expect(mark, id).toEqual({ when: 'prepared', hero: mark!.hero })
    }
  })

  it('names the target but none of the hidden numbers in any text, tooltip or spoken label', () => {
    for (const id of ids) {
      const state = battleScene(id)
      const hidden = forecastEnemyAction(state).futureTargets
      expect(hidden.length, id).toBeGreaterThan(0)
      const text = allTexts(state)
      for (const hit of hidden) {
        expect(text, id).toContain(names[hit.target])
        for (const value of [hit.attack, hit.healthLoss, hit.absorbed]) if (value > 0) expect(hasNumber(text, value), `${id}: ${value}`).toBe(false)
      }
      expect(text).not.toMatch(/смертельн/i)
    }
  })

  it('draws the same board whatever the hidden damage is: nothing of it can reach any element', async () => {
    for (const id of ids) {
      const state = battleScene(id)
      const heavier = structuredClone(state)
      const action = heavier.enemy.nextAction
      if (action.kind !== 'prepare') throw new Error('Expected a preparation')
      action.prepared.damage += 7
      expect(forecastEnemyAction(heavier).futureTargets[0]!.attack, id).toBeGreaterThan(forecastEnemyAction(state).futureTargets[0]!.attack)
      expect(await rendered(heavier), id).toBe(await rendered(state))
      expect(allTexts(heavier), id).toBe(allTexts(state))
      expect(intentOf(heavier), id).toEqual(intentOf(state))
      const html = await rendered(state)
      expect(html).not.toMatch(/смертельн/i)
      expect(html).not.toMatch(/class="ghost/)
    }
  })

  it('reveals the exact numbers, unchanged, on the next turn as an ordinary attack', () => {
    for (const id of ids) {
      const state = battleScene(id)
      const secret = forecastEnemyAction(state).futureTargets
      expect(endTurn(state)).toBe(true)
      const intent = intentOf(state)
      expect(intent.kind, id).toBe('attack')
      for (const hit of secret) {
        const shown = intent.kind === 'attack' ? intent.hits.find(item => item.hero === hit.target)! : null
        expect(shown, id).toMatchObject({ attack: hit.attack, healthLoss: hit.healthLoss, absorbed: hit.absorbed, lethal: hit.lethal })
      }
      expect(hasNumber(allTexts(state), secret[0]!.attack), id).toBe(true)
    }
    expect(lethalHeroes(intentOf((() => { const s = battleScene('phase2'); endTurn(s); return s })()))).toEqual(['warrior'])
  })

  it('shows the revealed strike on the scene built for it', async () => {
    const state = battleScene('revealed')
    const intent = intentOf(state)
    expect(intent).toMatchObject({ kind: 'attack', hits: [{ hero: 'mage' }] })
    const loss = intent.kind === 'attack' ? intent.hits[0]!.healthLoss : 0
    expect(hasNumber(await rendered(state), loss)).toBe(true)
  })
})

describe('the forecast is what happens', () => {
  it('matches the real health lost when the turn ends, for every scene with a hit', () => {
    for (const id of battleSceneIds) {
      const state = battleScene(id)
      const intent = intentOf(state)
      if (intent.kind !== 'attack' && intent.kind !== 'attack_all') continue
      const before = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
      endTurn(state)
      // A blow the party has stopped (B1) is shown struck out and loses nothing.
      for (const hit of intent.hits) expect(before[hit.hero] - state.heroes[hit.hero].health, id).toBe(hit.cancelled ? 0 : hit.healthLoss)
    }
  })

  it('does not change the battle while it is described or drawn', async () => {
    for (const id of battleSceneIds) {
      const state = battleScene(id)
      const snapshot = JSON.stringify(state)
      allTexts(state)
      await rendered(state)
      expect(JSON.stringify(state), id).toBe(snapshot)
    }
  })
})

describe('status badges', () => {
  it('give the current figure of each status from its definition', () => {
    const state = battleScene('everything')
    const views = statusViews(state, 'enemy')
    expect(views.find(view => view.id === 'vulnerability')!.badge).toBe('+3')
    expect(views.find(view => view.id === 'bleeding')!.badge).toBe('3')
    applyStatus(state, 'enemy', 'bleeding', 1)
    expect(statusViews(state, 'enemy').find(view => view.id === 'bleeding')!.badge).toBe('4')
    expect(views.length).toBe(2)
  })

  it('show no badge for a carrier without statuses', () => {
    expect(statusViews(battleScene('normal'), 'enemy')).toEqual([])
  })
})

describe('battle scene components', () => {
  it('do no combat math: they never import the rules or the damage chain', () => {
    for (const name of ['HeroFrame', 'EnemyFrame', 'IntentBanner', 'VitalBar', 'ThreatRays', 'StatusChip']) {
      const text = source(name)
      expect(text, name).not.toMatch(/import (?!type)[^\n]*game\/(battle|damage|deck)'/)
      expect(text, name).not.toMatch(/splitDamage|composeHit|forecastEnemyAction/)
    }
  })

  it('never touch the engine forecast: only BattleBoard reads it and hands down the public intent', () => {
    for (const name of ['HeroFrame', 'EnemyFrame', 'IntentBanner', 'VitalBar', 'ThreatRays', 'StatusChip', 'BattleFx']) {
      expect(source(name), name).not.toMatch(/futureTargets|EnemyActionForecast|\.prepared\b/)
    }
    expect(source('BattleBoard')).not.toMatch(/futureTargets/)
    expect(source('IntentBanner')).toContain('intent: PublicIntent')
  })

  it('keep the Pixi anchor protocol', () => {
    expect(source('HeroFrame')).toContain(':data-fx-anchor="hero.id"')
    expect(source('EnemyFrame')).toContain('data-fx-anchor="enemy"')
    expect(source('BattleBoard')).toContain('data-battle-scene')
  })
})
