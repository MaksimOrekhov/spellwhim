export type HeroId = 'warrior' | 'mage'
export type GameResult = 'victory' | 'defeat' | null
export type CardId = 'sword-strike' | 'fireball' | 'guard' | 'quick-cut' | 'thunderbolt' | 'bastion'

export interface Hero {
  id: HeroId
  name: string
  title: string
  health: number
  maxHealth: number
  armor: number
  icon: string
}

export interface CardDefinition {
  id: CardId
  name: string
  className: string
  cost: number
  description: string
  icon: string
  kind: 'attack' | 'spell' | 'defense'
  damage?: number
  armor?: number
  partnerArmor?: number
}

export const cards: CardDefinition[] = [
  { id: 'sword-strike', name: 'Удар мечом', className: 'warrior', cost: 1, description: '6 урона. По знаку Лиры: +3 урона и добор карты.', icon: '⚔', kind: 'attack', damage: 6 },
  { id: 'fireball', name: 'Огненный шар', className: 'mage', cost: 2, description: '8 урона и знак: следующий удар Бранна +3 и добор.', icon: '✹', kind: 'spell', damage: 8 },
  { id: 'guard', name: 'Защитная стойка', className: 'warrior', cost: 1, description: '4 брони герою под прицелом, 2 — напарнику.', icon: '⬡', kind: 'defense', armor: 4, partnerArmor: 2 },
  { id: 'quick-cut', name: 'Быстрый выпад', className: 'warrior', cost: 0, description: '3 урона. По знаку Лиры: +3 урона и добор.', icon: '⚔', kind: 'attack', damage: 3 },
  { id: 'thunderbolt', name: 'Грозовой разряд', className: 'mage', cost: 1, description: '5 урона и знак: следующий удар Бранна +3 и добор.', icon: '✹', kind: 'spell', damage: 5 },
  { id: 'bastion', name: 'Каменный бастион', className: 'warrior', cost: 2, description: '6 брони герою под прицелом, 3 — напарнику.', icon: '⬡', kind: 'defense', armor: 6, partnerArmor: 3 },
]

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

export interface BattleState {
  heroes: Record<HeroId, Hero>
  enemy: { name: string; title: string; health: number; maxHealth: number; attack: number; intent: HeroId; appearance: EncounterDefinition['appearance']; marked: boolean }
  mana: number
  maxMana: number
  turn: number
  result: GameResult
}
