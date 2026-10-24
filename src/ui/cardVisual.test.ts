// Card Visual Polish v3: the redesigned card face must still show exactly what the engine computed, in every state a player meets.
// Rendered through SSR (no DOM): numbers, name, cost, class identity, upgrade marker, state classes and the compact/full parity.
import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import type { Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createBattle, previewCard } from '../game/battle'
import { applyStatus } from '../game/statuses'
import { cardDefinition, cards, encounters } from '../game/types'
import type { CardId } from '../game/types'
import { canUpgradeCard, resolveCardDefinition } from '../game/cardProgression'
import { classThemes } from '../game/classThemes'
import { cardFace, neutralPreview } from './cardDisplay'
import type { CardBlock } from './cardDisplay'
import SpellCard from '../components/SpellCard.vue'
import CompactCard from '../components/CompactCard.vue'

const render = (component: typeof SpellCard | typeof CompactCard, props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(component as Component, props) }))
const board = () => createBattle(encounters.find(item => item.id === 'root-sentinel')!, undefined, { seed: 3 })
const gemValues = (html: string) => [...html.matchAll(/<b class="cf-num"[^>]*>(\d+)<\/b>/g)].map(match => Number(match[1]))
const costOf = (html: string) => Number(/<span class="cf-cost"[^>]*><b[^>]*>(\d+)<\/b>/.exec(html)?.[1])
const mana: CardBlock = { kind: 'mana', text: 'Недостаточно маны' }
const phase: CardBlock = { kind: 'phase', text: 'Ход противника' }

describe('the card face shows every catalogue card', () => {
  for (const definition of cards) {
    it(`${definition.id}: name, cost, class and the engine's numbers`, async () => {
      const preview = neutralPreview(definition)
      const html = await render(SpellCard, { card: definition, preview })
      expect(html).toContain(definition.name)
      expect(costOf(html)).toBe(definition.cost)
      expect(html).toContain(`data-card-class="${definition.className}"`)
      expect(gemValues(html)).toEqual(cardFace(definition, preview).chips.map(chip => chip.value))
      // The class must be recognisable without a text label: a seal with the class emblem is always on the card.
      expect(html).toContain('class="cf-seal"')
      expect(html).toContain('cf--' + classThemes[definition.className].ornament)
    })
  }
})

describe('the hand tile is the same card, cropped', () => {
  for (const definition of cards) {
    it(`${definition.id}: same numbers, name and cost as the full card`, async () => {
      const preview = neutralPreview(definition)
      const full = await render(SpellCard, { card: definition, preview })
      const tile = await render(CompactCard, { card: definition, preview })
      expect(gemValues(tile)).toEqual(gemValues(full))
      expect(tile).toContain(definition.name)
      expect(costOf(tile)).toBe(definition.cost)
      expect(tile).toContain(`data-card-class="${definition.className}"`)
    })
  }
})

describe('card states', () => {
  const sword = cardDefinition('sword-strike')
  const preview = neutralPreview(sword)
  const rootOf = (html: string) => html.slice(0, html.indexOf('>') + 1)

  it('marks an unaffordable card, a card of another phase and a plain card differently', async () => {
    expect(rootOf(await render(SpellCard, { card: sword, preview, block: mana }))).toContain('is-locked')
    expect(await render(SpellCard, { card: sword, preview, block: mana })).toContain('нужно 1')
    expect(rootOf(await render(SpellCard, { card: sword, preview, block: phase }))).toContain('is-dim')
    const plain = rootOf(await render(SpellCard, { card: sword, preview }))
    expect(plain).not.toContain('is-locked')
    expect(plain).not.toContain('is-dim')
  })

  it('lights up an active synergy with a boosted gem, and only when the card can be played', async () => {
    const state = board()
    applyStatus(state, 'enemy', 'vulnerability')
    state.heroes.mage.armor = 3
    const bolt = cardDefinition('frostbolt')
    const hot = previewCard(state, bolt)
    const html = await render(SpellCard, { card: bolt, preview: hot })
    expect(rootOf(html)).toContain('is-bonus')
    expect(html).toContain('is-boosted')
    expect(gemValues(html)[0]).toBe(hot.damage)
    expect(rootOf(await render(SpellCard, { card: bolt, preview: hot, block: mana }))).not.toContain('is-bonus')
    // A waiting condition is not a bonus: dashed gem, no aura.
    const cold = await render(SpellCard, { card: bolt, preview: neutralPreview(bolt) })
    expect(rootOf(cold)).not.toContain('is-bonus')
    expect(cold).not.toContain('is-boosted')
  })

  it('shows an inactive conditional number as such, not as a normal one', async () => {
    const parry = cardDefinition('parry')
    const state = board()
    state.enemy.nextAction = { kind: 'defend', name: 'Кора', armor: 3 }
    const html = await render(SpellCard, { card: parry, preview: previewCard(state, parry) })
    expect(html).toContain('is-inactive')
  })

  it('marks upgraded cards with an icon and text, not only with a colour', async () => {
    const upgradable = cards.filter(definition => canUpgradeCard({ definitionId: definition.id, upgrade: 0 }))
    expect(upgradable.length).toBeGreaterThan(10)
    for (const base of upgradable) {
      const upgraded = resolveCardDefinition({ definitionId: base.id, upgrade: 1 })
      const html = await render(SpellCard, { card: upgraded, preview: neutralPreview(upgraded) })
      expect(rootOf(html), base.id).toContain('is-upgraded')
      expect(html, base.id).toContain('aria-label="Улучшена"')
      const tile = await render(CompactCard, { card: upgraded, preview: neutralPreview(upgraded) })
      expect(tile, base.id).toContain('aria-label="Улучшена"')
      const plain = await render(SpellCard, { card: base, preview: neutralPreview(base) })
      expect(plain, base.id).not.toContain('aria-label="Улучшена"')
    }
  })

  it('keeps long rule sets inside the card: three or more rule rows collapse active bonuses into pills', async () => {
    const state = board()
    applyStatus(state, 'enemy', 'vulnerability')
    state.heroes.mage.armor = 3
    const bolt = cardDefinition('frostbolt')
    const html = await render(SpellCard, { card: bolt, preview: previewCard(state, bolt) })
    expect(html).toContain('sc-pills')
    // The pills still name every active bonus with its number.
    expect(html).toContain('+2')
    expect(html).toContain('+3')
  })

  it('never writes class colours into a card: colours come from the class theme variables', async () => {
    const html = await render(SpellCard, { card: sword, preview })
    expect(html).toContain('--class-primary')
    const theme = classThemes.warrior
    for (const colour of [theme.primary, theme.surface, theme.accent, theme.secondary]) expect(html.toLowerCase()).toContain(colour.toLowerCase())
    expect(html).not.toContain(classThemes.mage.primary.toLowerCase())
  })
})

describe('every card is drawn for both screens it appears on', () => {
  it('has an illustration for each catalogue card or an honest placeholder', async () => {
    for (const definition of cards) {
      const html = await render(SpellCard, { card: definition, preview: neutralPreview(definition) })
      expect(html.includes('<img') || html.includes('Арт ожидает утверждения'), definition.id).toBe(true)
    }
  })

  it('supports the experimental B2 cards as well', async () => {
    for (const id of ['frost-grip', 'ice-breaker'] as CardId[]) {
      const definition = cardDefinition(id)
      const html = await render(SpellCard, { card: definition, preview: neutralPreview(definition) })
      expect(html).toContain(definition.name)
    }
  })
})
