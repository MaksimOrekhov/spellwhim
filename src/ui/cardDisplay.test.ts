import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createBattle, previewCard } from '../game/battle'
import { availableDungeonNodes, claimDungeonReward, createCampaignBattle, createDungeonRun, deriveDungeonSeed, dungeonEncounter, dungeonNode, dungeonRewardOptions, enterDungeonNode, resolveDungeonBattle } from '../game/campaign'
import { cardDefinition, cards, encounters } from '../game/types'
import type { BattleState, CardDefinition, CardId } from '../game/types'
import { cardFace, cardNotes, damageParts, neutralPreview, ruleLines, spokenSummary, statChips } from './cardDisplay'
import { cardNameScale } from './cardDisplay'
import { COMPACT_BELOW, fanLayout, handMode, handOrder, zoomFactor, zoomShift } from './handLayout'
import SpellCard from '../components/SpellCard.vue'
import CardReward from '../components/CardReward.vue'
import { applyStatus } from '../game/statuses'

const card = (id: CardId) => cardDefinition(id)
/** A board where the enemy is attacking (root sentinel opens with an attack), optionally Vulnerable and with armor on Jaina. */
function board(options: { vulnerable?: boolean; mageArmor?: number; enemy?: string } = {}): BattleState {
  const state = createBattle(encounters.find(item => item.id === (options.enemy ?? 'root-sentinel'))!, undefined, { seed: 3 })
  if (options.vulnerable) applyStatus(state, 'enemy', 'vulnerability')
  state.heroes.mage.armor = options.mageArmor ?? 0
  return state
}
const preview = (id: CardId, state: BattleState) => previewCard(state, card(id))

describe('damage chips mirror the engine preview', () => {
  it('shows base 4 + armor 2 + Vulnerability 3 = 9 for Frostbolt', () => {
    const p = preview('frostbolt', board({ vulnerable: true, mageArmor: 3 }))
    const [chip] = statChips(card('frostbolt'), p)
    expect(chip).toMatchObject({ kind: 'damage', value: 9, base: 4, boosted: true, inactive: false })
    expect(damageParts(p).map(part => [part.kind, part.amount])).toEqual([['base', 4], ['armor', 2], ['vulnerability', 3]])
    const notes = cardNotes(card('frostbolt'), p)
    expect(notes.damage?.formula).toBe('4 + 2 + 3 = 9')
    expect(notes.conditions).toEqual([])
    expect(notes.keywords.map(key => key.name)).toEqual(['Уязвимость'])
  })

  it('adds only the bonuses that are active', () => {
    const armorOnly = preview('thunderbolt', board({ mageArmor: 2 }))
    expect(statChips(card('thunderbolt'), armorOnly)[0]).toMatchObject({ value: 6, base: 4, boosted: true })
    expect(damageParts(armorOnly).map(part => part.kind)).toEqual(['base', 'armor'])
    const vulnerableOnly = preview('sword-strike', board({ vulnerable: true }))
    expect(statChips(card('sword-strike'), vulnerableOnly)[0]).toMatchObject({ value: 9, base: 6 })
    expect(damageParts(vulnerableOnly).map(part => part.kind)).toEqual(['base', 'vulnerability'])
  })

  it('never invents a bonus on a plain board', () => {
    const state = board()
    for (const definition of cards) {
      const p = previewCard(state, definition)
      const chips = statChips(definition, p)
      expect(chips.every(chip => !chip.boosted), definition.id).toBe(true)
      expect(ruleLines(definition, p).filter(line => line.tone === 'on' && line.text.startsWith('+')), definition.id).toEqual([])
      expect(cardNotes(definition, p).damage?.parts.length ?? 1, definition.id).toBeLessThanOrEqual(1)
    }
    // the armor bonus is explained as waiting, with its amount
    expect(ruleLines(card('frostbolt'), previewCard(state, card('frostbolt'))).map(line => [line.tone, line.text])).toEqual([['off', '+2 при броне Джайны']])
  })

  it('does not apply Vulnerability to a card that deals no damage', () => {
    const p = preview('guard', board({ vulnerable: true }))
    expect(p.vulnerabilityBonus).toBe(0)
    expect(damageParts(p)).toEqual([])
    expect(cardNotes(card('guard'), p).damage).toBeNull()
  })
})

