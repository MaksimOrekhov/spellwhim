import { chooseCard } from './balance'
import type { ClassicStrategy } from './balance'
import { cloneBattleState, createTurnPlanner } from './balancePlanner'
import { createBattle, endTurn, forecastEnemyAction, playCard, previewCard } from './battle'
import { availableDungeonNodes, claimDungeonArtifact, claimDungeonReward, createCampaignBattle, createSectorRun, dungeonEncounter, dungeonNode, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, skipDungeonReward, upgradeDungeonRest } from './campaign'
import type { DungeonRunState } from './campaign'
import { canUpgradeCard } from './cardProgression'
import { chooseDungeonRouteNode, publicDungeonNodeView } from './dungeonRoutePolicy'
import type { DungeonRoutePolicy } from './dungeonRoutePolicy'
import { resolveRoom, roomActionAvailable, roomEligibleCards } from './dungeonRooms'
import type { RoomAction } from './dungeonRooms'
import type { EconomyConfig } from './economy'
import { resolveCardDefinition } from './cardProgression'
import type { Information } from './observableIntent'
import { rhahkZor, sectorEncounters, sectorOneElite } from './sectorContent'
import { cardDefinition } from './types'
import type { BattleState, CardId, CardInstance, EncounterDefinition, EnemyAction, HeroId } from './types'

/**
 * Headless laboratory of the Honest Turn B experiment (docs/design/honest-turn-b-experiment-v1.md). Everything here plays through the real
 * engine (`createBattle`, `playCard`, `endTurn`, `forecastEnemyAction`); no rule is copied. Three instruments:
 *  - `runFight`: one battle with a player policy, with a record of every turn (what the party bought, what the enemy did to it);
 *  - the policies: the fair planner and the classic bots plus two deliberately naive reflexes ("play all armor", "never defend"),
 *    which exist to show whether a reflex is still the best answer;
 *  - `bestResponses`: for one hand and one announced threat, an exhaustive search of every legal turn, so the price of safety is measured
 *    in damage given up, not guessed.
 * Limits (also written in the report): the planner and the reflexes are not people; the search knows the real order of the cards that a
 * draw effect would give; one turn at a time is looked at, so a plan that keeps a status for a later turn is invisible to the search.
 */
export type LabStrategy = ClassicStrategy | 'planner' | 'planner-careful' | 'armor-all' | 'offense-all'
export const labStrategies: readonly LabStrategy[] = ['planner', 'planner-careful', 'balanced', 'aggressive', 'defensive', 'armor-all', 'offense-all']

/** The six enemies of Sector I as the lab fights them, from the economy's own data (health and damage of that mode). */
export const sectorEnemyIds: readonly string[] = ['old-mines-raider', 'old-mines-digger', 'old-mines-watchman', 'old-mines-overseer', 'old-mines-johnson', 'old-mines-rhahk-zor']

export function labEncounter(economy: EconomyConfig, id: string): EncounterDefinition {
  const base = [...sectorEncounters].find(encounter => encounter.id === id)
  if (!base) throw new Error('Unknown sector enemy ' + id)
  const type = id === rhahkZor.id ? 'final' : id === sectorOneElite.id ? 'elite' : 'battle'
  return dungeonEncounter({ id: 'lab', layer: 0, column: 0, type, edges: [], encounterId: id, encounterHealth: base.maxHealth }, economy)
}

const hasArmorEffect = (id: CardId) => cardDefinition(id).effects.some(effect => effect.type === 'armor')
export const isDefenseCard = (id: CardId) => hasArmorEffect(id) || id === 'frost-grip'

export interface Chooser { next(state: BattleState): string | undefined }

/** Value of the card for a reflex player: armor per mana for the one who plays all armor, damage per mana for the one who never defends. */
function reflexChoice(state: BattleState, kind: 'armor-all' | 'offense-all'): string | undefined {
  const rows = state.hand
    .map(instance => ({ instance, card: resolveCardDefinition(instance) }))
    .filter(({ card }) => card.cost <= state.mana)
    .map(({ instance, card }) => {
      const preview = previewCard(state, card)
      const armor = preview.armor.warrior + preview.armor.mage
      const damage = preview.damage + preview.statusDamage
      const cost = Math.max(0.5, card.cost)
      const armorValue = armor / cost
      const damageValue = damage / cost
      const pure = card.kind === 'defense'
      return { instance, score: kind === 'armor-all' ? (armor > 0 || card.id === 'frost-grip' ? 1000 + armorValue * 10 + damageValue : damageValue) : (pure && damage === 0 ? -1 : damageValue + (card.effects.some(effect => effect.type === 'draw') ? 0.4 : 0)) }
    })
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score)
  return rows[0]?.instance.instanceId
}

