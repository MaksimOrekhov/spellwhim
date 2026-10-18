// Presentation model for a card: turns a CardDefinition plus the engine's CardPreview into glanceable chips,
// short rule lines and the detailed notes shown on hover. It only presents numbers the engine already computed
// (previewCard); it never re-implements damage rules. New cards need effects/tags in types.ts, not UI code.
import { encounters, MAX_HAND_SIZE, statusDefinitions } from '../game/types'
import type { BattleState, CardDefinition, CardEffect, CardPreview, HeroId } from '../game/types'
import { createBattle, previewCard } from '../game/battle'

export type GlyphKind = 'damage' | 'armor' | 'draw' | 'vulnerable' | 'exhaust' | 'bonus' | 'lock'
export type Tone = 'on' | 'off' | 'plain'

export interface StatChip {
  kind: 'damage' | 'armor' | 'draw'
  value: number
  /** One word under the number: who gets it. */
  caption: string
  /** Damage only: the card's own damage before synergies. */
  base: number
  /** Damage only: at least one synergy (armor / Vulnerability) is active. */
  boosted: boolean
  /** Conditional damage that is not active right now (shown dimmed). */
  inactive: boolean
  spoken: string
}
/** `short` is used when the card is partly covered by its neighbour and only a narrow strip is visible. */
export interface RuleLine { tone: Tone; glyph?: GlyphKind; text: string; short: string }
export interface CardTag { id: 'vulnerability' | 'exhaust'; glyph: GlyphKind; text: string; short: string }
export interface DamagePart { label: string; amount: number; kind: 'base' | 'armor' | 'vulnerability' }
export interface Keyword { glyph: GlyphKind; name: string; text: string }
export interface CardNotesModel {
  title: string
  subtitle: string
  description: string
  damage: { total: number; parts: DamagePart[]; formula: string; armorDamage: number; healthDamage: number } | null
  armor: { hero: HeroId | 'threatened' | 'partner'; name: string; amount: number }[]
  draw: number
  conditions: RuleLine[]
  keywords: Keyword[]
}
/** Why a card cannot be played right now: not enough mana, or the phase/engine forbids it. */
export interface CardBlock { kind: 'mana' | 'phase'; text: string }
export interface CardFace { chips: StatChip[]; lines: RuleLine[]; tags: CardTag[] }

const heroDative: Record<HeroId, string> = { warrior: 'Вариану', mage: 'Джайне' }
const heroName: Record<HeroId, string> = { warrior: 'Вариан', mage: 'Джайна' }
const kindLabel = { attack: 'атака', spell: 'заклинание', defense: 'защита' } as const

const armorCaption = (target: Extract<CardEffect, { type: 'armor' }>['target']) =>
  target === 'threatened' ? 'цели' : target === 'partner' ? 'напарнику' : heroDative[target]
function plural(n: number, one: string, few: string, many: string) {
  const m = n % 100
  if (m >= 11 && m <= 14) return many
  return n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many
}
const damageWord = (n: number) => plural(n, 'урон', 'урона', 'урона')
const cardsWord = (n: number) => plural(n, 'карта', 'карты', 'карт')

function damageEffects(card: CardDefinition) {
  return card.effects.filter((effect): effect is Extract<CardEffect, { type: 'damage' }> => effect.type === 'damage')
}

/** Big numbers on the card face, most important first: active damage, armor grants, draw, dimmed conditional damage. */
export function statChips(card: CardDefinition, preview: CardPreview): StatChip[] {
  const chips: StatChip[] = []
  const totalBase = damageEffects(card).reduce((sum, effect) => sum + effect.amount, 0)
  if (preview.damage > 0) {
    chips.push({ kind: 'damage', value: preview.damage, caption: 'врагу', base: preview.damage - preview.bonusDamage, boosted: preview.bonusDamage > 0, inactive: false, spoken: `${preview.damage} ${damageWord(preview.damage)} врагу` })
  }
  for (const effect of card.effects) {
    if (effect.type === 'armor') chips.push({ kind: 'armor', value: effect.amount, caption: armorCaption(effect.target), base: 0, boosted: false, inactive: false, spoken: `${effect.amount} брони ${armorCaption(effect.target)}` })
  }
  if (preview.draw > 0) chips.push({ kind: 'draw', value: preview.draw, caption: cardsWord(preview.draw), base: 0, boosted: false, inactive: false, spoken: `добор: ${preview.draw} ${cardsWord(preview.draw)}` })
  if (preview.damage === 0 && totalBase > 0) {
    chips.push({ kind: 'damage', value: totalBase, caption: 'врагу', base: totalBase, boosted: false, inactive: true, spoken: `${totalBase} ${damageWord(totalBase)} врагу, если враг атакует` })
  }
  return chips
}

