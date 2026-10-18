import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { advanceCampaign, campaignEncounter, campaignEncounters, carriedHeroes, createCampaignBattle } from './campaign'
import { baselineEconomy, buildEconomy, cloneEconomy, drawForTurn, economyEncounters, economyFromSearch, economyFromSpec, economyStage, gameEconomy, manaForTurn, maxManaTurn, playableEconomies } from './economy'
import { reinforcedEncounters } from './encountersV07'
import { cloneBattleState, createTurnPlanner, planTurn } from './balancePlanner'
import { allStrategies, simulateBalance, simulateRun, summarizeEconomy } from './balance'
import { useBattle } from '../composables/useBattle'
import { CARDS_DRAWN_PER_TURN, MAX_HAND_SIZE, OPENING_HAND_SIZE, cardDefinition, cards, encounters, startingDeck } from './types'
import type { BattleState, CardId, EnemyAction, EnemyHit } from './types'

const U = playableEconomies.U
const B = playableEconomies.B
const curve = (economy: typeof U, turns = 10) => Array.from({ length: turns }, (_, index) => manaForTurn(economy, index + 1))

/** A tough dummy: the party cannot die and the enemy cannot fall, so only the economy moves. */
function longBattle(economy = U, deck: readonly CardId[] = startingDeck, extra: Parameters<typeof createBattle>[2] = {}) {
  const state = createBattle({ ...encounters[0]!, maxHealth: 10_000 }, undefined, { deck, seed: 21, economy, ...extra })
  state.heroes.warrior.health = state.heroes.warrior.maxHealth = 10_000
  state.heroes.mage.health = state.heroes.mage.maxHealth = 10_000
  return state
}
function identities(state: BattleState) {
  return [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhausted, ...(state.pending ? [state.pending.card] : [])].map(card => card.instanceId).sort()
}
function spendEverything(state: BattleState) {
  for (let guard = 0; guard < 30; guard += 1) {
    const card = state.hand.find(instance => cardDefinition(instance.definitionId).cost <= state.mana && cardDefinition(instance.definitionId).cost > 0)
    if (!card || !playCard(state, card.instanceId).ok) return
  }
}

