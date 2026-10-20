import { withGame, mean, pct, r3 } from './harness.mjs'

const N = Number(process.argv[2] ?? 10000)
await withGame(['dungeonGenerator', 'sectorContent', 'dungeonSeed', 'campaign', 'dungeonRooms'], async ({ dungeonGenerator: g, sectorContent: sc, dungeonSeed: ds, campaign: camp, dungeonRooms: rooms }) => {
  const family = { 'old-mines-raider': 'F1', 'old-mines-digger': 'F1', 'old-mines-watchman': 'F2', 'old-mines-overseer': 'F3' }
  const combat = t => ['battle', 'elite', 'final'].includes(t)
  const stats = { maps: 0, paths: 0, dupVariantPaths: 0, mapsWithDupVariantPath: 0, mapsAllPathsDup: 0, famConsecPaths: 0, row0row3Same: 0, entrances: {}, seqs: {}, eliteAfterEvent: 0, elitePaths: 0, entranceNoSafeForge: 0, mapsEntranceNoSafeForge: 0, entranceOnlyPowderDev: 0, mapsWithEntranceOnlyPowderDev: 0, entrancesTotal: 0, rowSizes: [{}, {}, {}, {}, {}], attempts: [], ms: [], typeDecisionsPerPath: [], row0TypeChoice: 0, eliteCount: {}, forgeCount: {}, mapsElitePathHasForgeAlt: 0, uniqueSeqPerMap: [] }
  for (let seed = 0; seed < N; seed++) {
    const t0 = performance.now()
    const map = g.generateSectorMap(seed)
    stats.ms.push(performance.now() - t0)
    stats.attempts.push(map.generation.attempts)
    stats.maps++
    const nodes = map.layers.flat(), byId = new Map(nodes.map(n => [n.id, n]))
    stats.entrances[map.startNodeIds.length] = (stats.entrances[map.startNodeIds.length] ?? 0) + 1
    map.layers.slice(0, 5).forEach((row, i) => { stats.rowSizes[i][row.length] = (stats.rowSizes[i][row.length] ?? 0) + 1 })
    const e = nodes.filter(n => n.type === 'elite').length, f = nodes.filter(n => n.type === 'forge').length
    stats.eliteCount[e] = (stats.eliteCount[e] ?? 0) + 1; stats.forgeCount[f] = (stats.forgeCount[f] ?? 0) + 1
    const paths = g.sectorPaths(map)
    let dupHere = 0
    const seqHere = new Set()
    for (const p of paths) {
      stats.paths++
      const enc = p.filter(n => n.type === 'battle').map(n => n.encounterId)
      if (new Set(enc).size !== enc.length) { stats.dupVariantPaths++; dupHere++ }
      if (p[0].encounterId === p[3].encounterId) stats.row0row3Same++
      const fights = p.filter(n => combat(n.type)).map(n => family[n.encounterId] ?? n.encounterId)
      if (fights.some((x, i) => i > 0 && x === fights[i - 1])) stats.famConsecPaths++
      const seq = p.map(n => n.type).join('>')
      seqHere.add(seq)
      stats.seqs[seq] = (stats.seqs[seq] ?? 0) + 1
      if (p.some(n => n.type === 'elite')) { stats.elitePaths++; if (p[1].type === 'event') stats.eliteAfterEvent++ }
      let decisions = 0
      for (let i = 0; i < p.length - 1; i++) { const kids = new Set(p[i].edges.map(id => byId.get(id).type)); if (kids.size > 1) decisions++ }
      stats.typeDecisionsPerPath.push(decisions)
    }
    stats.uniqueSeqPerMap.push(seqHere.size)
    if (dupHere) stats.mapsWithDupVariantPath++
    if (dupHere === paths.length) stats.mapsAllPathsDup++
    if (map.layers[0].some(n => new Set(n.edges.map(id => byId.get(id).type)).size > 1)) stats.row0TypeChoice++
    let noForge = false, onlyPowder = false
    for (const s of map.startNodeIds) {
      stats.entrancesTotal++
      const own = paths.filter(p => p[0].id === s && !p.some(n => n.type === 'elite'))
      if (!own.some(p => p.some(n => n.type === 'forge'))) { stats.entranceNoSafeForge++; noForge = true }
      const realDev = own.some(p => p.some(n => n.type === 'forge' || (n.type === 'event' && n.eventId !== 'powder-store')))
      if (!realDev) { stats.entranceOnlyPowderDev++; onlyPowder = true }
    }
    if (noForge) stats.mapsEntranceNoSafeForge++
    if (onlyPowder) stats.mapsWithEntranceOnlyPowderDev++
  }
  const att = stats.attempts.slice().sort((a, b) => a - b)
  console.log(JSON.stringify({
    maps: stats.maps, avgPaths: r3(stats.paths / stats.maps),
    pathsWithRepeatedVariantPct: pct(stats.dupVariantPaths, stats.paths), mapsWithAnyRepeatPathPct: pct(stats.mapsWithDupVariantPath, stats.maps), mapsWhereEveryPathRepeatsPct: pct(stats.mapsAllPathsDup, stats.maps),
    row0EqualsRow3Pct: pct(stats.row0row3Same, stats.paths), pathsSameFamilyConsecutivePct: pct(stats.famConsecPaths, stats.paths),
    entrances: stats.entrances, rowSizes: stats.rowSizes, eliteNodesPerMap: stats.eliteCount, forgeNodesPerMap: stats.forgeCount,
    elitePathsPreceededByEventPct: pct(stats.eliteAfterEvent, stats.elitePaths),
    entrancesWithoutSafeForgePct: pct(stats.entranceNoSafeForge, stats.entrancesTotal), mapsWithSuchEntrancePct: pct(stats.mapsEntranceNoSafeForge, stats.maps),
    entrancesWhoseOnlySafeDevelopmentIsPowderPct: pct(stats.entranceOnlyPowderDev, stats.entrancesTotal), mapsWithSuchEntrancePct2: pct(stats.mapsWithEntranceOnlyPowderDev, stats.maps),
    row0HasTypeChoicePct: pct(stats.row0TypeChoice, stats.maps), avgTypeDecisionPointsPerPath: r3(mean(stats.typeDecisionsPerPath)),
    uniqueSeqPerMap: r3(mean(stats.uniqueSeqPerMap)),
    seqShareOfAllPaths: Object.fromEntries(Object.entries(stats.seqs).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k.replace(/battle/g, 'B').replace(/event/g, 'E').replace(/forge/g, 'F').replace(/treasure/g, 'T').replace(/elite/g, 'X').replace(/rest/g, 'R').replace(/final/g, 'Boss'), pct(v, stats.paths)])),
    attempts: { mean: r3(mean(att)), p50: att[att.length >> 1], p99: att[Math.floor(att.length * .99)], max: att[att.length - 1] }, msPerMap: { mean: r3(mean(stats.ms)), max: r3(Math.max(...stats.ms)) },
  }, null, 1))

  // Powder outcome: raw FNV hash used as a uniform number
  const node = 'layer-2-column-2'
  const small = Array.from({ length: 20000 }, (_, i) => ds.deriveDungeonSeed(i, `event-outcome:${node}`) / 4294967296 < 0.7)
  const base = (1760000000000 >>> 0)
  const clock = Array.from({ length: 20000 }, (_, i) => ds.deriveDungeonSeed((base + i * 977) >>> 0, `event-outcome:${node}`) / 4294967296 < 0.7)
  // correlation between two room nodes of the same seed
  const pairs = Array.from({ length: 20000 }, (_, i) => [ds.deriveDungeonSeed(i * 2654435761 >>> 0, 'event-outcome:layer-2-column-1') / 4294967296 < 0.7, ds.deriveDungeonSeed(i * 2654435761 >>> 0, 'event-outcome:layer-2-column-3') / 4294967296 < 0.7])
  console.log('powder success: small seeds', pct(small.filter(Boolean).length, small.length), '| clock-like seeds', pct(clock.filter(Boolean).length, clock.length), '| P(both nodes same outcome)', pct(pairs.filter(([a, b]) => a === b).length, pairs.length), '(independent ~58)')
})
