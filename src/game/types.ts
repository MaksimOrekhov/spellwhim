import type { EconomyConfig } from './economy'

export type HeroId = 'warrior' | 'mage'
// Kept separate from HeroId so class presentation can evolve independently of its current hero.
export type CardClassId = 'warrior' | 'mage'
export type PartySlotId = 'first' | 'second'
export type ArtifactId = 'reliable-wedge' | 'double-pulley' | 'weakpoint-lens' | 'shift-whistle' | 'tension-spool'
export type GameResult = 'victory' | 'defeat' | null
export type CardId = 'sword-strike' | 'fireball' | 'guard' | 'quick-cut' | 'thunderbolt' | 'bastion' | 'parry' | 'shield-bash' | 'interpose' | 'frostbolt' | 'arcane-insight' | 'ice-ward' | 'rend' | 'reaping-blow' | 'boil-blood' | 'stance-strike' | 'wound-clamp' | 'covering-counter' | 'crushing-swing' | 'arcane-mark' | 'ice-echo' | 'frost-seal' | 'blood-resonance'
export type StatusId = 'vulnerability' | 'bleeding'
/** Who can hold a status. `'enemy'` is the current opponent; hero keys follow the legacy engine key (`Hero.id`). */
export type StatusCarrierId = 'enemy' | HeroId
/** A status held by one carrier. `value` is read according to the definition: charges or intensity. */
export interface StatusInstance {
  id: StatusId
  value: number
}
/** The only store of battle statuses; the engine keeps no per-status flags elsewhere. */
export type BattleStatuses = Record<StatusCarrierId, StatusInstance[]>
export type CardTag = 'strike' | 'offensive-spell' | 'defense'
/** The bonus belongs to the party member who owns the card's class (see `party.ts`), never to a named character. */
export interface CardDamageBonus {
  condition: 'owner-has-armor'
  amount: number
}
/** `class:<id>` addresses the party member of that class; it resolves through the actual party and fails safe if absent or ambiguous. */
export type ArmorTarget = 'threatened' | 'partner' | HeroId | `class:${CardClassId}`
export const MAX_HAND_SIZE = 10
export const OPENING_HAND_SIZE = 8
export const CARDS_DRAWN_PER_TURN = 2

export interface Hero {
  /** Legacy engine key. Party System will replace this key with a roster-independent participant map. */
  id: HeroId
  /** Stable roster identity, combat class and party position are separate from the run instance. */
  characterId: string
  classId: CardClassId
  partySlot: PartySlotId
  instanceId: string
  name: string
  title: string
  health: number
  maxHealth: number
  armor: number
  icon: string
}

export type CardEffect =
  | { type: 'damage'; amount: number; when?: 'enemy-attacking' }
  | { type: 'armor'; amount: number; target: ArmorTarget }
  | { type: 'draw'; amount: number }
  /** Applies the status to the enemy; `amount` (default 1) is charges or intensity by the status definition. */
  | { type: 'status'; status: StatusId; amount?: number }
  /** Adds `perPoint` damage to this card's hit for every point of the enemy's status, then removes the whole status. */
  | { type: 'status-burst'; status: StatusId; perPoint: number }
  /** Runs the enemy's tick rule of the status right now (damage, then decay): the same tick, earlier. */
  | { type: 'status-tick'; status: StatusId }

export interface CardDefinition {
  id: CardId
  name: string
  className: CardClassId
  cost: number
  description: string
  icon: string
  kind: 'attack' | 'spell' | 'defense'
  tags: CardTag[]
  effects: CardEffect[]
  damageBonus?: CardDamageBonus
  exhaust?: boolean
  reward?: boolean
}

export interface CardInstance {
  instanceId: string
  definitionId: CardId
}

export interface ArtifactDefinition {
  id: ArtifactId
  name: string
  description: string
  icon: 'shield' | 'link' | 'crosshair' | 'bell' | 'gauge'
  trigger: 'incoming-hit' | 'owner-armor' | 'vulnerability-consumed' | 'prepared-hit' | 'armor-at-turn-start'
}

/** Run-lifetime ownership. Combat charges are held separately and reset for each battle. */
export interface ArtifactInstance {
  instanceId: string
  definitionId: ArtifactId
  ownerInstanceId: string
}

