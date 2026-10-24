import { claimDungeonReward, createSectorRun, dungeonNode, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle, skipDungeonReward } from '../game/campaign'
import type { DungeonMapNode, DungeonRunState } from '../game/campaign'
import { sectorPaths } from '../game/dungeonGenerator'
import { resolveRoom } from '../game/dungeonRooms'
import type { EconomyConfig } from '../game/economy'
import type { CardId } from '../game/types'

export const mapSceneIds = ['map-start', 'map-mid', 'map-end'] as const
export type MapSceneId = typeof mapSceneIds[number]
export const isMapScene = (scene: string): scene is MapSceneId => (mapSceneIds as readonly string[]).includes(scene)

const variety = (path: readonly DungeonMapNode[]) => new Set(path.map(node => node.type)).size

/**
 * Development fixtures of the route screen only (Map UI v2): the party stands on the map after N rooms of a real generated route.
 * Battles are skipped through a forced victory like the route tests do; nothing here is a balance claim.
 */
export function createMapScene(scene: MapSceneId, economy: EconomyConfig, deck: readonly CardId[] | undefined, seed = 11): DungeonRunState {
  let run = createSectorRun(seed, economy, deck, undefined, `qa-${scene}-${seed}`)
  const path = [...sectorPaths(run.map)].sort((a, b) => variety(b) - variety(a))[0]!
  const rooms = scene === 'map-start' ? 0 : scene === 'map-mid' ? Math.floor(path.length / 2) : path.length - 1
  for (const node of path.slice(0, rooms)) {
    run = enterDungeonNode(run, node.id)
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
