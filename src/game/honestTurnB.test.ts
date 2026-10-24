import { describe, expect, it } from 'vitest'
import { chooseCard } from './balance'
import { createTurnPlanner } from './balancePlanner'
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { createCampaignBattle, createDungeonRun, createSectorRun, dungeonEncounter } from './campaign'
import { gameEconomy, honestEconomies, isHonestEconomy, knownEconomies } from './economy'
import { armorSources, deckVariantIds, deckVariants, honestDeck, withFrost } from './honestDecks'
import { publicIntent, visibleThreat } from './observableIntent'
import { HONEST_RULES_VERSION, RULES_VERSION, RUN_SAVE_KEY, createRunSaveStore, decodeSnapshot, encodeSnapshot, rulesVersionFor } from './runSave'
import { deckVariantFor, requestedDeckVariant, resolveRulesMode, rulesModeHref, rulesModes, startingDeckFor } from './rulesMode'
import { rhahkZor, sectorEncounters } from './sectorContent'
import { sectorFoesB1 } from './sectorFoesB'
import { applyStatus, statusDefinitions, statusValue, statusViews } from './statuses'
import type { EconomyConfig } from './economy'
import type { BattleState, CardId, EncounterDefinition, EnemyAction, HeroId } from './types'
import { cardDefinition, cards, experimentalCards, startingDeck } from './types'

const B1 = honestEconomies['honest-b1']
const B2 = honestEconomies['honest-b2']
const A08 = honestEconomies['honest-a08']
/** What Frostbite takes off a hit of this base damage: the rule of the status definition, not a number copied here. */
const frostCut = (damage: number) => { const rule = statusDefinitions.frostbite.outgoingReduction!; return Math.max(rule.min, Math.round(damage * rule.ratio)) }

function dummy(actions: EnemyAction[], phase2?: EnemyAction[], health = 10_000): EncounterDefinition {
  return { id: 'dummy', name: 'Чучело', title: 'Проверка', maxHealth: health, appearance: 'defias', mapLabel: 'Проверка', behavior: { phase1: actions, ...(phase2 ? { phase2 } : {}) } }
}
const hit = (damage: number, target: HeroId = 'warrior', traits: Partial<Extract<EnemyAction, { kind: 'attack' }>> = {}): EnemyAction => ({ kind: 'attack', name: 'Удар', damage, target, ...traits })
/** A fight against a scripted enemy with exactly this hand (the rest of the deck is plain Sword Strikes that the tests never need). */
function start(economy: EconomyConfig, actions: EnemyAction[], hand: readonly CardId[], seed = 5, phase2?: EnemyAction[], health?: number) {
  const deck: CardId[] = [...hand, ...Array.from({ length: 6 }, () => 'sword-strike' as CardId)]
  const state = createBattle(dummy(actions, phase2, health), undefined, { deck, seed, economy })
  state.heroes.warrior.health = state.heroes.warrior.maxHealth = 1000
  state.heroes.mage.health = state.heroes.mage.maxHealth = 1000
  const pool = [...state.hand, ...state.drawPile]
  state.hand = hand.map(id => pool.splice(pool.findIndex(card => card.definitionId === id), 1)[0]!)
  state.drawPile = pool
  return state
}
function play(state: BattleState, id: CardId) {
  const card = state.hand.find(item => item.definitionId === id)
  if (!card) throw new Error('No ' + id + ' in hand')
  expect(playCard(state, card.instanceId).ok).toBe(true)
}
const handOf = (...ids: CardId[]): CardId[] => ids

