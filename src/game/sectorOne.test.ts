import { describe, expect, it } from 'vitest'
import { generateSectorMap, sectorOneConfig, sectorPaths, validateSectorConfig, validateSectorMap } from './dungeonGenerator'
import { availableDungeonNodes, claimDungeonReward, createDungeonRun, createSectorRun, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, restoreDungeonBattle } from './campaign'
import type { DungeonRunState, DungeonNodeType } from './campaign'
import { resolveRoom, selectRoom, roomEligibleCards } from './dungeonRooms'
import { decodeSnapshot, encodeSnapshot, validateRun } from './runSave'
import { gameEconomy } from './economy'
import { cardDefinition } from './types'
import { publicDungeonNodeView } from './dungeonRoutePolicy'

const roundTrip = (run: DungeonRunState) => decodeSnapshot(encodeSnapshot(run, gameEconomy, 1)).run
function win(run: DungeonRunState) {
  const battle = restoreDungeonBattle(run)
  battle.result = 'victory'
  return resolveDungeonBattle(run, battle)
}
function roomRun(type: DungeonNodeType, eventId?: string, start = 0): DungeonRunState {
  for (let seed = start; seed < start+200; seed++) {
    let run = createSectorRun(seed, gameEconomy, undefined, undefined, `test-${seed}`)
    const path = sectorPaths(run.map).find(p => p.some(n => n.type === type && (!eventId || n.eventId === eventId)))
    if (!path) continue
    for (const node of path) {
      run = roundTrip(enterDungeonNode(run, node.id))
      if (node.type === type && (!eventId || node.eventId === eventId)) return run
      if (run.room) run = resolveRoom(run, { roomId: run.room.id, action: 'leave' })
      else if (node.type === 'rest') run = resolveDungeonRest(run, null)
      else run = win(run)
      if (run.pendingReward) run = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    }
  }
  throw new Error('Room not generated')
}

describe('carved sector generator', () => {
  it('validates every node and every route over the first 1000 seeds and uint32 boundaries', () => {
    for (const seed of [...Array.from({length:1000},(_,i)=>i), 0xffffffff, 0x80000000]) {
      const map = generateSectorMap(seed)
      expect(validateSectorMap(map), `seed ${seed}`).toEqual([])
      expect(map.generation?.fallback).toBe(false)
      expect(map.layers.flat().length).toBeLessThanOrEqual(21)
    }
  }, 120000)
  it('is deterministic, sparse and has different category paths', () => {
    const a = generateSectorMap(42), b = generateSectorMap(43)
    expect(generateSectorMap(42)).toEqual(a)
    expect(b).not.toEqual(a)
    expect(new Set(sectorPaths(a).map(p => p.map(n=>n.type).join())).size).toBeGreaterThan(2)
    expect(a.layers.slice(0,-1).some(r => r.length < 4)).toBe(true)
  })
  it('supports an extra configured row without sector II/III content', () => {
    const config = structuredClone(sectorOneConfig)
    config.id = 'test-longer'; config.rows.splice(3, 0, { types: ['battle'] }); config.maxBattles = 5
    expect(validateSectorMap(generateSectorMap(21, config))).toEqual([])
    expect(generateSectorMap(21, config).layers.length).toBe(7)
  })
  it('rejects bad configuration and corrupt links without recursive overflow', () => {
    for (const mutation of [ { columns: 0 }, { paths: 1 }, { generatorVersion: 'future' }, { boss: 'none' }, { eventPool: [] }, { maxStep: 2 } ]) expect(() => validateSectorConfig({ ...sectorOneConfig, ...mutation })).toThrow()
    const map = generateSectorMap(4)
    map.layers[0]![0]!.edges = [map.layers[0]![0]!.id]
    expect(validateSectorMap(map).length).toBeGreaterThan(0)
    expect(()=>generateSectorMap(4,{...sectorOneConfig,maxElites:0})).toThrow(/exhausted 128 attempts/)
  })
  it('exposes only categories and connections to route policies',()=>{
    const map=generateSectorMap(42)
    for(const n of map.layers.flat()) expect(Object.keys(publicDungeonNodeView(n)).sort()).toEqual(['column','edges','id','layer','type'])
  })
})