describe('economy parameters', () => {
  it('describes the three mana models as in the brief', () => {
    expect(curve(baselineEconomy)).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])
    expect(curve(B)).toEqual([3, 4, 5, 5, 5, 5, 5, 5, 5, 5])
    expect(curve(U)).toEqual([3, 4, 4, 5, 5, 6, 6, 6, 6, 6])
    expect([maxManaTurn(baselineEconomy), maxManaTurn(B), maxManaTurn(U)]).toEqual([1, 3, 6])
  })

  it('clamps unusual turn numbers instead of reading outside the curve', () => {
    expect(manaForTurn(U, 0)).toBe(3)
    expect(manaForTurn(U, -4)).toBe(3)
    expect(manaForTurn(U, 6.9)).toBe(6)
    expect(manaForTurn(U, 1000)).toBe(6)
  })

  it('draws 2 cards a turn, or 3 from turn 5 with the late schedule', () => {
    expect(Array.from({ length: 8 }, (_, index) => drawForTurn(baselineEconomy, index + 2))).toEqual([2, 2, 2, 2, 2, 2, 2, 2])
    expect(Array.from({ length: 8 }, (_, index) => drawForTurn(U, index + 2))).toEqual([2, 2, 2, 3, 3, 3, 3, 3])
    expect(drawForTurn(buildEconomy({ mana: 'U' }), 9)).toBe(2)
  })

  it('keeps model A as the v0.6 control and model B as the standard game', () => {
    expect(baselineEconomy).toMatchObject({ id: 'A', manaCurve: 'A', draw: 'base', enemies: 'v06', openingHand: OPENING_HAND_SIZE })
    expect(baselineEconomy.drawSchedule.perTurn).toBe(CARDS_DRAWN_PER_TURN)
    expect(economyEncounters(baselineEconomy)).toBe(encounters)
    expect(playableEconomies.A).toBe(baselineEconomy)
    expect(gameEconomy).toBe(playableEconomies.B)
    expect(gameEconomy).toMatchObject({ id: 'B', manaCurve: 'B', draw: 'late3', enemies: 'v07' })
    expect(createCampaignBattle({ seed: 9 })).toMatchObject({ economy: gameEconomy, enemy: { maxHealth: 56 } })
  })

  it('builds the comparison stages from independent parts', () => {
    expect(economyStage('A', 'U')).toBe(baselineEconomy)
    expect(economyStage('B', 'U')).toMatchObject({ id: 'U/B', manaCurve: 'U', draw: 'base', enemies: 'v06' })
    expect(economyStage('C', 'B')).toMatchObject({ id: 'B/C', manaCurve: 'B', draw: 'base', enemies: 'v07' })
    expect(economyStage('D', 'U')).toMatchObject({ id: 'U/D', manaCurve: 'U', draw: 'late3', enemies: 'v07' })
    // The complete playable packages are stage D of their curve.
    expect({ ...economyStage('D', 'U'), id: 'U' }).toEqual(U)
    expect({ ...economyStage('D', 'B'), id: 'B' }).toEqual(B)
  })

  it('parses CLI specs and dev URL parameters, defaulting to the standard B package', () => {
    expect(economyFromSpec('U')).toBe(U)
    expect(economyFromSpec('b/c')).toMatchObject({ manaCurve: 'B', enemies: 'v07', draw: 'base' })
    expect(economyFromSpec('U/v06/late3')).toMatchObject({ manaCurve: 'U', enemies: 'v06', draw: 'late3' })
    expect(() => economyFromSpec('Z')).toThrow()
    expect(() => economyFromSpec('U/v09/base')).toThrow()
    expect(economyFromSearch('')).toBe(gameEconomy)
    expect(economyFromSearch('?economy=A')).toBe(baselineEconomy)
    expect(economyFromSearch('?economy=u')).toBe(U)
    expect(economyFromSearch('?economy=B')).toBe(B)
    expect(economyFromSearch('?economy=nonsense')).toBe(gameEconomy)
    expect(economyFromSearch('?economy=U&enemies=v06')).toMatchObject({ manaCurve: 'U', enemies: 'v06', draw: 'late3' })
    expect(economyFromSearch('?economy=U&enemies=v06&draw=base')).toMatchObject({ enemies: 'v06', draw: 'base' })
    expect(economyFromSearch('?economy=U&draw=bogus')).toBe(U)
  })

  it('scales enemy health for calibration runs without touching the presets', () => {
    const scaled = economyFromSpec('A/v07/base/0.5')
    expect(scaled.enemyHealthScale).toBe(0.5)
    expect(scaled.id).toBe('A/v07/base/x0.5')
    expect(economyEncounters(scaled).map(encounter => encounter.maxHealth)).toEqual([28, 36, 55])
    expect(economyEncounters(scaled).map(encounter => encounter.behavior)).toEqual(reinforcedEncounters.map(encounter => encounter.behavior))
    expect(reinforcedEncounters.map(encounter => encounter.maxHealth)).toEqual([56, 72, 110])
    expect(createCampaignBattle({ economy: scaled, seed: 1 }).enemy.maxHealth).toBe(28)
    expect(U.enemyHealthScale).toBe(1)
    expect(economyEncounters(U)).toBe(reinforcedEncounters)
    expect(() => economyFromSpec('U/v07/base/0')).toThrow()
  })

  it('copies share no object with the original', () => {
    const copy = cloneEconomy(U)
    expect(copy).toEqual(U)
    expect(copy).not.toBe(U)
    expect(copy.manaByTurn).not.toBe(U.manaByTurn)
    expect(copy.drawSchedule).not.toBe(U.drawSchedule)
    expect(copy.drawSchedule.boost).not.toBe(U.drawSchedule.boost)
  })
})