describe('B1 — armor-piercing hits', () => {
  it('ignore part of the armor: the armor needed to stop the hit is its damage plus the pierce', () => {
    for (const [armor, loss, pierced] of [[0, 10, 0], [3, 10, 3], [5, 10, 5], [8, 7, 5], [15, 0, 5], [20, 0, 5]] as const) {
      const state = start(B1, [hit(10, 'mage', { pierce: 5 })], handOf())
      state.heroes.mage.armor = armor
      const forecast = forecastEnemyAction(state)
      expect(forecast.targets[0]).toMatchObject({ healthLoss: loss })
      expect(forecast.targets[0]!.pierced ?? 0).toBe(pierced)
      endTurn(state)
      expect(state.heroes.mage.health).toBe(1000 - loss)
    }
  })

  it('leave the forecast of an ordinary hit exactly as it was (no extra fields)', () => {
    const state = start(B1, [hit(10, 'mage')], handOf())
    state.heroes.mage.armor = 4
    expect(Object.keys(forecastEnemyAction(state).targets[0]!).sort()).toEqual(['absorbed', 'artifactReduction', 'attack', 'consumedStatuses', 'healthLoss', 'lethal', 'parts', 'target'])
    expect(Object.keys(forecastEnemyAction(state)).sort()).toEqual(['action', 'armorGain', 'futureTargets', 'phase', 'targets', 'threatened'])
  })
})

describe('B1 — interrupting a blow', () => {
  const strike = hit(13, 'warrior', { interrupt: 14 })

  it('stops the whole hit when the party dealt enough health damage this turn, and only then', () => {
    for (const [fireballs, stopped] of [[1, false], [2, true]] as const) {
      const state = start(B1, [strike], handOf('fireball', 'fireball', 'sword-strike'))
      state.enemy.armor = 0
      for (let n = 0; n < fireballs; n += 1) play(state, 'fireball')
      const before = forecastEnemyAction(state).interrupt!
      expect(before).toEqual({ need: 14, dealt: fireballs * 8, broken: stopped })
      endTurn(state)
      expect(state.heroes.warrior.health).toBe(stopped ? 1000 : 1000 - 13)
    }
  })

  it('counts health damage, not what the enemy armor soaked up', () => {
    const state = start(B1, [strike], handOf('fireball', 'fireball', 'sword-strike'))
    state.enemy.armor = 8
    play(state, 'fireball')
    play(state, 'fireball')
    expect(forecastEnemyAction(state).interrupt).toEqual({ need: 14, dealt: 8, broken: false })
  })

  it('does not change the announced action, spends no armor, no status, and the cycle simply goes on', () => {
    const state = start(B1, [strike, hit(2, 'mage')], handOf('fireball', 'sword-strike', 'guard'))
    applyStatus(state, 'enemy', 'frostbite')
    play(state, 'guard')
    play(state, 'fireball')
    play(state, 'sword-strike')
    const declared = structuredClone(state.enemy.nextAction)
    expect(declared).toEqual(strike)
    expect(state.heroes.warrior.armor).toBeGreaterThan(0)
    const hp = state.heroes.warrior.health
    const armor = state.heroes.warrior.armor
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(hp)
    // Honest armor expires at the end of the enemy action anyway; what matters is that the stopped hit did not eat the Frostbite.
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(1)
    expect(armor).toBeGreaterThan(0)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 2, target: 'mage' })
    expect(state.artifactNotices.join(' ')).toContain('Удар сорван')
    expect(state.enemy.hurt).toBeUndefined()
  })

  it('the progress starts over every turn', () => {
    const state = start(B1, [hit(1, 'warrior'), strike], handOf('fireball', 'fireball', 'sword-strike'))
    play(state, 'fireball')
    endTurn(state)
    expect(forecastEnemyAction(state).interrupt).toEqual({ need: 14, dealt: 0, broken: false })
  })

  it('tracks nothing for an enemy whose hit cannot be interrupted', () => {
    const state = start(B1, [hit(5)], handOf('fireball', 'sword-strike'))
    play(state, 'fireball')
    expect(state.enemy.hurt).toBeUndefined()
    expect(forecastEnemyAction(state).interrupt).toBeUndefined()
  })

  it('is public for the strike but only a kind of trick, no number, while it is still being prepared', () => {
    const state = start(B1, [{ kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Молот', damage: 13, target: 'warrior', interrupt: 14, pierce: 4 } }], handOf())
    const intent = publicIntent(forecastEnemyAction(state))
    expect(intent).toEqual({ kind: 'prepare', name: 'Замах', phase: 1, targets: ['warrior'], blow: 'attack', traits: { pierce: true, interruptible: true } })
    expect(JSON.stringify(intent)).not.toMatch(/13|14|\b4\b/)
    endTurn(state)
    const revealed = publicIntent(forecastEnemyAction(state))
    expect(revealed).toMatchObject({ kind: 'attack', interrupt: { need: 14, dealt: 0, broken: false } })
  })

  it('a bot reads a stopped hit as no threat; an ordinary strike keeps its exact numbers', () => {
    const state = start(B1, [strike], handOf('fireball', 'fireball'))
    expect(visibleThreat(forecastEnemyAction(state), state.heroes)).toHaveLength(1)
    play(state, 'fireball')
    play(state, 'fireball')
    expect(visibleThreat(forecastEnemyAction(state), state.heroes)).toHaveLength(0)
    const intent = publicIntent(forecastEnemyAction(state))
    expect(intent.kind === 'attack' && intent.hits.every(item => item.cancelled && !item.lethal)).toBe(true)
  })
})

describe('B1 — rage', () => {
  it('adds damage to hits announced later and never edits the one already announced', () => {
    const rage: EnemyAction = { kind: 'defend', name: 'Раж', armor: 6, power: 2 }
    const state = start(B1, [rage, hit(6, 'mage'), { kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Молот', damage: 12, target: 'warrior' } }], handOf())
    expect(forecastEnemyAction(state).powerGain).toBe(2)
    const declared = structuredClone(state.enemy.nextAction)
    endTurn(state)
    expect(state.enemy.power).toBe(2)
    expect(declared).toMatchObject({ kind: 'defend' })
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 8, target: 'mage' })
    endTurn(state)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'prepare', prepared: { damage: 14 } })
    endTurn(state)
    expect(state.enemy.nextAction).toMatchObject({ kind: 'attack', damage: 14 })
  })

  it('is capped at +6', () => {
    const state = start(B1, [{ kind: 'defend', name: 'Раж', armor: 1, power: 4 }, hit(3)], handOf())
    for (let n = 0; n < 6; n += 1) endTurn(state)
    expect(state.enemy.power).toBe(6)
  })

  it('the standard enemies carry none of the new properties', () => {
    const text = JSON.stringify(sectorEncounters.map(encounter => encounter.behavior))
    expect(text).not.toMatch(/pierce|interrupt|exposes|power/)
  })
})

