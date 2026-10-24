import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import MainMenu from '../components/MainMenu.vue'
import { availableDungeonNodes, createSectorRun, dungeonRunPhase, enterDungeonNode } from './campaign'
import { drawForTurn, honestEconomies, manaForTurn } from './economy'
import { armorSources, honestDeck } from './honestDecks'
import { defaultRulesMode, requestedSeed, resolveLaunch, rulesModes, startingDeckFor } from './rulesMode'
import { createRunSaveStore, decodeSnapshot, RUN_SAVE_KEY } from './runSave'
import type { SaveStorage } from './runSave'
import oldSave from './fixtures/b2-long-mid-run-save.json?raw'

/** Decision Log X04: Honest Turn B2 on the long Sector I is the game. These tests pin what a normal launch plays and that old saves still open. */
const memory = (initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return { data, getItem: key => data[key] ?? null, setItem: (key, value) => { data[key] = value } }
}

describe('a normal launch plays B2 Long', () => {
  it('uses the B2 Long rules, deck and save slot under every address that is not an explicit laboratory request', () => {
    const addresses = ['', '?rules=honest-a08', '?rules=control', '?rules=honest-b1', '?economy=U', '?economy=A&enemies=v06', '?deck=armor6', '?seed=7', '?dev-rules=', '?dev-rules=nonsense', '?lab=1']
    for (const developer of [false, true]) {
      for (const address of addresses) {
        const launch = resolveLaunch(address, developer)
        expect(launch.mode, address).toBe(defaultRulesMode)
        expect(launch.lab).toBe(false)
        expect(launch.search).toBe('')
        expect(requestedSeed(launch.search)).toBeNull()
      }
    }
    expect(defaultRulesMode.id).toBe('honest-b2-long')
    expect(defaultRulesMode.economy).toBe(honestEconomies['honest-b2-long'])
    expect(defaultRulesMode.saveKey).toBe('spellwhim.run.v1.honest-b2-long')
  })

  it('opens another set of rules only in a development build and only by ?dev-rules=', () => {
    expect(resolveLaunch('?dev-rules=honest-a08', false).mode).toBe(defaultRulesMode)
    expect(resolveLaunch('?dev-rules=control', false).mode).toBe(defaultRulesMode)
    const a08 = resolveLaunch('?dev-rules=honest-a08', true)
    expect(a08.lab).toBe(true)
    expect(a08.mode.id).toBe('honest-a08')
    const control = resolveLaunch('?dev-rules=control&economy=U&seed=5', true)
    expect(control.mode.id).toBe('control')
    expect(control.mode.saveKey).toBe(RUN_SAVE_KEY)
    expect(requestedSeed(control.search)).toBe(5)
    expect(resolveLaunch('?dev-rules=b1&deck=armor6', true).mode.id).toBe('honest-b1')
    expect(startingDeckFor(resolveLaunch('?dev-rules=b2&deck=armor6', true).mode, resolveLaunch('?dev-rules=b2&deck=armor6', true).search)).toEqual(honestDeck('armor6', true))
  })

  it('has the B2 rules: seven cards, four mana, discard, temporary armor, B1 cycles, long route', () => {
    const economy = defaultRulesMode.economy!
    expect(economy.openingHand).toBe(7)
    expect(drawForTurn(economy, 2)).toBe(7)
    expect([1, 2, 3, 5, 9].map(turn => manaForTurn(economy, turn))).toEqual([4, 4, 4, 4, 4])
    expect(economy.discardHand).toBe(true)
    expect(economy.armorExpiry).toBe('turn')
    expect(economy.sectorFoes).toBe('b1')
    expect(economy.sectorRoute).toBe('long')
  })

  it('starts with the B2 deck (eight armor sources, Frost Grips and Ice Breakers) and a ten-visit map', () => {
    const deck = startingDeckFor(defaultRulesMode, resolveLaunch('', true).search)!
    expect(deck).toEqual(honestDeck('armor8', true))
    expect(deck).toHaveLength(18)
    expect(armorSources(deck)).toBe(8)
    expect(deck.filter(id => id === 'frost-grip')).toHaveLength(2)
    expect(deck.filter(id => id === 'ice-breaker')).toHaveLength(2)
    const run = createSectorRun(11, defaultRulesMode.economy!, deck)
    expect(run.map.layers).toHaveLength(10)
    expect(run.map.layers[run.map.layers.length - 1]).toHaveLength(1)
  })
})

