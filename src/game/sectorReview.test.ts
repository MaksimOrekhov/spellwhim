import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import DungeonRoom from '../components/DungeonRoom.vue'
import { createSectorScene } from '../ui/sectorScenes'
import { inspectSectorRoutes } from '../../research/sector-review/oracle'
import { generateSectorMap, sectorOneConfig, validateSectorMap } from './dungeonGenerator'
import { createDungeonRun, createSectorRun, deriveDungeonSeed, enterDungeonNode, restoreDungeonBattle, resolveDungeonBattle } from './campaign'
import type { DungeonRunState } from './campaign'
import { createRoomVisit, resolveRoom, roomReplacementOptions, roomEligibleCards, roomActionAvailable, selectRoom } from './dungeonRooms'
import { createRunSaveStore, decodeSnapshot, encodeSnapshot, IncompatibleSave, ROOM_RULES_VERSION, RUN_SAVE_KEY, validateRun } from './runSave'
import { gameEconomy } from './economy'
import { cards, cardDefinition } from './types'
import { nextRandom } from './deck'
import { resolveEnemyPortrait } from '../ui/enemyArt'
import { sectorEncounters } from './sectorContent'

const reload = (run: DungeonRunState) => decodeSnapshot(encodeSnapshot(run,gameEconomy,1)).run
function sealed(payload: unknown): string {
  const canonical = (v: unknown): string => Array.isArray(v) ? '['+v.map(canonical).join(',')+']' : v && typeof v==='object' ? '{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}' : JSON.stringify(v)!
  let hash=0x811c9dc5
  const text=canonical(payload)
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),0x01000193)
  return JSON.stringify({payload,checksum:(hash>>>0).toString(16)})
}