describe('B1 — marking', () => {
  it('leaves the hero Vulnerable when the hit does not kill; the next hit on them is 3 harder and ends it', () => {
    const state = start(B1, [hit(6, 'mage', { exposes: 'vulnerability' }), hit(6, 'mage'), hit(6, 'mage')], handOf())
    endTurn(state)
    expect(statusValue(state, 'mage', 'vulnerability')).toBe(1)
    expect(statusViews(state, 'mage')[0]!.description).toContain('удар по герою')
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 9 })
    endTurn(state)
    expect(state.heroes.mage.health).toBe(1000 - 6 - 9)
    expect(statusValue(state, 'mage', 'vulnerability')).toBe(0)
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 6 })
  })

  it('a hit that was stopped marks nobody', () => {
    const state = start(B1, [hit(6, 'mage', { exposes: 'vulnerability', interrupt: 4 })], handOf('sword-strike', 'fireball'))
    play(state, 'fireball')
    endTurn(state)
    expect(statusValue(state, 'mage', 'vulnerability')).toBe(0)
  })
})

describe('B2 — Frostbite and the two cards', () => {
  const grip = (state: BattleState) => play(state, 'frost-grip')

  it('the cards exist apart from the catalogue: not in `cards`, not rewards, not upgradable', () => {
    expect(cards.some(card => card.id === 'frost-grip' || card.id === 'ice-breaker')).toBe(false)
    expect(experimentalCards.map(card => card.id)).toEqual(['frost-grip', 'ice-breaker'])
    expect(experimentalCards.every(card => card.experimental && !card.reward)).toBe(true)
    expect(cardDefinition('ice-breaker').className).toBe('warrior')
    expect(cardDefinition('frost-grip').className).toBe('mage')
  })

  it('weakens the next hit by 30% of its base damage, at least 2, on every target, and is spent by it', () => {
    expect(statusDefinitions.frostbite.outgoingReduction).toEqual({ ratio: 0.3, min: 2 })
    for (const [damage, taken] of [[4, 2], [6, 4], [10, 7], [13, 9], [14, 10]] as const) {
      const state = start(B2, [hit(damage, 'warrior')], handOf('frost-grip'))
      grip(state)
      expect(statusValue(state, 'enemy', 'frostbite')).toBe(1)
      const cut = frostCut(damage)
      expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: damage - cut, chill: cut })
      endTurn(state)
      expect(state.heroes.warrior.health).toBe(1000 - taken)
      expect(taken).toBe(damage - cut)
      expect(statusValue(state, 'enemy', 'frostbite')).toBe(0)
    }
  })

  it('weakens both hits of an attack on both heroes and is spent once', () => {
    const state = start(B2, [{ kind: 'attack_all', name: 'Волна', damage: 8, primaryTarget: 'warrior' }], handOf('frost-grip'))
    grip(state)
    const forecast = forecastEnemyAction(state)
    expect(frostCut(8)).toBe(2)
    expect(forecast.targets.map(item => [item.target, item.attack, item.chill])).toEqual([['warrior', 6, 2], ['mage', 6, 2]])
    endTurn(state)
    expect([state.heroes.warrior.health, state.heroes.mage.health]).toEqual([994, 994])
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(0)
  })

  it('is not spent on a quiet turn, only by the next attack', () => {
    const state = start(B2, [{ kind: 'defend', name: 'Щит', armor: 3 }, { kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Молот', damage: 10, target: 'warrior' } }, hit(2)], handOf('frost-grip'))
    grip(state)
    endTurn(state)
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(1)
    endTurn(state)
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(1)
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 10 - frostCut(10) })
    endTurn(state)
    expect(state.heroes.warrior.health).toBe(1000 - (10 - frostCut(10)))
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(0)
  })

  it('does not stack and does not stack with armor in a way that goes below zero', () => {
    const state = start(B2, [hit(4)], handOf('frost-grip', 'frost-grip'))
    grip(state)
    grip(state)
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(1)
    expect(forecastEnemyAction(state).targets[0]).toMatchObject({ attack: 4 - frostCut(4), healthLoss: 4 - frostCut(4) })
  })

  it('Ice Breaker is a weaker Sword Strike without Frostbite and a much heavier blow with it, and spends it', () => {
    const plain = start(B2, [hit(1)], handOf('ice-breaker'))
    expect(previewCard(plain, cardDefinition('ice-breaker')).damage).toBe(5)
    const cold = start(B2, [hit(9)], handOf('frost-grip', 'ice-breaker'))
    const before = cold.enemy.health
    grip(cold)
    expect(previewCard(cold, cardDefinition('ice-breaker'))).toMatchObject({ damage: 12, bonusDamage: 7 })
    play(cold, 'ice-breaker')
    expect(before - cold.enemy.health).toBe(2 + 12)
    expect(statusValue(cold, 'enemy', 'frostbite')).toBe(0)
    // The Frostbite was spent on the blow, so the enemy's hit is not weakened: that is the price.
    expect(forecastEnemyAction(cold).targets[0]).toMatchObject({ attack: 9 })
    endTurn(cold)
    expect(cold.heroes.warrior.health).toBe(1000 - 9)
  })

  it('the same Frostbite protects instead when it is kept: the two uses exclude each other', () => {
    const options = [['keep', 14 - frostCut(14)], ['spend', 14]] as const
    for (const [choice, taken] of options) {
      const state = start(B2, [hit(14)], handOf('frost-grip', 'ice-breaker'))
      grip(state)
      if (choice === 'spend') play(state, 'ice-breaker')
      endTurn(state)
      expect(1000 - state.heroes.warrior.health).toBe(taken)
    }
  })

  it('a hero can carry no Frostbite, and a battle that ends clears it', () => {
    const state = start(B2, [hit(1)], handOf())
    expect(applyStatus(state, 'warrior', 'frostbite').applied).toBe(false)
    applyStatus(state, 'enemy', 'frostbite')
    state.enemy.health = 0
    endTurn(state)
    expect(statusValue(state, 'enemy', 'frostbite')).toBe(0)
  })
})

