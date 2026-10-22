// Presentation model for a card: turns a CardDefinition plus the engine's CardPreview into glanceable chips,
// short rule lines and the detailed notes shown on hover. It only presents numbers the engine already computed
// (previewCard); it never re-implements damage rules. New cards need effects/tags in types.ts, not UI code.
import { encounters, statusDefinitions } from '../game/types'
import type { ArmorTarget, BattleState, CardDefinition, CardEffect, CardPreview, HeroId } from '../game/types'
import { createBattle, previewCard } from '../game/battle'
import { characterGenitive } from '../game/party'
import { getClassTheme } from '../game/classThemes'

export type GlyphKind = 'damage' | 'armor' | 'draw' | 'vulnerable' | 'exhaust' | 'bonus' | 'lock' | 'bleeding' | 'frostbite'
export type Tone = 'on' | 'off' | 'plain'

export interface StatChip {
  kind: 'damage' | 'armor' | 'draw' | 'bleeding'
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
export interface CardTag { id: 'vulnerability' | 'exhaust' | 'frostbite'; glyph: GlyphKind; text: string; short: string }
export interface DamagePart { label: string; amount: number; kind: 'base' | 'armor' | 'vulnerability' | 'status' | 'artifact' }
export interface Keyword { glyph: GlyphKind; name: string; text: string }
export interface CardNotesModel {
  title: string
  subtitle: string
  description: string
  damage: { total: number; parts: DamagePart[]; formula: string; armorDamage: number; healthDamage: number } | null
  armor: { hero: ArmorTarget | HeroId; name: string; amount: number }[]
  draw: number
  statusDamage: number
  statusFuture: number
  stopsAfterDamage: boolean
  conditions: RuleLine[]
  keywords: Keyword[]
}
/** Why a card cannot be played right now: not enough mana, or the phase/engine forbids it. */
export interface CardBlock { kind: 'mana' | 'phase'; text: string }
export interface CardFace { chips: StatChip[]; lines: RuleLine[]; tags: CardTag[] }

const heroDative: Record<HeroId, string> = { warrior: 'Вариану', mage: 'Джайне' }
const heroName: Record<HeroId, string> = { warrior: 'Вариан', mage: 'Джайна' }
export const kindLabel = { attack: 'атака', spell: 'заклинание', defense: 'защита' } as const

/** Who an armor effect goes to, as shown on the card. Class targets name whoever owns that class in the current party. */
function armorRecipient(target: Extract<CardEffect, { type: 'armor' }>['target'], preview: CardPreview, neutralThreatened: string): string {
  if (target === 'threatened') return neutralThreatened
  if (target === 'partner') return 'напарнику'
  if (target.startsWith('class:')) {
    const hero = preview.classHeroes[target.slice('class:'.length) as keyof CardPreview['classHeroes']]
    return hero ? heroDative[hero] : 'союзнику'
  }
  return heroDative[target as HeroId]
}
const armorCaption = (target: Extract<CardEffect, { type: 'armor' }>['target'], preview: CardPreview) => armorRecipient(target, preview, 'цели')
/** The party member whose armor powers the card's class bonus, in the genitive ("броня Джайны"). */
const bonusOwnerGenitive = (preview: CardPreview) => preview.bonusOwner ? characterGenitive(preview.bonusOwner.characterId) : 'героя'
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

/** Big numbers on the card face, most important first: active damage, armor grants, draw, dimmed conditional damage, then Bleeding when there is room. */
export function statChips(card: CardDefinition, preview: CardPreview): StatChip[] {
  const chips: StatChip[] = []
  const totalBase = damageEffects(card).reduce((sum, effect) => sum + effect.amount, 0)
  if (preview.damage > 0) {
    chips.push({ kind: 'damage', value: preview.damage, caption: 'врагу', base: preview.damage - preview.bonusDamage, boosted: preview.bonusDamage > 0, inactive: false, spoken: `${preview.damage} ${damageWord(preview.damage)} врагу` })
  }
  for (const effect of preview.resolvedEffects ?? card.effects) {
    if (effect.type === 'armor') chips.push({ kind: 'armor', value: effect.amount, caption: armorCaption(effect.target, preview), base: 0, boosted: false, inactive: false, spoken: `${effect.amount} брони ${armorCaption(effect.target, preview)}` })
  }
  if (preview.draw > 0) chips.push({ kind: 'draw', value: preview.draw, caption: cardsWord(preview.draw), base: 0, boosted: false, inactive: false, spoken: `добор: ${preview.draw} ${cardsWord(preview.draw)}` })
  if (preview.damage === 0 && totalBase > 0) {
    chips.push({ kind: 'damage', value: totalBase, caption: 'врагу', base: totalBase, boosted: false, inactive: true, spoken: `${totalBase} ${damageWord(totalBase)} врагу, если враг атакует` })
  }
  // Bleeding: applied strength (a number to wait for), or the damage a tick card takes at once.
  for (const effect of preview.resolvedEffects ?? card.effects) {
    if (effect.type === 'status' && effect.status === 'bleeding' && chips.length < 2) chips.push({ kind: 'bleeding', value: effect.amount ?? 1, caption: 'Кровь', base: 0, boosted: false, inactive: false, spoken: `Кровотечение ${effect.amount ?? 1}` })
    if (effect.type === 'status-tick' && effect.status === 'bleeding') {
      if (chips.length >= 2) continue
      chips.push(preview.statusDamage > 0
        ? { kind: 'bleeding', value: preview.statusDamage, caption: 'сквозь броню', base: 0, boosted: false, inactive: false, spoken: `${preview.statusDamage} ${damageWord(preview.statusDamage)} сквозь броню` }
        : { kind: 'bleeding', value: 1, caption: 'при Крови', base: 0, boosted: false, inactive: true, spoken: 'урон равен силе Кровотечения врага, если оно есть' })
    }
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
      ? { tone: 'on', glyph: 'armor', text: `+${preview.armorBonus} — броня ${bonusOwnerGenitive(preview)}`, short: `+${preview.armorBonus} броня` }
      : { tone: 'off', glyph: 'armor', text: `+${card.damageBonus.amount} при броне ${bonusOwnerGenitive(preview)}`, short: `+${card.damageBonus.amount} при броне` })
  }
  const appliedBleeding = card.effects.find((effect): effect is Extract<CardEffect, { type: 'status' }> => effect.type === 'status' && effect.status === 'bleeding')
  const bleedingChipVisible = statChips(card, preview).some(chip => chip.kind === 'bleeding' && chip.spoken.startsWith('Кровотечение '))
  if (appliedBleeding && !bleedingChipVisible) {
    const amount = appliedBleeding.amount ?? 1
    lines.push({ tone: 'on', glyph: 'bleeding', text: `Накладывает Кровотечение ${amount}`, short: `Кровь +${amount}` })
  }
  const tickEffect = card.effects.find(effect => effect.type === 'status-tick')
  if (tickEffect && !statChips(card, preview).some(chip => chip.kind === 'bleeding')) {
    lines.push({ tone: preview.statusDamage > 0 ? 'on' : 'off', glyph: 'bleeding', text: preview.statusDamage > 0 ? `Кровотечение: ${preview.statusDamage} сейчас` : 'Тик Кровотечения сейчас', short: 'Тик Крови сейчас' })
  }
  const burstEffect = card.effects.find((effect): effect is Extract<CardEffect, { type: 'status-burst' }> => effect.type === 'status-burst')
  if (burstEffect?.status === 'frostbite') {
    const burst = preview.damageParts.find(part => part.id === 'frostbite-burst')
    lines.push(burst
      ? { tone: 'on', glyph: 'frostbite', text: `+${burst.amount} — враг обморожен (Обморожение будет потрачено)`, short: `+${burst.amount} мороз` }
      : { tone: 'off', glyph: 'frostbite', text: `+${burstEffect.perPoint}, если враг обморожен`, short: `+${burstEffect.perPoint} при морозе` })
  } else if (burstEffect) {
    const burst = preview.damageParts.find(part => part.id === 'bleeding-burst')
    lines.push(burst
      ? { tone: 'on', glyph: 'bleeding', text: `+${burst.amount} — Кровотечение врага`, short: `+${burst.amount} Кровь` }
      : { tone: 'off', glyph: 'bleeding', text: `+${burstEffect.perPoint} за каждую силу Кровотечения`, short: `+${burstEffect.perPoint} за Кровь` })
  }
  if (preview.vulnerabilityBonus > 0) lines.push({ tone: 'on', glyph: 'vulnerable', text: `+${preview.vulnerabilityBonus} — враг Уязвим`, short: `+${preview.vulnerabilityBonus} Уязвим` })
  if (preview.artifactDamage > 0) lines.push({ tone: 'on', glyph: 'bonus', text: `+${preview.artifactDamage} — первая атакующая карта отряда: Натяжной шкив`, short: `+${preview.artifactDamage} шкив` })
  return lines
}