export interface BattleArtifactState extends ArtifactInstance {
  usedThisBattle: boolean
  lastTriggeredTurn: number | null
  armedThisTurn: boolean
}

export interface PendingArtifactTrigger {
  artifactInstanceId: string
  reason: string
  kind: 'armor' | 'turn-damage'
  owner: HeroId
  amount: number
  target?: HeroId
}

export { statusDefinitions } from './statuses'

export const cards: CardDefinition[] = [
  { id: 'sword-strike', name: 'Удар мечом', className: 'warrior', cost: 1, description: '6 урона.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 6 }] },
  { id: 'fireball', name: 'Огненный шар', className: 'mage', cost: 2, description: '8 урона.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 8 }] },
  { id: 'guard', name: 'Защитная стойка', className: 'warrior', cost: 1, description: '4 брони цели врага.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 4, target: 'threatened' }] },
  { id: 'parry', name: 'Парирование', className: 'warrior', cost: 1, description: '3 брони цели. Если текущее действие врага — атака, наносит 3 урона.', icon: '⛨', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 3, target: 'threatened' }, { type: 'damage', amount: 3, when: 'enemy-attacking' }], reward: true },
  { id: 'shield-bash', name: 'Удар щитом', className: 'warrior', cost: 2, description: '5 урона и 3 брони цели. Накладывает Уязвимость.', icon: '⬡', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 5 }, { type: 'armor', amount: 3, target: 'threatened' }, { type: 'status', status: 'vulnerability' }], reward: true },
  { id: 'interpose', name: 'Прикрыть союзника', className: 'warrior', cost: 1, description: '5 брони союзнику-магу.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 5, target: 'class:mage' }], reward: true },
  { id: 'frostbolt', name: 'Ледяная стрела', className: 'mage', cost: 1, description: '4 урона. Накладывает Уязвимость. При броне Джайны: +2 урона.', icon: '❄', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 4 }, { type: 'status', status: 'vulnerability' }], damageBonus: { condition: 'owner-has-armor', amount: 2 }, reward: true },
  { id: 'arcane-insight', name: 'Тайное предвидение', className: 'mage', cost: 1, description: 'Добор карты.', icon: '✦', kind: 'spell', tags: [], effects: [{ type: 'draw', amount: 1 }], reward: true },
  { id: 'ice-ward', name: 'Ледяной покров', className: 'mage', cost: 1, description: '3 брони цели и 2 брони напарнику.', icon: '❄', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 3, target: 'threatened' }, { type: 'armor', amount: 2, target: 'partner' }], reward: true },
  { id: 'quick-cut', name: 'Быстрый выпад', className: 'warrior', cost: 0, description: '3 урона. Выбывает до конца боя.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 3 }], exhaust: true, reward: true },
  { id: 'thunderbolt', name: 'Грозовой разряд', className: 'mage', cost: 1, description: '4 урона. Добор карты. При броне Джайны: +2 урона.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 4 }, { type: 'draw', amount: 1 }], damageBonus: { condition: 'owner-has-armor', amount: 2 }, reward: true },
  { id: 'rend', name: 'Рассекающий удар', className: 'warrior', cost: 1, description: '5 урона. Накладывает Кровотечение 3.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 5 }, { type: 'status', status: 'bleeding', amount: 3 }], reward: true },
  { id: 'reaping-blow', name: 'Кровавая расплата', className: 'warrior', cost: 2, description: '4 урона и ещё 2 за каждую силу Кровотечения врага. Снимает Кровотечение.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 4 }, { type: 'status-burst', status: 'bleeding', perPoint: 2 }], reward: true },
  { id: 'boil-blood', name: 'Жар в венах', className: 'mage', cost: 1, description: 'Кровотечение врага срабатывает сразу: он теряет здоровье, равное силе (броня не поглощает), сила падает на 1. Добор карты.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'status-tick', status: 'bleeding' }, { type: 'draw', amount: 1 }], reward: true },
  { id: 'bastion', name: 'Каменный бастион', className: 'warrior', cost: 2, description: '6 брони цели, 3 — напарнику.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 6, target: 'threatened' }, { type: 'armor', amount: 3, target: 'partner' }], reward: true },
  { id: 'stance-strike', name: 'Удар из стойки', className: 'warrior', cost: 1, description: '3 урона и 2 брони напарнику. При броне Воина: +2 урона.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 3 }, { type: 'armor', amount: 2, target: 'partner' }], damageBonus: { condition: 'owner-has-armor', amount: 2 }, reward: true },
  { id: 'wound-clamp', name: 'Зажать рану', className: 'warrior', cost: 1, description: 'Кровотечение срабатывает сейчас (сила −1). 3 брони цели врага.', icon: '⛨', kind: 'defense', tags: ['defense'], effects: [{ type: 'status-tick', status: 'bleeding' }, { type: 'armor', amount: 3, target: 'threatened' }], reward: true },
  { id: 'covering-counter', name: 'Перехват удара', className: 'warrior', cost: 2, description: '7 брони цели врага. Если враг атакует, наносит 3 урона.', icon: '⛨', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 7, target: 'threatened' }, { type: 'damage', amount: 3, when: 'enemy-attacking' }], reward: true },
  { id: 'crushing-swing', name: 'Сокрушительный замах', className: 'warrior', cost: 3, description: '9 урона. Накладывает Уязвимость.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 9 }, { type: 'status', status: 'vulnerability' }], reward: true },
  { id: 'arcane-mark', name: 'Арканная метка', className: 'mage', cost: 1, description: 'Накладывает Уязвимость. Добор карты.', icon: '✦', kind: 'spell', tags: [], effects: [{ type: 'status', status: 'vulnerability' }, { type: 'draw', amount: 1 }], reward: true },
  { id: 'ice-echo', name: 'Ледяное эхо', className: 'mage', cost: 1, description: '2 урона. Добор карты.', icon: '❄', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 2 }, { type: 'draw', amount: 1 }], reward: true },
  { id: 'frost-seal', name: 'Синяя печать', className: 'mage', cost: 1, description: 'Кровотечение срабатывает сейчас (сила −1). Накладывает Уязвимость.', icon: '❄', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'status-tick', status: 'bleeding' }, { type: 'status', status: 'vulnerability' }], reward: true },
  { id: 'blood-resonance', name: 'Кровавый резонанс', className: 'mage', cost: 2, description: '3 урона и добор карты. Снимает Кровотечение: +1 урон за каждую силу.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 3 }, { type: 'status-burst', status: 'bleeding', perPoint: 1 }, { type: 'draw', amount: 1 }], reward: true },
]

export const startingDeck: CardId[] = [
  'sword-strike', 'sword-strike', 'fireball', 'fireball', 'guard', 'guard',
  'parry', 'parry', 'shield-bash', 'shield-bash', 'interpose', 'interpose',
  'frostbolt', 'frostbolt', 'arcane-insight', 'arcane-insight', 'ice-ward', 'ice-ward',
]

export function cardDefinition(id: CardId): CardDefinition {
  const definition = cards.find(card => card.id === id)
  if (!definition) throw new Error('Unknown card: ' + id)
  return definition
}

export type EnemyAppearance = 'root' | 'guardian' | 'heart' | 'defias' | 'goblin' | 'mechanical'

export interface EncounterDefinition {
  id: string
  name: string
  title: string
  maxHealth: number
  behavior: EnemyBehavior
  appearance: EnemyAppearance
  mapLabel: string
}

export type EnemyHit = { kind: 'attack'; name: string; damage: number; target: HeroId } | { kind: 'attack_all'; name: string; damage: number; primaryTarget: HeroId }
export type EnemyAction = EnemyHit | { kind: 'defend'; name: string; armor: number } | { kind: 'prepare'; name: string; prepared: EnemyHit } | { kind: 'recover'; name: string; armor: number }
export interface EnemyBehavior { phase1: EnemyAction[]; phase2?: EnemyAction[] }
export interface EnemyState {
  /** Stable encounter identity; portrait lookup never depends on localized display text or phase. */
  encounterId: string
  name: string; title: string; health: number; maxHealth: number; armor: number
  appearance: EncounterDefinition['appearance']; phase: 1 | 2; nextActionPhase: 1 | 2; behavior: EnemyBehavior
  behaviorIndex: number; nextAction: EnemyAction; focus: HeroId
}

export const encounters: EncounterDefinition[] = [
  { id: 'root-sentinel', name: 'Корневой дозорный', title: 'Порождение чащи', maxHealth: 24, behavior: { phase1: [{ kind: 'attack', name: 'Удар корнями', damage: 4, target: 'mage' }, { kind: 'defend', name: 'Кора-защитница', armor: 5 }, { kind: 'attack', name: 'Хлёсткая лоза', damage: 5, target: 'warrior' }] }, appearance: 'root', mapLabel: 'Заражённый овраг' },
  { id: 'twilight-guardian', name: 'Страж старой рощи', title: 'Древний хранитель', maxHealth: 30, behavior: { phase1: [{ kind: 'prepare', name: 'Тяжёлый удар', prepared: { kind: 'attack', name: 'Сокрушающий удар', damage: 10, target: 'warrior' } }, { kind: 'recover', name: 'Передышка', armor: 2 }, { kind: 'prepare', name: 'Прицелился в Джайну', prepared: { kind: 'attack', name: 'Удар по чародейке', damage: 9, target: 'mage' } }, { kind: 'recover', name: 'Передышка', armor: 2 }] }, appearance: 'guardian', mapLabel: 'Забытый алтарь' },
  { id: 'twilight-heart', name: 'Сумеречное сердце', title: 'Пробудившаяся чаща', maxHealth: 46, behavior: { phase1: [{ kind: 'attack', name: 'Сумеречный импульс', damage: 6, target: 'mage' }, { kind: 'attack_all', name: 'Корневая волна', damage: 3, primaryTarget: 'warrior' }, { kind: 'defend', name: 'Оболочка чащи', armor: 5 }], phase2: [{ kind: 'attack', name: 'Гневное жало', damage: 7, target: 'warrior' }, { kind: 'attack_all', name: 'Всплеск сердца', damage: 4, primaryTarget: 'mage' }, { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 }] }, appearance: 'heart', mapLabel: 'Сердце чащи' },
]

/**
 * One labelled contribution to a hit. `base` opens the list, additive modifiers follow in the fixed order
 * class condition → status → artifact, and reductions (negative amounts) come last. See `damage.ts`.
 */
export interface HitPart {
  kind: 'base' | 'status' | 'class-bonus' | 'artifact'
  id: string
  label: string
  /** Longer wording for the damage breakdown; `label` is used where space is tight. */
  detail?: string
  amount: number
}

/** A status that a play will spend, decided when the play starts. */
export interface ConsumedStatus {
  carrier: StatusCarrierId
  id: StatusId
  /** Charges spent; one when omitted. A burst card spends the whole value it read when the play started. */
  amount?: number
}

export interface CardPreview {
  damage: number
  armorDamage: number
  healthDamage: number
  bonusDamage: number
  vulnerabilityBonus: number
  armorBonus: number
  artifactDamage: number
  artifactArmor: Record<HeroId, number>
  artifactBonuses: string[]
  armor: Record<HeroId, number>
  draw: number
  bonuses: string[]
  appliedStatuses: StatusId[]
  /** Health the enemy loses at once through a status (a `status-tick` card): armor does not stop it. */
  statusDamage: number
  /** Health that statuses applied by this card will take over the coming turns if the enemy lives (bleeding). */
  statusFuture: number
  /** The same total as `damage`, itemised in rule order. Empty when the card deals no damage now. */
  damageParts: HitPart[]
  /** Party member whose armor drives the card's class bonus, when the card has one and the owner is unambiguous. */
  bonusOwner: { hero: HeroId; characterId: string } | null
  /** Who `class:<id>` armor targets resolve to right now (classes that are absent or ambiguous are omitted). */
  classHeroes: Partial<Record<CardClassId, HeroId>>
}

export interface PendingPlay {
  actionId: string
  card: CardInstance
  handIndex: number
  effects: CardEffect[]
  consumedStatuses: ConsumedStatus[]
  artifactTriggers: PendingArtifactTrigger[]
  preview: CardPreview
}

export interface BattleState {
  battleId: string
  seed: number
  rngState: number
  nextActionId: number
  heroes: Record<HeroId, Hero>
  /** Statuses of the enemy and of each hero; cleared when the battle ends. */
  statuses: BattleStatuses
  artifacts: BattleArtifactState[]
  artifactNotices: string[]
  enemy: EnemyState
  hand: CardInstance[]
  blockedDraws: number
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  exhausted: CardInstance[]
  pending: PendingPlay | null
  /** Rules that differ between the standard game and the experimental economies; plain data, never mutated. */
  economy: EconomyConfig
  mana: number
  maxMana: number
  turn: number
  result: GameResult
}