export function createChooser(strategy: LabStrategy, information: Information = 'public'): Chooser {
  if (strategy === 'planner' || strategy === 'planner-careful') {
    // The honest rules throw the hand away, so a card kept in hand is worth nothing to the planner (its default profile pays for kept cards).
    // `planner-careful` also counts lost health double: in a run, health does not come back, and time costs nothing.
    const planner = createTurnPlanner({ profile: strategy === 'planner' ? { keep: 0 } : { keep: 0, health: 2 } })
    return { next: state => planner.next(state) }
  }
  if (strategy === 'armor-all' || strategy === 'offense-all') return { next: state => reflexChoice(state, strategy) }
  return { next: state => chooseCard(state, strategy, information)?.instanceId }
}

export interface TurnLog {
  turn: number
  phase: 1 | 2
  /** The announced action of the turn (a preparation shows `prepare`; the strike follows on the next turn). */
  kind: EnemyAction['kind']
  /** A hit lands this turn (not a preparation, not a defence). */
  strike: boolean
  traits: { pierce: boolean; interrupt: boolean; exposes: boolean; group: boolean }
  mana: number
  handArmorCards: number
  manaOnDefense: number
  manaOnOffense: number
  armorGranted: number
  armorByClass: { warrior: number; mage: number }
  /** Armor granted, by the class of the card and by the hero who received it: who protects whom. */
  armorGrid: Record<'warrior' | 'mage', { warrior: number; mage: number }>
  armorAbsorbed: number
  /** Armor that did no work: on a hero who is not hit, or beyond what the hit needed (counting what piercing ignores). */
  armorWasted: number
  chillSaved: number
  frostApplied: boolean
  frostBurst: boolean
  damageDealt: number
  interruptNeed: number
  interruptDealt: number
  interruptBroken: boolean
  lost: { warrior: number; mage: number }
  /** Health actually lost minus the health the banner promised before the turn ended (always 0: nothing happens that was not announced). */
  unexplained: number
  /** Mana still unspent when the party ended the turn, and the cards of the hand it could have paid for. */
  manaLeft: number
  playableLeft: number
  targets: HeroId[]
  enemyPower: number
}

export interface FightLog {
  result: 'victory' | 'defeat' | 'timeout'
  turns: number
  lost: { warrior: number; mage: number }
  damageDealt: number
  log: TurnLog[]
  lowest: { warrior: number; mage: number }
  /** The turn a phase change happened, if any. */
  phaseShiftTurn: number | null
}

