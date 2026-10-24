// Presentation helpers for the deck-operation screens (upgrade / remove / replace): grouping identical copies for the gallery and
// listing what an upgrade really changes. Pure functions over resolved definitions; the rules (what is eligible, what a copy becomes)
// stay in cardProgression.ts / dungeonRooms.ts / campaign.ts.
import type { CardDefinition, CardPreview, PersistentCard } from '../game/types'
import { classThemes, getClassTheme } from '../game/classThemes'
import { resolveCardDefinition } from '../game/cardProgression'
import { cardFace, neutralPreview } from './cardDisplay'
import type { StatChip } from './cardDisplay'

export type CardOperation = 'upgrade' | 'remove' | 'replace'

export interface CopyGroup {
  key: string
  card: CardDefinition
  preview: CardPreview
  /** Every copy of this exact card (same definition and same upgrade state), in deck order. */
  copies: PersistentCard[]
  /** The subset the current operation may act on. */
  eligible: PersistentCard[]
}

const classOrder = Object.keys(classThemes)

/** Identical copies share one tile; an upgraded copy is a different tile. Order: class, mana cost, name, base before upgraded. */
export function groupCopies(deck: readonly PersistentCard[], isEligible: (copy: PersistentCard) => boolean): CopyGroup[] {
  const groups = new Map<string, CopyGroup>()
  for (const copy of deck) {
    const key = `${copy.definitionId}/${copy.upgrade}`
    let group = groups.get(key)
    if (!group) {
      const card = resolveCardDefinition(copy)
      group = { key, card, preview: neutralPreview(card), copies: [], eligible: [] }
      groups.set(key, group)
    }
    group.copies.push(copy)
    if (isEligible(copy)) group.eligible.push(copy)
  }
  return [...groups.values()].sort((a, b) =>
    classOrder.indexOf(a.card.className) - classOrder.indexOf(b.card.className) || a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name, 'ru') || (a.card.upgrade ?? 0) - (b.card.upgrade ?? 0))
}

export const chipLabel: Record<StatChip['kind'], string> = { damage: 'Урон', armor: 'Броня', draw: 'Добор', bleeding: 'Кровотечение' }

/** One line under a gallery card: its main numbers and keywords ("Урон 7 · Броня 3 · Уязвимость"). */
export function cardSummary(card: CardDefinition, preview: CardPreview): string {
  const face = cardFace(card, preview)
  const parts = face.chips.map(chip => `${chipLabel[chip.kind]} ${chip.value}`)
  for (const tag of face.tags) parts.push(tag.short)
  return parts.join(' · ')
}

/** "1 мана", "2 маны", "5 маны" is wrong: the cost is always followed by the right form. */
export function manaText(cost: number): string {
  const m = cost % 100
  return `${cost} ${m >= 11 && m <= 14 ? 'маны' : cost % 10 === 1 ? 'мана' : 'маны'}`
}
export const classLabel = (card: CardDefinition) => getClassTheme(card.className).name

export interface UpgradeChange { id: string; label: string; before: string | null; after: string | null }

/** What an upgrade really changes, as rows: numeric stats that differ (or appear), plus rule lines and tags that appeared or went away. */
export function upgradeChanges(before: CardDefinition, after: CardDefinition): UpgradeChange[] {
  const a = cardFace(before, neutralPreview(before))
  const b = cardFace(after, neutralPreview(after))
  const rows: UpgradeChange[] = []
  const seen = new Set<string>()
  const key = (chip: StatChip) => `${chip.kind}/${chip.caption}`
  const label = (chip: StatChip) => chip.kind === 'armor' || chip.kind === 'damage' ? `${chipLabel[chip.kind]} ${chip.caption}` : chipLabel[chip.kind]
  const value = (chip: StatChip | undefined) => chip ? String(chip.value) : null
  for (const chip of [...a.chips, ...b.chips]) {
    const id = key(chip)
    if (seen.has(id)) continue
    seen.add(id)
    const was = a.chips.find(item => key(item) === id)
    const now = b.chips.find(item => key(item) === id)
    if (value(was) !== value(now)) rows.push({ id, label: label(chip), before: value(was), after: value(now) })
  }
  const texts = (face: typeof a) => [...face.lines.map(line => line.text), ...face.tags.map(tag => tag.text)]
  const was = texts(a), now = texts(b)
  for (const text of was) if (!now.includes(text)) rows.push({ id: 'old:' + text, label: text, before: 'есть', after: null })
  for (const text of now) if (!was.includes(text)) rows.push({ id: 'new:' + text, label: text, before: null, after: 'есть' })
  if (before.cost !== after.cost) rows.unshift({ id: 'cost', label: 'Мана', before: String(before.cost), after: String(after.cost) })
  return rows
}

/** The description of the improved card as words, each flagged when it does not occur in the old text. */
export function changedWords(before: string, after: string): { word: string; changed: boolean }[] {
  const old = new Set(before.split(/\s+/))
  return after.split(/(\s+)/).map(word => ({ word, changed: word.trim() !== '' && !old.has(word) }))
}
