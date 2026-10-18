import type { EncounterDefinition } from './types'
import { normalEncounterCatalog, eliteEncounterCatalog } from './encountersV09'
import { encounters } from './types'
import { reinforcedEncounters } from './encountersV07'
import { rosterFrom, rosterV09 } from './rosters'

/**
 * Deadmines roster v1.0 (Combat Overhaul v0.2). Same eight Deadmines enemies and the same boss as v0.9, rewritten so that
 * the party has to react: health is 25–30 % higher, announced hits are about 40 % harder, and almost every turn of an
 * enemy cycle now threatens somebody. Rules of the data:
 *  - every strong hit is announced by a `prepare` turn and names its target (no hidden actions);
 *  - a single announced hit never exceeds what a full-health hero can survive (warrior 25, mage 18);
 *  - at most one turn of a cycle is a pure armor turn, and it is the window for the party's burst.
 * Reasons and the per-enemy before/after are written down in docs/combat-overhaul-v02.md. The v0.9 data stays in
 * `encountersV09.ts` as the control roster.
 */
export const normalEncounterCatalogV10: readonly EncounterDefinition[] = [
  {
    ...normalEncounterCatalog[0]!, title: 'Бьёт туда, где не прикрыто', maxHealth: 36,
    behavior: { phase1: [
      { kind: 'attack', name: 'Короткий выпад', damage: 7, target: 'mage' },
      { kind: 'prepare', name: 'Заходит за спину', prepared: { kind: 'attack', name: 'Нож в спину', damage: 11, target: 'mage' } },
      { kind: 'attack', name: 'Ответный выпад', damage: 6, target: 'warrior' },
      { kind: 'defend', name: 'Прикрывается киркой', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[1]!, title: 'Тяжёлый замах и крепкая каска', maxHealth: 42,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Размахивает киркой', prepared: { kind: 'attack', name: 'Удар надсмотрщика', damage: 14, target: 'warrior' } },
      { kind: 'defend', name: 'Каска и щиток', armor: 6 },
      { kind: 'attack', name: 'Тычок рукоятью', damage: 7, target: 'mage' },
    ] },
  },
  {
    ...normalEncounterCatalog[2]!, title: 'Фитиль уже горит', maxHealth: 38,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поджигает фитиль', prepared: { kind: 'attack_all', name: 'Пороховой хлопок', damage: 8, primaryTarget: 'mage' } },
      { kind: 'attack', name: 'Копоть из мехов', damage: 6, target: 'warrior' },
      { kind: 'defend', name: 'Прячется за бочкой', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[3]!, title: 'Глазастый стрелок', maxHealth: 39,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Берёт Джайну на прицел', prepared: { kind: 'attack', name: 'Выстрел из арбалета', damage: 13, target: 'mage' } },
      { kind: 'attack', name: 'Проверочный болт', damage: 7, target: 'warrior' },
      { kind: 'recover', name: 'Перезаряжает арбалет', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[4]!, title: 'Мастер гаечных ключей', maxHealth: 44,
    behavior: { phase1: [
      { kind: 'attack', name: 'Клепальный молоток', damage: 7, target: 'warrior' },
      { kind: 'attack_all', name: 'Паровой свисток', damage: 6, primaryTarget: 'mage' },
      { kind: 'prepare', name: 'Затягивает гайку', prepared: { kind: 'attack', name: 'Разводной ключ', damage: 13, target: 'mage' } },
      { kind: 'recover', name: 'Подтягивает пружины', armor: 4 },
    ] },
  },
  {
    ...normalEncounterCatalog[5]!, title: 'Старый морской волк', maxHealth: 46,
    behavior: { phase1: [
      { kind: 'attack_all', name: 'Качка на палубе', damage: 6, primaryTarget: 'warrior' },
      { kind: 'attack', name: 'Абордажная сабля', damage: 8, target: 'warrior' },
      { kind: 'prepare', name: 'Целится через снасти', prepared: { kind: 'attack', name: 'Выстрел с такелажа', damage: 14, target: 'mage' } },
      { kind: 'defend', name: 'Уходит за бортовой щит', armor: 3 },
    ] },
  },
]

export const eliteEncounterCatalogV10: readonly EncounterDefinition[] = [
  {
    ...eliteEncounterCatalog[0]!, maxHealth: 70,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поднимает тяжёлый меч', prepared: { kind: 'attack', name: 'Удар ветерана', damage: 16, target: 'warrior' } },
      { kind: 'attack_all', name: 'Рукоятью по обоим', damage: 7, primaryTarget: 'mage' },
      { kind: 'prepare', name: 'Перехватывает клинок', prepared: { kind: 'attack', name: 'Рубящий выпад', damage: 14, target: 'mage' } },
      { kind: 'defend', name: 'Выставляет гард', armor: 6 },
    ] },
  },
  {
    ...eliteEncounterCatalog[1]!, maxHealth: 78,
    behavior: {
      phase1: [
        { kind: 'prepare', name: 'Разогревает котёл', prepared: { kind: 'attack_all', name: 'Выпуск пара', damage: 7, primaryTarget: 'warrior' } },
        { kind: 'attack', name: 'Механическая клешня', damage: 10, target: 'mage' },
        { kind: 'recover', name: 'Сбрасывает давление', armor: 4 },
      ],
      phase2: [
        { kind: 'prepare', name: 'Переводит котёл в красную зону', prepared: { kind: 'attack', name: 'Удар поршня', damage: 17, target: 'warrior' } },
        { kind: 'attack_all', name: 'Обратная тяга', damage: 8, primaryTarget: 'mage' },
        { kind: 'defend', name: 'Запирает защитный кожух', armor: 6 },
        { kind: 'prepare', name: 'Снова копит давление', prepared: { kind: 'attack_all', name: 'Большой выпуск пара', damage: 10, primaryTarget: 'warrior' } },
      ],
    },
  },
]

/** The finale: the v0.7 Twilight Heart with more health and sharper phases. */
export const finalEncounterV10: EncounterDefinition = {
  ...reinforcedEncounters[2]!, id: encounters[2]!.id, maxHealth: 115,
  behavior: {
    phase1: [
      { kind: 'attack', name: 'Сумеречный импульс', damage: 9, target: 'mage' },
      { kind: 'attack_all', name: 'Корневая волна', damage: 7, primaryTarget: 'warrior' },
      { kind: 'defend', name: 'Оболочка чащи', armor: 5 },
      { kind: 'prepare', name: 'Сбор силы', prepared: { kind: 'attack', name: 'Гнёт чащи', damage: 17, target: 'warrior' } },
    ],
    phase2: [
      { kind: 'prepare', name: 'Сбор ярости', prepared: { kind: 'attack', name: 'Сумеречная казнь', damage: 15, target: 'mage' } },
      { kind: 'attack_all', name: 'Всплеск сердца', damage: 7, primaryTarget: 'mage' },
      { kind: 'attack', name: 'Гневное жало', damage: 11, target: 'warrior' },
      { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 },
      { kind: 'prepare', name: 'Сбор ярости', prepared: { kind: 'attack', name: 'Сумеречная казнь', damage: 16, target: 'mage' } },
      { kind: 'attack_all', name: 'Всплеск сердца', damage: 8, primaryTarget: 'mage' },
      { kind: 'attack', name: 'Гневное жало', damage: 11, target: 'warrior' },
      { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 },
    ],
  },
}

/** Health by position: the early discount of v0.9 (0.78–1.0 of catalog health) shrinks to a gentle ramp. */
export const rosterV10 = rosterFrom(rosterV09, 'v10', 'Штреки v1.0 (Combat Overhaul)', {
  normal: normalEncounterCatalogV10,
  elite: eliteEncounterCatalogV10,
  final: finalEncounterV10,
  healthScale: (type, layer, _column, random) => {
    if (type === 'battle' && layer > 0) random()
    return type === 'elite' ? 1 : layer === 0 ? 0.92 : 0.96 + Math.min(layer, 5) * 0.01
  },
})

/** The roster of the playable dungeon. */
export const defaultDungeonRoster = rosterV10
