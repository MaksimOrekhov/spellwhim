import { encounters } from '../../src/game/types'
import type { EncounterDefinition } from '../../src/game/types'

/**
 * Research-only redesign of the three encounters: same cast, same themes, same maximum armor rule,
 * but longer telegraphed cycles that alternate a threat window and a safe window.
 * HP is a placeholder; calibration rescales it. These are NOT proposed production values.
 */
export const redesigned: EncounterDefinition[] = [
  {
    ...encounters[0]!, maxHealth: 24,
    behavior: {
      phase1: [
        { kind: 'attack', name: 'Удар корнями', damage: 4, target: 'mage' },
        { kind: 'prepare', name: 'Замах', prepared: { kind: 'attack', name: 'Хлёсткая лоза', damage: 9, target: 'warrior' } },
        { kind: 'defend', name: 'Кора-защитница', armor: 5 },
        { kind: 'attack_all', name: 'Шипы', damage: 3, primaryTarget: 'mage' },
      ],
    },
  },
  {
    ...encounters[1]!, maxHealth: 30,
    behavior: {
      phase1: [
        { kind: 'prepare', name: 'Тяжёлый удар', prepared: { kind: 'attack', name: 'Сокрушающий удар', damage: 11, target: 'warrior' } },
        { kind: 'recover', name: 'Передышка', armor: 3 },
        { kind: 'prepare', name: 'Топот', prepared: { kind: 'attack_all', name: 'Сотрясение', damage: 5, primaryTarget: 'mage' } },
        { kind: 'recover', name: 'Передышка', armor: 3 },
      ],
    },
  },
  {
    ...encounters[2]!, maxHealth: 46,
    behavior: {
      phase1: [
        { kind: 'attack', name: 'Сумеречный импульс', damage: 6, target: 'mage' },
        { kind: 'attack_all', name: 'Корневая волна', damage: 3, primaryTarget: 'warrior' },
        { kind: 'defend', name: 'Оболочка чащи', armor: 5 },
        { kind: 'prepare', name: 'Сбор силы', prepared: { kind: 'attack', name: 'Гнёт чащи', damage: 12, target: 'warrior' } },
      ],
      phase2: [
        { kind: 'attack_all', name: 'Всплеск сердца', damage: 5, primaryTarget: 'mage' },
        { kind: 'attack', name: 'Гневное жало', damage: 8, target: 'warrior' },
        { kind: 'prepare', name: 'Сбор ярости', prepared: { kind: 'attack', name: 'Сумеречная казнь', damage: 14, target: 'mage' } },
        { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 },
      ],
    },
  },
]
