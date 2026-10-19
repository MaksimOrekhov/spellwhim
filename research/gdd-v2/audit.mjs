// Documentation research only. Original branches and game source are read, never changed.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'

const root = process.cwd()
const out = resolve('docs/data/gdd-v2')
const claude = '4900ff34337052c9a94c3c2ac423b27637d5397d'
const codex = 'b16c65192a20eb7055f5eb62d8c8a4d386fb9e7d'
const dir = 'docs/data/dungeon-campaign-research-v01/'
const show = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], {encoding:'utf8', maxBuffer:20*1024*1024})
mkdirSync(out,{recursive:true})
const files = execFileSync('git',['ls-tree','-r','--name-only',claude,'--',dir],{encoding:'utf8'}).trim().split('\n')
const inspected = files.map(file => {
  const source=show(claude,file)
  const parsed=file.endsWith('.json')?JSON.parse(source):null
  return {revision:claude,file,sha256:createHash('sha256').update(source).digest('hex'),bytes:Buffer.byteLength(source),rows:Array.isArray(parsed)?parsed.length:null,fields:Array.isArray(parsed)&&parsed.length?Object.keys(parsed[0]):null}
})
for(const [revision,file] of [[claude,'docs/dungeon-campaign-redesign-research-v01.md'],[codex,'docs/research/deadmines-progression-independent-2026-10-19.md'],[codex,'research/deadmines-independent/README.md'],[codex,'research/deadmines-independent/run.mjs']]) {
  const s=show(revision,file);inspected.push({revision,file,sha256:createHash('sha256').update(s).digest('hex'),bytes:Buffer.byteLength(s),lines:s.split('\n').length})
}
const codexFiles=execFileSync('git',['ls-tree','-r','--name-only',codex,'--','docs/data/deadmines-independent-2026-10-19/'],{encoding:'utf8'}).trim().split('\n')
for(const file of codexFiles){const s=show(codex,file);if(file.endsWith('.json'))JSON.parse(s);inspected.push({revision:codex,file,sha256:createHash('sha256').update(s).digest('hex'),bytes:Buffer.byteLength(s),csvRows:file.endsWith('.csv')?s.trim().split('\n').length-1:null})}
writeFileSync(resolve(out,'source-inventory.json'),JSON.stringify({base:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,inspected},null,2))

// Evaluate the unmodified lab body and a single shuffle correction in separate output folders.
// All original relative JSON writes resolve inside this experiment, never inside the source branch.
process.env.SPELLWHIM_ROOT=root
const commonURL='data:text/javascript;base64,'+Buffer.from(show(claude,dir+'lab-common.mjs')).toString('base64')
const fisher="function fisherYates(values,rand){const a=[...values];for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}\n"
const jobs=[]
for(const method of ['sort','fisher-yates']) {
  jobs.push({method,file:'lab-power-curve.mjs',args:['50']})
  for(const scale of [[1,1],[.75,.8]])jobs.push({method,file:'lab-long-run.mjs',args:['80','rec11',...scale.map(String)]})
}
const originals={argv:process.argv,table:console.table,error:console.error}
for(const job of jobs) {
  const destination=resolve(out,'claude-recheck',job.method)
  mkdirSync(destination,{recursive:true})
  let source=show(claude,dir+job.file).replace("'./lab-common.mjs'",JSON.stringify(commonURL))
  source=source.replaceAll('import.meta.url',JSON.stringify(pathToFileURL(resolve(destination,job.file)).href))
  if(job.method==='fisher-yates') {
    const old=source
    source=source.replace('[...pool].sort(() => rand() - 0.5)','fisherYates(pool, rand)').replace('[...rewardPool].sort(() => rand() - 0.5)','fisherYates(rewardPool, rand)')
    if(source===old)throw Error('Expected shuffle expression not found')
    source=fisher+source
  }
  source+='\n// Invocation '+job.args.join(' ')+'\n'
  process.argv=['node',job.file,...job.args]
  console.table=()=>{};console.error=()=>{}
  try {await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))}
  finally {process.argv=originals.argv;console.table=originals.table;console.error=originals.error}
  console.log('Checked',job.method,job.file,job.args.join(' '))
}
const comparisons=[]
for(const file of ['power-curve.json','long-run-dmg1-hp1.json','long-run-dmg0.75-hp0.8.json']) {
  const historical=JSON.parse(show(claude,dir+file)).filter(r=>!r.path||r.path==='rec11')
  const sort=JSON.parse(readFileSync(resolve(out,'claude-recheck/sort',file),'utf8'))
  const fixed=JSON.parse(readFileSync(resolve(out,'claude-recheck/fisher-yates',file),'utf8'))
  comparisons.push({file,historicalRows:historical.length,rerunRows:sort.length,exactHistoricalReproduction:JSON.stringify(historical)===JSON.stringify(sort),maxWinShift:Math.max(...sort.map((r,i)=>Math.abs(r.win-fixed[i].win))),maxTurnShift:Math.max(...sort.map((r,i)=>Math.abs((r.turns??r.nTurns)-(fixed[i].turns??fixed[i].nTurns))))})
}
writeFileSync(resolve(out,'shuffle-comparison.json'),JSON.stringify({sourceRevision:claude,changes:['Only sort comparator shuffle replaced by seeded Fisher-Yates; output path redirected; logs suppressed.'],limitations:['Same seed does not preserve later random draws: algorithms consume different numbers of RNG calls. In long-run a shared RNG also selects later enemies, so differences are joint scenario/shuffle effects.','Rerun uses current Node runtime; random comparator behavior is runtime-dependent.','No upgrades, gold cards, artifacts or route choice added to the linear experiment.'],comparisons},null,2))