describe('room transactions and persisted offers', () => {
  it('saves a cancelled draft without spending a forge, then upgrades exactly one copy once', () => {
    let run = roomRun('forge'), room = run.room!
    run = roundTrip(selectRoom(run, room.id, { action: 'upgrade', instanceId: run.deck[0]!.instanceId }))
    expect(run.room?.selection?.instanceId).toBe(run.deck[0]!.instanceId)
    run = roundTrip(selectRoom(run, room.id, null))
    expect(run.room).not.toBeNull()
    expect(availableDungeonNodes(run)).toEqual([])
    const id = run.deck[0]!.instanceId
    run = roundTrip(resolveRoom(run, { roomId: room.id, action: 'upgrade', instanceId: id }))
    expect(run.deck.find(c=>c.instanceId===id)?.upgrade).toBe(1)
    expect(run.deck.filter(c=>c.upgrade===1)).toHaveLength(1)
    expect(dungeonRunPhase(run)).toBe('map')
    expect(()=>resolveRoom(run,{roomId:room.id,action:'leave'})).toThrow()
  })
  it('removes a concrete copy and protects the last card', () => {
    const run = roomRun('forge'), id = run.deck[1]!.instanceId
    const next = roundTrip(resolveRoom(run,{roomId:run.room!.id,action:'remove',instanceId:id}))
    expect(next.deck).toHaveLength(run.deck.length-1)
    expect(next.deck.some(c=>c.instanceId===id)).toBe(false)
    expect(next.deck[0]).toEqual(run.deck[0])
    const one = {...run,deck:[run.deck[0]!]}
    expect(roomEligibleCards(one,'remove')).toEqual([])
    expect(()=>resolveRoom(one,{roomId:run.room!.id,action:'remove',instanceId:one.deck[0]!.instanceId})).toThrow()
  })
  it('replaces within class with a fresh normal copy and stable options', () => {
    const run = roomRun('forge'), old = run.deck[0]!
    old.upgrade = 1
    const room = roundTrip(run).room!, className = cardDefinition(old.definitionId).className
    const choice = room.replacements[className].find(c=>c.definitionId!==old.definitionId)!
    const next = roundTrip(resolveRoom(run,{roomId:room.id,action:'replace',instanceId:old.instanceId,cardId:choice.definitionId}))
    expect(next.deck).toHaveLength(run.deck.length)
    expect(next.deck[0]).toMatchObject({...choice,instanceId:`${run.runId}/card/${run.nextCardId}`,upgrade:0})
    const wrong = room.replacements[className==='warrior'?'mage':'warrior'][0]!
    expect(()=>resolveRoom(run,{roomId:room.id,action:'replace',instanceId:old.instanceId,cardId:wrong.definitionId})).toThrow()
  })
  it('charges 3 HP atomically for a forgotten-forge upgrade; low health cannot pay', () => {
    const run = roomRun('event','forgotten-forge'), command = {roomId:run.room!.id,action:'upgrade' as const,instanceId:run.deck[0]!.instanceId,heroId:'mage' as const}
    const next = roundTrip(resolveRoom(run,command))
    expect(next.heroes.mage.health).toBe(run.heroes.mage.health-3)
    const before = structuredClone(run)
    expect(()=>resolveRoom(run,{...command,instanceId:'missing'})).toThrow()
    expect(run).toEqual(before)
    run.heroes.mage.health=3
    expect(()=>resolveRoom(run,command)).toThrow()
  })
  it('persists the powder outcome and applies both success and failure once', () => {
    const seen = new Set<boolean>()
    for (let seed=0;seed<80 && seen.size<2;seed++) {
      const run = roomRun('event','powder-store',seed), room = roundTrip(run).room!
      seen.add(room.riskSuccess)
      const next = roundTrip(resolveRoom(run,{roomId:room.id,action:'risk'}))
      expect(next.deck.length-run.deck.length).toBe(room.riskSuccess?1:0)
      expect(next.heroes.mage.health).toBe(run.heroes.mage.health-(room.riskSuccess?0:2))
      if(room.riskSuccess) expect(next.deck[next.deck.length-1]?.upgrade).toBe(1)
      expect(()=>resolveRoom(next,{roomId:room.id,action:'risk'})).toThrow()
    }
    expect(seen.size).toBe(2)
  })
  it('treasure grants one reward, enforces personal slot replacement and supports decline', () => {
    const run=roomRun('treasure'), room=run.room!
    const a=room.artifactIds[0]!, owner=run.heroes.mage
    const equipped=roundTrip(resolveRoom(run,{roomId:room.id,action:'artifact',artifactId:a,heroId:'mage'}))
    expect(equipped.artifacts).toHaveLength(1)
    expect(equipped.artifacts[0]?.ownerInstanceId).toBe(owner.instanceId)
    expect(()=>resolveRoom(equipped,{roomId:room.id,action:'card',cardId:room.cards[0]!.definitionId})).toThrow()
    const occupied={...run,artifacts:[{instanceId:'previous',definitionId:'tension-spool' as const,ownerInstanceId:owner.instanceId}]}
    const other=room.artifactIds.find(id=>id!=='tension-spool')!
    expect(()=>resolveRoom(occupied,{roomId:room.id,action:'artifact',artifactId:other,heroId:'mage'})).toThrow()
    expect(resolveRoom(occupied,{roomId:room.id,action:'artifact',artifactId:other,heroId:'mage',replaceInstanceId:'previous'}).artifacts).toHaveLength(1)
    expect(roundTrip(resolveRoom(run,{roomId:room.id,action:'leave'})).deck).toEqual(run.deck)
  })
  it('completes the sector without a boss reward and keeps the legacy campaign independent', () => {
    let run=createSectorRun(77)
    for(const node of sectorPaths(run.map)[0]!) {
      run=roundTrip(enterDungeonNode(run,node.id))
      if(run.room) run=resolveRoom(run,{roomId:run.room.id,action:'leave'})
      else if(node.type==='rest') run=resolveDungeonRest(run,null)
      else run=win(run)
      if(run.pendingReward) run=claimDungeonReward(run,dungeonRewardOptions(run)[0]!)
      run=roundTrip(run)
    }
    expect(run.status).toBe('sector-complete')
    expect(run.pendingReward).toBeNull()
    expect(availableDungeonNodes(run)).toEqual([])
    expect(createDungeonRun(77).map.layers).toHaveLength(7)
    expect(()=>validateRun({...run,status:'victory'})).toThrow()
  })
  it('keeps topology, encounters and other offer streams independent from reward decisions',()=>{
    const run=roomRun('treasure'), room=run.room!, original=structuredClone(run.map)
    const card=roundTrip(resolveRoom(run,{roomId:room.id,action:'card',cardId:room.cards[0]!.definitionId}))
    const artifact=roundTrip(resolveRoom(run,{roomId:room.id,action:'artifact',artifactId:room.artifactIds[0],heroId:'warrior'}))
    expect(card.map).toEqual(original)
    expect(artifact.map).toEqual(original)
    expect(availableDungeonNodes(card)).toEqual(availableDungeonNodes(artifact))
    const next=availableDungeonNodes(card)[0]!
    const a=restoreDungeonBattle(enterDungeonNode(card,next.id)),b=restoreDungeonBattle(enterDungeonNode(artifact,next.id))
    expect(a.enemy).toEqual(b.enemy)
    expect(a.seed).toBe(b.seed)
  })
  it('rejects changed event outcomes, spent room ledgers and invalid room drafts on load',()=>{
    const run=roomRun('event','powder-store')
    expect(()=>validateRun({...run,room:{...run.room!,riskSuccess:!run.room!.riskSuccess}})).toThrow()
    expect(()=>validateRun({...run,room:{...run.room!,selection:{action:'artifact'}}})).toThrow()
    const next=resolveRoom(run,{roomId:run.room!.id,action:'leave'})
    expect(()=>validateRun({...next,room:run.room})).toThrow()
    expect(()=>validateRun({...next,journal:[]})).toThrow()
  })
  it('goblin trades accept only ordinary copies and preserve a cancelled offer',()=>{
    const run=roomRun('event','goblin-trade'), room=run.room!
    run.deck[0]!.upgrade=1
    expect(roomEligibleCards(run,'replace').some(c=>c.instanceId===run.deck[0]!.instanceId)).toBe(false)
    const draft=selectRoom(run,room.id,{action:'replace',instanceId:run.deck[1]!.instanceId})
    const cancelled=roundTrip(selectRoom(draft,room.id,null))
    expect(cancelled.room).toEqual(room)
    expect(()=>resolveRoom(run,{roomId:room.id,action:'remove',instanceId:run.deck[0]!.instanceId})).toThrow()
  })
})
