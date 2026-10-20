// Frozen before screening. V0 is loaded from the untouched 1afabb3 catalogue.
import { readFileSync } from 'node:fs'
export const base = JSON.parse(readFileSync(new URL('../config/v0.json', import.meta.url)))
const copy = value => structuredClone(value)
const bumped = (action, single, group) => action.kind === 'prepare'
  ? { ...action, prepared: bumped(action.prepared, single, group) }
  : ['attack', 'attack_all'].includes(action.kind)
    ? { ...action, damage: action.damage + (action.kind === 'attack' ? single : group) } : copy(action)
export function definitions(variant) {
  const enemies = copy(base)
  if (variant === 'V0') return enemies
  if (variant === 'V1') return enemies.map(e => ({ ...e, behavior: Object.fromEntries(Object.entries(e.behavior).map(([phase, actions]) => [phase, actions.map(a => bumped(a, 2, 1))])) }))
  if (!['V2', 'V3'].includes(variant)) throw Error('Unknown variant: ' + variant)
  // Literal PA from Claude 0431cf9, exp-routes.mjs; not the shorthand in C3.
  const byId = id => enemies.find(e => e.id === 'old-mines-' + id)
  for (const e of enemies) e.behavior = Object.fromEntries(Object.entries(e.behavior).map(([phase, actions]) => [phase, actions.map(a => bumped(a, 1, 1))]))
  byId('raider').behavior.phase1[2].armor = 3
  const overseer = byId('overseer').behavior.phase1
  byId('overseer').behavior.phase1 = [overseer[1], overseer[2], overseer[0]]
  const johnson = byId('johnson'), actions = johnson.behavior.phase1
  johnson.maxHealth = 64
  johnson.behavior.phase1 = [actions[1], actions[2], actions[0], { kind: 'attack_all', name: 'Обвал породы', damage: 4, primaryTarget: 'mage' }]
  byId('rhahk-zor').maxHealth = 70
  if (variant === 'V3') {
    // Main-only follow-up: give phase II an immediate second threat before its preparation.
    // The existing 8-point blow targets the mage; no additional damage or HP is stacked on PA.
    const phase = byId('rhahk-zor').behavior.phase2
    byId('rhahk-zor').behavior.phase2 = [phase[0], { ...phase[2], target: 'mage' }, phase[1], phase[3]]
  }
  return enemies
}
export const splits = { main: { start: 42, n: 300, planner: 60 }, holdout: { start: 1000042, n: 300, planner: 60 } }
export const loadouts = {
  none: [],
  wedgeWhistle: [['reliable-wedge', 'mage'], ['shift-whistle', 'warrior']],
  pulleySpool: [['double-pulley', 'warrior'], ['tension-spool', 'mage']],
}
export const classic = ['aggressive', 'balanced', 'defensive']