export function cardTags(card: CardDefinition): CardTag[] {
  const tags: CardTag[] = []
  if (card.effects.some(effect => effect.type === 'status' && effect.status === 'vulnerability')) tags.push({ id: 'vulnerability', glyph: 'vulnerable', text: 'Уязвимость врагу', short: 'Уязвимость' })
  if (card.effects.some(effect => effect.type === 'status' && effect.status === 'frostbite')) tags.push({ id: 'frostbite', glyph: 'frostbite', text: 'Обморожение врагу', short: 'Мороз' })
  if (card.exhaust) tags.push({ id: 'exhaust', glyph: 'exhaust', text: 'Выбывает', short: 'Выбывает' })
  return tags
}

export function cardFace(card: CardDefinition, preview: CardPreview): CardFace {
  // Keep the card's conditional/burst rules; hide only status steps skipped by a lethal stop.
  const rulesCard = preview.resolvedEffects ? { ...card, effects: card.effects.filter(effect => {
    if (effect.type !== 'status' && effect.type !== 'status-tick') return true
    return preview.resolvedEffects!.some(step => (step.type === 'status' || step.type === 'status-tick') && step.type === effect.type && step.status === effect.status)
  }) } : card
  return { chips: statChips(card, preview), lines: ruleLines(rulesCard, preview), tags: cardTags(rulesCard) }
}