describe('conditional damage (Parry)', () => {
  it('is dimmed while the enemy is not attacking and active once it attacks', () => {
    const calm = board({ enemy: 'twilight-guardian' })
    const waiting = statChips(card('parry'), preview('parry', calm))
    expect(waiting.map(chip => [chip.kind, chip.value, chip.inactive])).toEqual([['armor', 3, false], ['damage', 3, true]])
    expect(ruleLines(card('parry'), preview('parry', calm))[0]).toMatchObject({ tone: 'off' })
    const attacked = statChips(card('parry'), preview('parry', board()))
    expect(attacked.map(chip => [chip.kind, chip.value, chip.inactive])).toEqual([['damage', 3, false], ['armor', 3, false]])
    expect(ruleLines(card('parry'), preview('parry', board()))[0]).toMatchObject({ tone: 'on' })
  })
})

describe('armor, draw, exhaust and keywords', () => {
  it('lists armor grants with who receives them', () => {
    const bastion = statChips(card('bastion'), preview('bastion', board()))
    expect(bastion.map(chip => [chip.kind, chip.value, chip.caption])).toEqual([['armor', 6, 'цели'], ['armor', 3, 'напарнику']])
    const interpose = statChips(card('interpose'), preview('interpose', board()))
    expect(interpose.map(chip => [chip.value, chip.caption])).toEqual([[5, 'Джайне']])
  })

  it('keeps armor numbers equal to what the engine will grant', () => {
    const state = board()
    for (const definition of cards) {
      const p = previewCard(state, definition)
      const shown = statChips(definition, p).filter(chip => chip.kind === 'armor').reduce((sum, chip) => sum + chip.value, 0)
      expect(shown, definition.id).toBe(p.armor.warrior + p.armor.mage)
    }
  })

  it('shows draw', () => {
    const chips = statChips(card('arcane-insight'), preview('arcane-insight', board()))
    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({ kind: 'draw', value: 1, caption: 'карта' })
    expect(cardNotes(card('thunderbolt'), preview('thunderbolt', board())).draw).toBe(1)
  })

  it('marks exhaust and explains it', () => {
    const face = cardFace(card('quick-cut'), preview('quick-cut', board()))
    expect(face.tags.map(tag => tag.id)).toEqual(['exhaust'])
    expect(cardNotes(card('quick-cut'), preview('quick-cut', board())).keywords.map(key => key.name)).toContain('Выбывает')
    expect(cardFace(card('sword-strike'), preview('sword-strike', board())).tags).toEqual([])
  })

  it('explains Vulnerability when applied or consumed, and the swap when both', () => {
    const applies = cardNotes(card('frostbolt'), preview('frostbolt', board()))
    expect(applies.keywords.find(key => key.glyph === 'vulnerable')?.text).toContain('+3 урона');
    expect(applies.keywords.find(key => key.glyph === 'vulnerable')?.text).not.toContain('расходует текущую')
    const both = cardNotes(card('shield-bash'), preview('shield-bash', board({ vulnerable: true })))
    expect(both.keywords.find(key => key.glyph === 'vulnerable')?.text).toContain('расходует текущую')
    expect(cardFace(card('shield-bash'), preview('shield-bash', board())).tags.map(tag => tag.id)).toEqual(['vulnerability'])
    expect(cardNotes(card('sword-strike'), preview('sword-strike', board())).keywords).toEqual([])
  })
})