describe('saves of the playtests keep working', () => {
  it('restores an unfinished B2 Long run written before the switch and walks on from it', () => {
    const storage = memory({ [defaultRulesMode.saveKey]: oldSave, [defaultRulesMode.saveKey + '.backup']: oldSave })
    const loaded = createRunSaveStore(() => storage, defaultRulesMode.saveKey).load()
    expect(loaded.blocked).toBe(false)
    expect(loaded.message).toBe('')
    const snapshot = loaded.snapshot!
    expect(snapshot.economy.id).toBe('honest-b2-long')
    expect(snapshot.run.status).toBe('active')
    expect(snapshot.run.map.layers).toHaveLength(10)
    expect(snapshot.run.completedNodeIds.length).toBeGreaterThan(0)
    expect(dungeonRunPhase(snapshot.run)).toBe('map')
    const next = availableDungeonNodes(snapshot.run)
    expect(next.length).toBeGreaterThan(0)
    expect(enterDungeonNode(snapshot.run, next[0]!.id).visitedNodeIds.length).toBe(snapshot.run.visitedNodeIds.length + 1)
    expect(decodeSnapshot(oldSave).run).toEqual(snapshot.run)
  })

  it('never touches the slots of the other rules, saving or loading', () => {
    const control = 'control-run-record'
    const a08 = 'a08-run-record'
    const storage = memory({ [RUN_SAVE_KEY]: control, [RUN_SAVE_KEY + '.backup']: control, [RUN_SAVE_KEY + '.honest-a08']: a08, [RUN_SAVE_KEY + '.honest-b2']: 'b2-short-record' })
    const store = createRunSaveStore(() => storage, defaultRulesMode.saveKey)
    expect(store.load().snapshot).toBeNull()
    const run = createSectorRun(3, defaultRulesMode.economy!, honestDeck('armor8', true), undefined, 'fresh')
    expect(store.save(run, defaultRulesMode.economy!).ok).toBe(true)
    expect(storage.data[RUN_SAVE_KEY]).toBe(control)
    expect(storage.data[RUN_SAVE_KEY + '.backup']).toBe(control)
    expect(storage.data[RUN_SAVE_KEY + '.honest-a08']).toBe(a08)
    expect(storage.data[RUN_SAVE_KEY + '.honest-b2']).toBe('b2-short-record')
    expect(Object.keys(storage.data).sort()).toEqual([RUN_SAVE_KEY, RUN_SAVE_KEY + '.backup', RUN_SAVE_KEY + '.honest-a08', RUN_SAVE_KEY + '.honest-b2', defaultRulesMode.saveKey, defaultRulesMode.saveKey + '.backup'].sort())
  })

  it('keeps every laboratory mode and its own slot available to the tools', () => {
    expect(rulesModes.map(mode => mode.id)).toEqual(['control', 'honest-a08', 'honest-a09', 'honest-b1', 'honest-b2', 'honest-b1-long', 'honest-b2-long'])
    expect(new Set(rulesModes.map(mode => mode.saveKey)).size).toBe(rulesModes.length)
  })
})

describe('the start screen', () => {
  const render = (props: Record<string, unknown>) => renderToString(createSSRApp(MainMenu, { saved: null, canReturn: false, notice: '', unreadable: false, ...props }))
  const forbidden = /Честный ход|B1|B2|эксперимент|контрольн|броня\s*\d|Режим|Правила боя|Лаборатория/i

  it('offers a new run and nothing about rules, decks or experiments', async () => {
    const html = await render({})
    expect(html).toContain('Новый поход')
    expect(html).not.toContain('Продолжить поход')
    expect(html).not.toMatch(forbidden)
    expect(html).not.toContain('<a ')
  })
  it('offers to continue a saved run, with a copy to download', async () => {
    const html = await render({ saved: { active: true } })
    expect(html).toContain('Продолжить поход')
    expect(html).toContain('Новый поход')
    expect(html).toContain('Скачать копию')
    expect(html).not.toMatch(forbidden)
  })
  it('offers the way back from a run in progress, and only the retry for an unreadable save', async () => {
    expect(await render({ canReturn: true })).toContain('Вернуться в поход')
    const broken = await render({ unreadable: true, notice: 'Не удалось прочитать сохранение.' })
    expect(broken).toContain('Повторить загрузку')
    expect(broken).not.toContain('Новый поход')
  })
})
