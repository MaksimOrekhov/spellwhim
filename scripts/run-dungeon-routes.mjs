import { createServer } from 'vite'

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const { createDungeonMap, deriveDungeonSeed, enumerateDungeonPaths, validateDungeonMap } = await server.ssrLoadModule('/src/game/campaign.ts')
  const seed = Number(process.argv[2] ?? 42) >>> 0
  const mapSeed = deriveDungeonSeed(seed, 'map')
  const map = createDungeonMap(mapSeed)
  const errors = validateDungeonMap(map)
  if (errors.length) throw new Error(`Dungeon map ${seed} is invalid: ${errors.join('; ')}`)

  const profiles = enumerateDungeonPaths(map).map(path => {
    const fights = path.filter(node => ['battle', 'elite', 'final'].includes(node.type))
    return {
      path,
      fights: fights.length,
      elites: path.filter(node => node.type === 'elite').length,
      rests: path.filter(node => node.type === 'rest').length,
      enemyHealth: fights.reduce((sum, node) => sum + (node.encounterHealth ?? 0), 0),
      cardChoices: fights.reduce((sum, node) => sum + (node.rewardCount ?? 0), 0),
    }
  })
  const safe = profiles.filter(route => route.elites === 0).sort((a, b) => b.rests - a.rests || a.enemyHealth - b.enemyHealth)[0]
  const risky = profiles.filter(route => route.elites > 0).sort((a, b) => b.elites - a.elites || b.enemyHealth - a.enemyHealth)[0]
  const summarize = route => ({
    route: route.path.map(node => node.type === 'final' ? 'Финал' : `${node.layer + 1}:${node.type === 'battle' ? 'бой' : node.type === 'elite' ? 'элита' : 'привал'}`).join(' → '),
    fights: route.fights,
    elites: route.elites,
    rests: route.rests,
    'HP врагов': route.enemyHealth,
    'вариантов награды': route.cardChoices,
  })

  console.log(`Dungeon routes · run seed ${seed} · map seed ${mapSeed} · ${profiles.length} legal paths`)
  console.table([safe, risky].filter(Boolean).map(summarize))
} finally {
  await server.close()
}
