import type { DungeonMap, DungeonMapNode } from '../../src/game/campaign'

/** Research/test oracle only; deliberately does not call the generator's path or validation helpers. */
export function inspectSectorRoutes(map: DungeonMap) {
  const errors = new Set<string>(), nodes = map.layers.flat(), visited = new Set<string>()
  const paths: DungeonMapNode[][] = []
  const combat = (n: DungeonMapNode) => ['battle','elite','final'].includes(n.type)
  const walk = (node: DungeonMapNode, prefix: DungeonMapNode[]) => {
    if (prefix.some(p => p.id === node.id)) { errors.add('cycle'); return }
    visited.add(node.id)
    const route = [...prefix,node]
    if (node.id === map.finalNodeId) { paths.push(route); return }
    if (!node.edges.length) errors.add('dead end')
    for (const id of node.edges) {
      const target = nodes.find(n => n.id === id)
      if (!target || target.layer !== node.layer+1 || (target.type !== 'final' && Math.abs(node.column-target.column)>1)) { errors.add('edge'); continue }
      walk(target,route)
    }
  }
  map.startNodeIds.forEach(id => { const n = nodes.find(n => n.id === id); if (n) walk(n,[]); else errors.add('entrance') })
  if (visited.size !== nodes.length) errors.add('unreachable')
  for (const row of map.layers.slice(0,-2)) {
    const links = row.flatMap(n => n.edges.map(id => [n,nodes.find(t=>t.id===id)] as const))
    if (links.some(([a,b]) => links.some(([c,d]) => b && d && a.column<c.column && b.column>d.column))) errors.add('crossing')
  }
  for (const route of paths) {
    if (route.filter(n=>n.type==='elite').length>1 || route.filter(combat).length>4) errors.add('budget')
    if (route[1]?.type==='battle' && route[2]?.type==='elite') errors.add('row2 battle + elite')
    const variants = route.filter(n=>n.type==='battle').map(n=>n.encounterId)
    if (new Set(variants).size !== variants.length) errors.add('repeated variant')
    let services = 0
    for (const n of route) { services = combat(n)?0:services+1; if (services>2) errors.add('service budget') }
    if (route[route.length-2]?.type !== 'rest' || route[route.length-1]?.type !== 'final') errors.add('rest/boss')
  }
  for (const n of nodes) {
    if (!paths.some(p=>{ const i=p.findIndex(t=>t.id===n.id); return i>=0 && p.slice(i+1).every(t=>t.type!=='elite') })) errors.add('mandatory elite')
  }
  for (const start of map.startNodeIds) {
    if (!paths.some(p=>p[0]?.id===start && p.every(n=>n.type!=='elite') && p.some(n=>n.type==='forge'||n.type==='event'))) errors.add('no development')
  }
  return { errors:[...errors], paths }
}