describe('every card definition', () => {
  it('keeps Ice Echo at two face chips and shows Bleeding as a third mechanic line', () => {
    const echo = card('ice-echo')
    const preview = neutralPreview(echo)
    const face = cardFace(echo, preview)

    expect(face.chips.map(chip => chip.kind)).toEqual(['damage', 'draw'])
    expect(face.lines.map(line => line.short)).toContain('Кровь +1')
    expect(cardNotes(echo, preview).keywords.map(keyword => keyword.name)).toContain('Кровотечение')
  })

  it('has a face that fits: at most two numbers, two lines and short labels', () => {
    for (const bonusBoard of [board(), board({ vulnerable: true, mageArmor: 4 }), board({ enemy: 'twilight-guardian' })]) {
      for (const definition of cards) {
        const p = previewCard(bonusBoard, definition)
        const face = cardFace(definition, p)
        expect(face.chips.length, definition.id).toBeGreaterThan(0)
        expect(face.chips.length, definition.id).toBeLessThanOrEqual(2)
        expect(face.lines.length + face.tags.length, definition.id).toBeLessThanOrEqual(3)
        expect(definition.name.length, definition.id).toBeLessThanOrEqual(20)
        for (const line of face.lines) expect(line.short.length, definition.id + line.text).toBeGreaterThan(0)
        expect(spokenSummary(definition, p), definition.id).toContain(definition.description)
        const notes = cardNotes(definition, p)
        expect(notes.description).toBe(definition.description)
        if (notes.damage) expect(notes.damage.parts.reduce((sum, part) => sum + part.amount, 0)).toBe(notes.damage.total)
      }
    }
  })

  it('has a preview in the neutral reward context without active bonuses', () => {
    for (const definition of cards) {
      const p = neutralPreview(definition)
      expect(p.bonusDamage, definition.id).toBe(0)
      expect(cardNotes(definition, p, 'neutral').damage?.parts.length ?? 1, definition.id).toBeLessThanOrEqual(1)
    }
    expect(cardNotes(card('guard'), neutralPreview(card('guard')), 'neutral').armor).toEqual([{ hero: 'threatened', name: 'цели врага', amount: 4 }])
  })

  it('renders the shared card face for all definitions', async () => {
    for (const definition of cards) {
      const html = await renderToString(createSSRApp({ render: () => h(SpellCard, { card: definition, preview: neutralPreview(definition), hotkey: '3', block: { kind: 'mana', text: '' } }) }))
      expect(html, definition.id).toContain(definition.name)
      expect(html, definition.id).toContain(`data-card-class="${definition.className}"`)
      expect(html, definition.id).toContain('is-locked')
    }
  })
})

/** A run that has just won its first battle, so a real reward offer is pending. */
function runWithReward(seed: number) {
  let run = createDungeonRun(seed)
  const node = availableDungeonNodes(run).find(candidate => candidate.type !== 'rest')!
  run = enterDungeonNode(run, node.id)
  const battle = createCampaignBattle({ encounter: dungeonEncounter(dungeonNode(run.map, node.id)!), heroes: run.heroes, deck: run.deck, seed: deriveDungeonSeed(run.seed, `battle:${node.id}`), battleId: 'test/' + node.id })
  battle.result = 'victory'
  return resolveDungeonBattle(run, battle)
}

