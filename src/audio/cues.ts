import type { VfxPlan } from '../vfx/types'

export type SoundId = 'swing' | 'heavy-swing' | 'steel-hit' | 'heavy-hit' | 'shield-hit'
  | 'fire-launch' | 'fire-hit' | 'frost-launch' | 'frost-hit' | 'lightning' | 'arcane-launch' | 'arcane-hit'
  | 'steel-guard' | 'magic-guard' | 'block' | 'armor-break' | 'bleed' | 'ice-crack' | 'ice-form' | 'interrupt'
  | 'draw' | 'gather' | 'victory' | 'defeat' | 'card' | 'turn' | 'reward' | 'room' | 'weapon-draw' | 'door' | 'lock'
  | 'mine-air' | 'crystal-air' | 'forge-air' | 'creak' | 'distant-metal' | 'crystal-chime' | 'embers'
export interface SoundCue { at: number; sound: SoundId; gain?: number }

/** Translates only the already public, resolved visual vocabulary. It never inspects game state or computes damage. */
export function soundCues(plan: VfxPlan): SoundCue[] {
  const cues: SoundCue[] = []
  const add = (at: number, sound: SoundId, gain?: number) => cues.push({ at, sound, gain })
  for (const b of plan.beats) {
    switch (b.kind) {
      case 'strike': {
        const land = b.at + b.landMs
        // Reduced motion can move the lead landing to a minimum 80ms while outcome beats retain their compressed times.
        // Outcomes belong to a target of this one action; matching timestamps would add a false body hit after a block.
        const result = plan.beats.find(other => other.kind === 'result' && other.hero === b.to)
        const armor = b.to === 'enemy' && plan.beats.some(other => other.kind === 'armor-fx')
        const physical = b.school === 'physical' || b.school === 'blood'
        add(b.at, physical ? b.weight === 'heavy' ? 'heavy-swing' : 'swing' : b.school === 'fire' ? 'fire-launch' : b.school === 'frost' ? 'frost-launch' : 'arcane-launch', .7)
        // An armor outcome replaces the body impact; an all-party attack still has one landing per target.
        if (!result && !armor) add(land, physical ? b.style === 'bash' ? 'shield-hit' : b.weight === 'heavy' ? 'heavy-hit' : 'steel-hit' : b.school === 'fire' ? 'fire-hit' : b.school === 'frost' ? 'frost-hit' : b.school === 'lightning' ? 'lightning' : 'arcane-hit')
        break
      }
      case 'guard':
        // A capped enemy armor gain has a visual stance, but no false sound of gaining armor.
        if (plan.beats.some(n => n.kind === 'number' && n.anchor === b.anchor && n.tone === 'armor-gain')) add(b.at + b.landMs, b.style === 'steel' || b.style === 'plate' ? 'steel-guard' : 'magic-guard', .7)
        break
      case 'rune': if (b.sigil !== 'insight') add(b.at, 'arcane-launch', .35); break
      case 'draw': add(b.at, 'draw', .55); break
      case 'gather': add(b.at, 'gather', .4); break
      case 'break': add(b.at + b.landMs, 'interrupt'); break
      case 'result': add(b.at, b.outcome === 'block' ? 'block' : b.outcome === 'fizzle' ? 'interrupt' : 'armor-break'); break
      case 'armor-fx': add(b.at, b.mode === 'break' ? 'armor-break' : 'block'); break
      case 'status':
        if (b.status === 'frostbite') add(b.at, b.mode === 'consume' ? 'ice-crack' : 'ice-form', .7)
        if (b.status === 'bleeding') add(b.at, 'bleed', .55)
        break
    }
  }
  return cues.sort((a, b) => a.at - b.at)
}
