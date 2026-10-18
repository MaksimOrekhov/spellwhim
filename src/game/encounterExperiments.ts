import type { EncounterDefinition, EnemyAction, EnemyHit } from './types'
import { normalEncounterCatalog, eliteEncounterCatalog } from './encountersV09'
import { rosterFrom, rosterV09 } from './rosters'
import { rosterV10 } from './encountersV10'
import type { DungeonRoster } from './rosters'

/**
 * Combat Overhaul v0.2, stage A — experimental encounter generations of the Deadmines roster. The control is v0.9
 * (`rosterV09`); the variants below exist so the headless labs can replay one set of seeds against several tunings.
 * Only the encounter data changes: no new action kinds, no hidden actions, every strong hit is still announced.
 */

/** Pattern pass (variant B): the same six normal enemies and two elites, rewritten so that few turns are safe turns. */
const patternNormal: readonly EncounterDefinition[] = [
  {
    ...normalEncounterCatalog[0]!, id: 'defias-cutpurse', title: 'Бьёт туда, где не прикрыто', maxHealth: 27,
    behavior: { phase1: [
      { kind: 'attack', name: 'Короткий выпад', damage: 5, target: 'mage' },
      { kind: 'prepare', name: 'Заходит за спину', prepared: { kind: 'attack', name: 'Нож в спину', damage: 8, target: 'mage' } },
      { kind: 'attack', name: 'Ответный выпад', damage: 4, target: 'warrior' },
      { kind: 'defend', name: 'Прикрывается киркой', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[1]!, id: 'mine-overseer', title: 'Тяжёлый замах и крепкая каска', maxHealth: 32,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Размахивает киркой', prepared: { kind: 'attack', name: 'Удар надсмотрщика', damage: 11, target: 'warrior' } },
      { kind: 'defend', name: 'Каска и щиток', armor: 6 },
      { kind: 'attack', name: 'Тычок рукоятью', damage: 5, target: 'mage' },
    ] },
  },
  {
    ...normalEncounterCatalog[2]!, id: 'goblin-powder-runner', title: 'Фитиль уже горит', maxHealth: 29,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поджигает фитиль', prepared: { kind: 'attack_all', name: 'Пороховой хлопок', damage: 6, primaryTarget: 'mage' } },
      { kind: 'attack', name: 'Копоть из мехов', damage: 4, target: 'warrior' },
      { kind: 'defend', name: 'Прячется за бочкой', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[3]!, id: 'defias-lookout', title: 'Глазастый стрелок', maxHealth: 30,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Берёт Джайну на прицел', prepared: { kind: 'attack', name: 'Выстрел из арбалета', damage: 9, target: 'mage' } },
      { kind: 'attack', name: 'Проверочный болт', damage: 5, target: 'warrior' },
      { kind: 'recover', name: 'Перезаряжает арбалет', armor: 3 },
    ] },
  },
  {
    ...normalEncounterCatalog[4]!, id: 'foundry-tinkerer', title: 'Мастер гаечных ключей', maxHealth: 34,
    behavior: { phase1: [
      { kind: 'attack', name: 'Клепальный молоток', damage: 5, target: 'warrior' },
      { kind: 'attack_all', name: 'Паровой свисток', damage: 4, primaryTarget: 'mage' },
      { kind: 'prepare', name: 'Затягивает гайку', prepared: { kind: 'attack', name: 'Разводной ключ', damage: 9, target: 'mage' } },
      { kind: 'recover', name: 'Подтягивает пружины', armor: 4 },
    ] },
  },
  {
    ...normalEncounterCatalog[5]!, id: 'defias-deckhand', title: 'Старый морской волк', maxHealth: 35,
    behavior: { phase1: [
      { kind: 'attack_all', name: 'Качка на палубе', damage: 4, primaryTarget: 'warrior' },
      { kind: 'attack', name: 'Абордажная сабля', damage: 6, target: 'warrior' },
      { kind: 'prepare', name: 'Целится через снасти', prepared: { kind: 'attack', name: 'Выстрел с такелажа', damage: 10, target: 'mage' } },
      { kind: 'defend', name: 'Уходит за бортовой щит', armor: 3 },
    ] },
  },
]

