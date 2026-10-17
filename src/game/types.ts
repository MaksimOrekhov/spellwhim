export type HeroId = 'warrior' | 'mage'
// Kept separate from HeroId so class presentation can evolve independently of its current hero.
export type CardClassId = 'warrior' | 'mage'
export type GameResult = 'victory' | 'defeat' | null
export type CardId = 'sword-strike' | 'fireball' | 'guard' | 'quick-cut' | 'thunderbolt' | 'bastion' | 'parry' | 'shield-bash' | 'interpose' | 'frostbolt' | 'arcane-insight' | 'ice-ward'
export type StatusId = 'mark' | 'resonance'
export type CardTag = 'strike' | 'offensive-spell' | 'defense'
export const MAX_HAND_SIZE = 10
export const OPENING_HAND_SIZE = 8
export const CARDS_DRAWN_PER_TURN = 2

export interface Hero {
  id: HeroId
  name: string
  title: string
  health: number
  maxHealth: number
  armor: number
  icon: string
}

export type CardEffect =
  | { type: 'damage'; amount: number; when?: 'enemy-attacking' }
  | { type: 'armor'; amount: number; target: 'threatened' | 'partner' }
  | { type: 'draw'; amount: number }
  | { type: 'status'; status: StatusId; durationTurns: number }

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
  exhaust?: boolean
  reward?: boolean
}

export interface CardInstance {
  instanceId: string
  definitionId: CardId
}

export interface CardLink {
  name: string
  status: StatusId
  actor: HeroId
  tag: CardTag
  effects: CardEffect[]
}

export const links: CardLink[] = [
  { name: 'Магическая метка', status: 'mark', actor: 'warrior', tag: 'strike', effects: [{ type: 'damage', amount: 3 }, { type: 'draw', amount: 1 }] },
  { name: 'Защитный резонанс', status: 'resonance', actor: 'mage', tag: 'offensive-spell', effects: [{ type: 'damage', amount: 2 }] },
]

export const statusDefinitions: Record<StatusId, { name: string; description: string }> = {
  mark: { name: 'Метка Лиры', description: 'Следующий удар Бранна: +3 урона и добор. До конца хода.' },
  resonance: { name: 'Защитный резонанс', description: 'Следующее атакующее заклинание Лиры: +2 урона. До конца хода.' },
}

