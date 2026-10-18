import { describe, expect, it } from 'vitest'
import { chooseCard } from './balance'
import { createTurnPlanner, planTurn } from './balancePlanner'
import { createBattle, forecastEnemyAction, playCard } from './battle'
import { defaultDungeonRoster } from './encountersV10'
import { PREPARED_BLOW_PRIOR, publicIntent, visibleThreat } from './observableIntent'
import { runStrategyComparison } from './scenarios'
import { cardDefinition, encounters } from './types'
import type { Information } from './observableIntent'
import type { BattleState, CardId, EnemyAction, EncounterDefinition } from './types'

/**
 * Fair Bot Information: a bot sees what a player sees. Two battles that are identical in everything visible but differ in the
 * hidden size of a prepared strike must get identical decisions from every strategy; once the strike is announced, its exact
 * size is public and the decisions may differ. These tests run the real strategies, not just the public model.
 */
const classic = ['aggressive', 'defensive', 'balanced'] as const
type Classic = (typeof classic)[number]
const lookout = defaultDungeonRoster.normal.find(item => item.id === 'defias-lookout') as EncounterDefinition
const handCards: CardId[] = ['bastion', 'ice-ward', 'guard', 'parry', 'interpose', 'sword-strike', 'frostbolt', 'quick-cut']

interface Options { blow?: 'attack' | 'attack_all'; warrior?: number; mage?: number; armorMage?: number }
function prepared(damage: number, options: Options = {}): BattleState {
  const state = createBattle(lookout, undefined, { seed: 11, deck: [...handCards, ...handCards], openingHandSize: handCards.length })
  const blow = options.blow === 'attack_all' ? { kind: 'attack_all' as const, name: 'Залп', damage, primaryTarget: 'mage' as const } : { kind: 'attack' as const, name: 'Выстрел', damage, target: 'mage' as const }
  state.enemy.nextAction = { kind: 'prepare', name: 'Берёт Джайну на прицел', prepared: blow }
  state.enemy.focus = 'mage'
  state.heroes.warrior.health = options.warrior ?? 20
  state.heroes.mage.health = options.mage ?? 14
  state.heroes.mage.armor = options.armorMage ?? 0
  state.mana = 5
  state.maxMana = 5
  return state
}
/** The same battle one turn later: the strike is announced and its size is public. */
function revealed(damage: number, options: Options = {}): BattleState {
  const state = prepared(damage, options)
  state.enemy.nextAction = (state.enemy.nextAction as Extract<EnemyAction, { kind: 'prepare' }>).prepared
  return state
}

/** Plays a whole turn with a strategy and returns the cards it chose, in order. */
function turnOf(state: BattleState, strategy: Classic | 'planner', information: Information = 'public'): string[] {
  const names: string[] = []
  const planner = strategy === 'planner' ? createTurnPlanner() : undefined
  for (let guard = 0; guard < 12; guard += 1) {
    const id = planner ? planner.next(state) : chooseCard(state, strategy as Classic, information)?.instanceId
    const card = state.hand.find(item => item.instanceId === id)
    if (!card || !playCard(state, card.instanceId).ok) break
    names.push(cardDefinition(card.definitionId).id)
  }
  return names
}

const sizes = [8, 15]
const situations: { name: string; build: (damage: number) => BattleState }[] = [
  { name: 'single target', build: damage => prepared(damage) },
  { name: 'both heroes', build: damage => prepared(damage, { blow: 'attack_all' }) },
  // 15 would kill Jaina through no armor, 8 would not: the lethal case.
  { name: 'would-be lethal on a wounded hero', build: damage => prepared(damage, { mage: 11 }) },
  { name: 'armored target', build: damage => prepared(damage, { armorMage: 4, mage: 10 }) },
]