describe('mana progression in the engine', () => {
  it('uses B by default and preserves the v0.6 control when A is explicit', () => {
    const plain = createBattle(encounters[1]!, undefined, { seed: 5 })
    const explicit = createBattle(encounters[1]!, undefined, { seed: 5, economy: gameEconomy })
    const legacy = createBattle(encounters[1]!, undefined, { seed: 5, economy: baselineEconomy })
    expect(plain).toEqual(explicit)
    expect(plain).toMatchObject({ mana: 3, maxMana: 3, turn: 1 })
    expect(plain.economy).toEqual(gameEconomy)
    expect(legacy).toMatchObject({ economy: baselineEconomy, mana: 3, maxMana: 3, turn: 1 })
    expect(plain.hand).toHaveLength(OPENING_HAND_SIZE)
    const state = longBattle(baselineEconomy)
    for (let turn = 0; turn < 8; turn += 1) { spendEverything(state); endTurn(state); expect(state).toMatchObject({ mana: 3, maxMana: 3 }) }
  })

  it.each([['B', B], ['U', U]] as const)('grows the maximum at the start of each turn and refills it completely (%s)', (_, economy) => {
    const state = longBattle(economy)
    const seen: number[] = []
    for (let turn = 1; turn <= 9; turn += 1) {
      expect(state.turn).toBe(turn)
      expect(state.maxMana).toBe(manaForTurn(economy, turn))
      expect(state.mana).toBe(state.maxMana)
      seen.push(state.maxMana)
      spendEverything(state)
      expect(state.mana).toBeLessThan(state.maxMana)
      endTurn(state)
    }
    expect(seen).toEqual(curve(economy, 9))
  })

  it('does not carry unspent mana into the next turn', () => {
    const state = longBattle(U)
    endTurn(state)
    expect(state).toMatchObject({ turn: 2, mana: 4, maxMana: 4 })
    endTurn(state)
    expect(state).toMatchObject({ turn: 3, mana: 4 })
    endTurn(state)
    expect(state).toMatchObject({ turn: 4, mana: 5 })
  })

  it('lets a card be paid with the larger pool and rejects it above the pool', () => {
    const state = longBattle(U, ['fireball', 'fireball', 'fireball', 'fireball'], { openingHandSize: 4 })
    expect(playCard(state, state.hand[0]!.instanceId).ok).toBe(true)
    expect(playCard(state, state.hand[0]!.instanceId)).toMatchObject({ ok: false, reason: 'mana' })
    endTurn(state)
    expect(state.mana).toBe(4)
    expect(playCard(state, state.hand[0]!.instanceId).ok).toBe(true)
    expect(playCard(state, state.hand[0]!.instanceId).ok).toBe(true)
    expect(state.mana).toBe(0)
  })

  it('stays reproducible: same seed and actions give the same battle', () => {
    const play = () => {
      const state = longBattle(U, startingDeck, { seed: 99 })
      for (let turn = 0; turn < 7; turn += 1) { spendEverything(state); endTurn(state) }
      return state
    }
    expect(play()).toEqual(play())
    const other = longBattle(U, startingDeck, { seed: 100 })
    expect(other.hand.map(card => card.definitionId)).not.toEqual(longBattle(U, startingDeck, { seed: 99 }).hand.map(card => card.definitionId))
  })

  it('starts every encounter of a campaign from the first value of the curve and carries health', () => {
    const first = createCampaignBattle({ economy: U, seed: 1 })
    for (let turn = 0; turn < 6; turn += 1) endTurn(first)
    expect(first.maxMana).toBe(6)
    first.result = 'victory'
    first.heroes.warrior.health = 14
    first.heroes.mage.health = 7
    first.heroes.mage.armor = 4
    const second = createCampaignBattle({ economy: U, encounter: campaignEncounter(1, U), heroes: carriedHeroes(first), seed: 2 })
    expect(second).toMatchObject({ turn: 1, mana: 3, maxMana: 3, enemy: { name: 'Страж старой рощи', maxHealth: 72 } })
    expect(second.heroes).toMatchObject({ warrior: { health: 14, armor: 0 }, mage: { health: 7, armor: 0 } })
    expect(second.economy).toEqual(U)
  })
})