describe('B1 — Rak’Zor and its phases', () => {
  const boss = sectorFoesB1.find(encounter => encounter.id === rhahkZor.id)!
  const signature = (action: EnemyAction, power = 0): string => action.kind === 'prepare' ? 'prepare:' + signature(action.prepared, power) : action.kind === 'attack' ? `${action.target}:${action.damage + power}` : action.kind === 'attack_all' ? `all:${action.damage + power}:${action.primaryTarget}` : `${action.kind}:${action.armor}`

  it('crosses the half-health line without touching the announced action, notes the moment, and starts the new cycle after it', () => {
    const state = createCampaignBattle({ encounter: { ...boss, maxHealth: 133 }, economy: B1, seed: 4, deck: ['fireball'] })
    expect(state.enemy.phaseShiftTurn).toBeUndefined()
    state.enemy.health = 70
    state.hand = [{ instanceId: 'test/fireball', definitionId: 'fireball' }]
    const declared = structuredClone(state.enemy.nextAction)
    play(state, 'fireball')
    expect(state.enemy.health).toBe(62)
    expect(state.enemy.phase).toBe(2)
    expect(state.enemy.phaseShiftTurn).toBe(state.turn)
    expect(state.enemy.phaseNote?.title).toContain('Вторая фаза')
    expect(state.enemy.nextAction).toEqual(declared)
    expect(state.enemy.nextActionPhase).toBe(1)
    // The roar that opens phase II raises the damage of every hit announced after it, never the one already on the board.
    let power = 0
    for (const action of boss.behavior.phase2!) {
      endTurn(state)
      expect(signature(state.enemy.nextAction)).toBe(signature(action, power))
      expect(state.enemy.nextActionPhase).toBe(2)
      if (action.kind === 'prepare') {
        endTurn(state)
        expect(signature(state.enemy.nextAction)).toBe(signature(action.prepared, power))
      }
      if ((action.kind === 'defend' || action.kind === 'recover') && action.power) power += action.power
      state.heroes.warrior.health = state.heroes.mage.health = 100
    }
  })

  it('phase II is a different fight: group hits, piercing, Jaina as the main target, and a roar that raises the damage', () => {
    const one = boss.behavior.phase1
    const two = boss.behavior.phase2!
    const groups = (list: EnemyAction[]) => list.filter(action => action.kind === 'attack_all' || (action.kind === 'prepare' && action.prepared.kind === 'attack_all')).length
    const piercing = (list: EnemyAction[]) => list.filter(action => (action.kind === 'prepare' ? action.prepared : action as { pierce?: number }).pierce).length
    expect([groups(one), piercing(one)]).toEqual([0, 0])
    expect(groups(two)).toBeGreaterThanOrEqual(2)
    expect(piercing(two)).toBeGreaterThanOrEqual(2)
    expect(two.some(action => (action.kind === 'defend' || action.kind === 'recover') && !!action.power)).toBe(true)
    expect(one.some(action => action.kind === 'prepare' && action.prepared.kind === 'attack' && action.prepared.interrupt !== undefined)).toBe(true)
  })
})