describe('independent sector review regressions',()=>{
  it('preserves the prototype encounter health and 18/8, 3-mana opening contract',()=>{
    expect(sectorEncounters.map(e=>[e.id,e.maxHealth])).toEqual([
      ['old-mines-raider',32],['old-mines-digger',36],['old-mines-watchman',34],['old-mines-overseer',40],['old-mines-johnson',60],['old-mines-rhahk-zor',65],
    ])
    const run=createSectorRun(42),battle=restoreDungeonBattle(enterDungeonNode(run,run.map.startNodeIds[0]!))
    expect(run.deck).toHaveLength(18);expect(battle.hand).toHaveLength(8);expect(battle.mana).toBe(3)
  })
  it('enumerates real routes independently: budgets, safe continuations, reachability, crossings and unique variants',()=>{
    for(let seed=0;seed<1000;seed++) {
      const {errors,paths}=inspectSectorRoutes(generateSectorMap(seed))
      expect(errors,`seed ${seed}`).toEqual([])
      const family=(id:string)=>['old-mines-raider','old-mines-digger'].includes(id)?'F1':id
      for(const path of paths) {
        const combat=path.filter(n=>['battle','elite','final'].includes(n.type))
        if(combat.some((n,i)=>i>0 && family(n.encounterId!)===family(combat[i-1]!.encounterId!))) throw new Error(`Repeated family: ${seed}`)
      }
    }
  },120000)

  it('rejects concrete duplicate, budget, mandatory elite, crossing and unreachable mutations',()=>{
    const base=generateSectorMap(42)
    const duplicate=structuredClone(base), path=inspectSectorRoutes(duplicate).paths[0]!
    const first=path[0]!, last=path[3]!
    // Digger belongs to both row pools.
    first.encounterId=last.encounterId='old-mines-digger';first.encounterHealth=last.encounterHealth=36
    expect(validateSectorMap(duplicate)).toContain('Repeated normal encounter on a route')
    expect(inspectSectorRoutes(duplicate).errors).toContain('repeated variant')
    const budget=structuredClone(base), elite=budget.layers[2]!.find(n=>n.type==='elite')!
    const parent=budget.layers[1]!.find(n=>n.edges.includes(elite.id))!
    budget.configuration!.rows[1]!.required=['battle']
    parent.type='battle'; delete parent.eventId; parent.encounterId='old-mines-raider';parent.encounterHealth=32
    expect(validateSectorMap(budget)).toContain('Combat budget exceeded')
    expect(inspectSectorRoutes(budget).errors).toContain('row2 battle + elite')
    const forced=structuredClone(base), e=forced.layers[2]!.find(n=>n.type==='elite')!
    forced.layers[1]!.find(n=>n.edges.includes(e.id))!.edges=[e.id]
    expect(validateSectorMap(forced)).toContain('Forced future elite')
    expect(inspectSectorRoutes(forced).errors).toContain('mandatory elite')
    const unreachable=structuredClone(base), target=unreachable.layers[1]![0]!
    unreachable.layers[0]!.forEach(n=>{n.edges=n.edges.filter(id=>id!==target.id)})
    // Preserve a forward edge on each entrance, so this reaches the reachability check.
    unreachable.layers[0]!.filter(n=>!n.edges.length).forEach(n=>{ const to=unreachable.layers[1]!.find(t=>t.id!==target.id && Math.abs(t.column-n.column)<=1); if(to)n.edges=[to.id] })
    expect(inspectSectorRoutes(unreachable).errors).toContain('unreachable')
    expect(validateSectorMap(unreachable)).toContain('Unreachable room or dead end')
    let crossed=false
    for(let seed=0;seed<50 && !crossed;seed++) {
      const map=generateSectorMap(seed)
      for(let row=0;row<4 && !crossed;row++) for(const a of map.layers[row]!) for(const b of map.layers[row]!) {
        if(b.column!==a.column+1) continue
        const left=map.layers[row+1]!.find(n=>n.column===a.column),right=map.layers[row+1]!.find(n=>n.column===b.column)
        if(!left || !right) continue
        a.edges=[right.id];b.edges=[left.id];crossed=true
        expect(validateSectorMap(map)).toContain('Crossing edges')
        expect(inspectSectorRoutes(map).errors).toContain('crossing')
        break
      }
    }
    expect(crossed).toBe(true)
  })

  it('terminates for insufficient variant pools instead of relaxing uniqueness',()=>{
    const config=structuredClone(sectorOneConfig)
    config.normalPool=['old-mines-digger'];config.rows.forEach(r=>{if(r.encounters)r.encounters=['old-mines-digger']})
    expect(()=>generateSectorMap(42,config)).toThrow(/exhausted 128 attempts/)
  })

  it('namespaces coordinates, battle/reward streams, room decisions and portraits across sectors',()=>{
    const other={...sectorOneConfig,id:'test-other-sector'}
    const a=createSectorRun(42,gameEconomy,undefined,undefined,'two-sectors'), b=createSectorRun(42,gameEconomy,undefined,other,'two-sectors')
    const ids=new Set(a.map.layers.flat().map(n=>n.id))
    expect(b.map.layers.flat().every(n=>!ids.has(n.id))).toBe(true)
    const firstA=enterDungeonNode(a,a.map.startNodeIds[0]!),firstB=enterDungeonNode(b,b.map.startNodeIds[0]!)
    expect(firstA.battleEntry!.seed).not.toBe(firstB.battleEntry!.seed)
    const win=(run:DungeonRunState)=>{const s=restoreDungeonBattle(run);s.result='victory';return resolveDungeonBattle(run,s)}
    const rewardA=win(firstA).pendingReward!,rewardB=win(firstB).pendingReward!
    expect(rewardA.id).not.toBe(rewardB.id);expect(rewardA.seed).not.toBe(rewardB.seed)
    const roomA=createRoomVisit(a,a.map.layers.flat().find(n=>n.type==='forge')!)
    const roomB=createRoomVisit(b,b.map.layers.flat().find(n=>n.type==='forge')!)
    expect(roomA.id).not.toBe(roomB.id);expect(roomA.nodeId).not.toBe(roomB.nodeId)
    for(const scope of ['room-cards','room-replace:mage','event-outcome','artifact-reward']) expect(deriveDungeonSeed(a.seed,`${scope}:${roomA.nodeId}`)).not.toBe(deriveDungeonSeed(b.seed,`${scope}:${roomB.nodeId}`))
    expect(`room:${roomA.nodeId}`).not.toBe(`room:${roomB.nodeId}`)
    expect(resolveEnemyPortrait('old-mines-watchman/deadmines-old-mines/layer-1-column-1')).toEqual(resolveEnemyPortrait('old-mines-watchman'))
  })
})

