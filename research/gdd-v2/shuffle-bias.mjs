// Distribution diagnostic, no battle rules. Fixed ordered pool and independent seed per trial.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const out=resolve('docs/data/gdd-v2')
mkdirSync(out,{recursive:true})
const runs=50000,size=20,take=3
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6d2b79f5)>>>0;let t=Math.imul(s^s>>>15,s|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const rows=[]
for(const method of ['sort','fisher-yates']) {
  const included=Array(size).fill(0)
  for(let sample=0;sample<runs;sample++) {
    const rand=rng((900000+sample*7919)>>>0),a=Array.from({length:size},(_,i)=>i)
    if(method==='sort')a.sort(()=>rand()-.5)
    else for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
    for(const index of a.slice(0,take))included[index]++
  }
  rows.push({method,included,inclusionRates:included.map(n=>n/runs),minRate:Math.min(...included)/runs,maxRate:Math.max(...included)/runs})
}
writeFileSync(resolve(out,'shuffle-bias.json'),JSON.stringify({runs,size,take,node:process.version,expectedMarginal:take/size,seedFormula:'900000 + index * 7919 mod 2^32',warning:'Diagnostic of marginal inclusion by original index, not a formal test of every permutation or of game win rate.',rows},null,2))
