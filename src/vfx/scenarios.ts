import { createBattle } from '../game/battle'
import { honestEconomies } from '../game/economy'
import { sectorFoesB1 } from '../game/sectorFoesB'
import { applyStatus } from '../game/statuses'
import type { BattleState, CardId, EnemyAction, HeroId } from '../game/types'

/**
 * Reproducible battle states for the VFX lab (card-preview.html?view=vfx) and for the browser checks. Each one is built by the real rules
 * engine and nudged only through plain state fields (a status, some armor, the enemy's announced action), so what the lab draws is exactly
 * what a run could produce; pressing "play" goes through the same `startCardPlay` / `forecastEnemyAction` path as the game.
 */
export type ScenarioGroup = 'varian' | 'jaina' | 'defense' | 'enemy' | 'boss'
export type ScenarioRun = { kind: 'card'; cardId: CardId } | { kind: 'enemy' }
export interface VfxScenario { id: string; title: string; group: ScenarioGroup; run: ScenarioRun; build(): BattleState }

type FoeId = 'old-mines-raider' | 'old-mines-digger' | 'old-mines-watchman' | 'old-mines-overseer' | 'old-mines-johnson' | 'old-mines-rhahk-zor'

function foe(id: FoeId) {
  const found = sectorFoesB1.find(item => item.id === id)
  if (!found) throw new Error('Unknown foe ' + id)
  return found
}

function action(id: FoeId, phase: 1 | 2, index: number): EnemyAction {
  const list = phase === 2 ? foe(id).behavior.phase2! : foe(id).behavior.phase1
  return list[index]!
}

/** The blow a preparation holds, as the plain attack it becomes once announced. */
function revealed(id: FoeId, index: number): EnemyAction {
  const prepared = action(id, 1, index)
  if (prepared.kind !== 'prepare') throw new Error('Not a preparation')
  return prepared.prepared
}

function announce(state: BattleState, next: EnemyAction, phase: 1 | 2 = 1): void {
  state.enemy.nextAction = next
  state.enemy.nextActionPhase = phase
  state.enemy.focus = next.kind === 'attack' ? next.target : next.kind === 'attack_all' ? next.primaryTarget : next.kind === 'prepare' && next.prepared.kind === 'attack' ? next.prepared.target : state.enemy.focus
}

interface Setup {
  foe?: FoeId
  intent?: EnemyAction
  phase?: 2
  vulnerable?: boolean
  bleeding?: number
  frostbite?: boolean
  enemyArmor?: number
  armor?: Partial<Record<HeroId, number>>
  hurt?: number
  hand?: CardId[]
}

function arena(setup: Setup = {}): BattleState {
  const base = foe(setup.foe ?? 'old-mines-overseer')
  const state = createBattle({ ...base, maxHealth: Math.round(base.maxHealth * 1.75) }, undefined, { seed: 7, economy: honestEconomies['honest-b2'] })
  state.mana = state.maxMana = 9
  state.heroes.warrior.health = 21
  state.heroes.mage.health = 14
  if (setup.phase === 2 && state.enemy.behavior.phase2) { state.enemy.phase = 2; state.enemy.nextActionPhase = 2; state.enemy.behaviorIndex = 0 }
  if (setup.intent) announce(state, setup.intent, setup.phase ?? 1)
  if (setup.vulnerable) applyStatus(state, 'enemy', 'vulnerability')
  if (setup.bleeding) applyStatus(state, 'enemy', 'bleeding', setup.bleeding)
  if (setup.frostbite) applyStatus(state, 'enemy', 'frostbite')
  if (setup.enemyArmor) state.enemy.armor = setup.enemyArmor
  for (const [hero, armor] of Object.entries(setup.armor ?? {}) as [HeroId, number][]) state.heroes[hero].armor = armor
  if (setup.hurt !== undefined) state.enemy.hurt = setup.hurt
  state.hand = (setup.hand ?? []).map((definitionId, index) => ({ instanceId: `vfx/${index + 1}`, definitionId }))
  return state
}

const attacking = action('old-mines-raider', 1, 2)

