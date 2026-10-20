// Fixtures for visual checks of Sector I: valid run snapshots written to tmp-fixtures/*.json.
// Load one in the dev build:  localStorage.setItem('spellwhim.run.v1', await (await fetch('/tmp-fixtures/forge.json')).text()); location.reload()
// Run: node scripts/sector-visual-fixtures.mjs [seed]
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'

const seed = Number(process.argv[2] ?? 7)
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const [campaign, rooms, save, economy, upgrades] = await Promise.all(['campaign', 'dungeonRooms', 'runSave', 'economy', 'cardProgression'].map(name => server.ssrLoadModule(`/src/game/${name}.ts`)))
  const out = 'tmp-fixtures'
  await mkdir(out, { recursive: true })
  const write = (name, run) => writeFile(`${out}/${name}.json`, save.encodeSnapshot(run, economy.gameEconomy, 1))
  const base = campaign.createSectorRun(seed, economy.gameEconomy)
  const paths = campaign.enumerateDungeonPaths(base.map)
  const find = (pred) => paths.find(path => path.some(pred))
  const labels = { forge: 'Кузница: вы ушли без работы.', treasure: 'Тайник: вы ушли без добычи.', event: 'Событие: вы ушли без выбора.', rest: 'Привал: отряд передохнул.' }
  const take = (path, count, start = base) => {
    let run = start
    for (const node of path.slice(0, count)) {
      const combat = ['battle', 'elite', 'final'].includes(node.type)
      const decisions = [...run.decisions, `${combat ? 'battle' : node.type === 'rest' ? 'rest' : 'room'}:${node.id}`]
      if (['battle', 'elite'].includes(node.type)) decisions.push(`${run.runId}/reward/${node.id}`)
      const journal = combat ? run.journal : [...run.journal, { nodeId: node.id, kind: node.type === 'rest' ? 'rest' : 'leave', text: labels[node.type] }]
      run = { ...run, currentNodeId: node.id, visitedNodeIds: [...run.visitedNodeIds, node.id], completedNodeIds: [...run.completedNodeIds, node.id], decisions, journal }
    }
    return run
  }
  const enter = (path, index) => {
    const before = take(path, index)
    return campaign.enterDungeonNode(before, path[index].id)
  }
  const withUpgrades = run => ({ ...run, deck: run.deck.map((card, i) => i % 4 === 0 && upgrades.canUpgradeCard(card) ? { ...card, upgrade: 1 } : card) })
  await write('map-fresh', base)
  const longest = paths.find(path => path.some(n => n.type === 'forge')) ?? paths[0]
  await write('map-midway', withUpgrades(take(longest, 2)))
  for (const type of ['forge', 'treasure', 'elite', 'final']) {
    const path = find(n => n.type === type)
    if (!path) { console.log('no path with', type); continue }
    await write(type, withUpgrades(enter(path, path.findIndex(n => n.type === type))))
  }
  console.log('seed', seed, 'event ids on map:', base.map.layers.flat().filter(n => n.eventId).map(n => n.eventId).join(', '))
  // every event gets a fixture; a missing event is searched for on neighbouring seeds
  for (const eventId of ['forgotten-forge', 'powder-store', 'goblin-trade']) {
    for (let s = seed; s < seed + 200; s++) {
      const candidate = s === seed ? base : campaign.createSectorRun(s, economy.gameEconomy)
      const candidatePaths = campaign.enumerateDungeonPaths(candidate.map)
      const path = candidatePaths.find(p => p.some(n => n.eventId === eventId))
      if (!path) continue
      const before = take(path, path.findIndex(n => n.eventId === eventId), candidate)
      await write('event-' + eventId, withUpgrades(campaign.enterDungeonNode(before, path.find(n => n.eventId === eventId).id)))
      break
    }
  }
  const full = [...(find(n => n.type === 'final') ?? paths[0])]
  await write('complete', withUpgrades({ ...take(full, full.length), status: 'sector-complete' }))
} finally {
  await server.close()
}