describe('before the strike is announced, hidden damage changes nothing', () => {
  it('shows the two states are identical in everything visible', () => {
    const [small, large] = [prepared(8), prepared(15)]
    expect(publicIntent(forecastEnemyAction(small!))).toEqual(publicIntent(forecastEnemyAction(large!)))
    expect(forecastEnemyAction(small!).futureTargets[0]!.attack).not.toBe(forecastEnemyAction(large!).futureTargets[0]!.attack)
    expect(visibleThreat(forecastEnemyAction(small!), small!.heroes)).toEqual(visibleThreat(forecastEnemyAction(large!), large!.heroes))
  })

  for (const strategy of classic) {
    it(`${strategy}: the same turn whatever the hidden size is`, () => {
      for (const situation of situations) {
        const [a, b] = sizes.map(size => turnOf(situation.build(size), strategy))
        expect(a, situation.name).toEqual(b)
        expect(a!.length, situation.name).toBeGreaterThan(0)
      }
    })
  }

  it('planner: the same plan and the same turn whatever the hidden size is', () => {
    for (const situation of situations) {
      const [a, b] = sizes.map(size => planTurn(situation.build(size)))
      expect(a!.sequence, situation.name).toEqual(b!.sequence)
      expect(a!.score, situation.name).toBe(b!.score)
      const [x, y] = sizes.map(size => turnOf(situation.build(size), 'planner'))
      expect(x, situation.name).toEqual(y)
    }
  })

  it('never calls a preparation lethal, even when the hidden blow would kill', () => {
    const state = prepared(15, { mage: 11 })
    expect(forecastEnemyAction(state).futureTargets.some(hit => hit.lethal)).toBe(true)
    const hits = visibleThreat(forecastEnemyAction(state), state.heroes)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every(hit => hit.estimated && !hit.lethal && hit.attack === PREPARED_BLOW_PRIOR)).toBe(true)
  })

  it('the diagnostic omniscient policy does see it (the test is sensitive)', () => {
    const differs = classic.some(strategy => situations.some(situation => {
      const [a, b] = sizes.map(size => turnOf(situation.build(size), strategy, 'omniscient'))
      return JSON.stringify(a) !== JSON.stringify(b)
    }))
    expect(differs).toBe(true)
  })

  it('scenario strategies make the same choices against a real preparing enemy', () => {
    const guardian = encounters.find(item => item.id === 'twilight-guardian')!
    const first = guardian.behavior.phase1[0]!
    if (first.kind !== 'prepare') throw new Error('Expected the guardian to prepare first')
    const original = first.prepared.damage
    try {
      const results = [6, 18].map(damage => { first.prepared.damage = damage; return runStrategyComparison(42).filter(item => item.encounter === guardian.id).map(item => item.choices) })
      expect(results[0]).toEqual(results[1])
    } finally { first.prepared.damage = original }
  })
})

describe('once the strike is announced, its exact size counts', () => {
  it('shows the exact numbers to the fair policy', () => {
    const state = revealed(15, { mage: 11 })
    expect(visibleThreat(forecastEnemyAction(state), state.heroes)).toEqual([{ target: 'mage', attack: 15, healthLoss: 11, lethal: true, estimated: false }])
  })

  it('lets strategies react differently to a deadly announced strike and a mild one', () => {
    const differs = classic.filter(strategy => {
      const [a, b] = sizes.map(size => turnOf(revealed(size, { mage: 11 }), strategy))
      return JSON.stringify(a) !== JSON.stringify(b)
    })
    expect(differs.length).toBeGreaterThan(0)
  })

  it('the fair and the omniscient policy agree on an announced strike', () => {
    for (const strategy of classic) {
      for (const size of sizes) expect(turnOf(revealed(size, { mage: 11 }), strategy, 'public')).toEqual(turnOf(revealed(size, { mage: 11 }), strategy, 'omniscient'))
    }
  })

  it('planner: reacts to the announced strike', () => {
    const [mild, deadly] = sizes.map(size => planTurn(revealed(size, { mage: 11 })))
    expect(deadly!.sequence).not.toEqual(mild!.sequence)
  })
})
