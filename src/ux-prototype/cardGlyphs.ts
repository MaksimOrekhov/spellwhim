// Turns a CardDefinition + engine CardPreview into glanceable "chips" and at most two short rule lines.
// Pure and data-driven: a new class or card only needs effects/tags in types.ts — no per-card UI code.
// The verbatim rules text (card.description) always stays available in the inspect notes.
import type { CardDefinition, CardPreview, HeroId } from '../game/types'
import type { GlyphName } from './components/GlyphIcon.vue'

export interface Chip {
  kind: 'damage' | 'armor' | 'draw' | 'status'
  icon: GlyphName
  /** Number shown on the chip (final value for damage). */
  value?: number
  caption: string
  /** Damage only: base value before bonuses and the bonus parts, to explain the gold number. */
  base?: number
  boosted?: boolean
  /** Conditional effect that is not active right now (e.g. Parry while the enemy is not attacking). */
  dim?: boolean
}
export interface RuleLine { tone: 'plain' | 'on' | 'off'; icon?: GlyphName; text: string; parts?: { icon: GlyphName; text: string }[] }

const heroDative: Record<HeroId, string> = { warrior: 'Вариану', mage: 'Джайне' }
const targetCaption = (target: 'threatened' | 'partner' | HeroId) => target === 'threatened' ? 'цели' : target === 'partner' ? 'напарнику' : heroDative[target]

export function cardChips(card: CardDefinition, preview: CardPreview): Chip[] {
  const chips: Chip[] = []
  const conditionalOnly = card.effects.some(e => e.type === 'damage' && e.when) && preview.damage === 0
  if (preview.damage > 0) {
    chips.push({ kind: 'damage', icon: 'damage', value: preview.damage, base: preview.damage - preview.bonusDamage, boosted: preview.bonusDamage > 0, caption: 'врагу' })
  } else if (conditionalOnly) {
    const base = card.effects.reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0)
    chips.push({ kind: 'damage', icon: 'damage', value: base, caption: 'врагу', dim: true })
  }
  for (const effect of card.effects) {
    if (effect.type === 'armor') chips.push({ kind: 'armor', icon: 'armor', value: effect.amount, caption: targetCaption(effect.target) })
  }
  if (preview.draw > 0) chips.push({ kind: 'draw', icon: 'draw', value: preview.draw, caption: preview.draw === 1 ? 'карта' : 'карты' })
  for (const effect of card.effects) {
    if (effect.type === 'status') chips.push({ kind: 'status', icon: 'vulnerable', caption: 'уязвим' })
  }
  return chips
}

export function cardLines(card: CardDefinition, preview: CardPreview): RuleLine[] {
  const lines: RuleLine[] = []
  const conditional = card.effects.find(e => e.type === 'damage' && e.when)
  if (conditional && conditional.type === 'damage') {
    const active = preview.damage > 0
    lines.push({ tone: active ? 'on' : 'off', icon: 'damage', text: active ? 'Враг атакует: ответный удар' : 'Урон, если враг атакует' })
  }
  if (card.damageBonus) {
    if (preview.armorBonus > 0) lines.push({ tone: 'on', icon: 'armor', text: `+${card.damageBonus.amount} — броня Джайны` })
    else lines.push({ tone: 'off', icon: 'armor', text: `+${card.damageBonus.amount} при броне Джайны` })
  }
  if (preview.vulnerabilityBonus > 0) lines.push({ tone: 'on', icon: 'vulnerable', text: `+${preview.vulnerabilityBonus} — враг Уязвим` })
  if (card.exhaust) lines.push({ tone: 'plain', icon: 'exhaust', text: 'Выбывает до конца боя' })
  return lines.slice(0, 2)
}

/** "4 +3 +2" style breakdown for the inspect notes. */
export function damageBreakdown(preview: CardPreview): string {
  if (preview.damage <= 0) return ''
  const parts = [String(preview.damage - preview.bonusDamage)]
  if (preview.vulnerabilityBonus) parts.push(`+${preview.vulnerabilityBonus} Уязвимость`)
  if (preview.armorBonus) parts.push(`+${preview.armorBonus} броня Джайны`)
  return parts.join(' ')
}
