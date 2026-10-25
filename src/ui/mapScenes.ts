import { claimDungeonReward, createSectorRun, dungeonNode, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from '../game/campaign'
import type { DungeonMapNode, DungeonRunState } from '../game/campaign'
import { sectorPaths } from '../game/dungeonGenerator'
import { resolveRoom, roomEligibleCards } from '../game/dungeonRooms'
import type { EconomyConfig } from '../game/economy'
import type { CardId } from '../game/types'

export const mapSceneIds = ['map-start', 'map-mid', 'map-end', 'map-cart', 'map-cart-armed'] as const
export type MapSceneId = typeof mapSceneIds[number]
export const isMapScene = (scene: string): scene is MapSceneId => (mapSceneIds as readonly string[]).includes(scene)

const variety = (path: readonly DungeonMapNode[]) => new Set(path.map(node => node.type)).size

/**
 * Development fixtures of the route screen only (Map UI v2): the party stands on the map after N rooms of a real generated route.
 * Battles are skipped through a forced victory like the route tests do; nothing here is a balance claim.
 */
export function createMapScene(scene: MapSceneId, economy: EconomyConfig, deck: readonly CardId[] | undefined, seed = 11): DungeonRunState {
  let run = createSectorRun(seed, economy, deck, undefined, `qa-${scene}-${seed}`)
  // The cart scenes stand in the Runaway Cart room (E06), or right after riding it: the first seed from `seed` whose map has one.
  const cartScene = scene === 'map-cart' || scene === 'map-cart-armed'
  for (let probe = seed; cartScene && !run.map.layers.flat().some(node => node.eventId === 'runaway-cart') && probe < seed + 400; probe += 1) run = createSectorRun(probe, economy, deck, undefined, `qa-${scene}-${probe}`)
  const isCart = (node: DungeonMapNode) => node.eventId === 'runaway-cart'
  const path = cartScene ? sectorPaths(run.map).find(route => route.some(isCart))! : [...sectorPaths(run.map)].sort((a, b) => variety(b) - variety(a))[0]!
  const rooms = cartScene ? path.findIndex(isCart) + 1 : scene === 'map-start' ? 0 : scene === 'map-mid' ? Math.floor(path.length / 2) : path.length - 1
  for (const node of path.slice(0, rooms)) {
    run = enterDungeonNode(run, node.id)
    // A wounded party, so that all three choices of the room are open on screen.
    if (scene === 'map-cart' && isCart(node)) return { ...run, heroes: { warrior: { ...run.heroes.warrior, health: 20 }, mage: { ...run.heroes.mage, health: 10 } } }
    if (scene === 'map-cart-armed' && isCart(node)) return resolveRoom(run, { roomId: run.room!.id, action: 'ride', heroId: 'warrior', instanceId: roomEligibleCards(run, 'ride')[0]!.instanceId })
    if (run.room) run = resolveRoom(run, { roomId: run.room.id, action: 'leave' })
    else if (dungeonNode(run.map, node.id)!.type === 'rest') run = resolveDungeonRest(run, null)
    else {
      const battle = restoreDungeonBattle(run, economy, `qa-${node.id}`)
      battle.enemy.health = 0
      battle.result = 'victory'
      run = resolveDungeonBattle(run, battle)
      if (run.pendingReward) run = run.pendingReward.elite ? claimDungeonReward(run, dungeonRewardOptions(run)[0]!) : skipDungeonReward(run, run.pendingReward.id)
    }
  }
  return run
}