/** Where the final damage number comes from, e.g. 4 + 2 + 3 = 9. Empty when the card deals no damage now. */
export function damageParts(preview: CardPreview): DamagePart[] {
  if (preview.damage <= 0) return []
  // The engine already itemised the total in rule order; this only maps its parts onto display kinds.
  const kinds = { base: 'base', 'class-bonus': 'armor', status: 'status', artifact: 'artifact' } as const
  return preview.damageParts.filter(part => part.amount > 0).map(part => ({
    label: part.kind === 'base' ? part.label : part.detail ?? part.label,
    amount: part.amount,
    kind: part.kind === 'status' && part.id === 'vulnerability' ? 'vulnerability' : kinds[part.kind],
  }))
}

/** `neutral`: no board context (reward screen), so armor is described by its target rule instead of a concrete hero. */
export function cardNotes(card: CardDefinition, preview: CardPreview, context: 'board' | 'neutral' = 'board', armorExpires = false): CardNotesModel {
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
      ? { tone: 'on', glyph: 'armor', text: `Бонус активен: у ${bonusOwnerGenitive(preview)} есть броня, +${preview.armorBonus} урона. Броня не расходуется.`, short: '' }
      : { tone: 'off', glyph: 'armor', text: `Бонус не активен: +${card.damageBonus.amount} урона, пока у ${bonusOwnerGenitive(preview)} есть броня.`, short: '' })
  }
  if (preview.vulnerabilityBonus > 0) conditions.push({ tone: 'on', glyph: 'vulnerable', text: `Враг Уязвим: +${preview.vulnerabilityBonus} урона. Уязвимость будет снята.`, short: '' })
  if (preview.artifactBonuses.length) conditions.push({ tone: 'on', glyph: 'bonus', text: `Артефакт сработает: ${preview.artifactBonuses.join('; ')}.`, short: '' })

  const keywords: Keyword[] = []
  const appliesVulnerability = preview.appliedStatuses.includes('vulnerability')
  if (appliesVulnerability || preview.vulnerabilityBonus > 0) {
    const status = statusDefinitions.vulnerability
    keywords.push({
      glyph: 'vulnerable', name: status.name,
      text: status.description + (appliesVulnerability && preview.vulnerabilityBonus > 0 ? ' Эта карта сначала расходует текущую Уязвимость; новая остаётся, если враг выживет.' : ''),
    })
  }
  if (card.effects.some(effect => (effect.type === 'status' || effect.type === 'status-burst' || effect.type === 'status-tick') && effect.status === 'bleeding')) {
    const status = statusDefinitions.bleeding
    const burst = card.effects.some(effect => effect.type === 'status-burst')
    const tick = card.effects.some(effect => effect.type === 'status-tick')
    keywords.push({ glyph: 'bleeding', name: status.name, text: status.description + (burst ? ' Эта карта забирает всё Кровотечение сразу: будущих тиков не будет.' : tick ? ' Тик, сработавший сейчас, не повторится в начале хода врага: общий урон Кровотечения не растёт.' : '') })
  }
  if (card.effects.some(effect => (effect.type === 'status' || effect.type === 'status-burst') && effect.status === 'frostbite')) {
    const status = statusDefinitions.frostbite
    const burst = card.effects.some(effect => effect.type === 'status-burst')
    keywords.push({ glyph: 'frostbite', name: status.name, text: status.description + (burst ? ' Эта карта тратит Обморожение на усиленный удар: враг после этого бьёт в полную силу.' : '') })
  }
  const armor = context === 'neutral'
    ? card.effects.flatMap(effect => effect.type === 'armor' ? [{ hero: effect.target, name: armorRecipient(effect.target, preview, 'цели врага'), amount: effect.amount }] : [])
    : (['warrior', 'mage'] as const).map(hero => ({ hero, name: heroName[hero], amount: preview.armor[hero] })).filter(item => item.amount > 0)
  if (context === 'board' && card.effects.some(effect => effect.type === 'armor' && effect.target === 'threatened')) keywords.push({ glyph: 'armor', name: 'Броня', text: (armorExpires ? 'Поглощает урон и исчезает, когда враг закончит свой ход.' : 'Поглощает урон и исчезает после следующей атаки по герою.') + ' «Цель» — герой, которого атакует противник.' })
  if (card.exhaust) keywords.push({ glyph: 'exhaust', name: 'Выбывает', text: 'Эта копия не вернётся в колоду до конца боя.' })

  // The sum above already names every active bonus, so repeating them as sentences only makes the notes taller.
  const shownConditions = parts.length > 1 ? conditions.filter(line => line.tone !== 'on' || line.glyph === 'damage') : conditions
  return {
    title: card.name,
    subtitle: `${getClassTheme(card.className).name}${card.upgrade ? ' · Улучшена' : ''} · ${kindLabel[card.kind]} · ${card.cost} ${plural(card.cost, 'мана', 'маны', 'маны')}`,
    description: card.description,
    damage: preview.damage > 0
      ? { total: preview.damage, parts, formula: parts.length > 1 ? `${parts.map(part => part.amount).join(' + ')} = ${preview.damage}` : String(preview.damage), armorDamage: preview.armorDamage, healthDamage: preview.healthDamage }
      : null,
    armor, draw: preview.draw, statusDamage: preview.statusDamage, statusFuture: preview.statusFuture,
    stopsAfterDamage: context === 'board' && !!preview.resolvedEffects && preview.resolvedEffects.length < card.effects.filter(effect => effect.type !== 'status-burst' && !(effect.type === 'damage' && effect.when && preview.damage === 0)).length,
    conditions: shownConditions, keywords,
  }
}