export function runFight(state: BattleState, chooser: Chooser, maxTurns = 40, maxPlays = 14): FightLog {
  const start = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
  const lowest = { ...start }
  const log: TurnLog[] = []
  let damageDealt = 0
  let turns = 0
  while (!state.result && turns < maxTurns) {
    turns += 1
    const announced = state.enemy.nextAction
    const forecast0 = forecastEnemyAction(state)
    const hitNow = announced.kind === 'attack' || announced.kind === 'attack_all' ? announced : null
    const entry: TurnLog = {
      turn: state.turn, phase: state.enemy.phase, kind: announced.kind, strike: !!hitNow,
      traits: { pierce: !!hitNow?.pierce, interrupt: hitNow?.interrupt !== undefined, exposes: !!hitNow?.exposes, group: announced.kind === 'attack_all' },
      mana: state.mana, handArmorCards: state.hand.filter(card => hasArmorEffect(card.definitionId)).length,
      manaOnDefense: 0, manaOnOffense: 0, armorGranted: 0, armorByClass: { warrior: 0, mage: 0 }, armorGrid: { warrior: { warrior: 0, mage: 0 }, mage: { warrior: 0, mage: 0 } }, armorAbsorbed: 0, armorWasted: 0, chillSaved: 0,
      frostApplied: false, frostBurst: false, damageDealt: 0, interruptNeed: hitNow?.interrupt ?? 0, interruptDealt: 0, interruptBroken: false,
      lost: { warrior: 0, mage: 0 }, unexplained: 0, manaLeft: 0, playableLeft: 0, targets: forecast0.threatened, enemyPower: state.enemy.power ?? 0,
    }
    for (let plays = 0; plays < maxPlays && !state.result; plays += 1) {
      const id = chooser.next(state)
      const instance: CardInstance | undefined = id ? state.hand.find(card => card.instanceId === id) : undefined
      if (!instance) break
      const card = resolveCardDefinition(instance)
      const preview = previewCard(state, card)
      const result = playCard(state, instance.instanceId)
      if (!result.ok) break
      if (isDefenseCard(card.id)) entry.manaOnDefense += card.cost
      else entry.manaOnOffense += card.cost
      const granted = preview.armor.warrior + preview.armor.mage
      entry.armorGranted += granted
      entry.armorByClass[card.className] += granted
      entry.armorGrid[card.className].warrior += preview.armor.warrior
      entry.armorGrid[card.className].mage += preview.armor.mage
      if (preview.appliedStatuses.includes('frostbite')) entry.frostApplied = true
      if (preview.damageParts.some(part => part.id === 'frostbite-burst')) entry.frostBurst = true
      entry.damageDealt += result.damageDealt
      damageDealt += result.damageDealt
    }
    if (state.result) { log.push(entry); break }
    const forecast = forecastEnemyAction(state)
    entry.interruptDealt = forecast.interrupt?.dealt ?? 0
    entry.interruptBroken = forecast.interrupt?.broken === true
    const landing = entry.interruptBroken ? [] : forecast.targets
    for (const hero of ['warrior', 'mage'] as const) {
      const armor = state.heroes[hero].armor
      const hitOnHero = landing.find(item => item.target === hero)
      if (!hitOnHero) { entry.armorWasted += armor; continue }
      entry.armorAbsorbed += hitOnHero.absorbed
      // Useful armor is what the hit could take: its size plus what piercing makes the armor ignore.
      entry.armorWasted += Math.max(0, armor - hitOnHero.attack - (hitOnHero.pierced ?? 0))
    }
    entry.chillSaved = landing.reduce((sum, item) => sum + (item.chill ?? 0), 0)
    entry.manaLeft = state.mana
    entry.playableLeft = state.hand.filter(card => resolveCardDefinition(card).cost <= state.mana).length
    const promised = landing.reduce((sum, item) => sum + item.healthLoss, 0)
    const before = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }
    endTurn(state)
    entry.lost = { warrior: before.warrior - state.heroes.warrior.health, mage: before.mage - state.heroes.mage.health }
    entry.unexplained = entry.lost.warrior + entry.lost.mage - promised
    lowest.warrior = Math.min(lowest.warrior, state.heroes.warrior.health)
    lowest.mage = Math.min(lowest.mage, state.heroes.mage.health)
    log.push(entry)
  }
  return {
    result: state.result ?? 'timeout', turns,
    lost: { warrior: start.warrior - state.heroes.warrior.health, mage: start.mage - state.heroes.mage.health },
    damageDealt, log, lowest, phaseShiftTurn: state.enemy.phaseShiftTurn ?? null,
  }
}

/** A fight of the six sector enemies from full health with the given deck: the unit of the per-enemy tables. */
export function fightEnemy(economy: EconomyConfig, enemyId: string, deck: readonly CardId[], strategy: LabStrategy, seed: number, heroes?: BattleState['heroes']): FightLog {
  const state = createCampaignBattle({ encounter: labEncounter(economy, enemyId), economy, deck, seed, heroes, battleId: `lab/${enemyId}/${strategy}/${seed}` })
  return runFight(state, createChooser(strategy))
}

/** Win counts and the cost of winning, on one scale that does not depend on which hero was hurt: 0 for a loss, else the share of health kept. */
export const outcomeValue = (fight: FightLog): number => fight.result === 'victory' ? Math.max(0, 1 - (fight.lost.warrior + fight.lost.mage) / 43) : 0

