import type { EncounterDefinition } from './types'

/** Sector I v1.1 (PA; Rak'Zor 76 HP after the independent review). See docs/design/deadmines-sector-one-balance-v11.md.
 * Combat verbs and phase transitions belong to the existing engine. */
export const sectorOneEnemies: readonly EncounterDefinition[] = [
  { id: 'old-mines-raider', name: 'Шахтёр-налётчик', title: 'Кирка без выходных', maxHealth: 32, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'attack', name: 'Тычок киркой', damage: 6, target: 'mage' }, { kind: 'attack', name: 'Удар рукоятью', damage: 6, target: 'warrior' }, { kind: 'defend', name: 'За вагонетку', armor: 3 },
  ] } },
  { id: 'old-mines-digger', name: 'Забойщик', title: 'Замах на полштрека', maxHealth: 36, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'attack', name: 'Размашистый удар', damage: 7, target: 'warrior' }, { kind: 'attack', name: 'Обратный замах', damage: 7, target: 'mage' }, { kind: 'prepare', name: 'Поднимает кирку', prepared: { kind: 'attack', name: 'Удар забойщика', damage: 12, target: 'warrior' } },
  ] } },
  { id: 'old-mines-watchman', name: 'Дозорный Братства', title: 'Считает болты, а не гостей', maxHealth: 34, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'prepare', name: 'Целится в Джайну', prepared: { kind: 'attack', name: 'Прицельный болт', damage: 11, target: 'mage' } }, { kind: 'attack', name: 'Проверочный выстрел', damage: 6, target: 'warrior' }, { kind: 'recover', name: 'Перезаряжает за щитом', armor: 3 },
  ] } },
  { id: 'old-mines-overseer', name: 'Громила-надсмотрщик', title: 'Каска толще инструкции', maxHealth: 40, appearance: 'defias', mapLabel: 'Старые штольни', behavior: { phase1: [
    { kind: 'prepare', name: 'Берёт разбег', prepared: { kind: 'attack', name: 'Тяжёлый молот', damage: 13, target: 'warrior' } }, { kind: 'attack', name: 'Тычок локтем', damage: 6, target: 'mage' }, { kind: 'defend', name: 'Прячет подбородок', armor: 6 },
  ] } },
]

export const sectorOneElite: EncounterDefinition = { id: 'old-mines-johnson', name: 'Шахтёр Джонсон', title: 'Смена ещё не окончена', maxHealth: 64, appearance: 'defias', mapLabel: 'Опасный забой', behavior: { phase1: [
  { kind: 'prepare', name: 'Опирается на кирку', prepared: { kind: 'attack', name: 'Удар мастера', damage: 14, target: 'warrior' } }, { kind: 'attack', name: 'Летящий обломок', damage: 7, target: 'mage' }, { kind: 'defend', name: 'Шахтёрская закалка', armor: 6 }, { kind: 'attack_all', name: 'Обвал породы', damage: 4, primaryTarget: 'mage' },
] } }

export const rhahkZor: EncounterDefinition = { id: 'old-mines-rhahk-zor', name: "Рак'Зор", title: 'Бригадир Старых штолен', maxHealth: 76, appearance: 'guardian', mapLabel: 'Ворота штолен', behavior: {
  phase1: [{ kind: 'attack', name: 'Проверка каски', damage: 7, target: 'warrior' }, { kind: 'prepare', name: 'Заносит молот', prepared: { kind: 'attack', name: 'Удар бригадира', damage: 13, target: 'warrior' } }, { kind: 'attack', name: 'Обломок породы', damage: 6, target: 'mage' }, { kind: 'recover', name: 'Переводит дух', armor: 4 }],
  phase2: [{ kind: 'attack_all', name: 'Дрожь штолен', damage: 5, primaryTarget: 'warrior' }, { kind: 'prepare', name: 'Замах через плечо', prepared: { kind: 'attack', name: 'Летящий молот', damage: 11, target: 'mage' } }, { kind: 'attack', name: 'Гнев бригадира', damage: 8, target: 'warrior' }, { kind: 'recover', name: 'Вытаскивает молот', armor: 2 }],
} }

export const sectorEncounters = [...sectorOneEnemies, sectorOneElite, rhahkZor]
/** The three events of the standard (short) Sector I and of long-route runs saved before the content expansion. Their fingerprint (`SECTOR_CATALOG_VERSION`) reads this list, so it never grows. */
export const sectorEventIds = ['forgotten-forge', 'powder-store', 'goblin-trade'] as const
/** Events added by Sector I Content Expansion v1 (docs/design/sector-one-content-expansion-v1.md); only the long route's configuration version 2 offers them. */
export const expansionEventIds = ['suspicious-dinner'] as const
/** The events of the long route's configuration 2. Its fingerprint (`LONG_SECTOR_CATALOG_VERSION_2`) reads this list, so it never grows. */
export const eventIdsV2 = [...sectorEventIds, ...expansionEventIds] as const
/** Events added by Runaway Cart (E06, docs/design/event-e06-runaway-cart-v1.md); only the long route's configuration version 3 offers them. */
export const cartEventIds = ['runaway-cart'] as const
/** Every event a map or a saved room may carry. */
export const allSectorEventIds = [...eventIdsV2, ...cartEventIds] as const
export type SectorEventId = typeof allSectorEventIds[number]
export const sectorEventText: Record<SectorEventId, { name: string; text: string }> = {
  'runaway-cart': { name: 'Вагонетка без тормозов', text: 'Вагонетка несётся под уклон, а у тормоза сидит гоблин и мирно ест бутерброд. «Не волнуйтесь, — кричит он, — тормоз у нас есть. Теперь бы ещё найти, где он». Вариан уже примеривается к борту.' },
  'suspicious-dinner': { name: 'Подозрительный ужин', text: 'В столовой Братства Справедливости дымится котёл. Вариан принюхивается и мрачнеет. Джайна читает табличку: «Блюдо дня — сюрприз повара». Повара нет. Сюрприз остался.' },
  'forgotten-forge': { name: 'Забытая кузница', text: 'Инструменты ещё целы. Вариан проверяет клещи. Джайна замечает: «Инструкция начинается со слов: берегите пальцы».' },
  'powder-store': { name: 'Пороховой склад', text: 'На ящике написано: «Не трясти». Надпись дрожит вместе с крышкой.' },
  'goblin-trade': { name: 'Обмен у пройдохи', text: '«Гарантия до ближайшего поворота!» — обещает гоблин. Поворот, конечно, совсем рядом.' },
}