describe('draw schedule', () => {
  it('keeps unplayed cards and adds 2, then 3 from turn 5', () => {
    const state = longBattle(U, startingDeck, { openingHandSize: 1 })
    const handSizes = [state.hand.length]
    for (let turn = 0; turn < 3; turn += 1) { endTurn(state); handSizes.push(state.hand.length) }
    expect(handSizes).toEqual([1, 3, 5, 7])
    endTurn(state)
    expect(state.turn).toBe(5)
    expect(state.hand).toHaveLength(10)
  })

  it('never burns cards over the hand limit: the extra cards stay in the draw pile', () => {
    const deck = Array.from({ length: 30 }, (_, index) => startingDeck[index % startingDeck.length]!)
    const state = longBattle(U, deck, { openingHandSize: 2 })
    const everyCard = identities(state)
    for (let turn = 0; turn < 3; turn += 1) endTurn(state)
    expect(state.hand).toHaveLength(8)
    expect(state.blockedDraws).toBe(0)
    endTurn(state) // turn 5 asks for 3 with room for 2
    expect(state.hand).toHaveLength(MAX_HAND_SIZE)
    expect(state.blockedDraws).toBe(1)
    expect(state.drawPile).toHaveLength(deck.length - MAX_HAND_SIZE)
    expect(identities(state)).toEqual(everyCard)
    endTurn(state)
    expect(state.hand).toHaveLength(MAX_HAND_SIZE)
    expect(state.blockedDraws).toBe(4)
    expect(identities(state)).toEqual(everyCard)
  })

  it('does not lose or duplicate a card over a long fight of the largest economy', () => {
    const state = longBattle(U)
    const everyCard = identities(state)
    for (let turn = 0; turn < 20; turn += 1) {
      spendEverything(state)
      expect(state.hand.length).toBeLessThanOrEqual(MAX_HAND_SIZE)
      expect(state.mana).toBeGreaterThanOrEqual(0)
      endTurn(state)
      expect(identities(state)).toEqual(everyCard)
    }
  })
})

function hits(action: EnemyAction): EnemyHit[] {
  return action.kind === 'attack' || action.kind === 'attack_all' ? [action] : action.kind === 'prepare' ? [action.prepared] : []
}
function everyAction(encounter: typeof encounters[number]): EnemyAction[] {
  return [...encounter.behavior.phase1, ...(encounter.behavior.phase2 ?? [])]
}