// ---------------------------------------------------------------------------------------------------------------------------------
// One hand, one announced threat, every legal turn.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface ThreatSpec { id: string; label: string; action: EnemyAction; exposed?: HeroId }
const strike = (name: string, damage: number, target: HeroId, traits: Partial<{ pierce: number; interrupt: number; exposes: 'vulnerability' }> = {}): EnemyAction => ({ kind: 'attack', name, damage, target, ...traits })

/** The kinds of blow the sector throws, each as one announced action with its real numbers. */
export const threatSuite: readonly ThreatSpec[] = [
  { id: 'light-warrior', label: 'Удар 6 по Вариану', action: strike('Удар', 6, 'warrior') },
  { id: 'heavy-warrior', label: 'Удар 13 по Вариану', action: strike('Удар', 13, 'warrior') },
  { id: 'heavy-mage', label: 'Удар 12 по Джайне', action: strike('Удар', 12, 'mage') },
  { id: 'group', label: 'Удар 8 по обоим', action: { kind: 'attack_all', name: 'Удар по обоим', damage: 8, primaryTarget: 'warrior' } },
  { id: 'pierce-mage', label: 'Удар 10 по Джайне, пробивает 5 брони', action: strike('Бронебойный болт', 10, 'mage', { pierce: 5 }) },
  { id: 'interruptible', label: 'Удар 13 по Вариану; сорвать: 14 урона', action: strike('Удар забойщика', 13, 'warrior', { interrupt: 14 }) },
  { id: 'group-pierce', label: 'Удар 7 по обоим, пробивает 3 брони', action: { kind: 'attack_all', name: 'Дрожь', damage: 7, primaryTarget: 'mage', pierce: 3 } },
  { id: 'exposed-mage', label: 'Удар 8 по Джайне, она Уязвима', action: strike('Удар', 8, 'mage'), exposed: 'mage' },
]

export interface Response { loss: number; damage: number; mana: number; plays: CardId[] }
/** One non-dominated way to spend the turn: no other play loses less health and deals as much damage. */
export interface FrontierPoint { loss: number; damage: number; plays: CardId[] }
export interface BestResponse {
  /** Smallest health the party can lose to this blow this turn with any legal play of this hand. */
  minLoss: number
  /** Most damage dealt to the enemy among the plays that reach `minLoss`, and the least mana such a play needs. */
  damageAtMinLoss: number
  manaAtMinLoss: number
  /** Most damage that can be dealt this turn at all, and the loss of the cheapest-loss play among those. */
  maxDamage: number
  lossAtMaxDamage: number
  /** For each health the party is willing to lose (0, 3, 6, 9): the most damage left. */
  damageByAllowedLoss: Record<number, number>
  /** The plays that reach `minLoss` use a card that makes armor / only a frost card / no defensive card at all. */
  safestUses: { armor: boolean; frost: boolean }
  /** Loss and damage trade-off: the plays nobody can beat on both. A hand whose frontier holds a play that keeps Frostbite and another that spends it has a real choice. */
  frontier: FrontierPoint[]
  evaluated: number
}

/** A hand and a threat as a ready fight: the party at full health, the enemy unkillable, the hand exactly as dealt. */
export function threatState(economy: EconomyConfig, deck: readonly CardId[], threat: ThreatSpec, seed: number): BattleState {
  const encounter: EncounterDefinition = { id: 'threat', name: 'Угроза', title: threat.label, maxHealth: 10_000, appearance: 'defias', mapLabel: 'Проверка', behavior: { phase1: [threat.action] } }
  const state = createBattle(encounter, undefined, { deck, seed, economy })
  if (threat.exposed) state.statuses[threat.exposed].push({ id: 'vulnerability', value: 1 })
  return state
}

const keyOf = (state: BattleState): string => [
  state.mana, state.hand.map(card => card.definitionId).sort().join(','), state.enemy.health, state.enemy.armor, state.enemy.hurt ?? 0,
  state.heroes.warrior.armor, state.heroes.mage.armor, JSON.stringify(state.statuses), state.drawPile.length,
].join('|')

