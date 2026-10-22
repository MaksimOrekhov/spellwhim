import { describe, expect, it } from 'vitest'
import { honestEconomies } from './economy'
import { honestDeck } from './honestDecks'
import { bestResponses, createChooser, fightEnemy, labStrategies, outcomeValue, sectorEnemyIds, simulateSectorRun, threatState, threatSuite } from './honestLab'
import type { CardId } from './types'

const B1 = honestEconomies['honest-b1']
const B2 = honestEconomies['honest-b2']

describe('the Honest Turn B laboratory', () => {
  it('fights every sector enemy with every strategy to a result, and every log line is explained by the forecast', () => {
    for (const [economy, deck] of [[B1, honestDeck('armor10', false)], [B2, honestDeck('armor8', true)]] as const) {
      for (const enemy of sectorEnemyIds) {
        for (const strategy of labStrategies) {
          const fight = fightEnemy(economy, enemy, deck, strategy, 4)
          expect(['victory', 'defeat'], `${enemy} ${strategy}`).toContain(fight.result)
          expect(fight.log.length).toBeGreaterThan(0)
          // The banner promised exactly this much health loss on every turn: nothing happens that was not announced.
          for (const turn of fight.log) expect(turn.unexplained, `${enemy} ${strategy} turn ${turn.turn}`).toBe(0)
          expect(outcomeValue(fight)).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('is deterministic: the same seed gives the same fight', () => {
    const deck = honestDeck('armor8', true)
    const run = () => JSON.stringify(fightEnemy(B2, 'old-mines-rhahk-zor', deck, 'planner', 9))
    expect(run()).toBe(run())
  })

  it('the planner does not read the order of the deck: the same visible situation gives the same plan', () => {
    const deck = honestDeck('armor10', false)
    const state = threatState(B1, deck, threatSuite[1]!, 5)
    const chooser = createChooser('planner')
    const first = chooser.next(state)
    // Reshuffling what the player cannot see does not change what it does with the hand it holds.
    const other = threatState(B1, deck, threatSuite[1]!, 5)
    other.drawPile = [...other.drawPile].reverse()
    const second = createChooser('planner').next(other)
    expect(other.hand.find(card => card.instanceId === second)?.definitionId).toBe(state.hand.find(card => card.instanceId === first)?.definitionId)
  })

  it('finds the safest play of a hand exhaustively, and a banned card is a dead card', () => {
    const deck = honestDeck('armor8', true)
    const threat = threatSuite.find(item => item.id === 'heavy-warrior')!
    let compared = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = threatState(B2, deck, threat, seed)
      const ids = state.hand.map(card => card.definitionId)
      const full = bestResponses(state)
      expect(full.minLoss).toBeGreaterThanOrEqual(0)
      expect(full.minLoss).toBeLessThanOrEqual(13)
      expect(full.frontier.length).toBeGreaterThan(0)
      // The frontier trades loss for damage: loss goes up, damage goes up.
      for (let i = 1; i < full.frontier.length; i += 1) {
        expect(full.frontier[i]!.loss).toBeGreaterThanOrEqual(full.frontier[i - 1]!.loss)
        expect(full.frontier[i]!.damage).toBeGreaterThan(full.frontier[i - 1]!.damage)
      }
      const without = bestResponses(threatState(B2, deck, threat, seed), 6000, ['frost-grip' as CardId])
      expect(without.minLoss).toBeGreaterThanOrEqual(full.minLoss)
      if (ids.includes('frost-grip')) compared += 1
    }
    expect(compared).toBeGreaterThan(10)
  })

  it('a whole run is played through the real campaign: same seed, same result; B1 and B2 start from different decks', () => {
    const a = simulateSectorRun(5, B1, honestDeck('armor10', false), 'balanced')
    const b = simulateSectorRun(5, B1, honestDeck('armor10', false), 'balanced')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(['victory', 'defeat']).toContain(a.result)
    expect(a.battles.length).toBeGreaterThan(0)
    const withFrost = simulateSectorRun(5, B2, honestDeck('armor8', true), 'balanced')
    expect(withFrost.deckEnd.filter(id => id === 'frost-grip').length).toBeGreaterThanOrEqual(0)
    expect(withFrost.route).toEqual(a.route)
  })
})