describe('reward screen', () => {
  it('offers the cards of the run in order, each as the same card face', async () => {
    const run = runWithReward(11)
    const options: CardDefinition[] = dungeonRewardOptions(run)
    expect(options).toHaveLength(run.pendingReward!.count)
    const html = await renderToString(createSSRApp({ render: () => h(CardReward, { options, encounterName: 'Тест' }) }))
    const ids = [...html.matchAll(/data-card-id="([^"]+)"/g)].map(match => match[1])
    expect(ids).toEqual(options.map(option => option.id))
    for (const option of options) expect(html).toContain(option.name)
    expect(html.match(/class="sc /g)).toHaveLength(options.length)
  })

  it('claiming a card adds exactly that card to the deck', () => {
    const run = runWithReward(5)
    const options = dungeonRewardOptions(run)
    expect(options.length).toBeGreaterThan(1)
    for (const option of options) {
      const claimed = claimDungeonReward(run, option)
      expect(claimed.deck.length).toBe(run.deck.length + 1)
      expect(claimed.deck.filter(id => id === option.id).length).toBe(run.deck.filter(id => id === option.id).length + 1)
    }
  })
})

describe('hand layout', () => {
  it('keeps the order and leaves a playing card at its place', () => {
    const hand = ['a', 'b', 'c', 'd']
    expect(handOrder(hand, null, 0)).toEqual(hand)
    expect(handOrder(['a', 'c', 'd'], 'b', 1)).toEqual(hand)
    expect(handOrder([], 'x', 0)).toEqual(['x'])
  })

  it('fits 8 and 10 cards on a narrow row, evenly overlapped, never outside the row', () => {
    for (const [width, cardWidth] of [[950, 162], [1380, 210]] as const) {
      for (const count of [1, 4, 8, 10]) {
        const fan = fanLayout(count, width, cardWidth, cardWidth / 24)
        expect(fan.x(0)).toBeGreaterThanOrEqual(-0.001)
        expect(fan.x(count - 1) + cardWidth).toBeLessThanOrEqual(width + 0.001)
        if (count > 1) expect(fan.x(1) - fan.x(0)).toBeCloseTo(fan.step)
      }
      const ten = fanLayout(10, width, cardWidth, cardWidth / 24)
      expect(ten.overlapped).toBe(true)
      // enough of every card stays visible for cost, name and main number
      expect(ten.visible).toBeGreaterThan(0.5)
    }
    expect(fanLayout(3, 950, 162, 7).overlapped).toBe(false)
  })

  it('keeps a zoomed card inside the screen', () => {
    expect(zoomShift(40, 210, 1280)).toBe(8 - (40 - 105))
    expect(zoomShift(640, 210, 1280)).toBe(0)
    expect(zoomShift(1250, 210, 1280)).toBeLessThan(0)
    const shifted = 1250 + zoomShift(1250, 210, 1280)
    expect(shifted + 105).toBeLessThanOrEqual(1280 - 8 + 0.001)
  })

  it('limits the zoom so the card stays near the dock', () => {
    expect(zoomFactor(712, 436, 224, 7)).toBeLessThan(1.32)
    expect(zoomFactor(712, 436, 224, 7)).toBeGreaterThanOrEqual(1.1)
    expect(zoomFactor(900, 100, 224, 7)).toBe(1.32)
  })

  it('switches to non-overlapping tiles when a fan would hide too much, and every tile stays reachable', () => {
    const wide = handMode(10, 1380, 210, 9)
    const narrow = handMode(10, 950, 162, 7)
    expect(narrow.compact).toBe(true)
    expect(narrow.layout.overlapped).toBe(false)
    expect(narrow.slotWidth).toBeLessThanOrEqual(162 * 0.8)
    for (let i = 1; i < 10; i += 1) expect(narrow.layout.x(i) - narrow.layout.x(i - 1)).toBeGreaterThanOrEqual(narrow.slotWidth)
    expect(narrow.layout.x(9) + narrow.slotWidth).toBeLessThanOrEqual(950 + 0.001)
    expect(narrow.slotWidth).toBeGreaterThan(80)
    // a roomy row keeps full cards; the rule is the visible fraction of the fan
    expect(handMode(3, 950, 162, 7).compact).toBe(false)
    expect(wide.compact).toBe(fanLayout(10, 1380, 210, 9).visible < COMPACT_BELOW)
    expect(handMode(0, 950, 162, 7).compact).toBe(false)
  })

  it('keeps every card title on one line by shrinking long names in steps', () => {
    expect(cardNameScale('Удар мечом')).toBe(1.2)
    expect(cardNameScale('Сокрушительный замах')).toBeLessThan(cardNameScale('Ледяная стрела'))
    let previous = Infinity
    for (const name of ['а'.repeat(5), 'а'.repeat(14), 'а'.repeat(16), 'а'.repeat(18), 'а'.repeat(20), 'а'.repeat(24)]) {
      const scale = cardNameScale(name)
      expect(scale).toBeLessThanOrEqual(previous)
      previous = scale
    }
    for (const card of cards) expect(cardNameScale(card.name)).toBeGreaterThanOrEqual(0.72)
  })
})