describe('room review regressions',()=>{
  it('pays at exactly 4 HP, rejects 3 HP atomically and preserves the selected draft across reload',()=>{
    const run=createSectorScene('forgotten-forge'),id=run.deck[0]!.instanceId
    run.heroes.mage.health=4
    const draft=reload(selectRoom(run,run.room!.id,{action:'upgrade',instanceId:id,heroId:'mage'}))
    expect(draft.room!.selection).toEqual({action:'upgrade',instanceId:id,heroId:'mage'})
    const command={...draft.room!.selection!,roomId:draft.room!.id}
    const next=reload(resolveRoom(draft,command))
    expect(next.heroes.mage.health).toBe(1);expect(next.deck.find(c=>c.instanceId===id)!.upgrade).toBe(1)
    run.heroes.mage.health=3;const before=structuredClone(run)
    expect(()=>resolveRoom(run,command)).toThrow(/health/);expect(run).toEqual(before)
    expect(()=>resolveRoom(next,command)).toThrow()
  })

  it('allows risk at 3 HP, rejects 2 HP for either hero, and failure damages BOTH heroes once',()=>{
    const fixture=createSectorScene('powder-store')
    let failed=false
    for(let seed=0;seed<100 && !failed;seed++) {
      const run=structuredClone(fixture);run.seed=seed;run.room=createRoomVisit(run,run.map.layers.flat().find(n=>n.id===run.currentNodeId)!)
      if(run.room.riskSuccess)continue
      failed=true;run.heroes.warrior.health=run.heroes.mage.health=3
      const before=structuredClone(run), command={roomId:run.room.id,action:'risk' as const}, next=resolveRoom(run,command)
      expect(next.heroes.warrior.health).toBe(1);expect(next.heroes.mage.health).toBe(1);expect(next.deck).toEqual(run.deck)
      expect(run).toEqual(before);expect(()=>resolveRoom(next,command)).toThrow()
      for(const hero of ['warrior','mage'] as const) {const low=structuredClone(run);low.heroes[hero].health=2;expect(()=>resolveRoom(low,command)).toThrow(/kill/);expect(low.completedNodeIds).toEqual(run.completedNodeIds)}
    }
    expect(failed).toBe(true)
  })

  it('offers exactly 3 cards / 2 artifacts / 3 legal replacements, rejecting the hidden fourth',()=>{
    const run=createSectorScene('forge'),old=run.deck[0]!,room=run.room!
    expect(room.cards).toHaveLength(3);expect(room.artifactIds).toHaveLength(2)
    const options=roomReplacementOptions(run,old)
    expect(options).toHaveLength(3)
    options.forEach(c=>expect(cardDefinition(c.definitionId)).toMatchObject({reward:true,className:cardDefinition(old.definitionId).className}))
    const fourth=room.replacements[cardDefinition(old.definitionId).className].filter(c=>c.definitionId!==old.definitionId)[3]!
    expect(fourth).toBeDefined()
    expect(()=>resolveRoom(run,{roomId:room.id,action:'replace',instanceId:old.instanceId,cardId:fourth.definitionId})).toThrow()
    const next=reload(resolveRoom(run,{roomId:room.id,action:'replace',instanceId:old.instanceId,cardId:options[0]!.definitionId}))
    expect(next.deck[0]!.upgrade).toBe(0)
    expect(new Set(next.journal!.map(e=>e.nodeId)).size).toBe(next.journal!.length)
    expect(()=>validateRun({...next,journal:[...next.journal!,next.journal![next.journal!.length-1]!]})).toThrow()
  })

  it('respects exclusions and safely reduces or disables a scarce replacement pool',()=>{
    const run=createSectorScene('forge'),node=run.map.layers.flat().find(n=>n.id===run.currentNodeId)!,old=run.deck[0]!,className=cardDefinition(old.definitionId).className
    const pool=cards.filter(c=>c.reward && c.className===className)
    run.excludedRewards=pool.slice(1).map(c=>c.id);run.room=createRoomVisit(run,node)
    expect(roomReplacementOptions(run,old).map(c=>c.definitionId)).toEqual([pool[0]!.id])
    const other=run.room.replacements[className==='warrior'?'mage':'warrior'][0]!
    expect(()=>resolveRoom(run,{roomId:run.room!.id,action:'replace',instanceId:old.instanceId,cardId:other.definitionId})).toThrow()
    run.excludedRewards=pool.map(c=>c.id);run.room=createRoomVisit(run,node)
    expect(roomReplacementOptions(run,old)).toEqual([])
    expect(roomEligibleCards(run,'replace').some(c=>c.instanceId===old.instanceId)).toBe(false)
    expect(()=>resolveRoom(run,{roomId:run.room!.id,action:'replace',instanceId:old.instanceId,cardId:pool[0]!.id})).toThrow()
    run.excludedRewards=cards.filter(c=>c.reward).map(c=>c.id);run.room=createRoomVisit(run,node)
    expect(run.room.cards).toEqual([]);expect(run.room.riskCard).toBeNull()
    expect(roomActionAvailable(run,'replace')).toBe(false)
    expect(roomActionAvailable(run,'remove')).toBe(true)
    expect(reload(run).room).toEqual(run.room)
  })

  it('uses the existing PRNG first sample, has ~70% success and independent node outcomes',()=>{
    const run=createSectorRun(42),node=run.map.layers.flat().find(n=>n.type==='event')!
    let a=0,b=0,same=0
    for(let seed=0;seed<10000;seed++) {
      const fixture={...run,seed},left={...node,id:'deadmines-old-mines/layer-2-column-1'},right={...node,id:'deadmines-old-mines/layer-2-column-3'}
      const x=createRoomVisit(fixture,left).riskSuccess,y=createRoomVisit(fixture,right).riskSuccess
      expect(x).toBe(nextRandom({rngState:deriveDungeonSeed(seed,`event-outcome:${left.id}`)})<0.7)
      a+=Number(x);b+=Number(y);same+=Number(x===y)
    }
    expect(a/10000).toBeGreaterThan(0.68);expect(a/10000).toBeLessThan(0.72)
    expect(b/10000).toBeGreaterThan(0.68);expect(b/10000).toBeLessThan(0.72)
    expect(same/10000).toBeGreaterThan(0.55);expect(same/10000).toBeLessThan(0.61)
    const room=createSectorScene('powder-store')
    expect(reload(room).room).toEqual(room.room)
  },30000)

  it('renders distinct base/upgraded copies, their resolved effects and explicit loss warnings before confirmation',async()=>{
    const run=createSectorScene('forge');run.deck[0]!.upgrade=1
    for(const action of ['remove','replace'] as const) {
      run.room!.selection={action,instanceId:run.deck[0]!.instanceId}
      const html=await renderToString(createSSRApp(DungeonRoom,{run}))
      expect(html).toContain('↑');expect(html).toContain('Улучшена');expect(html).toContain('Без улучшения')
      expect(html).toContain('Копия 1');expect(html).toContain('Копия 2')
      expect(html).toContain(action==='remove'?'Вы удаляете улучшенную копию':'При замене улучшение будет потеряно')
      expect(html).toContain('Удар мечом');expect(html).toContain('confirmation-summary')
    }
  })

  it('renders the named payer and HP delta in the modal and confirmation button',async()=>{
    const run=createSectorScene('forgotten-forge');run.heroes.mage.health=4
    run.room!.selection={action:'upgrade',heroId:'mage',instanceId:run.deck[0]!.instanceId}
    const html=await renderToString(createSSRApp(DungeonRoom,{run}))
    expect(html.match(/Платит Джайна Праудмур: 4 → 1 HP/g)?.length).toBe(2)
  })

  it('classifies old/missing room contracts as incompatible and preserves both original records without rollback',()=>{
    const current=createSectorScene('powder-store'),raw=encodeSnapshot(current,gameEconomy,1)
    expect(decodeSnapshot(raw).roomRulesVersion).toBe(ROOM_RULES_VERSION)
    for(const version of ['sector-rooms-future',undefined]) {
      const envelope=JSON.parse(raw)
      if(version)envelope.payload.roomRulesVersion=version;else delete envelope.payload.roomRulesVersion
      // A valid checksum with an old contract must be classified before content regeneration.
      envelope.payload.run.room.cards=[]
      const incompatible=sealed(envelope.payload)
      expect(()=>decodeSnapshot(incompatible)).toThrow(IncompatibleSave)
      const data=new Map([[RUN_SAVE_KEY,incompatible],[RUN_SAVE_KEY+'.backup',raw]])
      const store=createRunSaveStore(()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value)}}))
      const before=new Map(data),loaded=store.load()
      expect(loaded.blocked).toBe(true);expect(loaded.snapshot).toBeNull();expect(loaded.message).toContain('правил комнат')
      expect(data).toEqual(before);expect(JSON.parse(store.exportSnapshot()).records).toEqual([{key:RUN_SAVE_KEY,raw:incompatible},{key:RUN_SAVE_KEY+'.backup',raw}])
    }
    expect(reload(createDungeonRun(42)).map.layers).toHaveLength(7)
  })
})
