// Crossed candidate-template x size x opening-hand experiment, plus literal current controls.
// Size interventions add named cards; no claim of an abstract composition-free size effect.
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { dungeonRewardRank } from '../../scripts/lib/dungeonRewardRank.mjs'

const out=resolve('docs/data/gdd-v2/controlled-start')
mkdirSync(out,{recursive:true})
const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'})
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null
const summarize=list=>({n:list.length,wins:list.filter(x=>x.result==='victory').length,timeouts:list.filter(x=>x.result==='timeout').length,...Object.fromEntries(['turns','lostW','lostM','spent','available','handStart','starved','blocked','vulnerability','maxManaReached'].map(k=>[k,avg(list.map(x=>x[k]))]))})
try {
  const load=p=>server.ssrLoadModule('/src/game/'+p+'.ts')
  const [t,b,ai,p,c,e,r,route]=await Promise.all(['types','battle','balance','balancePlanner','campaign','economy','encountersV10','dungeonRoutePolicy'].map(load))
  const cores={
    C:['sword-strike','sword-strike','fireball','guard','guard','parry','shield-bash','interpose','frostbolt','frostbolt','arcane-insight','ice-ward','ice-ward','thunderbolt'],
    L:['sword-strike','sword-strike','guard','guard','shield-bash','shield-bash','interpose','fireball','fireball','frostbolt','frostbolt','ice-ward','ice-ward','arcane-insight'],
  }
  const configs=[]
  for(const [template,core] of Object.entries(cores))for(const size of [14,16,18])for(const hand of [7,8]) {
    const deck=[...core,...(size>=16?['parry','arcane-insight']:[]),...(size>=18?['guard','ice-ward']:[])]
    if(deck.length!==size)throw Error('Size')
    const classes=Object.fromEntries(['warrior','mage'].map(id=>[id,deck.filter(card=>t.cardDefinition(card).className===id).length]))
    configs.push({id:`${template}${size}/h${hand}`,template,size,hand,classes,deck})
  }
  for(const hand of [7,8])configs.push({id:`current18/h${hand}`,template:'current',size:18,hand,deck:[...t.startingDeck]})
  const roster=r.defaultDungeonRoster
  const enemies=[...roster.normal,...roster.elite,roster.final]
  function fight(state,strategy) {
    const planner=strategy==='planner'?p.createTurnPlanner():null
    const start={w:state.heroes.warrior.health,m:state.heroes.mage.health}
    let turns=0,spent=0,available=0,handStart=0,starved=0,vulnerability=0,maxManaReached=0
    while(!state.result&&turns<40) {
      turns++;available+=state.maxMana;handStart+=state.hand.length;starved+=Number(state.hand.length<=2);maxManaReached=Math.max(maxManaReached,Number(state.maxMana===5))
      for(let plays=0;plays<24&&!state.result;plays++) {
        const id=planner?planner.next(state):ai.chooseCard(state,strategy,'public')?.instanceId
        if(!id)break
        const card=state.hand.find(x=>x.instanceId===id)
        const preview=b.previewCard(state,t.cardDefinition(card.definitionId));const before=state.mana
        if(!b.playCard(state,id).ok)throw Error('Play failed')
        spent+=before-state.mana;vulnerability+=Number(preview.vulnerabilityBonus>0)
      }
      if(!state.result)b.endTurn(state)
    }
    return {result:state.result??'timeout',turns,spent,available,handStart:handStart/turns,starved:starved/turns,blocked:state.blockedDraws,vulnerability,maxManaReached,lostW:start.w-state.heroes.warrior.health,lostM:start.m-state.heroes.mage.health}
  }
  const ranges=[{seed:210000,runs:128,plannerRuns:16},{seed:310000,runs:128,plannerRuns:16}]
  const rows=[]
  for(const range of ranges)for(const config of configs) {
    for(const strategy of ['balanced','defensive','planner'])for(const enemy of enemies) {
      const list=[]
      for(let i=0;i<(strategy==='planner'?range.plannerRuns:range.runs);i++)list.push(fight(b.createBattle(enemy,undefined,{deck:config.deck,openingHandSize:config.hand,seed:range.seed+i,economy:e.gameEconomy}),strategy))
      rows.push({range:range.seed,config:config.id,strategy,enemy:enemy.id,group:roster.normal.includes(enemy)?'normal':roster.elite.includes(enemy)?'elite':'boss',...summarize(list)})
    }
    console.log('Factorial',range.seed,config.id)
  }
  writeFileSync(resolve(out,'battles.json'),JSON.stringify({metadata:{revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),ranges,economy:'B',roster:'v10',information:'public',fullHealth:true,artifacts:false,manaMetric:'Sum of available/spent mana over every started turn, including the winning turn',caution:'Size intervention = named extra cards. Main and interaction contrasts describe these templates only.'},configs,rows},null,2))
  const routeConfigs=configs.filter(x=>['current18/h8','C16/h8','C14/h8','C14/h7','L14/h8','L14/h7'].includes(x.id))
  const routeRows=[],csv=['range,seed,config,strategy,policy,result,fights,elites,rests,deck,finalW,finalM']
  for(const range of ranges)for(const config of routeConfigs)for(const strategy of ['balanced','defensive'])for(const policy of ['safe','mixed','risky']) {
    const list=[]
    for(let i=0;i<range.runs;i++) {
      const seed=range.seed+i
      let run=c.createDungeonRun(seed,e.gameEconomy,config.deck,roster),fights=0,elites=0,rests=0
      while(run.status==='active') {
        const nodes=c.availableDungeonNodes(run),v=route.chooseDungeonRouteNode(nodes.map(route.publicDungeonNodeView),run.heroes,policy),node=nodes.find(n=>n.id===v.id)
        run=c.enterDungeonNode(run,node.id)
        if(node.type==='rest') {
          const id=['warrior','mage'].sort((a,b)=>run.heroes[a].health/run.heroes[a].maxHealth-run.heroes[b].health/run.heroes[b].maxHealth)[0]
          run=c.resolveDungeonRest(run,run.heroes[id].health<run.heroes[id].maxHealth?id:null);rests++;continue
        }
        const state=b.createBattle(c.dungeonEncounter(node,e.gameEconomy,roster),run.heroes,{deck:run.deck,openingHandSize:config.hand,seed:c.deriveDungeonSeed(seed,`battle:${node.id}`),economy:e.gameEconomy,artifacts:run.artifacts})
        const outcome=fight(state,strategy);if(outcome.result==='timeout')throw Error('Route timeout')
        fights++;elites+=Number(node.type==='elite');run=c.resolveDungeonBattle(run,state)
        if(run.pendingReward) {
          const weights={'reliable-wedge':6,'double-pulley':5,'shift-whistle':4,'weakpoint-lens':3,'tension-spool':2}
          const artifact=c.dungeonArtifactOptions(run).sort((a,b)=>weights[b.id]-weights[a.id])[0]
          if(artifact&&run.artifacts.length<2) {
            const pref=artifact.id==='double-pulley'?'warrior':'mage'
            const owner=[pref,pref==='warrior'?'mage':'warrior'].map(id=>run.heroes[id]).find(h=>!run.artifacts.some(a=>a.ownerInstanceId===h.instanceId))
            run=c.claimDungeonArtifact(run,artifact.id,owner.instanceId)
          }else {
            const rank=id=>({rend:6.5,'reaping-blow':5.5,'boil-blood':4.5}[id]??dungeonRewardRank(id,strategy))
            run=c.claimDungeonReward(run,c.dungeonRewardOptions(run).sort((a,b)=>rank(b.id)-rank(a.id))[0])
          }
        }
      }
      const sample={result:run.status,fights,elites,rests,deck:run.deck.length}
      list.push(sample);csv.push([range.seed,seed,config.id,strategy,policy,run.status,fights,elites,rests,run.deck.length,run.heroes.warrior.health,run.heroes.mage.health].join(','))
    }
    routeRows.push({range:range.seed,config:config.id,strategy,policy,n:list.length,wins:list.filter(x=>x.result==='victory').length,...Object.fromEntries(['fights','elites','rests','deck'].map(k=>[k,avg(list.map(x=>x[k]))]))})
  }
  writeFileSync(resolve(out,'runs.json'),JSON.stringify({metadata:{ranges,warning:'Current seven-node campaign only; fixed artifact-first rank and public route policies; no gold, upgrades or new healing.'},rows:routeRows},null,2))
  writeFileSync(resolve(out,'run-samples.csv'),csv.join('\n')+'\n')
  writeFileSync(resolve(out,'counts.json'),JSON.stringify({isolatedBattles:rows.reduce((s,r)=>s+r.n,0),currentRuns:routeRows.reduce((s,r)=>s+r.n,0),routeBattles:routeRows.reduce((s,r)=>s+r.n*r.fights,0)},null,2))
} finally {await server.close()}
