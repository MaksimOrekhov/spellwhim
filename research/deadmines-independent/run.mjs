// Isolated, reproducible research. Imports the game; never writes game source or controls.
// node research/deadmines-independent/run.mjs [--runs 300] [--planner-runs 40] [--maps 1000]
// Optional --seed-base and --output provide an independent holdout without replacing main results.
import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { dungeonRewardRank } from '../../scripts/lib/dungeonRewardRank.mjs'

const args = process.argv.slice(2)
const opt = (key, fallback) => args.includes(key) ? Number(args[args.indexOf(key) + 1]) : fallback
const runs = opt('--runs', 300), plannerRuns = opt('--planner-runs', 40), mapRuns = opt('--maps', 1000)
const seedBase = opt('--seed-base', 42100)
const out = resolve(args.includes('--output') ? args[args.indexOf('--output')+1] : 'docs/data/deadmines-independent-2026-10-19')
mkdirSync(out, { recursive: true })
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
const mean = values => values.length ? values.reduce((a,b) => a+b, 0)/values.length : null
const quant = (values, p) => [...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)] ?? null
const countBy = values => values.reduce((a,b) => (a[b]=(a[b]??0)+1,a), {})
const wilson = (wins,n) => { const z=1.96, p=wins/n, d=1+z*z/n, c=(p+z*z/(2*n))/d, h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d; return [c-h,c+h] }
const comb = (n,k) => { if(k<0||k>n)return 0; let r=1; for(let j=1;j<=k;j++)r=r*(n-j+1)/j; return r }
const present = (n,k,h) => 1-comb(n-k,h)/comb(n,h)
const both = (n,a,b,h) => 1-comb(n-a,h)/comb(n,h)-comb(n-b,h)/comb(n,h)+comb(n-a-b,h)/comb(n,h)
function rng(seed) { let s=seed>>>0; return () => {s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296} }
function shuffled(values,r) {const a=[...values];for(let i=a.length-1;i>0;i--){let j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

try {
  const load = p => server.ssrLoadModule('/src/game/'+p+'.ts')
  const [types,battle,balance,planner,campaign,economy,rosterMod,route] = await Promise.all(['types','battle','balance','balancePlanner','campaign','economy','encountersV10','dungeonRoutePolicy'].map(load))
  const roster=rosterMod.defaultDungeonRoster
  const base14=['sword-strike','sword-strike','fireball','guard','guard','parry','shield-bash','interpose','frostbolt','frostbolt','arcane-insight','ice-ward','ice-ward','thunderbolt']
  const decks={
    current18:types.startingDeck,
    compact16:[...types.startingDeck.filter((id,i,a)=>!(['fireball','arcane-insight'].includes(id)&&a.indexOf(id)===i))],
    compact14:base14,
    compact12:base14.filter((id,i,a)=>id!=='arcane-insight'&&!(id==='ice-ward'&&a.indexOf(id)===i)),
    compact10:['sword-strike','fireball','guard','parry','shield-bash','interpose','frostbolt','arcane-insight','ice-ward','thunderbolt'],
  }
  const configs=[{id:'18/h8',deck:'current18',hand:8},{id:'16/h8',deck:'compact16',hand:8},{id:'14/h8',deck:'compact14',hand:8},{id:'14/h7',deck:'compact14',hand:7},{id:'12/h8',deck:'compact12',hand:8},{id:'12/h6',deck:'compact12',hand:6},{id:'10/h6',deck:'compact10',hand:6}]
  function fight(state,strategy) {
    const p=strategy==='planner'?planner.createTurnPlanner():null
    let turns=0, plays=0, reshuffles=0, blocked=0, vulnerability=0, bonus=0
    let openingDefense=state.hand.some(c=>types.cardDefinition(c.definitionId).effects.some(e=>e.type==='armor'))
    const initial={warrior:state.heroes.warrior.health,mage:state.heroes.mage.health}
    let previousPile=state.drawPile.length
    while(!state.result&&turns<32) {
      turns++
      let actions=0
      while(!state.result&&actions<24) {
        const id=p?p.next(state):balance.chooseCard(state,strategy,'public')?.instanceId
        if(!id)break
        const card=state.hand.find(c=>c.instanceId===id)
        const preview=battle.previewCard(state,types.cardDefinition(card.definitionId))
        if(!battle.playCard(state,id).ok)throw new Error('Invalid play')
        vulnerability+=Number(preview.vulnerabilityBonus>0);bonus+=Number(preview.armorBonus>0)
        if(state.drawPile.length>previousPile)reshuffles++
        previousPile=state.drawPile.length;plays++;actions++
      }
      if(state.result)break
      battle.endTurn(state)
      if(state.drawPile.length>previousPile)reshuffles++
      previousPile=state.drawPile.length
    }
    blocked=state.blockedDraws
    return {result:state.result??'timeout',turns,plays,blocked,reshuffles,openingDefense,vulnerability,bonus,
      lostWarrior:initial.warrior-state.heroes.warrior.health,lostMage:initial.mage-state.heroes.mage.health,
      plannerPlans:p?.stats.plans??0,plannerTruncated:p?.stats.truncated??0}
  }
  function summary(samples) {
    const wins=samples.filter(s=>s.result==='victory').length,n=samples.length
    return {n,wins,winRate:wins/n,win95:wilson(wins,n),timeouts:samples.filter(s=>s.result==='timeout').length,
      ...Object.fromEntries(['turns','plays','blocked','reshuffles','vulnerability','bonus','lostWarrior','lostMage','plannerPlans','plannerTruncated'].map(k=>[k,mean(samples.map(s=>s[k]))])),
      noLoss:samples.filter(s=>s.lostWarrior+s.lostMage===0).length/n,
      loss90:quant(samples.map(s=>s.lostWarrior+s.lostMage),0.9)}
  }
  const encounters=[...roster.normal,...roster.elite,roster.final]
  const battleRows=[]
  for(const config of configs) {
    for(const strategy of ['aggressive','balanced','defensive','planner']) {
      // Planner subset is still paired across every deck and every encounter.
      const n=strategy==='planner'?plannerRuns:runs
      if(!n)continue
      for(const encounter of encounters) {
        const samples=[]
        for(let i=0;i<n;i++) {
          const state=battle.createBattle(encounter,undefined,{seed:seedBase+i,deck:decks[config.deck],openingHandSize:config.hand,economy:economy.gameEconomy})
          samples.push(fight(state,strategy))
        }
        battleRows.push({config:config.id,encounter:encounter.id,kind:roster.normal.includes(encounter)?'normal':roster.elite.includes(encounter)?'elite':'boss',strategy,...summary(samples)})
      }
    }
    console.log('Isolated fights:',config.id)
  }
  writeFileSync(resolve(out,'battles.json'),JSON.stringify({metadata:{seedBase,runs,plannerRuns,information:'public',economy:'B',roster:'v10',fullHealthEveryFight:true,artifactMode:'none',limits:{turns:32,playsPerTurn:24},reshuffleMetric:'draw-pile increases; diagnostic proxy, can miss a shuffle fully drawn at once'},decks,configs,rows:battleRows},null,2))

  const routeRows=[]
  for(const config of configs.filter(c=>['18/h8','14/h8','14/h7','12/h6'].includes(c.id))) {
    for(const strategy of ['balanced','defensive']) for(const policy of ['safe','mixed','risky']) {
      const samples=[]
      for(let i=0;i<runs;i++) {
        const seed=seedBase+i
        let run=campaign.createDungeonRun(seed,economy.gameEconomy,decks[config.deck],roster)
        let fights=0,elites=0,rests=0,healed=0,offers=0
        let bossEntry=null, fallen=null
        while(run.status==='active') {
          const available=campaign.availableDungeonNodes(run)
          const selected=route.chooseDungeonRouteNode(available.map(route.publicDungeonNodeView),run.heroes,policy)
          if(!selected)throw new Error('Stuck run')
          const node=available.find(n=>n.id===selected.id)
          run=campaign.enterDungeonNode(run,node.id)
          if(node.type==='rest') {
            const id=['warrior','mage'].sort((a,b)=>run.heroes[a].health/run.heroes[a].maxHealth-run.heroes[b].health/run.heroes[b].maxHealth)[0]
            const before=run.heroes[id].health
            run=campaign.resolveDungeonRest(run,before<run.heroes[id].maxHealth?id:null)
            healed+=run.heroes[id].health-before;rests++;continue
          }
          if(node.type==='final')bossEntry={warrior:run.heroes.warrior.health,mage:run.heroes.mage.health}
          const state=battle.createBattle(campaign.dungeonEncounter(node,economy.gameEconomy,roster),run.heroes,{deck:run.deck,seed:campaign.deriveDungeonSeed(seed,`battle:${node.id}`),economy:economy.gameEconomy,openingHandSize:config.hand,artifacts:run.artifacts})
          const result=fight(state,strategy)
          if(result.result==='timeout')throw new Error('Route timeout')
          fights++;elites+=Number(node.type==='elite')
          if(state.result==='defeat')fallen=['warrior','mage'].filter(id=>state.heroes[id].health<=0).join('+')
          run=campaign.resolveDungeonBattle(run,state)
          if(run.pendingReward) {
            offers++
            // Explicit fixed research policy: take an artifact until both slots are filled, then a ranked card.
            const art=campaign.dungeonArtifactOptions(run).sort((a,b)=>({'reliable-wedge':6,'double-pulley':5,'shift-whistle':4,'weakpoint-lens':3,'tension-spool':2}[b.id]-{'reliable-wedge':6,'double-pulley':5,'shift-whistle':4,'weakpoint-lens':3,'tension-spool':2}[a.id]))[0]
            if(art&&run.artifacts.length<2) {
              const preferred=art.id==='double-pulley'?'warrior':'mage'
              const owner=[preferred,preferred==='mage'?'warrior':'mage'].map(id=>run.heroes[id]).find(h=>!run.artifacts.some(a=>a.ownerInstanceId===h.instanceId))
              run=campaign.claimDungeonArtifact(run,art.id,owner.instanceId)
            } else {
              const rank=id=>({rend:6.5,'reaping-blow':5.5,'boil-blood':4.5}[id]??dungeonRewardRank(id,strategy))
              const card=campaign.dungeonRewardOptions(run).sort((a,b)=>rank(b.id)-rank(a.id))[0]
              run=campaign.claimDungeonReward(run,card)
            }
          }
        }
        samples.push({seed,result:run.status,fights,elites,rests,healed,offers,deck:run.deck.length,bossEntry,fallen,final:{warrior:run.heroes.warrior.health,mage:run.heroes.mage.health}})
      }
      const wins=samples.filter(s=>s.result==='victory').length
      routeRows.push({config:config.id,strategy,policy,n:runs,wins,winRate:wins/runs,win95:wilson(wins,runs),fights:mean(samples.map(s=>s.fights)),elites:mean(samples.map(s=>s.elites)),rests:mean(samples.map(s=>s.rests)),healed:mean(samples.map(s=>s.healed)),deck:mean(samples.map(s=>s.deck)),fallen:countBy(samples.map(s=>s.fallen??'none')),bossEntries:samples.filter(s=>s.bossEntry).length,bossEntryMage:mean(samples.filter(s=>s.bossEntry).map(s=>s.bossEntry.mage)),samples})
    }
    console.log('Actual seven-node runs:',config.id)
  }
  writeFileSync(resolve(out,'runs.json'),JSON.stringify({metadata:{seedBase,runs,information:'public',rewardPolicy:'fixed rank; artifact first until both slots occupied; no skip (unimplemented)',restPolicy:'lowest health ratio',warning:'Actual current map, not the proposed 21-room design',rawSamples:'run-samples.csv'},rows:routeRows.map(({samples,...row})=>row)},null,2))
  const csv=['seed,config,strategy,policy,result,fights,elites,rests,healed,offers,deck,bossWarrior,bossMage,fallen,finalWarrior,finalMage']
  for(const row of routeRows)for(const s of row.samples)csv.push([s.seed,row.config,row.strategy,row.policy,s.result,s.fights,s.elites,s.rests,s.healed,s.offers,s.deck,s.bossEntry?.warrior??'',s.bossEntry?.mage??'',s.fallen??'',s.final.warrior,s.final.mage].join(','))
  writeFileSync(resolve(out,'run-samples.csv'),csv.join('\n')+'\n')

  const currentMaps=[]
  for(let i=0;i<mapRuns;i++) {
    const map=campaign.createDungeonRun(seedBase+i).map
    const errors=campaign.validateDungeonMap(map)
    if(errors.length)throw new Error(errors.join('; '))
    const paths=campaign.enumerateDungeonPaths(map)
    const profiles=paths.map(p=>p.map(n=>n.type).join('/'))
    currentMaps.push({paths:paths.length,profiles:new Set(profiles).size,minBattles:Math.min(...paths.map(p=>p.filter(n=>n.type!=='rest').length)),maxBattles:Math.max(...paths.map(p=>p.filter(n=>n.type!=='rest').length)),zeroElite:paths.filter(p=>!p.some(n=>n.type==='elite')).length/paths.length})
  }
  // A prototype of topology and room TYPES only. No proposed combat is simulated here.
  const templates=[['battle','battle','battle'],['battle','battle','event','event'],['elite','service','battle','event'],['service','event','service','event'],['battle','battle','battle'],['camp','camp'],['boss']]
  function makeSector(seed) {
    const r=rng(seed)
    const rows=templates.map((t,row)=>shuffled(t,r).map((type,col)=>({id:`${row}:${col}`,type,col,edges:[]})))
    for(let row=0;row<rows.length-1;row++) {
      const a=rows[row],b=rows[row+1]
      const near=(x,y)=>Math.abs((x.col+0.5)/a.length-(y.col+0.5)/b.length)<=0.51
      for(const n of a) {
        const candidates=shuffled(b.filter(m=>near(n,m)),r)
        const k=1+Math.floor(r()*Math.min(3,candidates.length))
        n.edges=candidates.slice(0,k).map(m=>m.id)
      }
      for(const n of b)if(!a.some(m=>m.edges.includes(n.id))) {
        const parent=shuffled(a.filter(m=>near(m,n)&&m.edges.length<3),r)[0]
        if(!parent)return null
        parent.edges.push(n.id)
      }
    }
    const byId=new Map(rows.flat().map(n=>[n.id,n]))
    const paths=[]
    function walk(n,path) {const p=[...path,n];if(n.type==='boss')paths.push(p);else n.edges.forEach(id=>walk(byId.get(id),p))}
    rows[0].forEach(n=>walk(n,[]))
    if(!rows[0].every(n=>paths.some(p=>p[0]===n&&!p.some(m=>m.type==='elite'))))return null
    if(!paths.some(p=>p.some(n=>n.type==='elite'))||!paths.some(p=>p.some(n=>n.type==='service')))return null
    if(paths.some(p=>p.filter(n=>n.type==='battle').length<2))return null
    // Before committing to the optional elite row, each room must still offer an elite-free continuation.
    if(!rows[1].every(n=>paths.some(p=>p.includes(n)&&!p.some(m=>m.type==='elite'))))return null
    return {rows,paths}
  }
  let attempts=0,rejected=0
  const proposed=[]
  const example=[]
  for(let i=0;i<mapRuns;i++) {
    const sectors=[]
    for(let s=0;s<3;s++) {
      let sector=null
      for(let a=0;a<128&&!sector;a++) {attempts++;sector=makeSector(campaign.deriveDungeonSeed(seedBase+i,`sector:${s}:attempt:${a}`));if(!sector)rejected++}
      if(!sector)throw new Error('No valid sector in bounded retries')
      sectors.push(sector)
    }
    const random=rng(seedBase+i)
    const run=[]
    for(const sector of sectors) {
      let node=sector.rows[0][Math.floor(random()*sector.rows[0].length)]
      while(node) {
        run.push(node.type)
        const nextId=node.edges.length?node.edges[Math.floor(random()*node.edges.length)]:null
        node=nextId?sector.rows.flat().find(n=>n.id===nextId):null
      }
    }
    if(run.length!==21||run.filter(t=>t==='boss').length!==3||run.filter(t=>['elite','battle','boss'].includes(t)).length<9)throw new Error('Invalid sampled route')
    const sectorProfiles=sectors.map(s=>new Set(s.paths.map(p=>p.map(n=>n.type).join('/'))).size)
    proposed.push({paths:sectors.reduce((a,s)=>a*s.paths.length,1),profiles:sectorProfiles.reduce((a,n)=>a*n,1),elites:run.filter(t=>t==='elite').length,battles:run.filter(t=>['elite','battle','boss'].includes(t)).length,signature:run.join('/'),services:run.filter(t=>t==='service').length})
    if(i<3)example.push(sectors.map(s=>s.rows))
  }
  const frequencies=countBy(proposed.map(p=>p.signature)),n=proposed.length
  const collision=Object.values(frequencies).reduce((a,f)=>a+f*(f-1),0)/(n*(n-1))
  const maps={metadata:{seedBase,mapRuns,proposal:'3 sectors x 7 visited rooms; structural model only; random-neighbor path selection is NOT a player policy'},current:{paths:countBy(currentMaps.map(m=>m.paths)),profiles:countBy(currentMaps.map(m=>m.profiles)),minBattles:countBy(currentMaps.map(m=>m.minBattles)),maxBattles:countBy(currentMaps.map(m=>m.maxBattles)),meanZeroElitePathShare:mean(currentMaps.map(m=>m.zeroElite))},proposed:{attempts,rejected,rejectionRate:rejected/attempts,pathMedian:quant(proposed.map(p=>p.paths),.5),profileMedian:quant(proposed.map(p=>p.profiles),.5),profileMin:Math.min(...proposed.map(p=>p.profiles)),eliteDistribution:countBy(proposed.map(p=>p.elites)),battleDistribution:countBy(proposed.map(p=>p.battles)),meanElites:mean(proposed.map(p=>p.elites)),meanBattles:mean(proposed.map(p=>p.battles)),meanServices:mean(proposed.map(p=>p.services)),typeSignatureCollision:collision},examples:example}
  writeFileSync(resolve(out,'maps.json'),JSON.stringify(maps,null,2))
  const probabilities=[]
  for(const config of configs) {
    const deck=decks[config.deck],N=deck.length,H=config.hand
    const count=id=>deck.filter(c=>c===id).length
    const armorCards=deck.filter(id=>types.cardDefinition(id).effects.some(e=>e.type==='armor')).length
    probabilities.push({config:config.id,N,H,armorCards,pAnyArmor:present(N,armorCards,H),pFrostbolt:present(N,count('frostbolt'),H),pFrostboltAndSword:both(N,count('frostbolt'),count('sword-strike'),H),pSpecificSingleton:H/N,nominalAllSeenTurn:Math.max(1,Math.ceil((N-H)/2)+1)})
  }
  const poolSize=campaign.campaignRewards().length
  const math={opening:probabilities,rewardPool:poolSize,
    rewardOffers:[3,5].map(k=>({choices:k,pRend:k/poolSize,pAnyBleedApplier:1-comb(poolSize-2,k)/comb(poolSize,k),pSeeRendIn8:1-(1-k/poolSize)**8,pSeeRendAndReapingIn8:1-2*((poolSize-k)/poolSize)**8+(comb(poolSize-2,k)/comb(poolSize,k))**8})),
    dilution:[14,18,22,26].map(n=>({N:n,pOneNewCardIn8:8/n,pOneEachComboIn8:both(n,1,1,8),pTwoEachComboIn8:both(n,2,2,8)})),
    rareOfferModels:[0,1,2,3].map(elites=>({elites,guaranteedBossOffers:2,expectedRareSelectionsIfTakeAll:2+elites,expectedRandomExtraSlots8Normals:8*3*.03,pAtLeastOneRandomRare8Normals:1-.97**24})),
    healthBudget:{initial:43,checkpoint4EachTwice:16,camp6ChosenThreeTimes:18,availableUpperBound:77,normalLoss2EightFights:16,eliteLoss5TwoFights:10,bossLoss7ThreeFights:21,remainingAggregate:30,warning:'A deterministic budget scenario, not survival probability. Per-hero losses and wasted healing matter.'}}
  writeFileSync(resolve(out,'math.json'),JSON.stringify(math,null,2))
  const paired=[]
  for(const strategy of ['balanced','defensive'])for(const policy of ['safe','mixed','risky']) {
    const a=routeRows.find(r=>r.config==='18/h8'&&r.strategy===strategy&&r.policy===policy)
    const b=routeRows.find(r=>r.config==='14/h8'&&r.strategy===strategy&&r.policy===policy)
    let gained=0,lost=0
    for(let i=0;i<runs;i++){gained+=Number(a.samples[i].result!=='victory'&&b.samples[i].result==='victory');lost+=Number(a.samples[i].result==='victory'&&b.samples[i].result!=='victory')}
    paired.push({strategy,policy,n:runs,gained,lost,netPercentagePoints:100*(gained-lost)/runs})
  }
  const growth=[]
  for(let x=0;x<=8;x++)for(let y=0;y<=2;y++)growth.push({size:14+x+2+y-2,probability:comb(8,x)*.65**x*.35**(8-x)*comb(2,y)*.6**y*.4**(2-y)})
  const health=[]
  const timeline=['normal','normal','event','event','normal','camp','boss','normal','normal','elite','event','normal','camp','boss','normal','event','elite','event','normal','camp','boss']
  for(const focus of [.5,.7])for(const checkpoint of [0,4])for(const campPolicy of ['lowest-ratio','split']) {
    const n=100000
    let wins=0,deadWarrior=0,deadMage=0,wasted=0,healing=0
    const finalMin=[]
    for(let i=0;i<n;i++) {
      const random=rng(seedBase+i),hp={warrior:25,mage:18},max={warrior:25,mage:18}
      function heal(id,amount){const actual=Math.min(max[id]-hp[id],amount);hp[id]+=actual;wasted+=amount-actual;healing+=actual}
      let died=false
      for(let t=0;t<timeline.length;t++) {
        const kind=timeline[t]
        // Both policies consume the same combat random samples.
        if(kind==='camp') {
          if(campPolicy==='split'){heal('warrior',3);heal('mage',3)}else heal(hp.warrior/25<hp.mage/18?'warrior':'mage',6)
        } else if(['normal','elite','boss'].includes(kind)) {
          const losses=kind==='normal'?[0,2,4]:kind==='elite'?[2,5,8]:[4,7,10]
          const loss=losses[Math.floor(random()*3)]
          const target=random()<focus?'mage':'warrior'
          hp[target]-=loss
          if(hp[target]<=0){died=true;deadWarrior+=Number(target==='warrior');deadMage+=Number(target==='mage');break}
          if(kind==='boss'&&t<20){heal('warrior',checkpoint);heal('mage',checkpoint)}
        }
      }
      if(!died){wins++;finalMin.push(Math.min(hp.warrior/25,hp.mage/18))}
    }
    health.push({mageFocus:focus,checkpointEach:checkpoint,campPolicy,n,toySurvival:wins/n,deadWarrior,deadMage,actualHealing:healing/n,wastedHealing:wasted/n,survivorsFinalMinRatio10:quant(finalMin,.1)})
  }
  writeFileSync(resolve(out,'sensitivity.json'),JSON.stringify({pairedCurrentRuns:paired,growth:{assumptions:'8 ordinary rewards accepted independently with p=.65; 2 boss cards accepted; 2 elite cards accepted with p=.6; two removals; replacements/upgrades do not change size',expectedSize:growth.reduce((a,g)=>a+g.size*g.probability,0),probability18to22:growth.filter(g=>g.size>=18&&g.size<=22).reduce((a,g)=>a+g.probability,0)},health:{warning:'Synthetic attrition model, NOT the battle engine and NOT a forecast of game win rate. Independent categorical TOTAL party HP loss per fight, all assigned to one hero. No cards, armor or adaptive enemies.',timeline,rows:health}},null,2))
  writeFileSync(resolve(out,'metadata.json'),JSON.stringify({baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),seedBase,runs,plannerRuns,mapRuns,node:process.version,script:'research/deadmines-independent/run.mjs',battleCount:battleRows.reduce((a,r)=>a+r.n,0),actualRunCount:routeRows.reduce((a,r)=>a+r.n,0),note:'All engine fights and actual routes use unchanged source. Proposed map has only topology/room types; no proposed encounter/reward balance claims.'},null,2))
  console.log('Done:',out)
} finally { await server.close() }
