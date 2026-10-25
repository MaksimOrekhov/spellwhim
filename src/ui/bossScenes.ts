import { availableDungeonNodes, createAdventureRun, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle } from '../game/campaign'
import type { DungeonRunState } from '../game/campaign'
import { claimBossCard, claimBossDevelopment } from '../game/bossReward'
import { resolveRoom } from '../game/dungeonRooms'
import type { EconomyConfig } from '../game/economy'
import type { CardId } from '../game/types'

export const bossSceneIds = ['boss-gate', 'boss-reward', 'boss-exit'] as const
export type BossSceneId = typeof bossSceneIds[number]
export const isBossScene = (scene: string): scene is BossSceneId => (bossSceneIds as readonly string[]).includes(scene)

/**
 * Development fixtures of the sector exit (Sector Transition v1), reached through legal transactions of an adventure run: the party walks the first
 * route, every battle before the boss is skipped through a forced victory like the route tests do, and the heroes come to the boss a little wounded so the camp's mending shows.
 *   boss-gate:   the battle with the boss is about to begin (battle entry saved);
 *   boss-reward: the boss is down, both tracks of the reward are open;
 *   boss-exit:   the reward is closed (a gold card taken, an artifact given to the Mage) and the party waits at the exit.
 */
export function createBossScene(scene: BossSceneId, economy: EconomyConfig, deck: readonly CardId[] | undefined, seed = 11): DungeonRunState {
  const win = (run: DungeonRunState, id: string) => {
    const battle = restoreDungeonBattle(run, economy, `qa-${id}`)
    battle.enemy.health = 0
    battle.result = 'victory'
    return resolveDungeonBattle(run, battle)
  }
  let run = createAdventureRun(seed, economy, deck, `qa-${scene}-${seed}`)
  for (let guard = 0; guard < 40; guard += 1) {
    const next = availableDungeonNodes(run).sort((a, b) => a.column - b.column)[0]!
    run = enterDungeonNode(run, next.id)
    if (next.type === 'final') break
    if (run.room) run = resolveRoom(run, { roomId: run.room.id, action: 'leave' })
    else if (next.type === 'rest') run = resolveDungeonRest(run, null)
    else {
      run = win(run, next.id)
      if (run.pendingReward) run = { ...run, pendingReward: null, decisions: [...run.decisions, run.pendingReward.id] }
    }
  }
  run = { ...run, heroes: { warrior: { ...run.heroes.warrior, health: 19 }, mage: { ...run.heroes.mage, health: 14 } } }
  if (scene === 'boss-gate') return run
  run = win(run, run.map.finalNodeId)
  if (scene === 'boss-reward') return run
  const reward = run.bossReward!
  run = claimBossCard(run, reward.id, { kind: 'take', cardId: reward.cards[0]!.definitionId })
  return claimBossDevelopment(run, reward.id, { kind: 'artifact', artifactId: reward.artifactIds[0]!, ownerInstanceId: run.heroes.mage.instanceId })
}
