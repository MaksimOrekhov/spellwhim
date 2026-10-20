import { definitions, loadouts } from './config.mjs'

export const modules = ['campaign', 'dungeonGenerator', 'dungeonRooms', 'sectorContent', 'battle', 'balance', 'balancePlanner', 'cardProgression', 'types', 'economy', 'dungeonRoutePolicy', 'runSave']
export function simulation(m) {
  const { campaign: c, battle: b, balance, balancePlanner: planner, cardProgression: p, dungeonRooms: rooms, types, dungeonRoutePolicy: policy } = m
  const heroIds = ['warrior', 'mage']
  const hp = run => heroIds.map(id => run.heroes[id].health)
  const decks = { 18: [...types.startingDeck], 14: ['sword-strike', 'sword-strike', 'fireball', 'guard', 'guard', 'parry', 'shield-bash', 'interpose', 'frostbolt', 'frostbolt', 'arcane-insight', 'ice-ward', 'ice-ward', 'thunderbolt'] }
  decks[16] = [...decks[14], 'parry', 'arcane-insight']
  function apply(variant) {
    for (const e of definitions(variant)) Object.assign(m.sectorContent.sectorEncounters.find(x => x.id === e.id), structuredClone(e))
  }
  function artifacts(heroes, loadout) {
    return loadouts[loadout].map(([definitionId, owner], i) => ({ instanceId: 'study/item/' + i, definitionId, ownerInstanceId: heroes[owner].instanceId }))
  }
  function battle(encounter, seed, deck = 18, health = [25, 18], loadout = 'none') {
    const heroes = c.createCampaignBattle({ seed, battleId: 'study/party' }).heroes
    heroIds.forEach((id, i) => { heroes[id].health = health[i] })
    return c.createCampaignBattle({ encounter, heroes, seed, deck: decks[deck], economy: m.economy.gameEconomy, battleId: 'study/battle', artifacts: artifacts(heroes, loadout) })
  }
  function fight(state, strategy, trace = false, starterSize = 18) {
    const plan = strategy === 'planner' ? planner.createTurnPlanner() : null
    const entry = hp(state), initial = state.hand.map(x => x.definitionId)
    const out = { turns: 0, plays: 0, manaAvailable: 0, manaSpent: 0, handLeft: 0, unusedManaWithAttack: 0, armorGranted: 0, armorAbsorbed: 0, armorExpired: 0, rawThreat: 0, freeTurns: 0, attacks: 0, phase2Turns: 0, phase2Actions: 0, preparations: 0, preparationsKilled: 0, upgradedPlays: 0, acquiredPlays: 0, defensePlays: 0, openingDefenses: initial.filter(id => types.cardDefinition(id).kind === 'defense').length, actions: {}, trace: trace ? [] : undefined }
    while (!state.result && out.turns < 30) {
      out.turns++
      out.manaAvailable += state.mana
      const declared = structuredClone(state.enemy.nextAction)
      const phaseAtStart = state.enemy.nextActionPhase
      out.phase2Turns += Number(phaseAtStart === 2)
      if (declared.kind === 'prepare') out.preparations++
      const turn = trace ? { turn: state.turn, hp: hp(state), enemy: state.enemy.health, action: declared, hand: state.hand.map(x => [x.definitionId, x.upgrade]), mana: state.mana, plays: [] } : null
      for (let n = 0; n < 40 && !state.result; n++) {
        let id = plan ? plan.next(state) : balance.chooseCard(state, strategy === 'aggressive-fill' ? 'aggressive' : strategy, 'public')?.instanceId
        if (!id && strategy === 'aggressive-fill') id = balance.chooseCard(state, 'balanced', 'public')?.instanceId
        if (!id) break
        const instance = state.hand.find(x => x.instanceId === id), definition = p.resolveCardDefinition(instance)
        const before = state.mana, armor = heroIds.map(h => state.heroes[h].armor)
        out.plays++; out.defensePlays += Number(definition.kind === 'defense'); out.upgradedPlays += Number(instance.upgrade === 1)
        // Persistent copy IDs preserve acquisition order even after removal/replacement.
        out.acquiredPlays += Number(/\/card\/(\d+)$/.test(id) && Number(id.match(/\/card\/(\d+)$/)[1]) > starterSize)
        if (!b.playCard(state, id).ok) throw Error('Illegal play')
        out.manaSpent += before - state.mana
        heroIds.forEach((h, i) => { out.armorGranted += Math.max(0, state.heroes[h].armor - armor[i]) })
        if (turn) turn.plays.push({ card: definition.id, upgrade: instance.upgrade, mana: before - state.mana, enemyAfter: state.enemy.health, armor: heroIds.map(h => state.heroes[h].armor) })
      }
      if (JSON.stringify(declared) !== JSON.stringify(state.enemy.nextAction)) throw Error('Announced intent changed')
      out.handLeft += state.hand.length
      if (!state.result && state.hand.some(x => p.resolveCardDefinition(x).cost <= state.mana && b.previewCard(state, p.resolveCardDefinition(x)).damage > 0)) out.unusedManaWithAttack += state.mana
      if (!state.result) {
        const forecast = b.forecastEnemyAction(state)
        const armorBefore = heroIds.map(h => state.heroes[h].armor)
        const hpBefore = hp(state)
        b.endTurn(state)
        const performed = declared.kind !== 'prepare' || state.result !== 'victory'
        // Bleeding can kill before the enemy action. Detect actual damage/armor consumption.
        const wasHit = forecast.targets.length > 0 && (hp(state).some((x, i) => x !== hpBefore[i]) || heroIds.some((h, i) => state.heroes[h].armor < armorBefore[i]))
        // A zero-damage attack may still execute; status-lethal is identifiable by victory with unchanged party.
        const executed = state.result !== 'victory' || wasHit
        if (executed && performed) {
          out.actions[declared.kind] = (out.actions[declared.kind] ?? 0) + 1
          out.phase2Actions += Number(phaseAtStart === 2)
          if (forecast.targets.length) {
            out.attacks++
            for (const hit of forecast.targets) {
              out.rawThreat += hit.attack; out.armorAbsorbed += hit.absorbed
              out.armorExpired += Math.max(0, armorBefore[heroIds.indexOf(hit.target)] - hit.absorbed)
            }
          } else out.freeTurns++
        }
        if (declared.kind === 'prepare' && !state.result && JSON.stringify(state.enemy.nextAction) !== JSON.stringify(declared.prepared)) throw Error('Preparation changed target')
      } else if (declared.kind === 'prepare') out.preparationsKilled++
      if (turn) { turn.after = { hp: hp(state), enemy: state.enemy.health, mana: state.mana }; out.trace.push(turn) }
    }
    return { ...out, result: state.result ?? 'timeout', endW: state.heroes.warrior.health, endM: state.heroes.mage.health, lossW: entry[0] - state.heroes.warrior.health, lossM: entry[1] - state.heroes.mage.health, armorAtEnd: heroIds.reduce((s, h) => s + state.heroes[h].armor, 0), handLeft: out.handLeft / out.turns }
  }
  function newRun(seed, opts = {}) {
    let run = c.createSectorRun(seed, m.economy.gameEconomy, decks[opts.deck ?? 18], undefined, 'study-' + seed)
    run.artifacts = artifacts(run.heroes, opts.loadout ?? 'none')
    if (opts.health) heroIds.forEach((h, i) => { run.heroes[h].health = opts.health[i] })
    return run
  }
  function room(run, policyName, noArtifacts, leave = false) {
    const room = run.room
    if (leave) return rooms.resolveRoom(run, { roomId: room.id, action: 'leave' })
    let action = room.type === 'treasure' ? (noArtifacts ? 'card' : 'artifact') : room.type === 'forge' ? (policyName === 'safe' ? 'remove' : policyName === 'risky' ? 'replace' : 'upgrade') : room.eventId === 'powder-store' ? (policyName === 'safe' ? 'card' : 'risk') : room.eventId === 'goblin-trade' ? (policyName === 'safe' ? 'remove' : 'replace') : (policyName === 'safe' ? 'remove' : 'upgrade')
    const hero = [...heroIds].sort((a, b) => run.heroes[b].health - run.heroes[a].health)[0]
    if (action === 'risk' && heroIds.some(h => run.heroes[h].health <= 2)) action = 'card'
    if (action === 'upgrade' && room.eventId === 'forgotten-forge' && run.heroes[hero].health <= 3) action = 'remove'
    const target = rooms.roomEligibleCards(run, action)[0]
    if (['remove', 'replace', 'upgrade'].includes(action) && !target) action = 'leave'
    const replacement = target ? rooms.roomReplacementOptions(run, target)[0] : undefined
    const owner = heroIds.find(id => !run.artifacts.some(a => a.ownerInstanceId === run.heroes[id].instanceId))
    if (action === 'artifact' && !owner) action = 'card'
    return rooms.resolveRoom(run, { roomId: room.id, action, instanceId: target?.instanceId, cardId: action === 'replace' ? replacement?.definitionId : room.cards[0]?.definitionId, heroId: action === 'artifact' ? owner : hero, artifactId: room.artifactIds[0] })
  }
  function rest(run, mode = 'adaptive') {
    const injured = [...heroIds].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
    const target = run.deck.find(p.canUpgradeCard)
    const heal = mode === 'heal' || mode === 'adaptive' && run.heroes[injured].health / run.heroes[injured].maxHealth < .65
    if (heal && run.heroes[injured].health === run.heroes[injured].maxHealth) return { choice: 'skip', run: c.resolveDungeonRest(run, null) }
    return { choice: mode === 'skip' ? 'skip' : heal ? 'heal' : target ? 'upgrade' : 'skip', run: mode === 'skip' ? c.resolveDungeonRest(run, null) : heal ? c.resolveDungeonRest(run, injured) : target ? c.upgradeDungeonRest(run, target.instanceId, run.runId + '/' + run.currentNodeId) : c.resolveDungeonRest(run, null) }
  }
  function reward(run, noArtifacts = false, skip = false) {
    if (!run.pendingReward) return run
    const offer = run.pendingReward
    const owner = heroIds.find(id => !run.artifacts.some(a => a.ownerInstanceId === run.heroes[id].instanceId))
    if (skip && offer.elite) {
      // The UI intentionally has no elite-skip operation. Consume a real card reward,
      // then neutralise ONLY that acquisition in this explicit research counterfactual.
      const claimed = c.claimDungeonReward(run, c.dungeonRewardOptions(run)[0])
      return { ...claimed, deck: structuredClone(run.deck), artifacts: structuredClone(run.artifacts), nextCardId: run.nextCardId }
    }
    if (skip || !offer.elite && run.deck.length >= 21) return c.skipDungeonReward(run, offer.id)
    if (offer.elite && owner && !noArtifacts) return c.claimDungeonArtifact(run, offer.artifactIds[0], run.heroes[owner].instanceId)
    return c.claimDungeonReward(run, c.dungeonRewardOptions(run)[0])
  }
  function step(run, node, opts) {
    run = c.enterDungeonNode(run, node.id)
    let outcome, restChoice
    if (run.room) run = room(run, opts.policy ?? 'mixed', opts.noArtifacts, opts.leaveService)
    else if (node.type === 'rest') { const r = rest(run, opts.rest); run = r.run; restChoice = r.choice }
    else {
      const state = c.restoreDungeonBattle(run, m.economy.gameEconomy, 'study/battle')
      // The route chooser deliberately returns a PUBLIC node without encounter data.
      // Only after entering may telemetry read the now-revealed encounter from the run.
      const entered = c.dungeonNode(run.map, node.id)
      outcome = { encounter: entered.encounterId, node: node.id, type: node.type, entryW: run.heroes.warrior.health, entryM: run.heroes.mage.health, ...fight(state, opts.strategy ?? 'balanced', opts.trace, opts.deck ?? 18) }
      if (!state.result) throw Error('Timeout')
      run = c.resolveDungeonBattle(run, state)
    }
    run = reward(run, opts.noArtifacts, opts.skipReward && node.type === 'elite')
    return { run, outcome, restChoice }
  }
  function route(seed, opts = {}) {
    let run = opts.run ? structuredClone(opts.run) : newRun(seed, opts)
    const out = { seed, battles: [], checkpoints: [], restChoices: [], preRest: null, preBossW: 0, preBossM: 0, reachedBoss: false }
    while (run.status === 'active') {
      const choices = c.availableDungeonNodes(run).map(policy.publicDungeonNodeView)
      const node = opts.firstNode ? choices.find(n => n.id === opts.firstNode) : policy.chooseDungeonRouteNode(choices, run.heroes, opts.policy ?? 'mixed')
      if (!node) throw Error('Stuck route')
      if (node.type === 'rest') out.preRest = structuredClone(run)
      if (node.type === 'final') { out.reachedBoss = true; out.preBossW = run.heroes.warrior.health; out.preBossM = run.heroes.mage.health }
      const result = step(run, node, opts)
      run = result.run
      if (result.outcome) out.battles.push(result.outcome)
      if (result.restChoice) out.restChoices.push(result.restChoice)
      out.checkpoints.push({ layer: node.layer, type: node.type, hp: hp(run), deck: run.deck.length, artifacts: run.artifacts.length })
      if (opts.firstNode) opts = { ...opts, firstNode: undefined, skipReward: false, leaveService: false }
      if (opts.stopAfter === node.layer) break
    }
    const boss = out.battles.find(b => b.type === 'final')
    return { ...out, result: run.status, endW: run.heroes.warrior.health, endM: run.heroes.mage.health, turns: out.battles.reduce((s, b) => s + b.turns, 0), bossTurns: boss?.turns ?? 0, deadAt: run.status === 'defeat' ? run.currentNodeId : null, gained: run.journal.filter(j => j.card).length, upgrades: run.journal.filter(j => j.kind === 'upgrade').length, finalDeck: run.deck, journal: run.journal, run }
  }
  // Public graph alone selects a prefix ending at a genuine elite/service fork.
  function elitePrefix(seed, opts) {
    let run = newRun(seed, opts)
    const nodes = run.map.layers.flat().map(policy.publicDungeonNodeView)
    const forks = nodes.filter(n => n.layer === 1 && n.edges.some(id => nodes.find(x => x.id === id)?.type === 'elite') && n.edges.some(id => ['forge', 'treasure', 'event'].includes(nodes.find(x => x.id === id)?.type)))
    const fork = forks.sort((a, b) => a.column - b.column)[0]
    if (!fork) return null
    const entry = nodes.filter(n => n.layer === 0 && n.edges.includes(fork.id)).sort((a, b) => a.column - b.column)[0]
    if (!entry) throw Error('Unreachable fork')
    const history = []
    for (const n of [entry, fork]) { const result = step(run, n, opts); run = result.run; if (result.outcome) history.push(result.outcome); if (run.status !== 'active') return { dead: true, run, history } }
    const choices = c.availableDungeonNodes(run).map(policy.publicDungeonNodeView)
    return { run, history, elite: choices.find(n => n.type === 'elite'), safe: policy.chooseDungeonRouteNode(choices.filter(n => n.type !== 'elite'), run.heroes, 'safe') }
  }
  return { apply, battle, fight, route, newRun, step, rest, elitePrefix, decks }
}

export const mean = (rows, field) => rows.length ? rows.reduce((s, r) => s + (typeof field === 'function' ? field(r) : r[field]), 0) / rows.length : null
export const won = row => ['victory', 'sector-complete'].includes(row.result)
export function summarize(rows) {
  const numeric = ['turns', 'endW', 'endM', 'lossW', 'lossM', 'manaAvailable', 'manaSpent', 'armorGranted', 'armorAbsorbed', 'armorExpired', 'armorAtEnd', 'rawThreat', 'freeTurns', 'attacks', 'phase2Turns', 'phase2Actions', 'plays', 'upgradedPlays', 'acquiredPlays', 'handLeft', 'unusedManaWithAttack', 'openingDefenses', 'preparations', 'preparationsKilled', 'preBossW', 'preBossM', 'bossTurns']
  return { n: rows.length, wins: rows.filter(won).length, winPct: 100 * mean(rows, r => Number(won(r))), ...Object.fromEntries(numeric.filter(k => typeof rows[0]?.[k] === 'number').map(k => [k, mean(rows, k)])), timeouts: rows.filter(r => r.result === 'timeout').length }
}