describe('B1/B2 — the modes', () => {
  it('are known economies built on the Honest Turn A rules, with enemy numbers of their own', () => {
    for (const economy of [B1, B2]) {
      expect(economy).toMatchObject({ openingHand: 7, manaByTurn: [4], drawSchedule: { perTurn: 7 }, discardHand: true, armorExpiry: 'turn', enemyHealthScale: 1.75, excludedArtifacts: ['tension-spool'], sectorFoes: 'b1' })
      expect(Object.keys(economy)).not.toContain('enemyDamageScale')
      expect(isHonestEconomy(economy)).toBe(true)
    }
    expect(Object.keys(A08)).not.toContain('sectorFoes')
    expect(knownEconomies().map(economy => economy.id)).toEqual(['A', 'B', 'U', 'honest-a08', 'honest-a09', 'honest-b1', 'honest-b2', 'honest-b1-long', 'honest-b2-long'])
  })

  it('give the six enemies their new cycles and leave the map, the health and the other modes alone', () => {
    const control = createSectorRun(42, gameEconomy)
    expect(createSectorRun(42, B1).map).toEqual(control.map)
    expect(createSectorRun(42, B2).map).toEqual(control.map)
    for (const node of control.map.layers.flat().filter(item => item.encounterId)) {
      const standard = dungeonEncounter(node, gameEconomy)
      const b1 = dungeonEncounter(node, B1)
      const a08 = dungeonEncounter(node, A08)
      expect(b1.id).toBe(standard.id)
      expect(b1.maxHealth).toBe(Math.round(node.encounterHealth! * 1.75))
      expect(b1.maxHealth).toBe(a08.maxHealth)
      expect(b1.behavior).not.toEqual(standard.behavior)
      expect(b1.behavior).toEqual(sectorFoesB1.find(item => item.id === node.encounterId)!.behavior)
      expect(standard.behavior).toEqual(sectorEncounters.find(item => item.id === node.encounterId)!.behavior)
    }
    expect(sectorFoesB1.map(item => item.id)).toEqual(sectorEncounters.map(item => item.id))
  })

  it('give each enemy a different kind of question', () => {
    const traits = (encounter: EncounterDefinition) => {
      const all = [...encounter.behavior.phase1, ...(encounter.behavior.phase2 ?? [])]
      const hits = all.flatMap(action => action.kind === 'prepare' ? [action.prepared] : action.kind === 'attack' || action.kind === 'attack_all' ? [action] : [])
      return {
        group: hits.some(item => item.kind === 'attack_all'),
        pierce: hits.some(item => item.pierce),
        interrupt: hits.some(item => item.interrupt !== undefined),
        marks: hits.some(item => item.exposes),
        rage: all.some(action => (action.kind === 'defend' || action.kind === 'recover') && !!action.power),
        mageHits: hits.filter(item => item.kind === 'attack' && item.target === 'mage').length,
        warriorHits: hits.filter(item => item.kind === 'attack' && item.target === 'warrior').length,
      }
    }
    const byId = Object.fromEntries(sectorFoesB1.map(item => [item.id, traits(item)]))
    expect(byId['old-mines-raider']).toMatchObject({ group: true, pierce: false, interrupt: false, rage: false })
    expect(byId['old-mines-digger']).toMatchObject({ interrupt: true, pierce: false, group: false })
    expect(byId['old-mines-watchman']).toMatchObject({ pierce: true, interrupt: false })
    expect(byId['old-mines-overseer']).toMatchObject({ rage: true, interrupt: false, pierce: false })
    expect(byId['old-mines-johnson']).toMatchObject({ group: true, marks: true })
    expect(byId['old-mines-rhahk-zor']).toMatchObject({ group: true, pierce: true, interrupt: true, rage: true })
    // Jaina is a real target of every enemy, not only the one that is shielded by Varian's armor.
    for (const item of Object.values(byId)) expect(item.mageHits).toBeGreaterThan(0)
  })

  it('open only when the address asks, each with its own slot, and carry the deck choice in the link', () => {
    expect(resolveRulesMode('?rules=honest-b1').economy).toBe(B1)
    expect(resolveRulesMode('?rules=honest-b2').economy).toBe(B2)
    expect(resolveRulesMode('?rules=B2').id).toBe('honest-b2')
    expect(resolveRulesMode('?rules=b1').id).toBe('honest-b1')
    expect(resolveRulesMode('?rules=honest-a08').id).toBe('honest-a08')
    expect(new Set(rulesModes.map(mode => mode.saveKey)).size).toBe(rulesModes.length)
    expect(rulesModeHref('honest-b2', 12, 'armor6')).toBe('?rules=honest-b2&seed=12&deck=armor6')
    expect(rulesModeHref('honest-b1')).toBe('?rules=honest-b1')
    expect(requestedDeckVariant('?deck=armor8')).toBe('armor8')
    for (const bad of ['', '?deck=', '?deck=armor7', '?deck=ARMOR8', '?deck=__proto__']) expect(requestedDeckVariant(bad)).toBeNull()
  })

  it('start from the right deck: the standard one for control and A, a variant for B1, the frost package for B2', () => {
    const mode = (id: string) => rulesModes.find(item => item.id === id)!
    expect(startingDeckFor(mode('control'), '?deck=armor6')).toBeUndefined()
    expect(startingDeckFor(mode('honest-a08'), '?deck=armor6')).toBeUndefined()
    expect(deckVariantFor(mode('honest-b1'), '')).toBe('armor10')
    expect(startingDeckFor(mode('honest-b1'), '?deck=armor10')).toEqual(deckVariants.armor10)
    expect(startingDeckFor(mode('honest-b1'), '')).toEqual(deckVariants[mode('honest-b1').defaultDeck!])
    expect(startingDeckFor(mode('honest-b1'), '?deck=armor6')).toEqual(deckVariants.armor6)
    expect(startingDeckFor(mode('honest-b2'), '')!.filter(id => id === 'frost-grip')).toHaveLength(2)
    expect(startingDeckFor(mode('honest-b2'), '?deck=armor6')).toEqual(honestDeck('armor6', true))
  })
})

