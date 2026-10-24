import type { EncounterDefinition } from './types'
import type { SectorConfig, SectorRow } from './dungeonGenerator'
import { rhahkZor, sectorEventIds, sectorOneElite, sectorOneEnemies } from './sectorContent'

/**
 * EXPERIMENT "Sector I — long route" (docs/design/sector-one-long-v1.md, Decision Log X03). Ten visits instead of six.
 * Nothing here is read by the standard sector: the three extra enemies exist only in a map generated from `sectorLongConfig`,
 * which only the `honest-b1-long` / `honest-b2-long` modes ask for. They are written with the B1 hit traits (pierce, interrupt, exposes, power)
 * and reuse portraits that already sit in the art folder; each asks the party a different question than the four standard enemies:
 *
 *  - Saboteur (goblin): a blast on BOTH heroes that can be stopped by damage (interrupt 18): kill him in time or cover two heroes.
 *  - Tinkerer: marks Jaina, then hits Varian through his armor (pierce 4): armor on both heroes, and on the right one.
 *  - Veteran: stacks armor, then a heavy blow on Jaina with a high interrupt (26): armor does little against his shell, bleeding and frost do.
 */
const saboteur: EncounterDefinition = {
  id: 'old-mines-saboteur', name: 'Гоблин-подрывник', title: 'Бах — и всё по плану', maxHealth: 30, appearance: 'defias', mapLabel: 'Старые штольни',
  behavior: { phase1: [
    { kind: 'attack', name: 'Кидает гайку', damage: 6, target: 'warrior' },
    { kind: 'prepare', name: 'Поджигает шашку', prepared: { kind: 'attack_all', name: 'Взрыв шашки', damage: 10, primaryTarget: 'mage', interrupt: 18 } },
    { kind: 'defend', name: 'Прячется за ящик', armor: 4 },
  ] },
}

const tinkerer: EncounterDefinition = {
  id: 'old-mines-tinkerer', name: 'Механик-наладчик', title: 'Крутит гайки и нервы', maxHealth: 34, appearance: 'defias', mapLabel: 'Старые штольни',
  behavior: { phase1: [
    { kind: 'attack', name: 'Метит ключом', damage: 5, target: 'mage', exposes: 'vulnerability' },
    { kind: 'attack', name: 'Разводной ключ', damage: 7, target: 'warrior', pierce: 4 },
    { kind: 'recover', name: 'Подтягивает болты', armor: 5 },
  ] },
}

const veteran: EncounterDefinition = {
  id: 'old-mines-veteran', name: 'Ветеран Братства', title: 'Щит старше устава', maxHealth: 38, appearance: 'defias', mapLabel: 'Старые штольни',
  behavior: { phase1: [
    { kind: 'defend', name: 'Стойка щитоносца', armor: 7 },
    { kind: 'prepare', name: 'Выжидает', prepared: { kind: 'attack', name: 'Рассекающий выпад', damage: 14, target: 'mage', interrupt: 26 } },
    { kind: 'attack', name: 'Удар щитом', damage: 6, target: 'warrior' },
  ] },
}

export const longSectorEnemies: readonly EncounterDefinition[] = [saboteur, tinkerer, veteran]
/** Every encounter a Sector I map may name: the standard ones and the long route's extras. */
export const knownSectorEncounters: readonly EncounterDefinition[] = [...sectorOneEnemies, sectorOneElite, rhahkZor, ...longSectorEnemies]

const ids = (...list: EncounterDefinition[]) => list.map(item => item.id)
const [raider, digger, watchman, overseer] = sectorOneEnemies as [EncounterDefinition, EncounterDefinition, EncounterDefinition, EncounterDefinition]

/**
 * Nine rows and the boss. Forced fights: rows 1, 4, 6, 8 (four normal battles on every route); row 2 may add a fifth. Rows 3 and 7 are service rooms.
 * Row 5 is the choice the whole sector turns on: a rest, a forge or the optional elite. Row 9 is the guaranteed rest before Rak'Zor.
 * Enemy pools rise with the row, so the dangerous enemies come late, and no route repeats an enemy.
 */
const rows: SectorRow[] = [
  { types: ['battle'], encounters: ids(raider, saboteur, tinkerer) },
  { types: ['battle', 'event'], required: ['battle', 'event'], minNodes: 2, encounters: ids(raider, saboteur, tinkerer, digger, watchman) },
  { types: ['forge', 'treasure', 'event'], required: ['forge'], minNodes: 2 },
  { types: ['battle'], encounters: ids(digger, watchman, tinkerer, veteran, overseer) },
  { types: ['elite', 'rest', 'forge'], required: ['elite', 'rest'], minNodes: 3 },
  { types: ['battle'], encounters: ids(watchman, tinkerer, veteran, overseer, digger) },
  { types: ['forge', 'treasure', 'event'], required: ['treasure'], minNodes: 2 },
  { types: ['battle'], encounters: ids(overseer, veteran, digger, watchman) },
  { types: ['rest'] },
]

export const sectorLongConfig: SectorConfig = {
  id: 'deadmines-old-mines-long', version: 1, name: 'Старые штольни · длинный путь', generatorVersion: 'carved-paths-2',
  columns: 4, paths: 7, maxStep: 1, rows,
  normalPool: ids(...sectorOneEnemies, ...longSectorEnemies), elitePool: [sectorOneElite.id], eventPool: [...sectorEventIds], boss: rhahkZor.id,
  maxElites: 1, maxConsecutiveServices: 2, maxBattles: 7, maxNormalBattles: 5, assigner: 'forward', requireDevelopment: true,
}
