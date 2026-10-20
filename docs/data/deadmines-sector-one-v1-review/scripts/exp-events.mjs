import { withGame } from './harness.mjs'
await withGame(['dungeonGenerator'], async ({ dungeonGenerator: g }) => {
  const dist = {}, ev = {}, pathEvents = {}
  for (let seed = 0; seed < 5000; seed++) {
    const map = g.generateSectorMap(seed), nodes = map.layers.flat().filter(n => n.type === 'event')
    dist[nodes.length] = (dist[nodes.length] ?? 0) + 1
    nodes.forEach(n => ev[n.eventId] = (ev[n.eventId] ?? 0) + 1)
    for (const p of g.sectorPaths(map)) { const k = p.filter(n => n.type === 'event').length; pathEvents[k] = (pathEvents[k] ?? 0) + 1 }
  }
  console.log('event nodes per map', dist, 'by id', ev, 'events per path', pathEvents)
})