/** Screen-reader text: the verbatim rules plus the numbers that currently apply. */
export function spokenSummary(card: CardDefinition, preview: CardPreview): string {
  const chips = statChips(card, preview).map(chip => chip.spoken).join(', ')
  const bonus = preview.bonusDamage > 0 ? ` Итоговый урон ${preview.damage}: ${damageParts(preview).map(part => part.amount).join(' плюс ')}.` : ''
  return `${card.upgrade ? 'Улучшена. ' : ''}${card.description}${bonus}${chips ? ' Сейчас: ' + chips + '.' : ''}`
}

let neutralState: BattleState | null = null
/** Preview with no board context (reward screen): no armor, no Vulnerability, enemy not attacking, so no synergy shows as active. */
export function neutralPreview(card: CardDefinition): CardPreview {
  neutralState ??= createBattle(encounters.find(encounter => encounter.id === 'twilight-guardian')!, undefined, { seed: 1 })
  return previewCard(neutralState, card)
}

/** Title scale (em) on the full card: a title stays on one line over the art, so longer ones shrink in steps instead of wrapping. */
export function cardNameScale(name: string): number {
  const n = name.length
  return n <= 13 ? 1.2 : n <= 15 ? 1.05 : n <= 17 ? .88 : n <= 18 ? .84 : n <= 20 ? .8 : .72
}