const patternElite: readonly EncounterDefinition[] = [
  {
    ...eliteEncounterCatalog[0]!, maxHealth: 54,
    behavior: { phase1: [
      { kind: 'prepare', name: 'Поднимает тяжёлый меч', prepared: { kind: 'attack', name: 'Удар ветерана', damage: 12, target: 'warrior' } },
      { kind: 'attack_all', name: 'Рукоятью по обоим', damage: 5, primaryTarget: 'mage' },
      { kind: 'prepare', name: 'Перехватывает клинок', prepared: { kind: 'attack', name: 'Рубящий выпад', damage: 11, target: 'mage' } },
      { kind: 'defend', name: 'Выставляет гард', armor: 6 },
    ] },
  },
  {
    ...eliteEncounterCatalog[1]!, maxHealth: 60,
    behavior: {
      phase1: [
        { kind: 'prepare', name: 'Разогревает котёл', prepared: { kind: 'attack_all', name: 'Выпуск пара', damage: 5, primaryTarget: 'warrior' } },
        { kind: 'attack', name: 'Механическая клешня', damage: 7, target: 'mage' },
        { kind: 'recover', name: 'Сбрасывает давление', armor: 4 },
      ],
      phase2: [
        { kind: 'prepare', name: 'Переводит котёл в красную зону', prepared: { kind: 'attack', name: 'Удар поршня', damage: 13, target: 'warrior' } },
        { kind: 'attack_all', name: 'Обратная тяга', damage: 6, primaryTarget: 'mage' },
        { kind: 'defend', name: 'Запирает защитный кожух', armor: 6 },
        { kind: 'prepare', name: 'Снова копит давление', prepared: { kind: 'attack_all', name: 'Большой выпуск пара', damage: 7, primaryTarget: 'warrior' } },
      ],
    },
  },
]

function scaledHit(hit: EnemyHit, factor: number): EnemyHit {
  return { ...hit, damage: Math.max(1, Math.round(hit.damage * factor)) }
}
function scaledAction(action: EnemyAction, factor: number): EnemyAction {
  if (action.kind === 'attack' || action.kind === 'attack_all') return scaledHit(action, factor)
  if (action.kind === 'prepare') return { ...action, prepared: scaledHit(action.prepared, factor) }
  return action
}

/** Experiment knob: multiplies catalog health and announced damage (armor gains are left alone). */
export function tuneEncounter(encounter: EncounterDefinition, tuning: { hp?: number; damage?: number }): EncounterDefinition {
  const damage = tuning.damage ?? 1
  const behavior = {
    phase1: encounter.behavior.phase1.map(action => scaledAction(action, damage)),
    ...(encounter.behavior.phase2 ? { phase2: encounter.behavior.phase2.map(action => scaledAction(action, damage)) } : {}),
  }
  return { ...encounter, maxHealth: Math.round(encounter.maxHealth * (tuning.hp ?? 1)), behavior }
}

function tunedRoster(id: string, label: string, source: { normal: readonly EncounterDefinition[]; elite: readonly EncounterDefinition[] }, tuning: { hp?: number; damage?: number }, flat = false): DungeonRoster {
  return rosterFrom(rosterV09, id, label, {
    normal: source.normal.map(encounter => tuneEncounter(encounter, tuning)),
    elite: source.elite.map(encounter => tuneEncounter(encounter, tuning)),
    // "flat" removes the per-position discount of v0.9 (0.78–1.0 of catalog health) but keeps the random stream aligned.
    ...(flat ? { healthScale: (type, layer, _column, random) => { if (type === 'battle' && layer > 0) random(); return type === 'elite' ? 1 : 0.94 + Math.min(layer, 5) * 0.012 } } : {}),
  })
}

const controlSource = { normal: normalEncounterCatalog, elite: eliteEncounterCatalog }
const patternSource = { normal: patternNormal, elite: patternElite }

/** Experiment generations. A is the control. */
export const experimentRosters: Record<string, DungeonRoster> = {
  A: rosterV09,
  B: tunedRoster('B', 'B · новые шаблоны действий', patternSource, {}),
  C: tunedRoster('C', 'C · старые шаблоны, здоровье ×1,25 и урон ×1,2', controlSource, { hp: 1.25, damage: 1.2 }, true),
  E: rosterV10,
  D: tunedRoster('D', 'D · новые шаблоны, здоровье ×1,2 и урон ×1,1', patternSource, { hp: 1.2, damage: 1.1 }, true),
}

/**
 * Lab shorthand for sweeps: `p1.4x1.5` = new patterns with health ×1.4 and damage ×1.5 (flat position scale),
 * `o…` = the v0.9 patterns with the same knobs. Named rosters (A–D) are looked up first.
 */
export function rosterFromSpec(spec: string): DungeonRoster {
  const named = experimentRosters[spec]
  if (named) return named
  const match = /^([po])([\d.]+)x([\d.]+)$/.exec(spec)
  if (!match) throw new Error('Unknown roster: ' + spec)
  const [, source, hp, damage] = match
  return tunedRoster(spec, spec, source === 'p' ? patternSource : controlSource, { hp: Number(hp), damage: Number(damage) }, true)
}