export const cards: CardDefinition[] = [
  { id: 'sword-strike', name: 'Удар мечом', className: 'warrior', cost: 1, description: '6 урона. По метке Лиры: +3 урона и добор.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 6 }] },
  { id: 'fireball', name: 'Огненный шар', className: 'mage', cost: 2, description: '8 урона. Метка: удар Бранна +3 и добор.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 8 }, { type: 'status', status: 'mark', durationTurns: 1 }] },
  { id: 'guard', name: 'Защитная стойка', className: 'warrior', cost: 1, description: '4 брони цели врага. Резонанс: заклинание Лиры +2.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 4, target: 'threatened' }, { type: 'status', status: 'resonance', durationTurns: 1 }] },
  { id: 'parry', name: 'Парирование', className: 'warrior', cost: 1, description: '3 брони цели. Если враг собирается атаковать — 3 урона.', icon: '⛨', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 3, target: 'threatened' }, { type: 'damage', amount: 3, when: 'enemy-attacking' }], reward: true },
  { id: 'shield-bash', name: 'Удар щитом', className: 'warrior', cost: 2, description: '5 урона и 3 брони цели. Использует метку Лиры.', icon: '⬡', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 5 }, { type: 'armor', amount: 3, target: 'threatened' }], reward: true },
  { id: 'interpose', name: 'Прикрыть союзника', className: 'warrior', cost: 1, description: '5 брони напарнику. Создаёт защитный резонанс.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 5, target: 'partner' }, { type: 'status', status: 'resonance', durationTurns: 1 }], reward: true },
  { id: 'frostbolt', name: 'Ледяная стрела', className: 'mage', cost: 1, description: '4 урона. Создаёт магическую метку для удара Бранна.', icon: '❄', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 4 }, { type: 'status', status: 'mark', durationTurns: 1 }], reward: true },
  { id: 'arcane-insight', name: 'Тайное предвидение', className: 'mage', cost: 1, description: 'Добор карты. Следующий удар Бранна получает метку Лиры.', icon: '✦', kind: 'spell', tags: [], effects: [{ type: 'draw', amount: 1 }, { type: 'status', status: 'mark', durationTurns: 1 }], reward: true },
  { id: 'ice-ward', name: 'Ледяной покров', className: 'mage', cost: 1, description: '3 брони цели и 2 брони напарнику.', icon: '❄', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 3, target: 'threatened' }, { type: 'armor', amount: 2, target: 'partner' }], reward: true },
  { id: 'quick-cut', name: 'Быстрый выпад', className: 'warrior', cost: 0, description: '3 урона. Использует метку. Выбывает до конца боя.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 3 }], exhaust: true, reward: true },
  { id: 'thunderbolt', name: 'Грозовой разряд', className: 'mage', cost: 1, description: '4 урона. Добор карты. Использует резонанс.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 4 }, { type: 'draw', amount: 1 }], reward: true },
  { id: 'bastion', name: 'Каменный бастион', className: 'warrior', cost: 2, description: '6 брони цели, 3 — напарнику. Создаёт резонанс.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 6, target: 'threatened' }, { type: 'armor', amount: 3, target: 'partner' }, { type: 'status', status: 'resonance', durationTurns: 1 }], reward: true },
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

export interface EncounterDefinition {
  id: string
  name: string
  title: string
  maxHealth: number
  behavior: EnemyBehavior
  appearance: 'root' | 'guardian' | 'heart'
  mapLabel: string
}

export type EnemyHit = { kind: 'attack'; name: string; damage: number; target: HeroId } | { kind: 'attack_all'; name: string; damage: number; primaryTarget: HeroId }
export type EnemyAction = EnemyHit | { kind: 'defend'; name: string; armor: number } | { kind: 'prepare'; name: string; prepared: EnemyHit } | { kind: 'recover'; name: string; armor: number }
export interface EnemyBehavior { phase1: EnemyAction[]; phase2?: EnemyAction[] }
export interface EnemyState {
  name: string; title: string; health: number; maxHealth: number; armor: number
  appearance: EncounterDefinition['appearance']; phase: 1 | 2; nextActionPhase: 1 | 2; behavior: EnemyBehavior
  behaviorIndex: number; nextAction: EnemyAction; focus: HeroId
}

export const encounters: EncounterDefinition[] = [
  { id: 'root-sentinel', name: 'Корневой дозорный', title: 'Порождение чащи', maxHealth: 24, behavior: { phase1: [{ kind: 'attack', name: 'Удар корнями', damage: 4, target: 'mage' }, { kind: 'defend', name: 'Кора-защитница', armor: 5 }, { kind: 'attack', name: 'Хлёсткая лоза', damage: 5, target: 'warrior' }] }, appearance: 'root', mapLabel: 'Заражённый овраг' },
  { id: 'twilight-guardian', name: 'Страж старой рощи', title: 'Древний хранитель', maxHealth: 30, behavior: { phase1: [{ kind: 'prepare', name: 'Тяжёлый удар', prepared: { kind: 'attack', name: 'Сокрушающий удар', damage: 10, target: 'warrior' } }, { kind: 'recover', name: 'Передышка', armor: 2 }, { kind: 'prepare', name: 'Прицелился в Лиру', prepared: { kind: 'attack', name: 'Удар по чародейке', damage: 9, target: 'mage' } }, { kind: 'recover', name: 'Передышка', armor: 2 }] }, appearance: 'guardian', mapLabel: 'Забытый алтарь' },
  { id: 'twilight-heart', name: 'Сумеречное сердце', title: 'Пробудившаяся чаща', maxHealth: 46, behavior: { phase1: [{ kind: 'attack', name: 'Сумеречный импульс', damage: 6, target: 'mage' }, { kind: 'attack_all', name: 'Корневая волна', damage: 3, primaryTarget: 'warrior' }, { kind: 'defend', name: 'Оболочка чащи', armor: 5 }], phase2: [{ kind: 'attack', name: 'Гневное жало', damage: 7, target: 'warrior' }, { kind: 'attack_all', name: 'Всплеск сердца', damage: 4, primaryTarget: 'mage' }, { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 }] }, appearance: 'heart', mapLabel: 'Сердце чащи' },
]

export interface CardPreview {
  damage: number
  armorDamage: number
  healthDamage: number
  bonusDamage: number
  armor: Record<HeroId, number>
  draw: number
  links: string[]
  appliedStatuses: StatusId[]
}

export interface PendingPlay {
  actionId: string
  card: CardInstance
  handIndex: number
  effects: CardEffect[]
  consume: StatusId[]
  preview: CardPreview
}

export interface BattleState {
  battleId: string
  seed: number
  rngState: number
  nextActionId: number
  heroes: Record<HeroId, Hero>
  enemy: EnemyState
  statuses: Partial<Record<StatusId, { expiresOnTurn: number }>>
  hand: CardInstance[]
  blockedDraws: number
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  exhausted: CardInstance[]
  pending: PendingPlay | null
  mana: number
  maxMana: number
  turn: number
  result: GameResult
}
