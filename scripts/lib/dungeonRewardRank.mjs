/**
 * Shared scripted reward preference for dungeon route labs.
 * Existing card scores are kept at their established values; v0.1 rewards add
 * role-specific options for the expansion comparison only.
 */
export function dungeonRewardRank(id, strategy) {
  const fixed = {
    thunderbolt: 8,
    frostbolt: 7,
    parry: 6,
    'shield-bash': 6,
    'quick-cut': 5,
    'arcane-insight': 4,
    'arcane-mark': 5,
  }
  if (Object.hasOwn(fixed, id)) return fixed[id]
  if (id === 'bastion') return strategy === 'defensive' ? 7 : 5
  if (id === 'interpose') return strategy === 'defensive' ? 7 : 4
  if (id === 'ice-ward') return strategy === 'defensive' ? 7 : 5
  if (id === 'stance-strike') return strategy === 'defensive' ? 4 : 5
  if (id === 'wound-clamp') return strategy === 'defensive' ? 6 : 3
  if (id === 'covering-counter') return strategy === 'defensive' ? 7 : 4
  if (id === 'crushing-swing') return strategy === 'aggressive' ? 7 : 6
  if (id === 'ice-echo') return strategy === 'aggressive' ? 7 : 6
  if (id === 'frost-seal') return 4
  if (id === 'blood-resonance') return strategy === 'aggressive' ? 6 : 5
  return 0
}
