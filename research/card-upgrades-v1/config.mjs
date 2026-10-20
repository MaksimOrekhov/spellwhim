// Fixed before the holdout run. C templates exactly match research/gdd-v2/controlled-start.mjs.
export const ranges = [{ id: 'main', seed: 410000 }, { id: 'holdout', seed: 510000 }]
export const samples = { classic: 300, planner: 60, plannerScreening: 16, routes: 500, plannerRoutes: 30 }
export const core14 = ['sword-strike', 'sword-strike', 'fireball', 'guard', 'guard', 'parry', 'shield-bash', 'interpose', 'frostbolt', 'frostbolt', 'arcane-insight', 'ice-ward', 'ice-ward', 'thunderbolt']
export const reward4 = ['rend', 'thunderbolt', 'bastion', 'arcane-mark']
export const reward8 = [...reward4, 'ice-echo', 'wound-clamp', 'reaping-blow', 'frost-seal']
export const upgradePriority = ['frostbolt', 'sword-strike', 'arcane-insight', 'bastion', 'ice-ward', 'interpose', 'rend', 'thunderbolt', 'shield-bash', 'fireball', 'parry', 'guard']
const copies = ids => ids.map((definitionId, index) => ({ definitionId, upgrade: 0, instanceId: `sample/card/${index + 1}` }))
export function upgradeCopies(deck, count, priority = upgradePriority) {
  const result = deck.map(card => ({ ...card }))
  // Round-robin first copy of each preferred definition, then duplicates. Exact IDs are recorded in configs.
  for (let pass = 0; pass < result.length && count > 0; pass++) for (const id of priority) {
    const copy = result.filter(card => card.definitionId === id)[pass]
    if (copy && copy.upgrade === 0 && count > 0) { copy.upgrade = 1; count-- }
  }
  return result
}
export function configurations(startingDeck) {
  const main = [
    { id: 'A', deck: copies(startingDeck) },
    { id: 'B', deck: copies([...startingDeck, ...reward4]) },
    { id: 'C', deck: copies([...startingDeck, ...reward8]) },
    { id: 'D', deck: upgradeCopies(copies([...startingDeck, ...reward4]), 2) },
    { id: 'E', deck: upgradeCopies(copies([...startingDeck, ...reward8]), 4) },
    // F removes named copies from E: second fireball, second shield-bash, second guard, second parry.
    { id: 'F', deck: upgradeCopies(copies([...startingDeck, ...reward8]).filter((_, i) => ![3, 9, 5, 7].includes(i)), 4) },
  ].map(config => ({ ...config, family: 'power', hand: 8, planner: samples.planner }))
  const starts = [
    { id: '18-8+2', ids: startingDeck, hand: 8, upgrade: 2 },
    ...[{ id: '16-8', ids: [...core14, 'parry', 'arcane-insight'], hand: 8 }, { id: '14-8', ids: core14, hand: 8 }, { id: '14-7', ids: core14, hand: 7 }].flatMap(config => [{ ...config, upgrade: 0 }, { ...config, id: config.id + '+2', upgrade: 2 }]),
  ].map(config => ({ id: config.id, family: 'start', hand: config.hand, deck: upgradeCopies(copies(config.ids), config.upgrade), planner: samples.plannerScreening }))
  const arch = {
    armor: ['bastion', 'ice-ward', 'stance-strike', 'interpose', 'thunderbolt', 'frostbolt', 'parry', 'arcane-insight'],
    bleeding: ['rend', 'rend', 'ice-echo', 'wound-clamp', 'reaping-blow', 'boil-blood', 'blood-resonance', 'frost-seal'],
    vulnerability: ['frostbolt', 'arcane-mark', 'shield-bash', 'quick-cut', 'sword-strike', 'thunderbolt', 'crushing-swing', 'arcane-insight'],
    attack: ['quick-cut', 'thunderbolt', 'rend', 'sword-strike', 'fireball', 'stance-strike', 'ice-echo', 'crushing-swing'],
    defense: ['bastion', 'interpose', 'ice-ward', 'parry', 'covering-counter', 'wound-clamp', 'arcane-insight', 'frost-seal'],
  }
  const archetypes = Object.entries(arch).flatMap(([id, extras]) => [0, 4].map(level => ({ id: `${id}+${level}`, family: 'archetype', hand: 8, deck: upgradeCopies(copies([...startingDeck, ...extras]), level, [...extras, ...upgradePriority]), planner: samples.plannerScreening })))
  return [...main, ...starts, ...archetypes]
}