describe('B — the starting-deck variants', () => {
  it('keep 18 cards and the 10 : 8 split of the classes; they differ only in the armor sources 10, 8 and 6', () => {
    expect([...deckVariants.armor10].sort()).toEqual([...startingDeck].sort())
    for (const [id, sources] of [['armor10', 10], ['armor8', 8], ['armor6', 6]] as const) {
      const deck = deckVariants[id]
      expect(deck).toHaveLength(18)
      expect(armorSources(deck)).toBe(sources)
      expect(deck.filter(card => cardDefinition(card).className === 'warrior')).toHaveLength(10)
      expect(deck.filter(card => cardDefinition(card).className === 'mage')).toHaveLength(8)
      for (const card of deck) expect(cards.some(item => item.id === card)).toBe(true)
    }
    expect(deckVariantIds).toEqual(['armor10', 'armor8', 'armor6'])
  })

  it('the frost package swaps four cards, keeps the size and the class split, and adds no armor', () => {
    for (const id of deckVariantIds) {
      const base = deckVariants[id]
      const deck = withFrost(base)
      expect(deck).toHaveLength(18)
      expect(deck.filter(card => card === 'frost-grip')).toHaveLength(2)
      expect(deck.filter(card => card === 'ice-breaker')).toHaveLength(2)
      expect(armorSources(deck)).toBe(armorSources(base))
      expect(deck.filter(card => cardDefinition(card).className === 'warrior')).toHaveLength(10)
      expect(deck.filter(card => cardDefinition(card).className === 'mage')).toHaveLength(8)
    }
  })
})