describe('enemy package v0.7', () => {
  it('keeps the same cast with more health and no new kinds of action', () => {
    expect(reinforcedEncounters).toHaveLength(encounters.length)
    expect(economyEncounters(U)).toBe(reinforcedEncounters)
    expect(campaignEncounters(playableEconomies.A)).toBe(encounters)
    reinforcedEncounters.forEach((encounter, index) => {
      const original = encounters[index]!
      expect([encounter.id, encounter.name, encounter.appearance]).toEqual([original.id, original.name, original.appearance])
      expect(encounter.maxHealth).toBeGreaterThan(original.maxHealth * 1.7)
      expect(everyAction(encounter).every(action => ['attack', 'attack_all', 'defend', 'recover', 'prepare'].includes(action.kind))).toBe(true)
    })
    expect(reinforcedEncounters[2]!.behavior.phase2?.length).toBeGreaterThan(reinforcedEncounters[2]!.behavior.phase1.length)
  })

  it('announces every strong hit a turn ahead and never one-shots the mage', () => {
    for (const encounter of reinforcedEncounters) {
      for (const action of everyAction(encounter)) {
        // A hit of 10 or more is only ever a prepared strike; direct attacks stay below it.
        if (action.kind === 'attack' || action.kind === 'attack_all') expect(action.damage, action.name).toBeLessThan(10)
        for (const hit of hits(action)) expect(hit.damage, hit.name).toBeLessThan(18)
        if (action.kind === 'prepare') {
          expect(action.prepared.kind).toBe('attack')
          expect(action.prepared.damage).toBeGreaterThanOrEqual(10)
        }
      }
    }
  })

  it('never strings together more than three damaging turns, so pressure comes in waves', () => {
    for (const encounter of reinforcedEncounters) {
      for (const sequence of [encounter.behavior.phase1, encounter.behavior.phase2].filter((value): value is EnemyAction[] => !!value)) {
        // One lap as played, turn by turn: a prepare is followed by its strike. The cycle repeats, so read it twice.
        const turns = sequence.flatMap((action): EnemyAction[] => action.kind === 'prepare' ? [action, action.prepared] : [action])
        const damaging = [...turns, ...turns].map(action => action.kind === 'attack' || action.kind === 'attack_all')
        let run = 0
        let longest = 0
        for (const hit of damaging) { run = hit ? run + 1 : 0; longest = Math.max(longest, run) }
        expect(longest, encounter.name).toBeLessThanOrEqual(3)
        expect(turns.some(action => action.kind === 'defend' || action.kind === 'recover' || action.kind === 'prepare')).toBe(true)
      }
    }
  })

  it('gives each cycle a quiet turn for aggression or for placing armor', () => {
    for (const encounter of reinforcedEncounters) {
      for (const sequence of [encounter.behavior.phase1, encounter.behavior.phase2].filter((value): value is EnemyAction[] => !!value)) {
        expect(sequence.some(action => action.kind === 'prepare' || action.kind === 'defend' || action.kind === 'recover'), encounter.name).toBe(true)
        expect(sequence.filter(action => action.kind === 'defend' || action.kind === 'recover').length, encounter.name).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('resolves a prepared strike one turn later against the announced target, and armor placed in advance absorbs it', () => {
    const encounter = campaignEncounter(0, U)!
    const state = createBattle({ ...encounter, maxHealth: 400 }, undefined, { deck: ['guard', 'guard', 'interpose'], seed: 3, economy: U, openingHandSize: 3 })
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 6, target: 'mage' })
    endTurn(state)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'prepare', prepared: { kind: 'attack', damage: 11, target: 'warrior' } })
    const forecast = forecastEnemyAction(state)
    expect(forecast.targets).toEqual([])
    expect(forecast.futureTargets).toMatchObject([{ target: 'warrior', attack: 11 }])
    expect(state.enemy.focus).toBe('warrior')
    // The quiet turn: armor is placed on the announced target before the strike exists.
    const guard = state.hand.find(card => card.definitionId === 'guard')!
    expect(previewCard(state, cardDefinition('guard')).armor).toEqual({ warrior: 4, mage: 0 })
    expect(playCard(state, guard.instanceId).ok).toBe(true)
    const healthBefore = state.heroes.warrior.health
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(healthBefore)
    expect(state.heroes.warrior.armor).toBe(4)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', name: 'Хлёсткая лоза', damage: 11, target: 'warrior' })
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(healthBefore - 7)
    expect(state.heroes.warrior.armor).toBe(0)
  })

  it('enters the long second phase of the Twilight Heart at half health', () => {
    const boss = campaignEncounter(2, U)!
    const state = createBattle(boss, undefined, { deck: ['sword-strike'], seed: 4, economy: U })
    const intent = state.enemy.nextAction
    state.enemy.health = boss.maxHealth / 2 + 4
    state.drawPile = []
    state.hand = []
    state.hand.push({ instanceId: 'x/1', definitionId: 'sword-strike' })
    expect(playCard(state, 'x/1').ok).toBe(true)
    expect(state.enemy.phase).toBe(2)
    expect(state.enemy.nextAction).toEqual(intent)
    endTurn(state)
    expect(state.enemy.nextAction).toEqual(boss.behavior.phase2![0])
    // A prepare action is followed by its announced strike, which is not part of the schedule itself.
    const lap = boss.behavior.phase2!.flatMap((action): EnemyAction[] => action.kind === 'prepare' ? [action, action.prepared] : [action])
    const seen: EnemyAction[] = [state.enemy.nextAction]
    for (let index = 1; index < lap.length * 2; index += 1) {
      state.heroes.warrior.health = state.heroes.mage.health = 1000
      endTurn(state)
      seen.push(state.enemy.nextAction)
    }
    expect(seen).toEqual([...lap, ...lap])
  })

  it('shows what the enemy does under flat mana: the package is calibrated for growth, not for model A', () => {
    // Control for the report: stage C with flat mana is much harder than the v0.6 enemies.
    const runs = simulateBalance({ runs: 25, seed: 500, strategies: ['planner'], economy: economyStage('C', 'A') })
    const growth = simulateBalance({ runs: 25, seed: 500, strategies: ['planner'], economy: economyStage('C', 'U') })
    const wins = (list: typeof runs) => list.filter(run => run.status === 'victory').length
    expect(wins(growth)).toBeGreaterThan(wins(runs))
  })
})