function paretoFrontier(responses: readonly Response[]): FrontierPoint[] {
  const sorted = [...responses].sort((a, b) => a.loss - b.loss || b.damage - a.damage || a.mana - b.mana)
  const frontier: FrontierPoint[] = []
  let best = -1
  for (const item of sorted) {
    if (item.damage > best) { frontier.push({ loss: item.loss, damage: item.damage, plays: item.plays }); best = item.damage }
  }
  return frontier
}

/** `banned` cards are treated as dead cards (the search never plays them): the way to ask what a hand would do without one of its cards. */
export function bestResponses(root: BattleState, limit = 6000, banned: readonly CardId[] = []): BestResponse {
  const hp = (state: BattleState) => state.heroes.warrior.health + state.heroes.mage.health
  const startHp = hp(root)
  const startEnemy = root.enemy.health
  const responses: Response[] = []
  const seen = new Set<string>()
  let evaluated = 0
  const evaluate = (state: BattleState, plays: CardId[], spent: number) => {
    const after = cloneBattleState(state)
    endTurn(after)
    evaluated += 1
    responses.push({ loss: startHp - hp(after), damage: startEnemy - state.enemy.health, mana: spent, plays })
  }
  const walk = (state: BattleState, plays: CardId[], spent: number) => {
    evaluate(state, plays, spent)
    const tried = new Set<string>()
    for (const instance of state.hand) {
      const variant = instance.definitionId + (instance.upgrade ?? 0)
      if (tried.has(variant) || banned.includes(instance.definitionId) || resolveCardDefinition(instance).cost > state.mana || evaluated >= limit) continue
      tried.add(variant)
      const child = cloneBattleState(state)
      if (!playCard(child, instance.instanceId).ok) continue
      const key = keyOf(child)
      if (seen.has(key)) continue
      seen.add(key)
      walk(child, [...plays, instance.definitionId], spent + resolveCardDefinition(instance).cost)
    }
  }
  seen.add(keyOf(root))
  walk(cloneBattleState(root), [], 0)
  const minLoss = Math.min(...responses.map(item => item.loss))
  const safest = responses.filter(item => item.loss === minLoss)
  const maxDamage = Math.max(...responses.map(item => item.damage))
  const damageByAllowedLoss: Record<number, number> = {}
  for (const allowed of [0, 3, 6, 9]) {
    const ok = responses.filter(item => item.loss <= allowed)
    damageByAllowedLoss[allowed] = ok.length ? Math.max(...ok.map(item => item.damage)) : -1
  }
  return {
    minLoss, damageAtMinLoss: Math.max(...safest.map(item => item.damage)), manaAtMinLoss: Math.min(...safest.map(item => item.mana)),
    maxDamage, lossAtMaxDamage: Math.min(...responses.filter(item => item.damage === maxDamage).map(item => item.loss)),
    damageByAllowedLoss,
    safestUses: { armor: safest.some(item => item.plays.some(hasArmorEffect)), frost: safest.some(item => item.plays.includes('frost-grip')) },
    frontier: paretoFrontier(responses), evaluated,
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// A whole Sector I run under one policy: route, rooms, rewards, rests. The same policy for every mode, so only the rules differ.
// ---------------------------------------------------------------------------------------------------------------------------------

export interface RunLog {
  seed: number
  result: 'victory' | 'defeat' | 'timeout'
  battles: { enemy: string; node: string; fight: FightLog }[]
  healthEnd: { warrior: number; mage: number }
  deckEnd: CardId[]
  route: string[]
}

function pickRoomAction(run: DungeonRunState, policy: DungeonRoutePolicy): { action: RoomAction; hero: HeroId } {
  const room = run.room!
  const hero: HeroId = run.heroes.warrior.health >= run.heroes.mage.health ? 'warrior' : 'mage'
  const wishes: RoomAction[] = room.type === 'treasure' ? ['artifact', 'card']
    : room.type === 'forge' ? (policy === 'safe' ? ['remove', 'upgrade'] : policy === 'risky' ? ['replace', 'upgrade'] : ['upgrade', 'remove'])
      : room.eventId === 'powder-store' ? (policy === 'safe' ? ['card'] : ['risk', 'card'])
        : room.eventId === 'goblin-trade' ? (policy === 'safe' ? ['remove'] : ['replace', 'remove'])
          : (policy === 'safe' ? ['remove', 'upgrade'] : ['upgrade', 'remove'])
  return { action: wishes.find(item => roomActionAvailable(run, item)) ?? 'leave', hero }
}

export function simulateSectorRun(seed: number, economy: EconomyConfig, deck: readonly CardId[], strategy: LabStrategy, policy: DungeonRoutePolicy = 'mixed'): RunLog {
  let run = createSectorRun(seed, economy, deck, undefined, 'lab-' + seed)
  const battles: RunLog['battles'] = []
  const route: string[] = []
  const heroHealth = () => ({ warrior: run.heroes.warrior.health, mage: run.heroes.mage.health })
  for (let guard = 0; guard < 60 && run.status === 'active'; guard += 1) {
    const choices = availableDungeonNodes(run).map(publicDungeonNodeView)
    const chosen = chooseDungeonRouteNode(choices, run.heroes, policy)
    if (!chosen) throw new Error('Stuck route')
    run = enterDungeonNode(run, chosen.id)
    route.push(chosen.type)
    if (run.room) {
      const { action, hero } = pickRoomAction(run, policy)
      const room = run.room
      const target = ['upgrade', 'remove', 'replace'].includes(action) ? roomEligibleCards(run, action)[0] : undefined
      const replacement = target && action === 'replace' ? room.replacements[cardDefinition(target.definitionId).className].find(card => card.definitionId !== target.definitionId) : undefined
      const owner = (['warrior', 'mage'] as const).find(id => !run.artifacts.some(item => item.ownerInstanceId === run.heroes[id].instanceId))
      let finalAction: RoomAction = action
      if (action === 'artifact' && !owner) finalAction = 'card'
      if (['upgrade', 'remove', 'replace'].includes(finalAction) && !target) finalAction = 'leave'
      run = resolveRoom(run, {
        roomId: room.id, action: finalAction, instanceId: target?.instanceId, cardId: finalAction === 'replace' ? replacement?.definitionId : room.cards[0]?.definitionId,
        heroId: finalAction === 'artifact' ? owner : hero, artifactId: room.artifactIds[0],
      })
    } else if (chosen.type === 'rest') {
      const injured = (['warrior', 'mage'] as const).slice().sort((a, b) => run.heroes[a].health / run.heroes[a].maxHealth - run.heroes[b].health / run.heroes[b].maxHealth)[0]!
      const copy = run.deck.find(canUpgradeCard)
      run = run.heroes[injured].health / run.heroes[injured].maxHealth < 0.65 ? resolveDungeonRest(run, injured) : copy ? upgradeDungeonRest(run, copy.instanceId, run.runId + '/' + chosen.id) : resolveDungeonRest(run, null)
    } else {
      const node = dungeonNode(run.map, chosen.id)!
      const encounter = dungeonEncounter(node, economy)
      const state = createCampaignBattle({ encounter, economy, heroes: run.heroes, deck: run.deck, artifacts: run.artifacts, seed: run.battleEntry!.seed, battleId: 'lab/' + seed + '/' + chosen.id })
      const fight = runFight(state, createChooser(strategy))
      battles.push({ enemy: node.encounterId!, node: chosen.type, fight })
      if (!state.result) return { seed, result: 'timeout', battles, healthEnd: { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health }, deckEnd: run.deck.map(card => card.definitionId), route }
      run = resolveDungeonBattle(run, state)
    }
    if (run.pendingReward) {
      const offer = run.pendingReward
      const owner = (['warrior', 'mage'] as const).find(id => !run.artifacts.some(item => item.ownerInstanceId === run.heroes[id].instanceId))
      if (offer.elite && owner && offer.artifactIds[0]) run = claimDungeonArtifact(run, offer.artifactIds[0], run.heroes[owner].instanceId)
      else if (!offer.elite && run.deck.length >= 21) run = skipDungeonReward(run, offer.id)
      else run = claimDungeonReward(run, dungeonRewardOptions(run)[0]!)
    }
  }
  return {
    seed, result: run.status === 'sector-complete' || run.status === 'victory' ? 'victory' : run.status === 'defeat' ? 'defeat' : 'timeout', battles,
    healthEnd: heroHealth(), deckEnd: run.deck.map(card => card.definitionId), route,
  }
}

