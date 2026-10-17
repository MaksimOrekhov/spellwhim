export type HeroId = 'warrior' | 'mage'
export type GameResult = 'victory' | 'defeat' | null
export type CardId = 'sword-strike' | 'fireball' | 'guard' | 'quick-cut' | 'thunderbolt' | 'bastion'
export type StatusId = 'mark' | 'resonance'
export type CardTag = 'strike' | 'offensive-spell' | 'defense'

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
  | { type: 'damage'; amount: number }
  | { type: 'armor'; amount: number; target: 'threatened' | 'partner' }
  | { type: 'draw'; amount: number }
  | { type: 'status'; status: StatusId; durationTurns: number }

export interface CardDefinition {
  id: CardId
  name: string
  className: HeroId
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
  { id: 'quick-cut', name: 'Быстрый выпад', className: 'warrior', cost: 0, description: '3 урона. Использует метку. Выбывает до конца боя.', icon: '⚔', kind: 'attack', tags: ['strike'], effects: [{ type: 'damage', amount: 3 }], exhaust: true, reward: true },
  { id: 'thunderbolt', name: 'Грозовой разряд', className: 'mage', cost: 1, description: '4 урона. Добор карты. Использует резонанс.', icon: '✹', kind: 'spell', tags: ['offensive-spell'], effects: [{ type: 'damage', amount: 4 }, { type: 'draw', amount: 1 }], reward: true },
  { id: 'bastion', name: 'Каменный бастион', className: 'warrior', cost: 2, description: '6 брони цели, 3 — напарнику. Создаёт резонанс.', icon: '⬡', kind: 'defense', tags: ['defense'], effects: [{ type: 'armor', amount: 6, target: 'threatened' }, { type: 'armor', amount: 3, target: 'partner' }, { type: 'status', status: 'resonance', durationTurns: 1 }], reward: true },
]

export const startingDeck: CardId[] = ['sword-strike', 'sword-strike', 'fireball', 'fireball', 'guard', 'guard']

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
  attack: number
  intent: HeroId
  appearance: 'root' | 'guardian' | 'heart'
  mapLabel: string
}

export const encounters: EncounterDefinition[] = [
  { id: 'root-sentinel', name: 'Корневой дозорный', title: 'Порождение чащи', maxHealth: 24, attack: 4, intent: 'mage', appearance: 'root', mapLabel: 'Заражённый овраг' },
  { id: 'twilight-guardian', name: 'Страж старой рощи', title: 'Древний хранитель', maxHealth: 30, attack: 5, intent: 'warrior', appearance: 'guardian', mapLabel: 'Забытый алтарь' },
  { id: 'twilight-heart', name: 'Сумеречное сердце', title: 'Пробудившаяся чаща', maxHealth: 46, attack: 7, intent: 'mage', appearance: 'heart', mapLabel: 'Сердце чащи' },
]

export interface CardPreview {
  damage: number
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
  enemy: { name: string; title: string; health: number; maxHealth: number; attack: number; intent: HeroId; appearance: EncounterDefinition['appearance'] }
  statuses: Partial<Record<StatusId, { expiresOnTurn: number }>>
  hand: CardInstance[]
  drawPile: CardInstance[]
  discardPile: CardInstance[]
  exhausted: CardInstance[]
  pending: PendingPlay | null
  mana: number
  maxMana: number
  turn: number
  result: GameResult
}
