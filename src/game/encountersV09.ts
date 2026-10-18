import type { EncounterDefinition } from './types'

/** Deadmines roster for the playable dungeon. The old economy packages remain Balance Lab controls. */
export const normalEncounterCatalog: readonly EncounterDefinition[] = [
  {
    id: 'defias-cutpurse', name: 'Шахтный налётчик', title: 'Ловкий воришка', maxHealth: 27,
    appearance: 'defias', mapLabel: 'Штреки Братства',
    behavior: { phase1: [
      { kind: 'attack', name: 'Короткий выпад', damage: 4, target: 'mage' },
      { kind: 'attack', name: 'Ответный выпад', damage: 4, target: 'warrior' },
      { kind: 'defend', name: 'Прикрывается киркой', armor: 3 },
    ] },
  },
  {
    id: 'mine-overseer', name: 'Шахтный надсмотрщик', title: 'Броня и тяжёлый замах', maxHealth: 32,
    appearance: 'defias', mapLabel: 'Штреки Братства',
    behavior: { phase1: [
      { kind: 'defend', name: 'Каска и щиток', armor: 6 },
      { kind: 'prepare', name: 'Размахивает киркой', prepared: { kind: 'attack', name: 'Удар надсмотрщика', damage: 10, target: 'warrior' } },
      { kind: 'recover', name: 'Подбирает заклёпки', armor: 2 },
    ] },
  },
  {
    id: 'goblin-powder-runner', name: 'Гоблин-пороховщик', title: 'Фитиль уже горит', maxHealth: 29,
    appearance: 'goblin', mapLabel: 'Литейная гоблинов',
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поджигает фитиль', prepared: { kind: 'attack_all', name: 'Пороховой хлопок', damage: 5, primaryTarget: 'mage' } },
      { kind: 'defend', name: 'Прячется за бочкой', armor: 3 },
      { kind: 'attack', name: 'Копоть из мехов', damage: 4, target: 'warrior' },
    ] },
  },
  {
    id: 'defias-lookout', name: 'Дозорный Братства', title: 'Глазастый стрелок', maxHealth: 30,
    appearance: 'defias', mapLabel: 'Штреки Братства',
    behavior: { phase1: [
      { kind: 'prepare', name: 'Берёт Джайну на прицел', prepared: { kind: 'attack', name: 'Выстрел из арбалета', damage: 8, target: 'mage' } },
      { kind: 'attack', name: 'Проверочный болт', damage: 4, target: 'warrior' },
      { kind: 'recover', name: 'Перезаряжает арбалет', armor: 2 },
    ] },
  },
  {
    id: 'foundry-tinkerer', name: 'Литейный механик', title: 'Мастер гаечных ключей', maxHealth: 34,
    appearance: 'mechanical', mapLabel: 'Литейная гоблинов',
    behavior: { phase1: [
      { kind: 'attack', name: 'Клепальный молоток', damage: 5, target: 'warrior' },
      { kind: 'recover', name: 'Подтягивает пружины', armor: 4 },
      { kind: 'attack_all', name: 'Паровой свисток', damage: 3, primaryTarget: 'mage' },
      { kind: 'defend', name: 'Закрывает люк', armor: 3 },
    ] },
  },
  {
    id: 'defias-deckhand', name: 'Матрос Братства', title: 'Старый морской волк', maxHealth: 35,
    appearance: 'defias', mapLabel: 'Причал Железного клюва',
    behavior: { phase1: [
      { kind: 'attack_all', name: 'Качка на палубе', damage: 3, primaryTarget: 'warrior' },
      { kind: 'attack', name: 'Абордажная сабля', damage: 6, target: 'warrior' },
      { kind: 'prepare', name: 'Целится через снасти', prepared: { kind: 'attack', name: 'Выстрел с такелажа', damage: 9, target: 'mage' } },
      { kind: 'defend', name: 'Уходит за бортовой щит', armor: 3 },
    ] },
  },
]

export const eliteEncounterCatalog: readonly EncounterDefinition[] = [
  {
    id: 'defias-veteran', name: 'Ветеран Братства', title: 'Закалённый мечник', maxHealth: 54,
    appearance: 'defias', mapLabel: 'Элитный бой',
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поднимает тяжёлый меч', prepared: { kind: 'attack', name: 'Удар ветерана', damage: 11, target: 'warrior' } },
      { kind: 'attack_all', name: 'Рукоятью по обоим', damage: 4, primaryTarget: 'mage' },
      { kind: 'prepare', name: 'Перехватывает клинок', prepared: { kind: 'attack', name: 'Рубящий выпад', damage: 10, target: 'mage' } },
      { kind: 'defend', name: 'Выставляет гард', armor: 5 },
    ] },
  },
  {
    id: 'goblin-foundry-chief', name: 'Старший механик литейной', title: 'Хозяин котла', maxHealth: 60,
    appearance: 'mechanical', mapLabel: 'Элитный бой',
    behavior: {
      phase1: [
        { kind: 'prepare', name: 'Разогревает котёл', prepared: { kind: 'attack_all', name: 'Выпуск пара', damage: 4, primaryTarget: 'warrior' } },
        { kind: 'recover', name: 'Сбрасывает давление', armor: 4 },
        { kind: 'attack', name: 'Механическая клешня', damage: 7, target: 'mage' },
      ],
      phase2: [
        { kind: 'prepare', name: 'Переводит котёл в красную зону', prepared: { kind: 'attack', name: 'Удар поршня', damage: 12, target: 'warrior' } },
        { kind: 'attack_all', name: 'Обратная тяга', damage: 5, primaryTarget: 'mage' },
        { kind: 'defend', name: 'Запирает защитный кожух', armor: 6 },
        { kind: 'prepare', name: 'Снова копит давление', prepared: { kind: 'attack_all', name: 'Большой выпуск пара', damage: 6, primaryTarget: 'warrior' } },
      ],
    },
  },
]

export const encounterPoolsByLayer: readonly (readonly string[])[] = [
  ['defias-cutpurse', 'defias-lookout', 'mine-overseer', 'goblin-powder-runner'],
  ['defias-cutpurse', 'mine-overseer', 'goblin-powder-runner', 'defias-lookout', 'foundry-tinkerer'],
  normalEncounterCatalog.map(encounter => encounter.id),
]

/** Layers are zero-based: the first two share a 4-enemy pool, layer 3 adds the tinkerer, layer 5 opens the full roster. */
export function encounterPoolForLayer(layer: number): readonly string[] {
  const poolIndex = layer < 2 ? 0 : layer < 4 ? 1 : 2
  return encounterPoolsByLayer[poolIndex] ?? []
}

/** Map layer indices are zero-based: Veteran on layer 3, foundry chief on layer 5. */
const eliteEncounterIdByLayer: Readonly<Record<number, string>> = {
  2: 'defias-veteran',
  4: 'goblin-foundry-chief',
}

export function eliteEncountersForLayer(layer: number): readonly EncounterDefinition[] {
  const encounterId = eliteEncounterIdByLayer[layer]
  return encounterId ? eliteEncounterCatalog.filter(encounter => encounter.id === encounterId) : []
}

export function dungeonEncounterById(id: string): EncounterDefinition | undefined {
  return [...normalEncounterCatalog, ...eliteEncounterCatalog].find(encounter => encounter.id === id)
}
