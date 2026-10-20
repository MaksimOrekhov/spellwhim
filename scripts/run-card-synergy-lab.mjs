// Purpose-built reward-card archetypes through the canonical battle engine.
// npm run card-pool:synergy -- 100 42
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createServer } from 'vite'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const positional = args.filter(value => !value.startsWith('--'))
const runs = Math.max(1, Math.floor(Number(option('--runs', positional[0] ?? 100))))
const baseSeed = Number(option('--seed', positional[1] ?? 42)) >>> 0
const jsonPath = option('--json', 'docs/data/card-pool-art-v01/synergy-lab.json')
const strategies = option('--strategies', 'aggressive,balanced,defensive,planner').split(',')

const specs = [
  { id: 'control', name: 'Стартовая колода', cards: [], replace: [] },
  { id: 'vulnerability', name: 'Уязвимость и добор', cards: ['arcane-mark', 'arcane-mark', 'frostbolt', 'frostbolt', 'crushing-swing', 'crushing-swing'], replace: ['sword-strike', 'sword-strike', 'guard', 'guard', 'parry', 'parry'] },
  { id: 'vulnerability-lens', name: 'Уязвимость + Линза слабой точки', cards: ['arcane-mark', 'arcane-mark', 'frostbolt', 'frostbolt', 'crushing-swing', 'crushing-swing'], replace: ['sword-strike', 'sword-strike', 'guard', 'guard', 'parry', 'parry'], artifact: { id: 'weakpoint-lens', owner: 'mage' } },
  { id: 'bleeding', name: 'Кровотечение: тик, эхо и взрыв', cards: ['rend', 'rend', 'wound-clamp', 'wound-clamp', 'ice-echo', 'ice-echo', 'blood-resonance', 'blood-resonance', 'frost-seal', 'frost-seal'], replace: ['sword-strike', 'sword-strike', 'fireball', 'fireball', 'guard', 'guard', 'frostbolt', 'frostbolt', 'arcane-insight', 'arcane-insight'] },
  { id: 'armor-counter', name: 'Броня и контратака', cards: ['stance-strike', 'stance-strike', 'stance-strike', 'covering-counter', 'covering-counter', 'covering-counter'], replace: ['sword-strike', 'sword-strike', 'fireball', 'fireball', 'arcane-insight', 'arcane-insight'] },
  { id: 'armor-counter-pulley', name: 'Броня + контратака + Сдвоенный полиспаст', cards: ['stance-strike', 'stance-strike', 'stance-strike', 'covering-counter', 'covering-counter', 'covering-counter'], replace: ['sword-strike', 'sword-strike', 'fireball', 'fireball', 'arcane-insight', 'arcane-insight'], artifact: { id: 'double-pulley', owner: 'warrior' } },
]

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const progression = await server.ssrLoadModule('/src/game/cardProgression.ts')
  const load = path => server.ssrLoadModule(path)
  const [battle, balance, plannerModule, types, economy, rosterModule, statusModule] = await Promise.all([
    load('/src/game/battle.ts'), load('/src/game/balance.ts'), load('/src/game/balancePlanner.ts'), load('/src/game/types.ts'),
    load('/src/game/economy.ts'), load('/src/game/encountersV10.ts'), load('/src/game/statuses.ts'),
  ])
  const roster = rosterModule.defaultDungeonRoster
  const encounters = [...roster.normal, ...roster.elite, roster.final].filter(Boolean)
  const stats = Object.fromEntries(specs.map(spec => [spec.id, Object.fromEntries(strategies.map(strategy => [strategy, { runs: 0, wins: 0, defeats: 0, timeouts: 0, turns: 0, cardsPlayed: 0, warriorHp: 0, mageHp: 0, cards: {}, battlesByEncounter: {} }]))]))

  const makeDeck = spec => {
    const deck = [...types.startingDeck]
    for (const id of spec.replace) {
      const index = deck.indexOf(id)
      if (index < 0) throw new Error(`${spec.id} cannot replace missing ${id}`)
      deck.splice(index, 1)
    }
    deck.push(...spec.cards)
    if (deck.length !== types.startingDeck.length) throw new Error(`${spec.id} deck has ${deck.length} cards`)
    return deck
  }

  function ensureCard(row, id) {
    return row.cards[id] ??= { plays: 0, battlesPlayed: 0, damage: 0, armor: 0, draws: 0, vulnerabilitySetups: 0, vulnerabilityConsumed: 0, bleedingApplied: 0, bleedingTicks: 0, bleedingTickDamage: 0, bleedingBursts: 0, bleedingBurstDamage: 0, artifactTriggers: 0, artifactBonusArmor: 0 }
  }

  function runBattle(spec, strategy, encounter, seed) {
    const row = stats[spec.id][strategy]
    const owner = spec.artifact ? spec.artifact.owner === 'warrior' ? 'warrior' : 'mage' : null
    const battleId = `card-synergy/${spec.id}/${strategy}/${seed}/${encounter.id}`
    const state = battle.createBattle(encounter, undefined, {
      seed, battleId, deck: makeDeck(spec), economy: economy.gameEconomy,
      artifacts: spec.artifact ? [{ instanceId: `${battleId}/artifact`, definitionId: spec.artifact.id, ownerInstanceId: `${battleId}/hero/${owner === 'warrior' ? 'first' : 'second'}` }] : [],
    })
    const cardPlaysThisBattle = new Set()
    const planner = strategy === 'planner' ? plannerModule.createTurnPlanner() : undefined
    let turns = 0, cardsPlayed = 0
    while (!state.result && turns < 32) {
      turns += 1
      let playsThisTurn = 0
      while (!state.result && playsThisTurn < 12) {
        const plannedId = planner?.next(state)
        const instance = plannedId ? state.hand.find(card => card.instanceId === plannedId) : strategy === 'planner' ? undefined : balance.chooseCard(state, strategy)
        if (!instance) break
        const card = progression.resolveCardDefinition(instance)
        const preview = battle.previewCard(state, card)
        const oldBleeding = statusModule.statusValue(state, 'enemy', 'bleeding')
        const beforeEnemyHealth = state.enemy.health
        const beforeEnemyArmor = state.enemy.armor
        if (!battle.playCard(state, instance.instanceId).ok) break
        const cardStats = ensureCard(row, card.id)
        cardStats.plays += 1
        cardStats.damage += Math.max(0, beforeEnemyHealth - state.enemy.health) + Math.max(0, beforeEnemyArmor - state.enemy.armor)
        cardStats.armor += Object.values(preview.armor).reduce((sum, value) => sum + value, 0) + Object.values(preview.artifactArmor).reduce((sum, value) => sum + value, 0)
        cardStats.draws += preview.draw
        cardStats.vulnerabilitySetups += card.effects.filter(effect => effect.type === 'status' && effect.status === 'vulnerability').length
        cardStats.vulnerabilityConsumed += Number(preview.vulnerabilityBonus > 0)
        cardStats.bleedingApplied += card.effects.filter(effect => effect.type === 'status' && effect.status === 'bleeding').reduce((sum, effect) => sum + (effect.amount ?? 1), 0)
        cardStats.bleedingTicks += Number(card.effects.some(effect => effect.type === 'status-tick' && effect.status === 'bleeding') && oldBleeding > 0)
        cardStats.bleedingTickDamage += preview.statusDamage
        cardStats.bleedingBursts += Number(card.effects.some(effect => effect.type === 'status-burst' && effect.status === 'bleeding') && oldBleeding > 0)
        cardStats.bleedingBurstDamage += preview.damageParts.filter(part => part.id === 'bleeding-burst').reduce((sum, part) => sum + part.amount, 0)
        cardStats.artifactTriggers += Number(preview.artifactBonuses.length > 0)
        cardStats.artifactBonusArmor += Object.values(preview.artifactArmor).reduce((sum, value) => sum + value, 0)
        cardPlaysThisBattle.add(card.id)
        cardsPlayed += 1
        playsThisTurn += 1
      }
      if (state.result) break
      battle.endTurn(state)
    }
    const result = state.result ?? 'timeout'
    row.runs += 1
    row.wins += Number(result === 'victory')
    row.defeats += Number(result === 'defeat')
    row.timeouts += Number(result === 'timeout')
    row.turns += turns
    row.cardsPlayed += cardsPlayed
    row.warriorHp += state.heroes.warrior.health
    row.mageHp += state.heroes.mage.health
    for (const id of cardPlaysThisBattle) ensureCard(row, id).battlesPlayed += 1
    const encounterRows = row.battlesByEncounter[encounter.id] ??= { name: encounter.name, runs: 0, wins: 0, turns: 0, warriorHp: 0, mageHp: 0 }
    encounterRows.runs += 1
    encounterRows.wins += Number(result === 'victory')
    encounterRows.turns += turns
    encounterRows.warriorHp += state.heroes.warrior.health
    encounterRows.mageHp += state.heroes.mage.health
  }

  for (const spec of specs) for (const strategy of strategies) for (let index = 0; index < runs; index += 1) {
    const seed = (baseSeed + index) >>> 0
    for (const encounter of encounters) runBattle(spec, strategy, encounter, seed)
  }

  const summaries = []
  for (const spec of specs) for (const strategy of strategies) {
    const row = stats[spec.id][strategy]
    summaries.push({
      archetype: spec.id, name: spec.name, strategy, runs: row.runs, wins: row.wins,
      winRate: +(100 * row.wins / Math.max(1, row.runs)).toFixed(1),
      averageTurns: +(row.turns / Math.max(1, row.runs)).toFixed(2),
      averageCardsPlayed: +(row.cardsPlayed / Math.max(1, row.runs)).toFixed(2),
      averageWarriorHp: +(row.warriorHp / Math.max(1, row.runs)).toFixed(1),
      averageMageHp: +(row.mageHp / Math.max(1, row.runs)).toFixed(1),
    })
  }
  const cardMetrics = []
  for (const spec of specs) for (const strategy of strategies) {
    const row = stats[spec.id][strategy]
    for (const id of spec.cards.length ? [...new Set(spec.cards)] : []) {
      const card = ensureCard(row, id)
      cardMetrics.push({ archetype: spec.id, strategy, id, name: types.cardDefinition(id).name, ...card,
        playsPerBattle: +(card.plays / Math.max(1, row.runs)).toFixed(3),
        shareOfBattlesPlayed: +(100 * card.battlesPlayed / Math.max(1, row.runs)).toFixed(1),
      })
    }
  }
  const encounterSummaries = []
  for (const spec of specs) for (const strategy of strategies) for (const [encounterId, row] of Object.entries(stats[spec.id][strategy].battlesByEncounter)) {
    encounterSummaries.push({ archetype: spec.id, strategy, encounterId, name: row.name, runs: row.runs,
      winRate: +(100 * row.wins / Math.max(1, row.runs)).toFixed(1), averageTurns: +(row.turns / Math.max(1, row.runs)).toFixed(2),
      averageWarriorHp: +(row.warriorHp / Math.max(1, row.runs)).toFixed(1), averageMageHp: +(row.mageHp / Math.max(1, row.runs)).toFixed(1) })
  }

  console.log(`Purpose-built synergy decks · ${runs} seeds · ${baseSeed}–${(baseSeed + runs - 1) >>> 0} · economy ${economy.gameEconomy.id} · roster ${roster.id} · ${encounters.length} encounters`)
  console.log('Each themed deck replaces an equal number of cards in the unchanged 18-card starting deck. Archetypes are tested with and without their matching artifact. These are deterministic bot fights, not human win rates.')
  console.table(summaries)
  console.log('\nEncounter-level results')
  console.table(encounterSummaries)
  console.log('\nThemed-card and synergy metrics')
  console.table(cardMetrics)

  mkdirSync(dirname(jsonPath), { recursive: true })
  writeFileSync(jsonPath, JSON.stringify({
    metadata: { runsPerEncounter: runs, seed: baseSeed, seedEnd: (baseSeed + runs - 1) >>> 0, economy: economy.gameEconomy.id, roster: roster.id, encounters: encounters.map(item => item.id), strategies,
      method: 'Canonical createBattle/previewCard/playCard/endTurn are loaded from game source via Vite SSR. Each themed 18-card deck replaces a matching number of cards from startingDeck. Pairs differ only in the tested themed cards and, for artifact cases, the single named artifact. Same seed and encounter are used per pair. Results measure a scripted bot’s use of the deck and do not represent human play.' },
    archetypes: specs.map(({ id, name, cards, replace, artifact }) => ({ id, name, addedCards: cards, replacedCards: replace, artifact: artifact ?? null })),
    summaries, encounters: encounterSummaries, cardMetrics,
  }, null, 2))
} finally {
  await server.close()
}
