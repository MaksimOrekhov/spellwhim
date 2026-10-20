import { withGame } from './harness.mjs'

// Mutate room types / edges of valid maps and compare the DP validator with brute-force path enumeration.
await withGame(['dungeonGenerator', 'sectorContent', 'deck'], async ({ dungeonGenerator: g, sectorContent: sc }) => {
  const c = g.sectorOneConfig
  const combat = t => ['battle', 'elite', 'final'].includes(t)
  const service = t => ['forge', 'treasure', 'event', 'rest'].includes(t)
  let rnd = 12345
  const rand = () => { rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0; return rnd / 4294967296 }
  function brute(map) {
    const paths = g.sectorPaths(map), nodes = map.layers.flat(), byId = new Map(nodes.map(n => [n.id, n]))
    const budget = paths.every(p => p.filter(n => n.type === 'elite').length <= c.maxElites && p.filter(n => combat(n.type)).length <= c.maxBattles)
    const services = paths.every(p => { let run = 0, max = 0; for (const n of p) { run = service(n.type) ? run + 1 : 0; max = Math.max(max, run) } return max <= c.maxConsecutiveServices })
    // from every node some continuation to the boss with no FUTURE elite
    const suffixSafe = id => { const n = byId.get(id); if (n.type === 'final') return true; return n.edges.some(e => byId.get(e).type !== 'elite' && suffixSafe(e)) }
    const forced = !nodes.every(n => suffixSafe(n.id))
    const dev = map.startNodeIds.every(s => paths.some(p => p[0].id === s && !p.some(n => n.type === 'elite') && p.some(n => n.type === 'forge' || n.type === 'event')))
    return { budget, services, forcedElite: forced, dev }
  }
  const tally = { checked: 0, mismatches: [], failing: { budget: 0, services: 0, forcedElite: 0, dev: 0 } }
  for (let seed = 0; seed < 3000; seed++) {
    for (let k = 0; k < 6; k++) {
      const map = structuredClone(g.generateSectorMap(seed))
      // random type mutation inside allowed row types, keeping payload consistent
      const flex = map.layers.slice(1, 3).flat()
      const n = flex[Math.floor(rand() * flex.length)]
      const types = c.rows[n.layer].types
      const t = types[Math.floor(rand() * types.length)]
      delete n.eventId; delete n.encounterId; delete n.encounterHealth; delete n.rewardCount
      n.type = t
      if (t === 'event') { const used = new Set(map.layers.flat().map(x => x.eventId)); const free = c.eventPool.find(e => !used.has(e)); if (!free) continue; n.eventId = free }
      if (t === 'battle' || t === 'elite') { n.encounterId = t === 'elite' ? c.elitePool[0] : c.normalPool[0]; n.encounterHealth = sc.sectorEncounters.find(e => e.id === n.encounterId).maxHealth; n.rewardCount = t === 'elite' ? 5 : 3 }
      // occasionally add a non-crossing straight edge
      if (rand() < 0.5) { const row = map.layers[1 + Math.floor(rand() * 2)]; const a = row[Math.floor(rand() * row.length)]; const to = map.layers[a.layer + 1].find(x => x.column === a.column); if (to && !a.edges.includes(to.id)) a.edges.push(to.id) }
      const errs = g.validateSectorMap(map)
      if (errs.some(e => /Invalid|Crossing|Missing required|Empty row/.test(e))) continue
      const b = brute(map)
      tally.checked++; for (const k of ["budget","services","dev"]) if (!b[k]) tally.failing[k]++; if (b.forcedElite) tally.failing.forcedElite++
      const v = { budget: !errs.includes('Combat budget exceeded'), services: !errs.includes('Too many services in sequence'), forcedElite: errs.includes('Forced future elite'), dev: !errs.includes('No safe development route') }
      for (const key of Object.keys(b)) if (b[key] !== v[key] && tally.mismatches.length < 10) tally.mismatches.push({ seed, key, brute: b[key], validator: v[key], errs })
    }
  }
  console.log(JSON.stringify(tally, null, 1))
})