describe('Balance Lab with economies', () => {
  it('reproduces the v0.6 control exactly when no economy is given', () => {
    const plain = simulateRun(42, 'balanced')
    expect(simulateRun(42, 'balanced', { economy: baselineEconomy })).toEqual(plain)
    expect(plain.battles.map(battle => battle.economyId)).toEqual(['A', 'A', 'A'])
    expect(plain.battles.map(battle => battle.encounterName)).toEqual(encounters.map(encounter => encounter.name))
    expect(plain.battles.every(battle => battle.turnLog.every(turn => turn.maxMana === 3))).toBe(true)
  })

  it('runs all four strategies on B and U, repeatably, with the curve showing in the records', () => {
    for (const economy of [B, U, economyStage('B', 'U'), economyStage('C', 'B')]) {
      for (const strategy of allStrategies) {
        const run = simulateRun(77, strategy, { economy })
        expect(simulateRun(77, strategy, { economy })).toEqual(run)
        expect(run.status).not.toBe('timeout')
        expect(run.battles.length).toBeGreaterThan(0)
        for (const battle of run.battles) {
          expect(battle.economyId).toBe(economy.id)
          battle.turnLog.forEach((turn, index) => {
            expect(turn.turn).toBe(index + 1)
            expect(turn.maxMana).toBe(manaForTurn(economy, turn.turn))
            expect(turn.manaSpent).toBeLessThanOrEqual(turn.maxMana)
            expect(turn.manaLeft).toBe(turn.maxMana - turn.manaSpent)
            expect(turn.handStart).toBeLessThanOrEqual(MAX_HAND_SIZE)
            expect(turn.handEnd).toBeLessThanOrEqual(MAX_HAND_SIZE)
            expect(turn.cardsPlayed).toBeLessThanOrEqual(turn.maxMana + 3)
          })
          expect(battle.manaAvailable).toBe(battle.turnLog.reduce((sum, turn) => sum + turn.maxMana, 0))
          expect(battle.manaSpent).toBe(battle.turnLog.reduce((sum, turn) => sum + turn.manaSpent, 0))
          expect(battle.turns).toBe(battle.turnLog.length)
        }
      }
    }
  })

  it('carries hero health between v0.7 battles and starts each battle from turn 1', () => {
    const run = simulateRun(12, 'planner', { economy: U })
    expect(run.battles[1]?.heroesStart).toEqual(run.battles[0]?.heroesEnd)
    expect(run.battles.every(battle => battle.turnLog[0]?.maxMana === 3 && battle.turnLog[0]?.turn === 1)).toBe(true)
    expect(run.battles.map(battle => battle.deckSizeStart)).toEqual([18, 19, 20].slice(0, run.battles.length))
  })

  it('records why a battle was lost', () => {
    const lost = simulateBalance({ runs: 12, seed: 900, strategies: ['aggressive'], economy: B }).filter(run => run.status === 'defeat')
    expect(lost.length).toBeGreaterThan(0)
    for (const run of lost) {
      const battle = run.battles[run.battles.length - 1]!
      expect(battle.result).toBe('defeat')
      expect(battle.defeat).not.toBeNull()
      expect(battle.defeat!.fallen.length).toBeGreaterThan(0)
      expect(battle.defeat!.fallen.every(id => battle.heroesEnd[id] <= 0)).toBe(true)
      expect(battle.turnLog[battle.turnLog.length - 1]!.turn).toBe(battle.defeat!.turn)
    }
    expect(simulateRun(42, 'balanced').battles.every(battle => battle.defeat === null)).toBe(true)
  })

  it('traces every turn when asked, and does not otherwise', () => {
    const traced = simulateRun(8, 'planner', { economy: U, trace: true })
    const plain = simulateRun(8, 'planner', { economy: U })
    expect(plain.battles.every(battle => battle.trace === undefined)).toBe(true)
    expect(traced.battles.every(battle => battle.trace?.length === battle.turns)).toBe(true)
    expect(traced.battles[0]!.trace![0]).toMatchObject({ turn: 1, mana: 3 })
    expect(traced.battles.map(({ trace, ...battle }) => battle)).toEqual(plain.battles.map(({ trace, ...battle }) => battle))
  })

  it('summarizes the economy: fight length, health, mana, hand, combos and a per-turn curve', () => {
    const runs = simulateBalance({ runs: 12, seed: 300, strategies: ['balanced', 'planner'], economy: U })
    const [balanced, planner] = summarizeEconomy(runs, U)
    for (const row of [balanced!, planner!]) {
      expect(row.runs).toBe(12)
      expect(row.encounters).toHaveLength(3)
      expect(row.encounters[0]!.turns).toBeGreaterThan(1)
      expect(row.mana.availablePerTurn).toBeGreaterThan(3)
      expect(row.mana.utilization).toBeGreaterThan(0.5)
      expect(row.mana.utilization).toBeLessThanOrEqual(1)
      expect(row.handEnd).toBeLessThanOrEqual(row.handStart + 0.0001)
      expect(row.byIntent.map(entry => entry.kind)).toEqual(['attack', 'attack_all', 'prepare', 'defend', 'recover'])
      expect(row.turnCurve[0]).toMatchObject({ turn: 1, maxMana: 3 })
    }
    expect(planner!.vulnerabilityTriggersPerTurn).toBeGreaterThan(balanced!.vulnerabilityTriggersPerTurn)
  })

  it('lets the planner use a larger pool within its search limits', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = createCampaignBattle({ economy: U, seed, deck: startingDeck })
      for (let turn = 0; turn < 5; turn += 1) endTurn(state)
      expect(state.maxMana).toBe(6)
      expect(planTurn(state).truncated).toBe(false)
      const planner = createTurnPlanner()
      const copy = structuredClone(state)
      for (let guard = 0; guard < 12; guard += 1) {
        const id = planner.next(copy)
        if (!id) break
        expect(playCard(copy, id).ok).toBe(true)
      }
      const spent = copy.maxMana - copy.mana
      expect(copy.mana).toBeGreaterThanOrEqual(0)
      expect(spent).toBeGreaterThanOrEqual(4)
      expect(planner.stats.truncated).toBe(0)
    }
  })

  it('finishes the campaign through the v0.7 enemies and ends it after the last one', () => {
    const last = createCampaignBattle({ economy: U, encounter: campaignEncounter(2, U), seed: 3 })
    last.result = 'victory'
    expect(advanceCampaign(last, 2)).toEqual({ kind: 'complete' })
    last.result = 'victory'
    expect(advanceCampaign(last, 1)).toEqual({ kind: 'reward', nextEncounter: 2 })
  })

  it('knows every card it can draw: the starting deck is untouched by the economy', () => {
    expect(startingDeck).toHaveLength(18)
    expect(cards.every(card => card.cost <= 2)).toBe(true)
  })
})

