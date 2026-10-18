import { encounters } from './types'
import type { EncounterDefinition } from './types'

/**
 * Enemy package v0.7 — the same three enemies with roughly twice the health and longer, readable cycles.
 * Only data: no new action kinds, no new statuses.
 *
 * Design rules of the package:
 * - every strong hit is announced by a `prepare` action one turn before it lands, with its target and damage;
 * - the quiet turns of a cycle (prepare, defend, recover) are the windows for aggressive combinations, or for placing
 *   armor ahead of time (armor stays on a hero until that hero is hit);
 * - hits come in short runs ("pressure periods") that force a choice between defending and racing;
 * - the mage (18 health) is the target of the sharpest single hits, so protecting her stays a real decision;
 * - the boss' second phase opens with an announced execution and continues as one long sequence that ramps up, so a fight
 *   that drags on becomes more dangerous instead of repeating the same three hits.
 * The numbers were set with the Balance Lab; see docs/combat-economy-v07.md for the targets and results.
 */
export const reinforcedEncounters: readonly EncounterDefinition[] = [
  {
    // Root Sentinel: opens on the mage, announces a heavy lash, then a bark window, then thorns on both.
    ...encounters[0]!, maxHealth: 56,
    behavior: {
      phase1: [
        { kind: 'attack', name: 'Удар корнями', damage: 6, target: 'mage' },
        { kind: 'prepare', name: 'Замах лозой', prepared: { kind: 'attack', name: 'Хлёсткая лоза', damage: 11, target: 'warrior' } },
        { kind: 'defend', name: 'Кора-защитница', armor: 5 },
        { kind: 'attack_all', name: 'Шипы', damage: 5, primaryTarget: 'mage' },
      ],
    },
  },
  {
    // Old-Grove Guardian: two announced heavy strikes (one at each hero) with a shove between them, then a rest window.
    ...encounters[1]!, maxHealth: 72,
    behavior: {
      phase1: [
        { kind: 'prepare', name: 'Тяжёлый замах', prepared: { kind: 'attack', name: 'Сокрушающий удар', damage: 12, target: 'warrior' } },
        { kind: 'attack_all', name: 'Корневой толчок', damage: 5, primaryTarget: 'mage' },
        { kind: 'prepare', name: 'Прицелился в Джайну', prepared: { kind: 'attack', name: 'Удар по чародейке', damage: 10, target: 'mage' } },
        { kind: 'recover', name: 'Передышка', armor: 4 },
      ],
    },
  },
  {
    // Twilight Heart: phase 1 alternates cheap pressure with an announced crush. When it falls below half health, phase 2
    // opens with an announced execution of the mage (so the new phase is visible even in a fast fight) and then runs a
    // ten-turn sequence whose second half hits harder. That second half is an anti-stall ramp: no simulated fight
    // (7-10 turns) has ever reached it.
    ...encounters[2]!, maxHealth: 110,
    behavior: {
      phase1: [
        { kind: 'attack', name: 'Сумеречный импульс', damage: 8, target: 'mage' },
        { kind: 'attack_all', name: 'Корневая волна', damage: 6, primaryTarget: 'warrior' },
        { kind: 'defend', name: 'Оболочка чащи', armor: 5 },
        { kind: 'prepare', name: 'Сбор силы', prepared: { kind: 'attack', name: 'Гнёт чащи', damage: 15, target: 'warrior' } },
      ],
      phase2: [
        { kind: 'prepare', name: 'Сбор ярости', prepared: { kind: 'attack', name: 'Сумеречная казнь', damage: 14, target: 'mage' } },
        { kind: 'attack_all', name: 'Всплеск сердца', damage: 6, primaryTarget: 'mage' },
        { kind: 'attack', name: 'Гневное жало', damage: 9, target: 'warrior' },
        { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 },
        { kind: 'prepare', name: 'Сбор ярости', prepared: { kind: 'attack', name: 'Сумеречная казнь', damage: 16, target: 'mage' } },
        { kind: 'attack_all', name: 'Всплеск сердца', damage: 7, primaryTarget: 'mage' },
        { kind: 'attack', name: 'Гневное жало', damage: 9, target: 'warrior' },
        { kind: 'defend', name: 'Сумеречный панцирь', armor: 6 },
      ],
    },
  },
]
