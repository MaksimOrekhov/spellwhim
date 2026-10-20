import { createDungeonRun, createSectorRun, enterDungeonNode, claimDungeonReward, dungeonRewardOptions, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle } from '../game/campaign'
import type { DungeonMapNode, DungeonRunState } from '../game/campaign'
import { sectorPaths } from '../game/dungeonGenerator'
import { resolveRoom } from '../game/dungeonRooms'
import { chooseCard } from '../game/balance'
import { playCard, endTurn } from '../game/battle'

export const sectorSceneIds = ['forge','forge-upgraded','treasure','forgotten-forge','powder-store','goblin-trade','rest','elite','boss','complete','legacy'] as const
/** Reach fixtures through legal routes and battles; no invented victories or HP edits. */
export function createSectorScene(scene: string): DungeonRunState {
  if (!sectorSceneIds.includes(scene as typeof sectorSceneIds[number])) throw new Error('Unknown sector scene')
  if (scene === 'legacy') return createDungeonRun(42, undefined, undefined, undefined, 'qa-legacy')
  const matches = (n: DungeonMapNode) => scene === 'forge-upgraded' ? n.type === 'forge' : scene === 'complete' ? n.type === 'final' : scene === 'boss' ? n.type === 'final' : n.type === scene || n.eventId === scene
  for (let seed = 42; seed < 242; seed++) {
    let run = createSectorRun(seed, undefined, undefined, undefined, `qa-${scene}-${seed}`)
    const path = sectorPaths(run.map).find(p => p.some(matches) && (scene !== 'forge-upgraded' || p.some(n=>n.eventId==='forgotten-forge' && n.layer<p.find(matches)!.layer)))
    if (!path) continue
    for (const node of path) {
      run = enterDungeonNode(run, node.id)
      if (matches(node) && scene !== 'complete') return run
      if (run.room) run = scene==='forge-upgraded' && run.room.eventId==='forgotten-forge'
        ? resolveRoom(run,{roomId:run.room.id,action:'upgrade',instanceId:run.deck[0]!.instanceId,heroId:'mage'})
        : resolveRoom(run, { roomId: run.room.id, action: 'leave' })
      else if (node.type === 'rest') {
        const target = run.heroes.mage.health < run.heroes.mage.maxHealth ? 'mage' : run.heroes.warrior.health < run.heroes.warrior.maxHealth ? 'warrior' : null
        run = resolveDungeonRest(run, target)
      } else {
        const battle = restoreDungeonBattle(run)
        for (let turn = 0; turn < 30 && !battle.result; turn++) {
          for (let p = 0; p < 20 && !battle.result; p++) {
            const card = chooseCard(battle, 'defensive', 'public')
            if (!card) break
            if (!playCard(battle, card.instanceId).ok) throw new Error('Invalid QA play')
          }
          if (!battle.result) endTurn(battle)
        }
        if (battle.result !== 'victory') throw new Error('QA route did not win')
        run = resolveDungeonBattle(run, battle)
      }
      if (run.pendingReward) run = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
      if (scene === 'complete' && node.type === 'final') return run
    }
  }
  throw new Error('Could not reach QA scene')
}
