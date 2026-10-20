import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const args=process.argv.slice(2), flag=(name, fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback
const phase=flag('--phase','structure'), count=Number(flag('--runs',phase==='structure'?10000:300)), base=Number(flag('--seed',42))>>>0
if (!Number.isSafeInteger(count)||count<1) throw Error('Invalid run count')
const output='docs/data/deadmines-sector-one-v1'
await mkdir(output,{recursive:true})
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'})
try {
  const load=p=>server.ssrLoadModule('/src/game/'+p+'.ts')
  const [gen,camp,rooms,content,rules,balance,planner,types,economy,policy,progression,save,control]=await Promise.all(['dungeonGenerator','campaign','dungeonRooms','sectorContent','battle','balance','balancePlanner','types','economy','dungeonRoutePolicy','cardProgression','runSave','encountersV10'].map(load))
  const decks={18:types.startingDeck,14:['sword-strike','sword-strike','fireball','guard','guard','parry','shield-bash','interpose','frostbolt','frostbolt','arcane-insight','ice-ward','ice-ward','thunderbolt']}
  decks[16]=[...decks[14],'parry','arcane-insight']
  const manifest={studyVersion:1,phase,count,base,information:'public',economy:economy.gameEconomy,config:gen.sectorOneConfig,decks,limits:{turns:30,playsPerTurn:20},routePolicy:'chooseDungeonRouteNode(publicDungeonNodeView(available), current heroes, policy)',reward:'first seeded offered card; elite artifact in first free slot, otherwise first card; skip ordinary at deck size >=21',roomPolicy:{safe:'remove, safe powder card',mixed:'upgrade, paid upgrade if safe, trade replacement, powder risk if safe',risky:'replace, paid upgrade, trade replacement, powder risk if safe'},rest:'heal lowest health fraction under 65%; otherwise upgrade first eligible copy',planner:phase.includes('planner')?{runs:count}:null}
  function fight(state,strategy) {
    const plan=strategy==='planner'?planner.createTurnPlanner():null
    const entry={warrior:state.heroes.warrior.health,mage:state.heroes.mage.health}
    let turns=0, plays=0, prepared=0, defense=0, offense=0
    while(!state.result && turns<30) {
      turns++
      const declared=structuredClone(state.enemy.nextAction)
      if(declared.kind==='prepare') prepared++
      for(let p=0;p<20&&!state.result;p++) {
        const id=plan?plan.next(state):balance.chooseCard(state,strategy,'public')?.instanceId
        if(!id) break
        const copy=state.hand.find(c=>c.instanceId===id), preview=rules.previewCard(state,progression.resolveCardDefinition(copy))
        defense+=Object.values(preview.armor).reduce((s,v)=>s+v,0);offense+=preview.healthDamage
        if(!rules.playCard(state,id).ok) throw Error('Illegal bot play')
        plays++
      }
      // Phase changes and card effects must leave the declared action intact until execution.
      if(JSON.stringify(state.enemy.nextAction)!==JSON.stringify(declared)) throw Error('Declared intent mutated by player turn')
      if(!state.result) {
        rules.endTurn(state)
        if(declared.kind==='prepare' && !state.result && JSON.stringify(state.enemy.nextAction)!==JSON.stringify(declared.prepared)) throw Error('Prepared target changed')
      }
    }
    return {result:state.result??'timeout',turns,plays,prepared,defense,offense,warrior:state.heroes.warrior.health,mage:state.heroes.mage.health,lossWarrior:entry.warrior-state.heroes.warrior.health,lossMage:entry.mage-state.heroes.mage.health}
  }
  const average=(rows,key)=>+(rows.reduce((s,r)=>s+(r[key]??0),0)/rows.length).toFixed(3)
  const summarize=rows=>({n:rows.length,winRate:+(100*rows.filter(r=>['victory','sector-complete'].includes(r.result)).length/rows.length).toFixed(2),...Object.fromEntries(['turns','warrior','mage','lossWarrior','lossMage','plays','prepared','defense','offense','battles','elites','gained','skipped','upgrades','upgradedGained','finalUpgraded','removed','replaced','forges','events','fightTurns'].filter(k=>rows.some(r=>Object.hasOwn(r,k))).map(k=>[k,average(rows,k)])),timeouts:rows.filter(r=>r.result==='timeout').length})
  const rows=[],summaries=[]
  if(phase==='structure') {
    const longer=structuredClone(gen.sectorOneConfig);longer.id='test-seven-visits';longer.rows.splice(3,0,{types:['battle']});longer.maxBattles=5
    for(const config of [gen.sectorOneConfig,longer]) {
      const profiles=new Set(),topologies=new Set(),typesCount={},attempts={},data=[]
      for(let i=0;i<count+2;i++) {
        const seed=i===count?0xffffffff:i===count+1?0x80000000:(base+i)>>>0
        const map=gen.generateSectorMap(seed,config),errors=gen.validateSectorMap(map)
        if(errors.length) throw Error(JSON.stringify({seed,errors}))
        const paths=gen.sectorPaths(map),sequences=new Set(paths.map(p=>p.map(n=>n.type).join('>'))),elite=paths.filter(p=>p.some(n=>n.type==='elite')).length
        map.layers.flat().forEach(n=>{typesCount[n.type]=(typesCount[n.type]??0)+1})
        const profile=[...sequences].sort().join('|');profiles.add(profile)
        topologies.add(map.layers.flat().map(n=>n.id+':'+n.edges.join()).join('|'))
        attempts[map.generation.attempts]=(attempts[map.generation.attempts]??0)+1
        data.push({seed,paths:paths.length,sequences:sequences.size,eliteFraction:elite/paths.length,forgeFraction:paths.filter(p=>p.some(n=>n.type==='forge')).length/paths.length,eventFraction:paths.filter(p=>p.some(n=>n.type==='event')).length/paths.length,developmentFraction:paths.filter(p=>p.some(n=>n.type==='forge'||n.type==='event')).length/paths.length,attempts:map.generation.attempts,fallback:map.generation.fallback})
        // Real offers and unfinished services must validate and round-trip, not just room glyphs.
        if(i<1000 && config===gen.sectorOneConfig) {
          const run=camp.createSectorRun(seed,economy.gameEconomy,undefined,config,'structure-'+seed)
          for(const n of run.map.layers.flat().filter(n=>['forge','treasure','event'].includes(n.type))) {
            const visit=rooms.createRoomVisit(run,n)
            if(visit.cards.length!==3||visit.artifactIds.length!==2||visit.replacements.mage.length!==4||visit.replacements.warrior.length!==4) throw Error('Empty room payload')
          }
        }
        if(i>0&&i%2000===0) console.log(config.id,i)
      }
      summaries.push({config:config.id,n:data.length,violations:0,fallbacks:0,attempts,topologies:topologies.size,profileSets:profiles.size,typesCount,avgPaths:average(data,'paths'),avgSequences:average(data,'sequences'),elitePathFraction:average(data,'eliteFraction'),forgePathFraction:average(data,'forgeFraction'),eventPathFraction:average(data,'eventFraction'),developmentPathFraction:average(data,'developmentFraction'),minimumSequences:Math.min(...data.map(r=>r.sequences)),stageOne:data.slice(0,1000).length})
      rows.push(...data.map(r=>({...r,config:config.id})))
    }
  } else if(phase==='items') {
    const loadouts={wedge:[['reliable-wedge','mage']],pulley:[['double-pulley','warrior']],lens:[['weakpoint-lens','mage']],whistle:[['shift-whistle','warrior']],spool:[['tension-spool','mage']],pulleySpool:[['double-pulley','warrior'],['tension-spool','mage']],wedgeWhistle:[['reliable-wedge','mage'],['shift-whistle','warrior']]}
    manifest.loadouts=loadouts
    for(const encounter of [content.sectorOneElite,content.rhahkZor]) for(const strategy of ['aggressive','balanced','defensive']) for(const [loadout,items] of Object.entries(loadouts)) {
      const group=[]
      for(let i=0;i<count;i++) {
        const seed=(base+i)>>>0,heroes=camp.createCampaignBattle({seed,battleId:'items'}).heroes
        const state=camp.createCampaignBattle({encounter,heroes,seed,deck:decks[18],battleId:'items',artifacts:items.map(([definitionId,owner],index)=>({instanceId:'item-'+index,definitionId,ownerInstanceId:heroes[owner].instanceId}))})
        group.push({seed,deck:'18',encounter:encounter.id,strategy,loadout,...fight(state,strategy)})
      }
      summaries.push({encounter:encounter.id,strategy,loadout,...summarize(group)});rows.push(...group)
    }
  } else if(phase==='enemies'||phase==='planner') {
    const strategies=phase==='planner'?['planner']:['aggressive','balanced','defensive']
    const encounters=[...content.sectorEncounters,...control.normalEncounterCatalogV10.slice(0,2),control.finalEncounterV10]
    for(const [deckName,deck] of Object.entries(decks)) for(const encounter of encounters) for(const strategy of strategies) {
      const group=[]
      for(let i=0;i<count;i++) {
        const seed=(base+i)>>>0
        const state=camp.createCampaignBattle({encounter,deck,seed,economy:economy.gameEconomy,battleId:'study'})
        group.push({seed,deck:deckName,encounter:encounter.id,strategy,...fight(state,strategy)})
      }
      summaries.push({deck:deckName,encounter:encounter.id,strategy,...summarize(group)});rows.push(...group)
      console.log(encounter.id,deckName,strategy,summaries.at(-1).winRate)
    }
  } else if(phase==='routes'||phase==='planner-routes') {
    for(const [deckName,deck] of Object.entries(decks)) for(const policyName of ['safe','mixed','risky']) for(const strategy of phase==='planner-routes'?['planner']:['balanced','defensive']) {
      const group=[]
      for(let i=0;i<count;i++) {
        const seed=(base+i)>>>0
        let run=camp.createSectorRun(seed,economy.gameEconomy,deck,undefined,'route-'+seed), turns=0,battles=0,elites=0,forges=0,events=0
        const route=[]
        while(run.status==='active') {
          const choices=camp.availableDungeonNodes(run).map(policy.publicDungeonNodeView)
          const node=policy.chooseDungeonRouteNode(choices,run.heroes,policyName)
          if(!node) throw Error('Stuck route')
          run=camp.enterDungeonNode(run,node.id);route.push(node.type)
          if(run.room) {
            const room=run.room;forges+=Number(node.type==='forge');events+=Number(node.type==='event')
            let action=room.type==='treasure'?'artifact':room.type==='forge'?(policyName==='safe'?'remove':policyName==='risky'?'replace':'upgrade'):room.eventId==='powder-store'?(policyName==='safe'?'card':'risk'):room.eventId==='goblin-trade'?(policyName==='safe'?'remove':'replace'):(policyName==='safe'?'remove':'upgrade')
            let heroId=['warrior','mage'].sort((a,b)=>run.heroes[b].health-run.heroes[a].health)[0]
            if(action==='risk' && Object.values(run.heroes).some(h=>h.health<=2)) action='card'
            if(action==='upgrade'&&room.eventId==='forgotten-forge'&&run.heroes[heroId].health<=3) action='remove'
            const target=rooms.roomEligibleCards(run,action)[0]
            if(['remove','replace','upgrade'].includes(action)&&!target) action='leave'
            const replacement=target?room.replacements[types.cardDefinition(target.definitionId).className].find(c=>c.definitionId!==target.definitionId):undefined
            const owner=['warrior','mage'].find(id=>!run.artifacts.some(a=>a.ownerInstanceId===run.heroes[id].instanceId))
            if(action==='artifact'&&!owner) action='card'
            run=rooms.resolveRoom(run,{roomId:room.id,action,instanceId:target?.instanceId,cardId:action==='replace'?replacement?.definitionId:room.cards[0].definitionId,heroId:action==='artifact'?owner:heroId,artifactId:room.artifactIds[0]})
          } else if(node.type==='rest') {
            const injured=['warrior','mage'].sort((a,b)=>run.heroes[a].health/run.heroes[a].maxHealth-run.heroes[b].health/run.heroes[b].maxHealth)[0]
            const copy=run.deck.find(progression.canUpgradeCard)
            run=run.heroes[injured].health/run.heroes[injured].maxHealth<.65?camp.resolveDungeonRest(run,injured):copy?camp.upgradeDungeonRest(run,copy.instanceId,run.runId+'/'+node.id):camp.resolveDungeonRest(run,null)
          } else {
            const state=camp.restoreDungeonBattle(run,economy.gameEconomy,'study'), outcome=fight(state,strategy)
            if(!state.result) throw Error('Route battle timed out')
            turns+=outcome.turns;battles++;elites+=Number(node.type==='elite')
            run=camp.resolveDungeonBattle(run,state)
          }
          if(run.pendingReward) {
            const offer=run.pendingReward,owner=['warrior','mage'].find(id=>!run.artifacts.some(a=>a.ownerInstanceId===run.heroes[id].instanceId))
            if(offer.elite&&owner) run=camp.claimDungeonArtifact(run,offer.artifactIds[0],run.heroes[owner].instanceId)
            else if(!offer.elite&&run.deck.length>=21) run=camp.skipDungeonReward(run,offer.id)
            else run=camp.claimDungeonReward(run,camp.dungeonRewardOptions(run)[0])
          }
          save.validateRun(run)
        }
        const j=run.journal
        group.push({seed,deck:deckName,policy:policyName,strategy,result:run.status,turns,battles,elites,forges,events,route:route.join('>'),warrior:run.heroes.warrior.health,mage:run.heroes.mage.health,gained:j.filter(x=>x.kind==='reward'&&x.card||x.kind==='card'||x.kind==='risk'&&x.card).length,skipped:j.filter(x=>x.kind==='skip').length,upgrades:j.filter(x=>x.kind==='upgrade').length,upgradedGained:j.filter(x=>x.kind==='risk'&&x.card?.upgrade).length,finalUpgraded:run.deck.filter(c=>c.upgrade===1).length,removed:j.filter(x=>x.kind==='remove').length,replaced:j.filter(x=>x.kind==='replace').length,fightTurns:turns/battles,finalDeck:run.deck.map(c=>({definitionId:c.definitionId,upgrade:c.upgrade})),journal:j})
      }
      summaries.push({deck:deckName,policy:policyName,strategy,...summarize(group)});rows.push(...group)
      console.log('routes',deckName,policyName,strategy,summaries.at(-1).winRate)
    }
  } else throw Error('Unknown phase')
  await writeFile(`${output}/${phase}-${count}-manifest.json`,JSON.stringify(manifest,null,2)+'\n')
  await writeFile(`${output}/${phase}-${count}.json`,JSON.stringify(summaries,null,2)+'\n')
  await writeFile(`${output}/${phase}-${count}.jsonl.gz`,gzipSync(rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{mtime:0}))
  console.table(summaries)
} finally {await server.close()}
