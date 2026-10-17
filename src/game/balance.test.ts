import { describe, expect, it } from 'vitest'
import { endTurn, playCard } from './battle'
import { simulateBalance, simulateRun, summarizeBalance } from './balance'
import { advanceCampaign, addCampaignReward, campaignEncounter, campaignRewardOptions, campaignRewards, createCampaignBattle } from './campaign'
import { cardDefinition, encounters, startingDeck } from './types'

describe('headless balance lab', () => {
  it('uses the real encounter sequence, carries hero health, and adds rewards to the next deck', () => {
    const first = createCampaignBattle({ encounter: campaignEncounter(0), deck: startingDeck, seed: 2 })
    first.result = 'victory'
    first.heroes.warrior.health = 17
    first.heroes.mage.health = 9
    expect(advanceCampaign(first, 0)).toEqual({ kind: 'reward', nextEncounter: 1 })

    const reward = campaignRewards()[0]!
    const deck = addCampaignReward(addCampaignReward(startingDeck, reward), reward)
    const second = createCampaignBattle({ encounter: campaignEncounter(1), heroes: first.heroes, deck, seed: 3 })
    expect(second.heroes).toMatchObject({ warrior: { health: 17, armor: 0 }, mage: { health: 9, armor: 0 } })
    expect([...second.hand, ...second.drawPile].map(card => card.definitionId)).toContain(reward.id)
    expect(new Set([...second.hand, ...second.drawPile].map(card => card.instanceId)).size).toBe(deck.length)
    second.result = 'victory'
    expect(advanceCampaign(second, 2)).toEqual({ kind: 'complete' })
  })

  it('stops a campaign after a real engine defeat', () => {
    const battle = createCampaignBattle({ encounter: campaignEncounter(0), seed: 9, deck: [] })
    battle.heroes.mage.health = 3
    expect(endTurn(battle)).toBe(true)
    expect(battle.result).toBe('defeat')
    expect(advanceCampaign(battle, 0)).toEqual({ kind: 'defeat' })
  })

  it('finishes the final boss through the same atomic card rules', () => {
    const battle = createCampaignBattle({ encounter: campaignEncounter(2), seed: 7, deck: ['sword-strike'], })
    battle.enemy.health = 6
    const play = playCard(battle, battle.hand[0]!.instanceId)
    expect(play).toMatchObject({ ok: true, damageDealt: 6 })
    expect(battle.result).toBe('victory')
    expect(advanceCampaign(battle, 2)).toEqual({ kind: 'complete' })
  })

  it('is repeatable and returns detailed run records for all three strategies', () => {
    const first = simulateBalance({ runs: 2, seed: 42 })
    expect(simulateBalance({ runs: 2, seed: 42 })).toEqual(first)
    expect(first.map(run => run.strategy)).toEqual(['aggressive', 'aggressive', 'defensive', 'defensive', 'balanced', 'balanced'])
    expect(first.every(run => run.battles.length > 0 && run.status !== 'timeout')).toBe(true)
    expect(new Set(first.filter(run => run.seed === 42).map(run => JSON.stringify(run.rewards))).size).toBeGreaterThan(1)
    const fullRun = simulateRun(42, 'balanced')
    expect(fullRun).toMatchObject({ status: 'victory', battlesCompleted: 3 })
    expect(fullRun.battles).toHaveLength(encounters.length)
    expect(fullRun.battles.map(battle => battle.result)).toEqual(['victory', 'victory', 'victory'])
    expect(fullRun.rewards).toHaveLength(2)
    expect(fullRun.battles.map(battle => battle.deckSizeStart)).toEqual([18, 19, 20])
    expect(fullRun.battles.every(battle => battle.averagePlayableCardsAtTurnStart <= battle.averageHandSizeAtTurnStart)).toBe(true)
    expect(fullRun.battles.every(battle => battle.averageHandSizeAtTurnStart <= 10 && battle.averageHandSizeAfterActions <= 10)).toBe(true)
    expect(fullRun.battles[1]?.heroesStart).toEqual(fullRun.battles[0]?.heroesEnd)
    expect(fullRun.battles[2]?.heroesStart).toEqual(fullRun.battles[1]?.heroesEnd)
    expect(simulateRun(42, 'balanced')).toEqual(fullRun)
    const defeat = simulateRun(90, 'aggressive')
    expect(defeat).toMatchObject({ status: 'victory', battlesCompleted: 3, failedEncounter: null })
    expect(defeat.battles).toHaveLength(3)
    expect(defeat.battles[defeat.battles.length - 1]?.result).toBe('victory')
    expect(defeat.rewards).toHaveLength(2)
  })

  it('does not continue after a technical battle limit and reports timeouts separately', () => {
    const run = simulateRun(5, 'balanced', { maxTurnsPerBattle: 0 })
    expect(run.status).toBe('timeout')
    expect(run.battles).toHaveLength(1)
    expect(run.battles[0]?.result).toBe('timeout')
    expect(summarizeBalance([run])[0]).toMatchObject({ victories: 0, defeats: 0, timeouts: 1 })
  })

  it('aggregates winners and preserves reward identity', () => {
    const reward = campaignRewards().find(card => card.id === 'bastion')!
    expect(addCampaignReward(addCampaignReward(startingDeck, reward), cardDefinition('thunderbolt'))).toEqual([...startingDeck, 'bastion', 'thunderbolt'])
    const rows = summarizeBalance([
      { ...simulateRun(1, 'aggressive', { maxTurnsPerBattle: 0 }), status: 'victory', turns: 3, finalHealth: { warrior: 5, mage: 4 } },
      { ...simulateRun(2, 'aggressive', { maxTurnsPerBattle: 0 }), status: 'defeat', turns: 5, finalHealth: { warrior: 2, mage: 0 } },
    ])
    expect(rows[0]).toMatchObject({ runs: 2, victories: 1, defeats: 1, timeouts: 0, averageTurns: 4, medianTurns: 4 })
    expect(rows[0]?.battlesReached).toHaveLength(encounters.length)
    expect(rows[0]?.battleWins).toHaveLength(encounters.length)
  })

  it('offers three reproducible reward options from the expanded pool', () => {
    const battle = createCampaignBattle({ seed: 742 })
    battle.result = 'victory'
    expect(campaignRewards().length).toBeGreaterThanOrEqual(6)
    const first = campaignRewardOptions(battle)
    expect(first).toHaveLength(3)
    expect(campaignRewardOptions(battle)).toEqual(first)
    const other = createCampaignBattle({ seed: 743 })
    other.result = 'victory'
    expect(campaignRewardOptions(other)).not.toEqual(first)
  })
})
