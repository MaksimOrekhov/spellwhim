// Shared simulation helpers for the review. Mirrors scripts/run-sector-one.mjs semantics (public information, real engine).
export const MODULES = ['dungeonGenerator', 'campaign', 'dungeonRooms', 'sectorContent', 'battle', 'balance', 'balancePlanner', 'types', 'economy', 'dungeonRoutePolicy', 'cardProgression']

export function makeSim(m) {
  const { campaign: camp, battle: rules, balance, balancePlanner: planner, cardProgression: prog, dungeonRooms: rooms, types, economy, dungeonRoutePolicy: policy, sectorContent: sc } = m
  const decks = {
    18: types.startingDeck,
    14: ['sword-strike', 'sword-strike', 'fireball', 'guard', 'guard', 'parry', 'shield-bash', 'interpose', 'frostbolt', 'frostbolt', 'arcane-insight', 'ice-ward', 'ice-ward', 'thunderbolt'],
  }
  decks[16] = [...decks[14], 'parry', 'arcane-insight']

  function fight(state, strategy) {
    const plan = strategy === 'planner' ? planner.createTurnPlanner() : null
    const entry = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    let turns = 0, attacksLanded = 0, rawThreat = 0, freeTurns = 0, manaLeft = 0, manaTotal = 0, defPlays = 0, plays = 0, handLeft = 0
    while (!state.result && turns < 30) {
      turns++
      for (let p = 0; p < 20 && !state.result; p++) {
        const id = plan ? plan.next(state) : balance.chooseCard(state, strategy, 'public')?.instanceId
        if (!id) break
        const def = prog.resolveCardDefinition(state.hand.find(c => c.instanceId === id))
        if (def.kind === 'defense') defPlays++
        plays++
        if (!rules.playCard(state, id).ok) throw Error('Illegal bot play')
      }
      manaLeft += state.mana; manaTotal += state.maxMana; handLeft += state.hand.length
      if (!state.result) {
        const a = state.enemy.nextAction
        if (a.kind === 'attack' || a.kind === 'attack_all') { attacksLanded++; rawThreat += a.damage * (a.kind === 'attack_all' ? 2 : 1) } else freeTurns++
        rules.endTurn(state)
      }
    }
    return { result: state.result ?? 'timeout', turns, manaLeftPerTurn: manaLeft / turns, manaUsePct: 100 * (1 - manaLeft / manaTotal), defShare: defPlays / Math.max(1, plays), handLeft: handLeft / turns, attacksLanded, rawThreat, freeTurns, lossW: entry.warrior - state.heroes.warrior.health, lossM: entry.mage - state.heroes.mage.health, endW: state.heroes.warrior.health, endM: state.heroes.mage.health }
  }

  function battle(encounter, { seed, deck = decks[18], health, artifacts = [] } = {}) {
    const heroes = camp.createCampaignBattle({ seed, battleId: 'r' }).heroes
    if (health) { heroes.warrior.health = health[0]; heroes.mage.health = health[1] }
    return camp.createCampaignBattle({ encounter, heroes, seed, deck, economy: economy.gameEconomy, battleId: 'review', artifacts: artifacts.map(([definitionId, owner], i) => ({ instanceId: 'it' + i, definitionId, ownerInstanceId: heroes[owner].instanceId })) })
  }

  /** Full sector run. opts: policy, strategy, deck, noArtifacts, forceElite ('yes'|'no'|undefined). */
  function route(seed, { policy: policyName = 'mixed', strategy = 'balanced', deck = decks[18], noArtifacts = false, forceElite } = {}) {
    let run = camp.createSectorRun(seed, economy.gameEconomy, deck, undefined, 'review-' + seed)
    const out = { seed, battles: 0, elites: 0, turns: 0, minFrac: 1, bossLossW: 0, bossLossM: 0, bossTurns: 0, preBossW: 0, preBossM: 0, route: [] }
    // optional: steer the elite decision by filtering choices that cannot / must reach an elite
    const paths = m.dungeonGenerator.sectorPaths(run.map)
    while (run.status === 'active') {
      let choices = camp.availableDungeonNodes(run)
      if (forceElite) {
        const prefix = run.visitedNodeIds
        const ok = choices.filter(n => paths.some(p => p.slice(0, prefix.length).every((x, i) => x.id === prefix[i]) && p[prefix.length]?.id === n.id && (forceElite === 'yes') === p.some(x => x.type === 'elite')))
        if (ok.length) choices = ok
        else if (forceElite === 'yes' && run.visitedNodeIds.length === 0) return null
      }
      const node = policy.chooseDungeonRouteNode(choices.map(policy.publicDungeonNodeView), run.heroes, policyName)
      run = camp.enterDungeonNode(run, node.id); out.route.push(node.type)
      if (run.room) {
        const room = run.room
        let action = room.type === 'treasure' ? (noArtifacts ? 'card' : 'artifact') : room.type === 'forge' ? (policyName === 'safe' ? 'remove' : policyName === 'risky' ? 'replace' : 'upgrade') : room.eventId === 'powder-store' ? (policyName === 'safe' ? 'card' : 'risk') : room.eventId === 'goblin-trade' ? (policyName === 'safe' ? 'remove' : 'replace') : (policyName === 'safe' ? 'remove' : 'upgrade')
        const heroId = ['warrior', 'mage'].sort((a, b) => run.heroes[b].health - run.heroes[a].health)[0]
        if (action === 'risk' && Object.values(run.heroes).some(h => h.health <= 2)) action = 'card'
        if (action === 'upgrade' && room.eventId === 'forgotten-forge' && run.heroes[heroId].health <= 3) action = 'remove'
        const target = rooms.roomEligibleCards(run, action)[0]
        if (['remove', 'replace', 'upgrade'].includes(action) && !target) action = 'leave'
        const replacement = target ? room.replacements[types.cardDefinition(target.definitionId).className].find(c => c.definitionId !== target.definitionId) : undefined
        const owner = ['warrior', 'mage'].find(id => !run.artifacts.some(a => a.ownerInstanceId === run.heroes[id].instanceId))
        if (action === 'artifact' && !owner) action = 'card'
        run = rooms.resolveRoom(run, { roomId: room.id, action, instanceId: target?.instanceId, cardId: action === 'replace' ? replacement?.definitionId : room.cards[0].definitionId, heroId: action === 'artifact' ? owner : heroId, artifactId: room.artifactIds[0] })
      } else if (node.type === 'rest') {
        const injured = ['warrior', 'mage'].sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]
        const copy = run.deck.find(prog.canUpgradeCard)
        run = run.heroes[injured].health / run.heroes[injured].maxHealth < .65 ? camp.resolveDungeonRest(run, injured) : copy ? camp.upgradeDungeonRest(run, copy.instanceId, run.runId + '/' + node.id) : camp.resolveDungeonRest(run, null)
      } else {
        if (node.type === 'final') { out.preBossW = run.heroes.warrior.health; out.preBossM = run.heroes.mage.health }
        const state = camp.restoreDungeonBattle(run, economy.gameEconomy, 'review'), o = fight(state, strategy)
        if (!state.result) { out.result = 'timeout'; return out }
        out.turns += o.turns; out.battles++; out.elites += Number(node.type === 'elite')
        if (node.type === 'final') { out.bossLossW = o.lossW; out.bossLossM = o.lossM; out.bossTurns = o.turns }
        run = camp.resolveDungeonBattle(run, state)
      }
      out.minFrac = Math.min(out.minFrac, run.heroes.warrior.health / 25, run.heroes.mage.health / 18)
      if (run.pendingReward) {
        const offer = run.pendingReward, owner = ['warrior', 'mage'].find(id => !run.artifacts.some(a => a.ownerInstanceId === run.heroes[id].instanceId))
        if (offer.elite && owner && !noArtifacts) run = camp.claimDungeonArtifact(run, offer.artifactIds[0], run.heroes[owner].instanceId)
        else if (!offer.elite && run.deck.length >= 21) run = camp.skipDungeonReward(run, offer.id)
        else run = camp.claimDungeonReward(run, camp.dungeonRewardOptions(run)[0])
      }
    }
    out.result = run.status; out.endW = run.heroes.warrior.health; out.endM = run.heroes.mage.health; out.deck = run.deck.length; out.artifacts = run.artifacts.length
    out.route = out.route.join('>')
    return out
  }

  // ---- in-memory enemy variants (never written to disk) ----
  const all = [...sc.sectorOneEnemies, sc.sectorOneElite, sc.rhahkZor]
  const originals = all.map(e => structuredClone({ maxHealth: e.maxHealth, behavior: e.behavior }))
  function resetEnemies() { all.forEach((e, i) => { e.maxHealth = originals[i].maxHealth; e.behavior = structuredClone(originals[i].behavior) }) }
  function setEnemy(id, patch) { const e = all.find(x => x.id === id); Object.assign(e, structuredClone(patch)) }
  const byId = id => all.find(x => x.id === id)
  return { decks, fight, battle, route, resetEnemies, setEnemy, byId, all }
}

export const avg = (rows, k) => +(rows.reduce((s, r) => s + (r[k] ?? 0), 0) / rows.length).toFixed(2)
export const winPct = rows => +(100 * rows.filter(r => r.result === 'victory' || r.result === 'sector-complete').length / rows.length).toFixed(1)