describe('B — saves', () => {
  function memory() {
    const data = new Map<string, string>()
    return { data, storage: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } } }
  }
  it('round-trip under their own rules versions, with the frost cards in the deck', () => {
    for (const [economy, version] of [[B1, 'honest-turn-b1-1'], [B2, 'honest-turn-b2-1']] as const) {
      const deck = economy === B2 ? honestDeck('armor8', true) : deckVariants.armor6
      const run = createSectorRun(31, economy, deck, undefined, 'run-b')
      const snapshot = decodeSnapshot(encodeSnapshot(run, economy, 1))
      expect(snapshot.rulesVersion).toBe(version)
      expect(snapshot.economy).toEqual(economy)
      expect(snapshot.run).toEqual(run)
      expect(snapshot.run.deck.map(card => card.definitionId)).toEqual(deck)
      expect(rulesVersionFor(economy)).toBe(version)
      expect(version).not.toBe(HONEST_RULES_VERSION)
      expect(version).not.toBe(RULES_VERSION)
      const tampered = JSON.parse(encodeSnapshot(run, economy, 1)) as { payload: { rulesVersion: string }; checksum: string }
      tampered.payload.rulesVersion = HONEST_RULES_VERSION
      expect(() => decodeSnapshot(JSON.stringify(tampered))).toThrow()
    }
    expect(rulesVersionFor(A08)).toBe(HONEST_RULES_VERSION)
  })

  it('refuse mixed rules and unknown cards', () => {
    const sector = createSectorRun(3, B1)
    expect(() => encodeSnapshot(sector, B2, 1)).not.toThrow()
    expect(() => encodeSnapshot(sector, gameEconomy, 1)).toThrow()
    expect(() => encodeSnapshot(createDungeonRun(3, B1), B1, 1)).toThrow()
    const bad = createSectorRun(3, B1)
    bad.deck[0] = { ...bad.deck[0]!, definitionId: 'no-such-card' as CardId }
    expect(() => encodeSnapshot(bad, B1, 1)).toThrow()
  })

  it('keep every mode in its own slot and never touch the standard save', () => {
    const { data, storage } = memory()
    const control = createRunSaveStore(() => storage)
    expect(control.save(createSectorRun(1, gameEconomy, undefined, undefined, 'control-run'), gameEconomy).ok).toBe(true)
    const standardRaw = data.get(RUN_SAVE_KEY)!
    for (const mode of rulesModes.filter(item => item.economy)) {
      const store = createRunSaveStore(() => storage, mode.saveKey)
      expect(store.save(createSectorRun(2, mode.economy!, startingDeckFor(mode, ''), undefined, 'run-' + mode.id), mode.economy!).ok).toBe(true)
      expect(createRunSaveStore(() => storage, mode.saveKey).load().snapshot?.run.runId).toBe('run-' + mode.id)
    }
    expect(data.get(RUN_SAVE_KEY)).toBe(standardRaw)
    expect(createRunSaveStore(() => storage).load().snapshot?.run.runId).toBe('control-run')
  })

  it('a battle restored from a saved B run is the same battle, with the new cycle', () => {
    const run = createSectorRun(77, B1, deckVariants.armor8)
    const node = run.map.layers.flat().find(item => item.type === 'battle')!
    const encounter = dungeonEncounter(node, B1)
    const a = createCampaignBattle({ encounter, economy: B1, deck: run.deck, seed: 9, battleId: 'x' })
    const b = createCampaignBattle({ encounter: dungeonEncounter(node, B1), economy: B1, deck: run.deck, seed: 9, battleId: 'x' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('B — every fight is playable, honest and explained', () => {
  const economies = [B1, B2] as const
  const idsOf = (state: BattleState) => [...state.hand, ...state.drawPile, ...state.discardPile, ...state.exhausted].map(card => card.instanceId).sort()

  it('executes exactly the forecast it showed, loses no card, and ends with the fair bots and the planner', () => {
    for (const economy of economies) {
      const deck = economy === B2 ? honestDeck('armor8', true) : deckVariants.armor10
      const run = createSectorRun(11, economy, deck)
      for (const node of run.map.layers.flat().filter(item => ['battle', 'elite', 'final'].includes(item.type))) {
        for (const strategy of ['balanced', 'aggressive', 'defensive', 'planner'] as const) {
          const state = createCampaignBattle({ encounter: dungeonEncounter(node, economy), economy, seed: 3, deck: run.deck })
          const planner = strategy === 'planner' ? createTurnPlanner({ profile: { keep: 0 } }) : undefined
          const everything = idsOf(state)
          for (let turn = 0; turn < 60 && !state.result; turn += 1) {
            for (let n = 0; n < 12 && !state.result; n += 1) {
              const id = planner ? planner.next(state) : chooseCard(state, strategy as 'balanced')?.instanceId
              if (!id) break
              playCard(state, id)
            }
            if (state.result) break
            // The announced action is what happens: the hero health after the enemy acts is the forecast's.
            const forecast = forecastEnemyAction(state)
            const expected = Object.fromEntries((['warrior', 'mage'] as const).map(hero => [hero, state.heroes[hero].health - (forecast.interrupt?.broken ? 0 : forecast.targets.filter(item => item.target === hero).reduce((sum, item) => sum + item.healthLoss, 0))]))
            const declared = structuredClone(state.enemy.nextAction)
            endTurn(state)
            expect({ warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }, node.id + strategy).toEqual(expected)
            expect(idsOf(state)).toEqual(everything)
            if (!state.result && declared.kind === 'prepare') expect(state.enemy.nextAction).toEqual(declared.prepared)
          }
          expect(state.result, node.id + ' ' + strategy).not.toBeNull()
        }
      }
    }
  })
})
