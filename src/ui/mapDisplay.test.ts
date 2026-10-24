import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import CampaignMap from '../components/CampaignMap.vue'
import { createDungeonRun, createSectorRun } from '../game/campaign'
import type { DungeonRunState } from '../game/campaign'
import { createMapScene } from './mapScenes'
import { sectorLongConfig } from '../game/sectorLong'
import { honestEconomies } from '../game/economy'
import { mapAriaLabel, mapFace, mapNodeState, mapPosition, mapRailPath, mapRowLabel } from './mapDisplay'

const hidden = ['forge', 'treasure', 'event'] as const
const trueNames = ['Кузница', 'Сокровищница', 'Событие']

describe('map faces', () => {
  it('shows forges, treasuries and events as one unknown room until they are entered', () => {
    const [forge, treasure, event] = hidden.map(type => mapFace({ type }, false))
    expect(forge).toEqual(treasure)
    expect(forge).toEqual(event)
    expect(forge!.kind).toBe('unknown')
    for (const face of [forge!, treasure!, event!]) for (const name of trueNames) expect(`${face.label} ${face.hint}`).not.toContain(name)
  })
  it('reveals the true kind after the visit', () => {
    expect(hidden.map(type => mapFace({ type }, true).kind)).toEqual(['forge', 'treasure', 'event'])
  })
  it('keeps the openly announced categories open', () => {
    expect(mapFace({ type: 'battle' }, false).label).toBe('Обычный бой')
    expect(mapFace({ type: 'elite' }, false).label).toBe('Элитный бой')
    expect(mapFace({ type: 'rest' }, false).label).toBe('Привал')
    expect(mapFace({ type: 'final' }, false).label).toBe('Босс')
  })
  it('words the accessible name from the face, never from the true type', () => {
    const face = mapFace({ type: 'forge' }, false)
    expect(mapAriaLabel({ type: 'forge', layer: 3 }, face, 'available')).toBe('Штрек 4. Неизвестная комната. Доступно.')
    expect(mapRowLabel({ type: 'final', layer: 9 })).toBe('Финал')
  })
  it('derives one state per room', () => {
    const visited = new Set(['a', 'b']); const available = new Set(['c'])
    expect(['b', 'a', 'c', 'd'].map(id => mapNodeState(id, visited, available, 'b'))).toEqual(['current', 'visited', 'available', 'locked'])
  })
})

describe('map geometry', () => {
  it('runs left to right, one lane per column, inside the box', () => {
    const first = mapPosition({ layer: 0, column: 1 }, 10, 3)
    const last = mapPosition({ layer: 9, column: 1 }, 10, 3)
    expect(first.y).toBe(50)
    expect(first.x).toBeGreaterThan(5)
    expect(last.x).toBeLessThan(95)
    for (const column of [0, 1, 2]) expect(mapPosition({ layer: 4, column }, 10, 3).y).toBeGreaterThan(10)
    expect(mapPosition({ layer: 4, column: 0 }, 10, 3).y).toBeLessThan(mapPosition({ layer: 4, column: 2 }, 10, 3).y)
  })
  it('draws a rail with horizontal tangents', () => {
    expect(mapRailPath({ x: 10, y: 50 }, { x: 20, y: 20 })).toBe('M 100 500 C 150 500, 150 200, 200 200')
  })
})

describe('map screen', () => {
  const render = (run: DungeonRunState) => renderToString(createSSRApp(CampaignMap, { map: run.map, run }))
  const longEconomy = honestEconomies['honest-b2-long']

  it('does not leak a hidden room in any text, class or label before it is entered (short and long sectors)', async () => {
    for (const economy of [undefined, longEconomy]) {
      for (let seed = 1; seed <= 25; seed++) {
        const run = createSectorRun(seed, economy, undefined, economy ? sectorLongConfig : undefined, `leak-${seed}`)
        const html = await render(run)
        for (const name of trueNames) expect(html).not.toContain(name)
        expect(html).not.toMatch(/map-(node|slot)--(forge|treasure|event)|is-(forge|treasure|event)/)
        expect(html).toContain('Неизвестная комната')
        expect((html.match(/aria-label="(Штрек|Финал)/g) ?? []).length).toBe(run.map.layers.flat().length)
      }
    }
  }, 60000)

  it('names a service room only after the party has been there', async () => {
    let revealed = 0
    for (let seed = 1; seed <= 12; seed++) {
      const run = createMapScene('map-mid', longEconomy, undefined, seed)
      const html = await render(run)
      const walked = new Set(run.visitedNodeIds)
      const nodes = run.map.layers.flat()
      const names: Record<string, string> = { forge: 'Кузница', treasure: 'Сокровищница', event: 'Событие' }
      for (const type of hidden) {
        const seen = nodes.some(node => node.type === type && walked.has(node.id))
        expect(html.includes(`aria-label="Штрек`) && new RegExp(`aria-label="[^"]*${names[type]}`).test(html)).toBe(seen)
        if (seen) revealed++
      }
    }
    expect(revealed).toBeGreaterThan(0)
  }, 60000)

  it('renders the control map as medallions without room captions', async () => {
    const run = createDungeonRun(5, undefined, undefined, undefined, 'short')
    const html = await render(run)
    expect(html).toContain('map-slot--boss')
    expect(html).not.toMatch(/<strong>(Обычный бой|Элитный бой|Привал|Босс)<\/strong>/)
  })
})
