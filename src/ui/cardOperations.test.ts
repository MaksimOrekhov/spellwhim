import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { cardUpgrades } from '../game/cardUpgrades'
import { canUpgradeCard, resolveCardDefinition } from '../game/cardProgression'
import { createSectorRun } from '../game/campaign'
import { cardDefinition } from '../game/types'
import type { CardId, PersistentCard } from '../game/types'
import { changedWords, groupCopies, manaText, upgradeChanges } from './cardOperations'
import CardOperationDialog from '../components/CardOperationDialog.vue'

const copy = (definitionId: CardId, upgrade: 0 | 1, n: number): PersistentCard => ({ instanceId: `t/${n}`, definitionId, upgrade })
const resolved = (id: CardId, upgrade: 0 | 1 = 0) => resolveCardDefinition({ definitionId: id, upgrade })

describe('card operation gallery model', () => {
  it('shares one tile between identical copies, keeps upgraded copies apart and tracks eligibility per instance', () => {
    const deck = [copy('sword-strike', 0, 1), copy('sword-strike', 0, 2), copy('sword-strike', 1, 3), copy('fireball', 0, 4)]
    const groups = groupCopies(deck, canUpgradeCard)
    expect(groups.map(g => [g.card.id, g.card.upgrade ?? 0, g.copies.length, g.eligible.length])).toEqual([['sword-strike', 0, 2, 2], ['sword-strike', 1, 1, 0], ['fireball', 0, 1, 1]])
    expect(groups[0]!.copies.map(c => c.instanceId)).toEqual(['t/1', 't/2'])
    expect(groups[1]!.eligible).toEqual([])
  })
  it('lists every copy of the run deck exactly once across tiles', () => {
    const run = createSectorRun(42)
    const groups = groupCopies(run.deck, () => true)
    expect(groups.flatMap(g => g.copies.map(c => c.instanceId)).sort()).toEqual(run.deck.map(c => c.instanceId).sort())
    expect(groups.length).toBeLessThanOrEqual(run.deck.length / 2 + 1)
  })
  it('reports at least one concrete change for every upgrade and names what appears or grows', () => {
    for (const id of Object.keys(cardUpgrades) as Array<keyof typeof cardUpgrades>) {
      expect(upgradeChanges(resolved(id), resolved(id, 1)).length, id).toBeGreaterThan(0)
    }
    const strike = upgradeChanges(resolved('sword-strike'), resolved('sword-strike', 1))
    expect(strike).toEqual([{ id: 'damage/врагу', label: 'Урон врагу', before: '6', after: '8' }])
    const insight = upgradeChanges(resolved('arcane-insight'), resolved('arcane-insight', 1))
    expect(insight.some(row => row.before === null && row.after !== null)).toBe(true)
  })
  it('marks only words that are new in the upgraded text', () => {
    const words = changedWords('6 урона.', '8 урона.').filter(w => w.changed).map(w => w.word)
    expect(words).toEqual(['8'])
  })
  it('declines mana cost words', () => {
    expect([0, 1, 2, 5, 11, 21].map(manaText)).toEqual(['0 маны', '1 мана', '2 маны', '5 маны', '11 маны', '21 мана'])
  })
})

describe('card operation dialog markup', () => {
  const deck = [copy('sword-strike', 0, 1), copy('sword-strike', 0, 2), copy('sword-strike', 1, 3), copy('fireball', 0, 4)]
  const render = (props: Record<string, unknown>) => renderToString(createSSRApp(CardOperationDialog, { deck, isEligible: canUpgradeCard, ...props }))

  it('upgrade: shows the whole deck, dims an already upgraded tile and compares before/after with a change list', async () => {
    const html = await render({ mode: 'upgrade', selectedInstanceId: 't/1' })
    expect(html).toContain('×2')
    expect(html).toContain('Уже улучшена')
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('Сейчас')
    expect(html).toContain('Станет ↑')
    expect(html).toContain('Что изменится')
    expect(html).toContain('Урон врагу')
  })
  it('upgrade: an already upgraded copy cannot be the selection', async () => {
    const html = await render({ mode: 'upgrade', selectedInstanceId: 't/3' })
    expect(html).not.toContain('Станет ↑')
    expect(html).toContain('Выберите ещё не улучшенную карту')
    expect(html).toMatch(/<button[^>]*disabled/)
  })
  it('remove: previews the card, the deck size after removal and the irreversibility notice; losing an upgrade is spelled out', async () => {
    const plain = await render({ mode: 'remove', isEligible: () => true, selectedInstanceId: 't/1' })
    expect(plain).toContain('Удаление необратимо')
    expect(plain).toContain('>4<');expect(plain).toContain('>3<')
    expect(plain).toContain('Удалить навсегда')
    expect(plain).not.toContain('улучшение будет потеряно')
    const up = await render({ mode: 'remove', isEligible: () => true, selectedInstanceId: 't/3' })
    expect(up).toContain('Её улучшение будет потеряно навсегда')
  })
  it('replace: shows the leaving card and real offers; the confirm stays disabled until one is chosen', async () => {
    const replacementsFor = () => [cardDefinition('guard'), cardDefinition('parry')]
    const open = await render({ mode: 'replace', isEligible: () => true, selectedInstanceId: 't/3', replacementsFor })
    expect(open).toContain('Исчезнет')
    expect(open).toContain('Предложение')
    expect(open).toContain('Новая карта придёт без улучшения')
    expect(open).toContain('При замене улучшение будет потеряно')
    expect(open).toMatch(/disabled[^>]*>Заменить карту/)
    const picked = await render({ mode: 'replace', isEligible: () => true, selectedInstanceId: 't/1', selectedCardId: 'guard', replacementsFor })
    expect(picked).toContain('Появится')
    expect(picked).not.toMatch(/disabled[^>]*>Заменить карту/)
  })
})
