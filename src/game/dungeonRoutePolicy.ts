import type { DungeonMapNode, DungeonNodeType } from './campaign'
import type { HeroId } from './types'

/** The only map data route policies are allowed to inspect. */
export interface PublicDungeonNodeView {
  id: string
  layer: number
  column: number
  type: DungeonNodeType
  edges: readonly string[]
}

export type DungeonRoutePolicy = 'safe' | 'risky' | 'mixed'

export function publicDungeonNodeView(node: DungeonMapNode): PublicDungeonNodeView {
  return { id: node.id, layer: node.layer, column: node.column, type: node.type, edges: [...node.edges] }
}

/** Select using map-visible category and party health only; encounter data is intentionally absent. */
export function chooseDungeonRouteNode(
  nodes: readonly PublicDungeonNodeView[],
  heroes: Record<HeroId, { health: number; maxHealth: number }>,
  policy: DungeonRoutePolicy,
): PublicDungeonNodeView | undefined {
  const healthRatio = Math.min(heroes.warrior.health / heroes.warrior.maxHealth, heroes.mage.health / heroes.mage.maxHealth)
  const score = (node: PublicDungeonNodeView): number => {
    if (node.type === 'final') return 200
    if (policy === 'safe') return node.type === 'rest' ? 100 : node.type === 'battle' ? 20 : -30
    if (policy === 'risky') return node.type === 'elite' ? 100 : node.type === 'battle' ? 20 : -10
    if (node.type === 'rest') return healthRatio < 0.7 ? 120 : 35
    return node.type === 'elite' ? (healthRatio > 0.82 ? 65 : -35) : 40
  }
  return [...nodes].sort((a, b) => score(b) - score(a) || a.column - b.column || a.id.localeCompare(b.id))[0]
}