describe('the playable app adapter', () => {
  it('uses model B by default and carries it through a new battle', () => {
    const standard = useBattle({ seed: 7 })
    expect(standard.state.value.economy).toEqual(gameEconomy)
    standard.startBattle(campaignEncounter(0, gameEconomy)!)
    standard.finishTurn()
    expect(standard.state.value).toMatchObject({ turn: 2, maxMana: 4, mana: 4, enemy: { maxHealth: 56 } })
  })

  it('grows mana through finishTurn, resets it for the next battle and for a restart', () => {
    const battle = useBattle({ seed: 7, economy: U })
    expect(battle.state.value.economy).toEqual(U)
    battle.startBattle(campaignEncounter(0, U)!)
    expect(battle.state.value).toMatchObject({ turn: 1, maxMana: 3 })
    const seen = [battle.state.value.maxMana]
    for (let turn = 0; turn < 4; turn += 1) { battle.finishTurn(); seen.push(battle.state.value.maxMana) }
    expect(seen).toEqual([3, 4, 4, 5, 5])
    battle.startBattle(campaignEncounter(1, U)!)
    expect(battle.state.value).toMatchObject({ turn: 1, mana: 3, maxMana: 3, enemy: { maxHealth: 72 } })
    battle.restart()
    expect(battle.state.value).toMatchObject({ turn: 1, maxMana: 3 })
    expect(battle.state.value.economy).toEqual(U)
  })
})

