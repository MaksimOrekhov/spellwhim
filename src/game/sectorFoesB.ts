import type { EncounterDefinition } from './types'
import { rhahkZor, sectorOneElite, sectorOneEnemies } from './sectorContent'

/**
 * EXPERIMENT "Honest Turn B1" (docs/design/honest-turn-b-experiment-v1.md): the six enemies of Sector I with new cycles.
 * Same ids, portraits, map health and places on the map as `sectorContent.ts`, so one seed is one map; only the behaviour differs.
 * Every number is an absolute figure of this experiment (the A damage fraction is not applied on top of it).
 *
 * Each enemy asks a different question of the party:
 *  - Raider: two heroes, small hits and a hit on both: who is covered this turn?
 *  - Digger: one heavy blow on Varian that the party can stop by dealing damage instead of buying armor.
 *  - Watchman: a bolt at Jaina that ignores part of her armor, so armor is a poor answer and speed is the answer.
 *  - Overseer: a wall of armor and a rage that grows every cycle: a long defensive fight loses to it.
 *  - Johnson: a blow on both heroes after he marks Jaina, so both heroes have to be thought about together.
 *  - Rak'Zor: phase I is the Digger's question on a bigger scale; phase II is a different fight (group hits that pierce armor).
 * Interrupt thresholds are health damage dealt by cards in ONE turn; they are announced with the blow (never earlier).
 */
const sector = (id: string): EncounterDefinition => [...sectorOneEnemies, sectorOneElite, rhahkZor].find(encounter => encounter.id === id)!

const raider: EncounterDefinition = {
  ...sector('old-mines-raider'),
  behavior: { phase1: [
    { kind: 'attack', name: 'Тычок киркой', damage: 5, target: 'mage' },
    { kind: 'attack_all', name: 'Подкоп под ноги', damage: 4, primaryTarget: 'warrior' },
    { kind: 'attack', name: 'Удар рукоятью', damage: 6, target: 'warrior' },
    { kind: 'defend', name: 'За вагонетку', armor: 3 },
  ] },
}

const digger: EncounterDefinition = {
  ...sector('old-mines-digger'),
  behavior: { phase1: [
    { kind: 'attack', name: 'Размашистый удар', damage: 6, target: 'warrior' },
    { kind: 'prepare', name: 'Поднимает кирку', prepared: { kind: 'attack', name: 'Удар забойщика', damage: 13, target: 'warrior', interrupt: 20 } },
    { kind: 'attack', name: 'Обратный замах', damage: 6, target: 'mage' },
  ] },
}

const watchman: EncounterDefinition = {
  ...sector('old-mines-watchman'),
  behavior: { phase1: [
    { kind: 'prepare', name: 'Целится в Джайну', prepared: { kind: 'attack', name: 'Бронебойный болт', damage: 10, target: 'mage', pierce: 6 } },
    { kind: 'attack', name: 'Проверочный выстрел', damage: 6, target: 'warrior' },
    { kind: 'recover', name: 'Перезаряжает за щитом', armor: 3 },
  ] },
}

const overseer: EncounterDefinition = {
  ...sector('old-mines-overseer'),
  behavior: { phase1: [
    { kind: 'prepare', name: 'Берёт разбег', prepared: { kind: 'attack', name: 'Тяжёлый молот', damage: 12, target: 'warrior' } },
    { kind: 'attack', name: 'Тычок локтем', damage: 6, target: 'mage' },
    { kind: 'defend', name: 'Входит в раж', armor: 6, power: 3 },
  ] },
}

const johnson: EncounterDefinition = {
  ...sector('old-mines-johnson'),
  behavior: { phase1: [
    { kind: 'attack', name: 'Метит обломком', damage: 6, target: 'mage', exposes: 'vulnerability' },
    { kind: 'prepare', name: 'Опирается на кирку', prepared: { kind: 'attack_all', name: 'Обвал на двоих', damage: 8, primaryTarget: 'warrior' } },
    { kind: 'attack', name: 'Удар мастера', damage: 8, target: 'warrior' },
    { kind: 'defend', name: 'Шахтёрская закалка', armor: 6 },
  ] },
}

const boss: EncounterDefinition = {
  ...sector('old-mines-rhahk-zor'),
  phaseNote: {
    title: 'Вторая фаза: обрушение штолен',
    lines: [
      'Рак’Зор сбросил каску. Действие, которое вы видите сейчас, не меняется.',
      'Дальше: рёв (ярость растёт), затем удары по обоим героям. Часть брони они пробивают.',
      'Главная цель теперь Джайна, а молот метит её Уязвимостью.',
    ],
  },
  behavior: {
    phase1: [
      { kind: 'attack', name: 'Проверка каски', damage: 7, target: 'warrior' },
      { kind: 'prepare', name: 'Заносит молот', prepared: { kind: 'attack', name: 'Удар бригадира', damage: 13, target: 'warrior', interrupt: 20 } },
      { kind: 'attack', name: 'Обломок породы', damage: 6, target: 'mage' },
      { kind: 'recover', name: 'Переводит дух', armor: 4 },
    ],
    phase2: [
      { kind: 'defend', name: 'Рёв бригадира', armor: 3, power: 2 },
      { kind: 'attack_all', name: 'Дрожь штолен', damage: 5, primaryTarget: 'warrior', pierce: 3 },
      { kind: 'prepare', name: 'Замах через плечо', prepared: { kind: 'attack', name: 'Летящий молот', damage: 11, target: 'mage', pierce: 3, exposes: 'vulnerability' } },
      { kind: 'attack_all', name: 'Обвал свода', damage: 6, primaryTarget: 'mage' },
      { kind: 'recover', name: 'Вытаскивает молот', armor: 2 },
    ],
  },
}

export const sectorFoesB1: readonly EncounterDefinition[] = [raider, digger, watchman, overseer, johnson, boss]

/** The enemy data sets a run can be built on; `sectorEncounters` (the standard Sector I) is the default and is not listed here. */
export const sectorFoeSets = { b1: sectorFoesB1 } as const
export type SectorFoeSetId = keyof typeof sectorFoeSets