/** Short conditions under the numbers; each is marked active ("on") or waiting ("off"). */
export function ruleLines(card: CardDefinition, preview: CardPreview): RuleLine[] {
  const lines: RuleLine[] = []
  if (card.effects.some(effect => effect.type === 'damage' && effect.when)) {
    lines.push(preview.damage > 0
      ? { tone: 'on', glyph: 'damage', text: 'Враг атакует — урон!', short: 'Урон врагу!' }
      : { tone: 'off', glyph: 'damage', text: 'Урон, если враг атакует', short: 'При атаке врага' })
  }
  if (card.damageBonus) {
    lines.push(preview.armorBonus > 0
      ? { tone: 'on', glyph: 'armor', text: `+${preview.armorBonus} — броня Джайны`, short: `+${preview.armorBonus} броня` }
      : { tone: 'off', glyph: 'armor', text: `+${card.damageBonus.amount} при броне Джайны`, short: `+${card.damageBonus.amount} при броне` })
  }
  if (preview.vulnerabilityBonus > 0) lines.push({ tone: 'on', glyph: 'vulnerable', text: `+${preview.vulnerabilityBonus} — враг Уязвим`, short: `+${preview.vulnerabilityBonus} Уязвим` })
  return lines
}

export function cardTags(card: CardDefinition): CardTag[] {
  const tags: CardTag[] = []
  if (card.effects.some(effect => effect.type === 'status' && effect.status === 'vulnerability')) tags.push({ id: 'vulnerability', glyph: 'vulnerable', text: 'Уязвимость врагу', short: 'Уязвимость' })
  if (card.exhaust) tags.push({ id: 'exhaust', glyph: 'exhaust', text: 'Выбывает', short: 'Выбывает' })
  return tags
}

export function cardFace(card: CardDefinition, preview: CardPreview): CardFace {
  return { chips: statChips(card, preview), lines: ruleLines(card, preview), tags: cardTags(card) }
}

/** Where the final damage number comes from, e.g. 4 + 2 + 3 = 9. Empty when the card deals no damage now. */
export function damageParts(preview: CardPreview): DamagePart[] {
  if (preview.damage <= 0) return []
  const parts: DamagePart[] = [{ label: 'Урон карты', amount: preview.damage - preview.bonusDamage, kind: 'base' }]
  if (preview.armorBonus > 0) parts.push({ label: 'Броня Джайны', amount: preview.armorBonus, kind: 'armor' })
  if (preview.vulnerabilityBonus > 0) parts.push({ label: 'Уязвимость', amount: preview.vulnerabilityBonus, kind: 'vulnerability' })
  return parts
}

