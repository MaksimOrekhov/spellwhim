import { createServer } from 'vite'
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const count=Number(process.argv[2]??10000)
if(!Number.isSafeInteger(count)||count<10000)throw Error('At least 10000 seeds required')
const output='docs/data/deadmines-sector-one-v1-fixes'
const baselineCommit='e115e81ea5453d20e81e524e130b73d796a248ef'
const baseline=execFileSync('git',['show',`${baselineCommit}:src/game/dungeonGenerator.ts`],{encoding:'utf8'}).replaceAll("'./","'/src/game/")
const virtual='/src/game/__review_baseline.ts'
const server=await createServer({plugins:[{name:'review-baseline',enforce:'pre',resolveId(id){if(id===virtual)return virtual},load(id){if(id===virtual)return baseline}}],optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,ws:false,hmr:false},appType:'custom'})
try {
  const [current,old,oracle,rooms,campaign]=await Promise.all([server.ssrLoadModule('/src/game/dungeonGenerator.ts'),server.ssrLoadModule(virtual),server.ssrLoadModule('/research/sector-review/oracle.ts'),server.ssrLoadModule('/src/game/dungeonRooms.ts'),server.ssrLoadModule('/src/game/campaign.ts')])
  const family={ 'old-mines-raider':'F1','old-mines-digger':'F1','old-mines-watchman':'F2','old-mines-overseer':'F3','old-mines-johnson':'F4','old-mines-rhahk-zor':'F5' }
  const rows=[],summaries=[]
  for(const [version,generator] of [['before',old],['after',current]]) {
    const start=performance.now(),data=[],variants={},topologies=new Set(),profiles=new Set()
    let invalid=0,exhausted=0,totalPaths=0,duplicates=0,families=0,combatPairs=0
    for(let seed=0;seed<count;seed++) {
      let map
      try{map=generator.generateSectorMap(seed)}catch(error){exhausted++;data.push({seed,error:String(error)});continue}
      const checked=oracle.inspectSectorRoutes(map)
      const errors=version==='before'?checked.errors.filter(e=>e!=='repeated variant'):checked.errors
      if(errors.length)invalid++
      const paths=checked.paths,seq=new Set(paths.map(p=>p.map(n=>n.type).join('>')))
      totalPaths+=paths.length
      const row={seed,attempts:map.generation.attempts,paths:paths.length,sequences:seq.size,errors:checked.errors,elite:0,forge:0,event:0,duplicate:0,familyPairs:0,combatPairs:0}
      for(const path of paths) {
        const normals=path.filter(n=>n.type==='battle').map(n=>n.encounterId)
        if(new Set(normals).size!==normals.length){row.duplicate++;duplicates++}
        const combats=path.filter(n=>['battle','elite','final'].includes(n.type))
        for(let i=1;i<combats.length;i++){row.combatPairs++;combatPairs++;if(family[combats[i-1].encounterId]===family[combats[i].encounterId]){row.familyPairs++;families++}}
        row.elite+=Number(path.some(n=>n.type==='elite'));row.forge+=Number(path.some(n=>n.type==='forge'));row.event+=Number(path.some(n=>n.type==='event'))
      }
      map.layers.flat().filter(n=>n.type==='battle').forEach(n=>{variants[n.encounterId]=(variants[n.encounterId]??0)+1})
      topologies.add(JSON.stringify(map.layers.map(row=>row.map(n=>[n.column,n.edges.map(id=>map.layers.flat().find(t=>t.id===id).column)]))))
      profiles.add([...seq].sort().join('|'));data.push(row)
      if(seed && seed%2000===0)console.log(version,seed)
    }
    const valid=data.filter(r=>!r.error),sum=k=>valid.reduce((s,r)=>s+r[k],0),avg=k=>sum(k)/valid.length
    const attempts=valid.map(r=>r.attempts).sort((a,b)=>a-b)
    summaries.push({version,seeds:count,invalid,exhausted,ms:performance.now()-start,totalPaths,duplicatePathFraction:duplicates/totalPaths,sameFamilyPairFraction:families/combatPairs,meanAttempts:avg('attempts'),maxAttempts:attempts.at(-1),p99Attempts:attempts[Math.floor(attempts.length*.99)],topologies:topologies.size,profileSets:profiles.size,avgPaths:avg('paths'),avgSequences:avg('sequences'),elitePathFraction:sum('elite')/totalPaths,forgePathFraction:sum('forge')/totalPaths,eventPathFraction:sum('event')/totalPaths,variants})
    rows.push(...data.map(r=>({...r,version})))
  }
  const outcomes=[]
  const run=campaign.createSectorRun(42),template=run.map.layers.flat().find(n=>n.type==='event')
  for(const prefix of ['',current.sectorOneConfig.id+'/']) {
    let oldA=0,oldB=0,oldSame=0,a=0,b=0,same=0
    for(let seed=0;seed<count;seed++) {
      const ids=[`${prefix}layer-2-column-1`,`${prefix}layer-2-column-3`]
      const raw=ids.map(id=>campaign.deriveDungeonSeed(seed,`event-outcome:${id}`)/4294967296<.7)
      const mixed=ids.map(id=>rooms.createRoomVisit({...run,seed},{...template,id}).riskSuccess)
      oldA+=Number(raw[0]);oldB+=Number(raw[1]);oldSame+=Number(raw[0]===raw[1]);a+=Number(mixed[0]);b+=Number(mixed[1]);same+=Number(mixed[0]===mixed[1])
    }
    outcomes.push({prefix,rawHash:{a:oldA/count,b:oldB/count,agreement:oldSame/count},mulberry:{a:a/count,b:b/count,agreement:same/count,independentExpected:(a/count)*(b/count)+(1-a/count)*(1-b/count)}})
  }
  // uint32 boundaries also get independently enumerated.
  for(const seed of [0xffffffff,0x80000000])if(oracle.inspectSectorRoutes(current.generateSectorMap(seed)).errors.length)throw Error('Boundary map invalid')
  await mkdir(output,{recursive:true})
  await writeFile(`${output}/independent-structure.jsonl.gz`,gzipSync(rows.map(r=>JSON.stringify(r)).join('\n')))
  const summary={baselineCommit,seedRange:[0,count-1],oracle:'research/sector-review/oracle.ts, independent DFS; no production validation/path calls',summaries,outcomes}
  await writeFile(`${output}/independent-summary.json`,JSON.stringify(summary,null,2)+'\n')
  console.log(JSON.stringify(summary,null,2))
  if(summaries[1].invalid||summaries[1].exhausted||summaries[1].duplicatePathFraction||summaries[1].sameFamilyPairFraction)throw Error('Review regression')
}finally{await server.close()}
