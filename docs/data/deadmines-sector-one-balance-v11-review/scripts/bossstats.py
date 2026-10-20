# Rak'Zor phase metrics shared by analyze.py; `python bossstats.py <raw stem>...` prints a quick summary.
import gzip,json,statistics as st,sys
D='docs/data/deadmines-sector-one-balance-v11-review/results/raw/'
def stats(g):
  n=len(g); m=lambda f: st.mean(f(r) for r in g)
  reached=[r for r in g if r['phaseTurn'] is not None]
  return dict(n=n, win=100*m(lambda r:r['result']=='victory'), T=m(lambda r:r['turns']), phaseTurn=st.mean(r['phaseTurn'] for r in reached) if reached else None,
    reach=100*len(reached)/n, noP2=100*m(lambda r:r['phase2Executed']==0), p2hit=100*m(lambda r:r['phase2Attacks']>=1),
    m11=100*m(lambda r:any(k=='prepare' and i+1<len(r['phase2Kinds']) and r['phase2Kinds'][i+1] in ('attack','attack_all') for i,k in enumerate(r['phase2Kinds']))),
    p2acts=m(lambda r:r['phase2Executed']), p2turns=st.mean(r['turns']-r['phaseTurn'] for r in reached) if reached else None,
    lossW=m(lambda r:r['lossW']), lossM=m(lambda r:r['lossM']), p2W=m(lambda r:r['lossByPhase'][1][0]), p2M=m(lambda r:r['lossByPhase'][1][1]))
if __name__=='__main__':
  for f in sys.argv[1:]:
    R=[json.loads(l) for l in gzip.open(D+f+'.jsonl.gz')]; R=[r for r in R if r.get('reached')]
    print('==',f)
    for dk in ['developed','starter']:
      for p in ['aggressive','tempo','balanced','defensive','oracle3']:
        g=[r for r in R if r['deckKind']==dk and r['policy']==p]
        if not g: continue
        s=stats(g)
        print(' ',dk[:5],p.ljust(10),'win{win:5.1f} T{T:.2f} cross@{phaseTurn:.2f} noP2act{noP2:4.0f}% P2hit{p2hit:4.0f}% M11{m11:4.0f}% P2acts{p2acts:.2f} loss {lossW:.1f}/{lossM:.1f} (P2 {p2W:.1f}/{p2M:.1f})'.format(**s))
