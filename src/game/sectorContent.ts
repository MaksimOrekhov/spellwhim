import type { EncounterDefinition } from './types'

/** Sector I prototype. Combat verbs and phase transitions belong to the existing engine. */
export const sectorOneEnemies: readonly EncounterDefinition[] = [
  { id: 'old-mines-raider', name: 'Шахтёр-налётчик', title: 'Кирка без выходных', maxHealth: 32, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'attack', name: 'Тычок киркой', damage: 5, target: 'mage' }, { kind: 'attack', name: 'Удар рукоятью', damage: 5, target: 'warrior' }, { kind: 'defend', name: 'За вагонетку', armor: 2 },
  ] } },
  { id: 'old-mines-digger', name: 'Забойщик', title: 'Замах на полштрека', maxHealth: 36, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'attack', name: 'Размашистый удар', damage: 6, target: 'warrior' }, { kind: 'attack', name: 'Обратный замах', damage: 6, target: 'mage' }, { kind: 'prepare', name: 'Поднимает кирку', prepared: { kind: 'attack', name: 'Удар забойщика', damage: 11, target: 'warrior' } },
  ] } },
  { id: 'old-mines-watchman', name: 'Дозорный Братства', title: 'Считает болты, а не гостей', maxHealth: 34, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'prepare', name: 'Целится в Джайну', prepared: { kind: 'attack', name: 'Прицельный болт', damage: 10, target: 'mage' } }, { kind: 'attack', name: 'Проверочный выстрел', damage: 5, target: 'warrior' }, { kind: 'recover', name: 'Перезаряжает за щитом', armor: 3 },
  ] } },
  { id: 'old-mines-overseer', name: 'Громила-надсмотрщик', title: 'Каска толще инструкции', maxHealth: 40, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'defend', name: 'Прячет подбородок', armor: 6 }, { kind: 'prepare', name: 'Берёт разбег', prepared: { kind: 'attack', name: 'Тяжёлый молот', damage: 12, target: 'warrior' } }, { kind: 'attack', name: 'Тычок локтем', damage: 5, target: 'mage' },
  ] } },
]

export const sectorOneElite: EncounterDefinition = { id: 'old-mines-johnson', name: 'Шахтёр Джонсон', title: 'Смена ещё не окончена', maxHealth: 60, appearance: 'defias', mapLabel: 'Опасный забой', behavior: { phase1: [
  { kind: 'defend', name: 'Шахтёрская закалка', armor: 6 }, { kind: 'prepare', name: 'Опирается на кирку', prepared: { kind: 'attack', name: 'Удар мастера', damage: 13, target: 'warrior' } }, { kind: 'attack', name: 'Летящий обломок', damage: 6, target: 'mage' }, { kind: 'recover', name: 'Поправляет каску', armor: 2 },
] } }

export const rhahkZor: EncounterDefinition = { id: 'old-mines-rhahk-zor', name: "Рак'Зор", title: 'Бригадир Старых штолен', maxHealth: 65, appearance: 'guardian', mapLabel: 'Ворота штолен', behavior: {
  phase1: [{ kind: 'attack', name: 'Проверка каски', damage: 6, target: 'warrior' }, { kind: 'prepare', name: 'Заносит молот', prepared: { kind: 'attack', name: 'Удар бригадира', damage: 12, target: 'warrior' } }, { kind: 'attack', name: 'Обломок породы', damage: 5, target: 'mage' }, { kind: 'recover', name: 'Переводит дух', armor: 4 }],
  phase2: [{ kind: 'attack_all', name: 'Дрожь штолен', damage: 4, primaryTarget: 'warrior' }, { kind: 'prepare', name: 'Замах через плечо', prepared: { kind: 'attack', name: 'Летящий молот', damage: 10, target: 'mage' } }, { kind: 'attack', name: 'Гнев бригадира', damage: 7, target: 'warrior' }, { kind: 'recover', name: 'Вытаскивает молот', armor: 2 }],
} }

export const sectorEncounters = [...sectorOneEnemies, sectorOneElite, rhahkZor]
export const sectorEventIds = ['forgotten-forge', 'powder-store', 'goblin-trade'] as const
export type SectorEventId = typeof sectorEventIds[number]
export const sectorEventText: Record<SectorEventId, { name: string; text: string }> = {
  'forgotten-forge': { name: 'Забытая кузница', text: 'Инструменты ещё целы. Вариан проверяет клещи. Джайна замечает: «Инструкция начинается со слов: берегите пальцы».' },
  'powder-store': { name: 'Пороховой склад', text: 'На ящике написано: «Не трясти». Надпись дрожит вместе с крышкой.' },
  'goblin-trade': { name: 'Обмен у пройдохи', text: '«Гарантия до ближайшего поворота!» — обещает гоблин. Поворот, конечно, совсем рядом.' },
}