describe('attack or defense: the price of safety', () => {
  /** Boss turn 5: Varian has 11 health and "Гнёт чащи" (15 on Varian) is announced; the party holds the same 8 cards. */
  function bossTurn(mana: number) {
    const boss = campaignEncounter(2, U)!
    const state = createBattle({ ...boss, maxHealth: 110 }, undefined, { deck: startingDeck, seed: 5, economy: U })
    const pool = [...state.hand, ...state.drawPile, ...state.discardPile]
    const held = ['sword-strike', 'sword-strike', 'fireball', 'frostbolt', 'guard', 'parry', 'interpose', 'ice-ward'] as const
    state.hand = held.map(id => pool.splice(pool.findIndex(card => card.definitionId === id), 1)[0]!)
    state.drawPile = pool
    state.discardPile = []
    state.turn = 5
    state.maxMana = state.mana = mana
    state.enemy.health = 62
    const strike = boss.behavior.phase1[3]!
    if (strike.kind !== 'prepare') throw new Error('Expected the prepared Гнёт чащи')
    state.enemy.nextAction = strike.prepared
    state.enemy.focus = 'warrior'
    state.heroes.warrior.health = 11
    return state
  }
  function allLines(root: BattleState) {
    const lines: { damage: number; dead: boolean; brann: number }[] = []
    const walk = (state: BattleState) => {
      const after = cloneBattleState(state)
      endTurn(after)
      lines.push({ damage: 62 - state.enemy.health, dead: after.result === 'defeat', brann: after.heroes.warrior.health })
      const tried = new Set<CardId>()
      for (const instance of state.hand) {
        if (tried.has(instance.definitionId) || cardDefinition(instance.definitionId).cost > state.mana) continue
        tried.add(instance.definitionId)
        const next = cloneBattleState(state)
        if (playCard(next, instance.instanceId).ok) walk(next)
      }
    }
    walk(root)
    return lines
  }

  it('the line with the most damage can lose Varian at every pool size', () => {
    const lethalShare: number[] = []
    const relativePrice: number[] = []
    for (const mana of [3, 4, 5, 6]) {
      const lines = allLines(bossTurn(mana))
      const greediest = lines.reduce((best, line) => line.damage > best.damage ? line : best)
      const surviving = lines.filter(line => !line.dead)
      expect(greediest.dead, 'mana ' + mana).toBe(true)
      expect(surviving.length).toBeGreaterThan(0)
      const bestSafe = surviving.reduce((best, line) => line.damage > best.damage ? line : best)
      expect(greediest.damage).toBeGreaterThan(bestSafe.damage)
      relativePrice.push((greediest.damage - bestSafe.damage) / greediest.damage)
      lethalShare.push(lines.filter(line => line.dead).length / lines.length)
    }
    // Safety has a measurable damage cost; a random line is lethal less often as the pool grows.
    expect(relativePrice[0]!).toBeGreaterThan(0.35)
    expect(relativePrice[3]!).toBeLessThan(0.25)
    for (let index = 1; index < 4; index += 1) {
      expect(lethalShare[index]!).toBeLessThan(lethalShare[index - 1]!)
    }
  })

  it('the planner answers the announced strike with armor first, and keeps Varian alive', () => {
    for (const mana of [3, 4, 5, 6]) {
      const root = bossTurn(mana)
      const planner = createTurnPlanner()
      const state = structuredClone(root)
      const played: CardId[] = []
      for (let guard = 0; guard < 12; guard += 1) {
        const id = planner.next(state)
        if (!id) break
        played.push(state.hand.find(card => card.instanceId === id)!.definitionId)
        expect(playCard(state, id).ok).toBe(true)
      }
      expect(played.some(id => ['guard', 'parry', 'interpose', 'ice-ward'].includes(id)), 'mana ' + mana).toBe(true)
      endTurn(state)
      expect(state.result).toBeNull()
      expect(state.heroes.warrior.health).toBeGreaterThan(0)
    }
  })
})
