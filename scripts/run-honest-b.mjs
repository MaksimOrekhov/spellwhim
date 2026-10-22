// Honest Turn B study (docs/design/honest-turn-b-experiment-v1.md): A against B1 and B2 on the same seeds, through the real engine.
//   node scripts/run-honest-b.mjs [--phase enemies|hands|frost|runs|phases|all] [--seeds 300] [--hands 400] [--runs 300] [--output docs/data/honest-turn-b]
// Every number in the report comes from the JSON files this writes; nothing is tuned to a target win rate.
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const flag = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const phase = flag('--phase', 'all')
const seeds = Number(flag('--seeds', 300))
const handCount = Number(flag('--hands', 400))
const runCount = Number(flag('--runs', 300))
const output = flag('--output', 'docs/data/honest-turn-b')
await mkdir(output, { recursive: true })
const sha = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'unknown' } })()

const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, ws: false, hmr: false }, appType: 'custom' })
try {
  const load = path => server.ssrLoadModule('/src/game/' + path + '.ts')
  const [lab, economy, decks, rules] = await Promise.all(['honestLab', 'economy', 'honestDecks', 'rulesMode'].map(load))
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const share = (part, whole) => whole ? part / whole : 0
  const r = (n, d = 2) => +n.toFixed(d)
  const quantile = (values, p) => { const s = [...values].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0 }
  const modeOf = id => rules.rulesModes.find(item => item.id === id)
  /** The deck a mode starts with unless the study asks for a variant. */
  const deckOf = (id, variant) => decks.honestDeck(variant ?? modeOf(id).defaultDeck ?? 'armor10', modeOf(id).frost === true)
  const write = (name, data) => writeFile(`${output}/${name}.json`, JSON.stringify(data, null, 1) + '\n')
  const manifest = { study: 'honest-turn-b', commit: sha, seeds, hands: handCount, runs: runCount, information: 'public', planner: 'createTurnPlanner, profile keep 0 (planner-careful: health x2)', modes: ['honest-a08', 'honest-b1', 'honest-b2'], defaultDecks: Object.fromEntries(['honest-a08', 'honest-b1', 'honest-b2'].map(id => [id, modeOf(id).defaultDeck ?? 'armor10'])) }
  await write('manifest', manifest)
  const enemyName = id => id.replace('old-mines-', '')
  const modes = ['honest-a08', 'honest-b1', 'honest-b2']

  if (phase === 'enemies' || phase === 'all') {
    // One battle per enemy, strategy and seed, from full health: what each way of playing costs against each enemy.
    const rows = []
    const profiles = []
    for (const mode of modes) {
      const eco = economy.honestEconomies[mode]
      const deck = deckOf(mode)
      for (const enemy of lab.sectorEnemyIds) {
        for (const strategy of lab.labStrategies) {
          const fights = []
          for (let seed = 1; seed <= seeds; seed += 1) fights.push(lab.fightEnemy(eco, enemy, deck, strategy, seed))
          const turns = fights.flatMap(item => item.log)
          const strikes = turns.filter(item => item.strike)
          rows.push({
            mode, enemy: enemyName(enemy), strategy, battles: seeds,
            win: r(share(fights.filter(item => item.result === 'victory').length, seeds)), value: r(mean(fights.map(lab.outcomeValue))),
            turns: r(mean(fights.map(item => item.turns)), 1), lostV: r(mean(fights.map(item => item.lost.warrior)), 1), lostJ: r(mean(fights.map(item => item.lost.mage)), 1),
            unexplained: turns.reduce((sum, item) => sum + Math.abs(item.unexplained), 0),
          })
          if (strategy === 'planner') {
            const breakable = strikes.filter(item => item.interruptNeed > 0)
            const both = strikes.filter(item => item.strike && item.targets.length)
            profiles.push({
              mode, enemy: enemyName(enemy), strikesPerBattle: r(strikes.length / seeds, 1),
              defenseManaOnStrike: r(mean(strikes.map(item => item.manaOnDefense))), offenseManaOnStrike: r(mean(strikes.map(item => item.manaOnOffense))),
              defenseManaOnQuiet: r(mean(turns.filter(item => !item.strike).map(item => item.manaOnDefense))),
              armorGrantedOnStrike: r(mean(strikes.map(item => item.armorGranted))), armorAbsorbedOnStrike: r(mean(strikes.map(item => item.armorAbsorbed))),
              armorEfficiency: r(share(strikes.reduce((s, i) => s + i.armorAbsorbed, 0), strikes.reduce((s, i) => s + i.armorGranted, 0))),
              armorWastedOnStrike: r(mean(strikes.map(item => item.armorWasted))), chillSavedOnStrike: r(mean(strikes.map(item => item.chillSaved))),
              interruptTried: breakable.length, interruptBroken: r(share(breakable.filter(item => item.interruptBroken).length, breakable.length)),
              frostApplied: r(share(turns.filter(item => item.frostApplied).length, turns.length)), frostShattered: r(share(turns.filter(item => item.frostBurst).length, turns.length)),
              armorFromWarriorCards: r(mean(strikes.map(item => item.armorByClass.warrior))), armorFromMageCards: r(mean(strikes.map(item => item.armorByClass.mage))),
              // Who protects whom, per strike turn: armor on Varian / on Jaina from each hero's cards, and Frostbite's saving (Jaina's card).
              armorOnVarianFromVarian: r(mean(strikes.map(item => item.armorGrid.warrior.warrior))), armorOnJainaFromVarian: r(mean(strikes.map(item => item.armorGrid.warrior.mage))),
              armorOnVarianFromJaina: r(mean(strikes.map(item => item.armorGrid.mage.warrior))), armorOnJainaFromJaina: r(mean(strikes.map(item => item.armorGrid.mage.mage))),
              jainaCardsHelped: r(share(strikes.filter(item => item.armorByClass.mage + item.chillSaved > 0).length, strikes.length)), varianCardsHelped: r(share(strikes.filter(item => item.armorByClass.warrior > 0).length, strikes.length)),
              jainaLossPerBattle: r(mean(fights.map(item => item.lost.mage)), 1), varianLossPerBattle: r(mean(fights.map(item => item.lost.warrior)), 1),
              warriorShareOfLoss: r(share(fights.reduce((s, i) => s + i.lost.warrior, 0), fights.reduce((s, i) => s + i.lost.warrior + i.lost.mage, 0))),
              manaLeftTurns3Plus: r(share(turns.filter(item => item.manaLeft >= 3 && item.playableLeft > 0).length, turns.length)),
              bothHeroesArmored: r(share(strikes.filter(item => item.armorGranted > 0 && item.armorByClass.warrior > 0 && item.armorByClass.mage > 0).length, strikes.length)),
              phase2Share: r(mean(fights.map(item => item.log.filter(turn => turn.phase === 2).length / Math.max(1, item.log.length)))),
            })
          }
        }
      }
    }
    await write('enemies', rows)
    await write('enemy-profiles', profiles)
    console.log('enemies written', rows.length)
  }

  if (phase === 'phases' || phase === 'all') {
    // Rak'Zor phase by phase.
    const rows = []
    for (const mode of modes) {
      const eco = economy.honestEconomies[mode]
      const deck = deckOf(mode)
      const fights = []
      for (let seed = 1; seed <= seeds; seed += 1) fights.push(lab.fightEnemy(eco, 'old-mines-rhahk-zor', deck, 'planner', seed))
      for (const phaseNo of [1, 2]) {
        const per = fights.map(item => item.log.filter(turn => turn.phase === phaseNo))
        const turns = per.flat()
        rows.push({
          mode, phase: phaseNo, turnsPerBattle: r(mean(per.map(list => list.length)), 1), lossPerTurn: r(mean(turns.map(turn => turn.lost.warrior + turn.lost.mage))),
          lostV: r(mean(per.map(list => list.reduce((sum, turn) => sum + turn.lost.warrior, 0))), 1), lostJ: r(mean(per.map(list => list.reduce((sum, turn) => sum + turn.lost.mage, 0))), 1),
          defenseMana: r(mean(turns.map(turn => turn.manaOnDefense))), offenseMana: r(mean(turns.map(turn => turn.manaOnOffense))),
          armorGranted: r(mean(turns.map(turn => turn.armorGranted)), 1), armorAbsorbed: r(mean(turns.map(turn => turn.armorAbsorbed)), 1),
          armorEfficiency: r(share(turns.reduce((s, i) => s + i.armorAbsorbed, 0), turns.reduce((s, i) => s + i.armorGranted, 0))), damageDealt: r(mean(turns.map(turn => turn.damageDealt)), 1),
          reached: r(share(per.filter(list => list.length).length, seeds)),
        })
      }
    }
    await write('boss-phases', rows)
    console.table(rows)
  }

  if (phase === 'hands' || phase === 'all') {
    // For random hands and each kind of blow: the least health the party can lose, and what safety costs in damage.
    const rows = []
    const cases = [['honest-b1', 'armor10', false], ['honest-b1', 'armor8', false], ['honest-b1', 'armor6', false], ['honest-b2', 'armor10', true], ['honest-b2', 'armor8', true], ['honest-b2', 'armor6', true]]
    for (const [mode, variant, frost] of cases) {
      const eco = economy.honestEconomies[mode]
      const deck = decks.honestDeck(variant, frost)
      for (const threat of lab.threatSuite) {
        const results = []
        for (let seed = 1; seed <= handCount; seed += 1) results.push(lab.bestResponses(lab.threatState(eco, deck, threat, seed)))
        rows.push({
          mode, deck: variant, armorSources: decks.armorSources(deck), threat: threat.id, label: threat.label, hands: handCount,
          fullyBlockable: r(share(results.filter(item => item.minLoss === 0).length, handCount)), meanMinLoss: r(mean(results.map(item => item.minLoss)), 1),
          p90MinLoss: quantile(results.map(item => item.minLoss), 0.9), loses9Plus: r(share(results.filter(item => item.minLoss >= 9).length, handCount)),
          manaForSafest: r(mean(results.map(item => item.manaAtMinLoss)), 1), damageWhenSafest: r(mean(results.map(item => item.damageAtMinLoss)), 1),
          maxDamage: r(mean(results.map(item => item.maxDamage)), 1), maxDamageP50: quantile(results.map(item => item.maxDamage), 0.5), maxDamageP75: quantile(results.map(item => item.maxDamage), 0.75), maxDamageP90: quantile(results.map(item => item.maxDamage), 0.9),
          lossWhenMaxDamage: r(mean(results.map(item => item.lossAtMaxDamage)), 1),
          damageAllowing3: r(mean(results.map(item => item.damageByAllowedLoss[3])), 1), damageAllowing6: r(mean(results.map(item => item.damageByAllowedLoss[6])), 1),
        })
      }
    }
    await write('hands', rows)
    console.log('hands written', rows.length)
  }

  if (phase === 'frost' || phase === 'all') {
    // Frost and Steel at the level of one hand: does Frostbite beat plain armor, is spending it a real choice?
    const rows = []
    for (const variant of ['armor10', 'armor8', 'armor6']) {
      const eco = economy.honestEconomies['honest-b2']
      const deck = decks.honestDeck(variant, true)
      for (const threat of lab.threatSuite) {
        let withGrip = 0, cuts = 0, cutSum = 0, both = 0, dilemma = 0, shatterOnly = 0, holdOnly = 0, extra = []
        for (let seed = 1; seed <= handCount; seed += 1) {
          const state = lab.threatState(eco, deck, threat, seed)
          const ids = state.hand.map(card => card.definitionId)
          if (!ids.includes('frost-grip')) continue
          withGrip += 1
          const full = lab.bestResponses(state)
          const without = lab.bestResponses(lab.threatState(eco, deck, threat, seed), 6000, ['frost-grip'])
          if (without.minLoss > full.minLoss) { cuts += 1; cutSum += without.minLoss - full.minLoss }
          if (!ids.includes('ice-breaker')) continue
          both += 1
          const hold = full.frontier.filter(point => point.plays.includes('frost-grip') && !point.plays.includes('ice-breaker'))
          const shatter = full.frontier.filter(point => point.plays.includes('frost-grip') && point.plays.includes('ice-breaker'))
          if (hold.length && shatter.length) { dilemma += 1; extra.push(Math.min(...shatter.map(point => point.loss)) - Math.min(...hold.map(point => point.loss))) }
          else if (shatter.length) shatterOnly += 1
          else holdOnly += 1
        }
        rows.push({
          deck: variant, threat: threat.id, handsWithGrip: withGrip, frostCutsLoss: r(share(cuts, withGrip)), meanCut: r(cuts ? cutSum / cuts : 0, 1),
          handsWithBoth: both, realChoice: r(share(dilemma, both)), shatterAlwaysBest: r(share(shatterOnly, both)), holdAlwaysBest: r(share(holdOnly, both)), extraLossToShatter: r(mean(extra), 1),
        })
      }
    }
    await write('frost', rows)
    console.log('frost written', rows.length)
  }

  if (phase === 'frost-use' || phase === 'all') {
    // What a player actually does with Frostbite in B2: keeps it (applies and does not spend) or spends it on Ice Breaker in the same turn.
    // Counted separately for turns when a blow lands and quiet turns, for the two planners. A one-turn planner cannot keep a status for the
    // next turn's blow, so on quiet turns it always spends; that is a limit of the player, not of the rule (see the report).
    const rows = []
    const eco = economy.honestEconomies['honest-b2']
    const deck = decks.honestDeck('armor8', true)
    for (const strategy of ['planner', 'planner-careful']) {
      for (const enemy of lab.sectorEnemyIds) {
        const count = { strikeHold: 0, strikeSpend: 0, quietHold: 0, quietSpend: 0 }
        for (let seed = 1; seed <= seeds; seed += 1) {
          for (const turn of lab.fightEnemy(eco, enemy, deck, strategy, seed).log) {
            if (!turn.frostApplied) continue
            count[(turn.strike ? 'strike' : 'quiet') + (turn.frostBurst ? 'Spend' : 'Hold')] += 1
          }
        }
        rows.push({ strategy, enemy: enemyName(enemy), ...count, strikeKept: r(share(count.strikeHold, count.strikeHold + count.strikeSpend)) })
      }
    }
    await write('frost-use', rows)
    console.log('frost-use written', rows.length)
  }

  if (phase === 'runs' || phase === 'all') {
    // Whole Sector I runs, same seeds in every mode, same policy for route, rooms, rewards and rests.
    const rows = []
    const cases = []
    for (const mode of modes) for (const variant of ['armor10', 'armor8', 'armor6']) cases.push([mode, variant])
    for (const strategy of ['planner', 'planner-careful', 'defensive', 'balanced']) {
      for (const [mode, variant] of cases) {
        if (mode === 'honest-a08' && variant !== 'armor10' && strategy !== 'planner') continue
        const eco = economy.honestEconomies[mode]
        const deck = mode === 'honest-a08' ? decks.honestDeck(variant, false) : decks.honestDeck(variant, modeOf(mode).frost === true)
        const logs = []
        for (let seed = 1; seed <= runCount; seed += 1) logs.push(lab.simulateSectorRun(seed, eco, deck, strategy))
        const won = logs.filter(log => log.result === 'victory')
        const deaths = {}
        for (const log of logs.filter(item => item.result === 'defeat')) { const key = enemyName(log.battles.at(-1).enemy); deaths[key] = (deaths[key] ?? 0) + 1 }
        rows.push({
          mode, deck: variant, strategy, runs: runCount, win: r(share(won.length, runCount)), timeouts: logs.filter(log => log.result === 'timeout').length,
          battlesPerRun: r(mean(logs.map(log => log.battles.length)), 1), healthEndV: r(mean(won.map(log => log.healthEnd.warrior)), 1), healthEndJ: r(mean(won.map(log => log.healthEnd.mage)), 1),
          lostV: r(mean(logs.map(log => log.battles.reduce((sum, item) => sum + item.fight.lost.warrior, 0))), 1), lostJ: r(mean(logs.map(log => log.battles.reduce((sum, item) => sum + item.fight.lost.mage, 0))), 1),
          diedAt: deaths,
        })
      }
    }
    await write('runs', rows)
    console.log('runs written', rows.length)
  }
} finally { await server.close() }