function card(id: string, title: string, group: ScenarioGroup, cardId: CardId, setup: Setup = {}): VfxScenario {
  return { id, title, group, run: { kind: 'card', cardId }, build: () => arena({ intent: attacking, ...setup, hand: [cardId, 'sword-strike', 'guard', 'fireball', 'frostbolt', 'ice-ward'] }) }
}

function enemy(id: string, title: string, group: ScenarioGroup, setup: Setup): VfxScenario {
  return { id, title, group, run: { kind: 'enemy' }, build: () => arena({ ...setup, hand: ['sword-strike', 'guard', 'fireball', 'frostbolt', 'ice-ward', 'quick-cut'] }) }
}

export const vfxScenarios: readonly VfxScenario[] = [
  card('sword-strike', 'Удар мечом', 'varian', 'sword-strike'),
  card('quick-cut', 'Быстрый выпад', 'varian', 'quick-cut'),
  card('crushing-swing', 'Сокрушительный замах (тяжёлый, Уязвимость)', 'varian', 'crushing-swing'),
  card('shield-bash', 'Удар щитом (Уязвимость, броня)', 'varian', 'shield-bash'),
  card('shield-bash-vuln', 'Удар щитом по Уязвимому врагу', 'varian', 'shield-bash', { vulnerable: true }),
  card('rend', 'Рассекающий удар (Кровотечение)', 'varian', 'rend'),
  card('reaping-blow', 'Кровавая расплата (расход Кровотечения)', 'varian', 'reaping-blow', { bleeding: 3 }),
  card('stance-strike', 'Удар из стойки (бонус за броню, броня напарнику)', 'varian', 'stance-strike', { armor: { warrior: 3 } }),
  card('ice-breaker-frost', 'Раскол льда по обмороженному врагу', 'varian', 'ice-breaker', { frostbite: true }),
  card('ice-breaker-plain', 'Раскол льда без Обморожения (льда нет)', 'varian', 'ice-breaker'),
  card('sword-vs-armor', 'Удар мечом по броне врага (держит)', 'varian', 'sword-strike', { enemyArmor: 9 }),
  card('sword-breaks-armor', 'Удар мечом разбивает броню врага', 'varian', 'sword-strike', { enemyArmor: 4 }),
  card('fireball', 'Огненный шар', 'jaina', 'fireball'),
  card('frostbolt', 'Ледяная стрела (Уязвимость)', 'jaina', 'frostbolt'),
  card('frostbolt-bonus', 'Ледяная стрела: бонус за броню и расход Уязвимости', 'jaina', 'frostbolt', { vulnerable: true, armor: { mage: 4 } }),
  card('thunderbolt', 'Грозовой разряд (добор)', 'jaina', 'thunderbolt'),
  card('thunderbolt-bonus', 'Грозовой разряд с бронёй Джайны', 'jaina', 'thunderbolt', { armor: { mage: 3 } }),
  card('arcane-insight', 'Тайное предвидение (только добор, без атаки)', 'jaina', 'arcane-insight'),
  card('arcane-mark', 'Арканная метка (Уязвимость, добор)', 'jaina', 'arcane-mark'),
  card('frost-grip', 'Ледяная хватка (Обморожение)', 'jaina', 'frost-grip'),
  card('ice-echo', 'Ледяное эхо (урон, Кровотечение, добор)', 'jaina', 'ice-echo'),
  card('boil-blood', 'Жар в венах (Кровотечение срабатывает сразу)', 'jaina', 'boil-blood', { bleeding: 3 }),
  card('frost-seal', 'Синяя печать (тик + Уязвимость)', 'jaina', 'frost-seal', { bleeding: 2 }),
  card('blood-resonance', 'Кровавый резонанс (расход Кровотечения)', 'jaina', 'blood-resonance', { bleeding: 3 }),
  card('guard', 'Защитная стойка (сталь)', 'defense', 'guard'),
  card('bastion', 'Каменный бастион (броня обоим)', 'defense', 'bastion'),
  card('interpose', 'Прикрыть союзника (сталь на Джайне)', 'defense', 'interpose'),
  card('ice-ward', 'Ледяной покров (барьер обоим)', 'defense', 'ice-ward'),
  card('parry', 'Парирование (броня + контрудар)', 'defense', 'parry'),
  card('covering-counter', 'Перехват удара (броня + контрудар)', 'defense', 'covering-counter'),
  card('parry-idle', 'Парирование, когда враг не атакует (контрудара нет)', 'defense', 'parry', { intent: action('old-mines-raider', 1, 3) }),
  card('wound-clamp', 'Зажать рану (тик + броня)', 'defense', 'wound-clamp', { bleeding: 2 }),
  enemy('enemy-claw', 'Обычная атака по Вариану', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 2) }),
  enemy('enemy-claw-mage', 'Обычная атака по Джайне', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 0) }),
  enemy('enemy-heavy', 'Тяжёлая атака (13)', 'enemy', { foe: 'old-mines-digger', intent: revealed('old-mines-digger', 1) }),
  enemy('enemy-all', 'Групповая атака', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 1) }),
  enemy('enemy-block', 'Удар полностью заблокирован', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 2), armor: { warrior: 12 } }),
  enemy('enemy-partial', 'Броня поглотила часть удара', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 2), armor: { warrior: 4 } }),
  enemy('enemy-pierce', 'Бронебойный болт', 'enemy', { foe: 'old-mines-watchman', intent: revealed('old-mines-watchman', 0), armor: { mage: 8 } }),
  enemy('enemy-all-armor', 'Групповая атака: Вариан блокирует, Джайна получает урон', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 1), armor: { warrior: 8 } }),
  enemy('enemy-prepare', 'Подготовленная атака', 'enemy', { foe: 'old-mines-digger', intent: action('old-mines-digger', 1, 1) }),
  enemy('enemy-stopped', 'Атака сорвана', 'enemy', { foe: 'old-mines-digger', intent: revealed('old-mines-digger', 1), hurt: 21 }),
  enemy('enemy-defend', 'Враг получает броню', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 3) }),
  enemy('enemy-rage', 'Ярость надсмотрщика', 'enemy', { foe: 'old-mines-overseer', intent: action('old-mines-overseer', 1, 2) }),
  enemy('enemy-bleed', 'Кровотечение срабатывает перед атакой', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 2), bleeding: 3 }),
  enemy('enemy-frost', 'Обморожение ослабляет удар и тратится', 'enemy', { foe: 'old-mines-raider', intent: action('old-mines-raider', 1, 2), frostbite: true }),
  enemy('enemy-exposes', 'Удар с меткой (Уязвимость на герое)', 'enemy', { foe: 'old-mines-johnson', intent: action('old-mines-johnson', 1, 0) }),
  enemy('boss-hit', 'Рак’Зор: проверка каски', 'boss', { foe: 'old-mines-rhahk-zor', intent: action('old-mines-rhahk-zor', 1, 0) }),
  enemy('boss-heavy', 'Рак’Зор: удар бригадира (тяжёлый)', 'boss', { foe: 'old-mines-rhahk-zor', intent: revealed('old-mines-rhahk-zor', 1) }),
  enemy('boss-prepare', 'Рак’Зор заносит молот', 'boss', { foe: 'old-mines-rhahk-zor', intent: action('old-mines-rhahk-zor', 1, 1) }),
  enemy('boss-all', 'Рак’Зор: дрожь штолен (по обоим, бронебой)', 'boss', { foe: 'old-mines-rhahk-zor', phase: 2, intent: action('old-mines-rhahk-zor', 2, 1), armor: { warrior: 4, mage: 3 } }),
  enemy('boss-all-heavy', 'Рак’Зор: обвал свода (по обоим)', 'boss', { foe: 'old-mines-rhahk-zor', phase: 2, intent: action('old-mines-rhahk-zor', 2, 3) }),
  enemy('boss-roar', 'Рак’Зор: рёв (ярость)', 'boss', { foe: 'old-mines-rhahk-zor', phase: 2, intent: action('old-mines-rhahk-zor', 2, 0) }),
]

export function vfxScenario(id: string): VfxScenario | undefined { return vfxScenarios.find(item => item.id === id) }