/** `neutral`: no board context (reward screen), so armor is described by its target rule instead of a concrete hero. */
export function cardNotes(card: CardDefinition, preview: CardPreview, context: 'board' | 'neutral' = 'board'): CardNotesModel {
  const parts = damageParts(preview)
  const totalBase = damageEffects(card).reduce((sum, effect) => sum + effect.amount, 0)
  const activeBase = preview.damage > 0 ? preview.damage - preview.bonusDamage : 0
  const conditions: RuleLine[] = []
  if (card.effects.some(effect => effect.type === 'damage' && effect.when)) {
    conditions.push(activeBase >= totalBase
      ? { tone: 'on', glyph: 'damage', text: 'Условие выполнено: противник атакует, карта наносит урон.', short: '' }
      : { tone: 'off', glyph: 'damage', text: 'Условие не выполнено: урон наносится, только если следующее действие врага — атака.', short: '' })
  }
  if (card.damageBonus) {
    conditions.push(preview.armorBonus > 0
      ? { tone: 'on', glyph: 'armor', text: `Бонус активен: у Джайны есть броня, +${preview.armorBonus} урона. Броня не расходуется.`, short: '' }
      : { tone: 'off', glyph: 'armor', text: `Бонус не активен: +${card.damageBonus.amount} урона, пока у Джайны есть броня.`, short: '' })
  }
  if (preview.vulnerabilityBonus > 0) conditions.push({ tone: 'on', glyph: 'vulnerable', text: `Враг Уязвим: +${preview.vulnerabilityBonus} урона. Уязвимость будет снята.`, short: '' })

  const keywords: Keyword[] = []
  const appliesVulnerability = preview.appliedStatuses.includes('vulnerability')
  if (appliesVulnerability || preview.vulnerabilityBonus > 0) {
    const status = statusDefinitions.vulnerability
    keywords.push({
      glyph: 'vulnerable', name: status.name,
      text: status.description + (appliesVulnerability && preview.vulnerabilityBonus > 0 ? ' Эта карта сначала расходует текущую Уязвимость; новая остаётся, если враг выживет.' : ''),
    })
  }
  const armor = context === 'neutral'
    ? card.effects.flatMap(effect => effect.type === 'armor' ? [{ hero: effect.target, name: effect.target === 'threatened' ? 'цели врага' : effect.target === 'partner' ? 'напарнику' : heroDative[effect.target], amount: effect.amount }] : [])
    : (['warrior', 'mage'] as const).map(hero => ({ hero, name: heroName[hero], amount: preview.armor[hero] })).filter(item => item.amount > 0)
  if (armor.length && context === 'board') keywords.push({ glyph: 'armor', name: 'Броня', text: 'Поглощает урон и исчезает после следующей атаки по герою. «Цель» — герой, которого атакует противник.' })
  if (card.exhaust) keywords.push({ glyph: 'exhaust', name: 'Выбывает', text: 'Эта копия не вернётся в колоду до конца боя.' })
  if (preview.draw > 0 && context === 'board') keywords.push({ glyph: 'draw', name: 'Добор', text: `Берёт карты из колоды; в руке не больше ${MAX_HAND_SIZE}, лишние остаются в колоде.` })

  return {
    title: card.name,
    subtitle: `${card.className === 'warrior' ? 'Воин' : 'Маг'} · ${kindLabel[card.kind]} · ${card.cost} ${plural(card.cost, 'мана', 'маны', 'маны')}`,
    description: card.description,
    damage: preview.damage > 0
      ? { total: preview.damage, parts, formula: parts.length > 1 ? `${parts.map(part => part.amount).join(' + ')} = ${preview.damage}` : String(preview.damage), armorDamage: preview.armorDamage, healthDamage: preview.healthDamage }
      : null,
    armor, draw: preview.draw, conditions, keywords,
  }
}

/** Screen-reader text: the verbatim rules plus the numbers that currently apply. */
export function spokenSummary(card: CardDefinition, preview: CardPreview): string {
  const chips = statChips(card, preview).map(chip => chip.spoken).join(', ')
  const bonus = preview.bonusDamage > 0 ? ` Итоговый урон ${preview.damage}: ${damageParts(preview).map(part => part.amount).join(' плюс ')}.` : ''
  return `${card.description}${bonus}${chips ? ' Сейчас: ' + chips + '.' : ''}`
}

let neutralState: BattleState | null = null
/** Preview with no board context (reward screen): no armor, no Vulnerability, enemy not attacking, so no synergy shows as active. */
export function neutralPreview(card: CardDefinition): CardPreview {
  neutralState ??= createBattle(encounters.find(encounter => encounter.id === 'twilight-guardian')!, undefined, { seed: 1 })
  return previewCard(neutralState, card)
}
