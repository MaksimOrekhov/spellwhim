import type { CardDefinition, CardEffect, CardId } from './types'

type Upgrade = { effect?: { index: number; amount: number }; insert?: { index: number; effect: CardEffect }; description: string }
/** Full delta only. Costs, classes, status rules and exhaust are inherited unchanged. GDD §5.2 prototype. */
export const cardUpgrades: Record<CardId, Upgrade> = {
  'sword-strike': { effect: { index: 0, amount: 8 }, description: '8 урона.' },
  fireball: { effect: { index: 0, amount: 10 }, description: '10 урона.' },
  guard: { effect: { index: 0, amount: 5 }, description: '5 брони цели врага.' },
  parry: { effect: { index: 0, amount: 4 }, description: '4 брони цели. Если текущее действие врага — атака, наносит 3 урона.' },
  'shield-bash': { effect: { index: 0, amount: 7 }, description: '7 урона и 3 брони цели. Накладывает Уязвимость.' },
  interpose: { effect: { index: 0, amount: 7 }, description: '7 брони союзнику-магу.' },
  frostbolt: { effect: { index: 0, amount: 5 }, description: '5 урона. Накладывает Уязвимость. При броне владельца-Мага: +2 урона.' },
  'arcane-insight': { insert: { index: 1, effect: { type: 'armor', amount: 2, target: 'class:mage' } }, description: 'Добор карты, затем 2 брони владельцу-Магу.' },
  'ice-ward': { effect: { index: 0, amount: 4 }, description: '4 брони цели и 2 брони напарнику.' },
  'quick-cut': { effect: { index: 0, amount: 4 }, description: '4 урона. Выбывает до конца боя.' },
  thunderbolt: { effect: { index: 0, amount: 5 }, description: '5 урона. Добор карты. При броне владельца-Мага: +2 урона.' },
  rend: { effect: { index: 0, amount: 6 }, description: '6 урона. Накладывает Кровотечение 3.' },
  'reaping-blow': { effect: { index: 0, amount: 6 }, description: '6 урона и ещё 2 за каждую силу Кровотечения врага. Снимает Кровотечение.' },
  'boil-blood': { insert: { index: 1, effect: { type: 'armor', amount: 2, target: 'threatened' } }, description: 'Кровотечение срабатывает сейчас (сила −1), затем 2 брони цели врага и добор карты.' },
  bastion: { effect: { index: 0, amount: 8 }, description: '8 брони цели, 3 — напарнику.' },
  'stance-strike': { effect: { index: 0, amount: 4 }, description: '4 урона и 2 брони напарнику. При броне Воина: +2 урона.' },
  'wound-clamp': { effect: { index: 1, amount: 5 }, description: 'Кровотечение срабатывает сейчас (сила −1). 5 брони цели врага.' },
  'covering-counter': { effect: { index: 0, amount: 9 }, description: '9 брони цели врага. Если враг атакует, наносит 3 урона.' },
  'crushing-swing': { effect: { index: 0, amount: 12 }, description: '12 урона. Накладывает Уязвимость.' },
  'arcane-mark': { insert: { index: 2, effect: { type: 'armor', amount: 2, target: 'class:mage' } }, description: 'Накладывает Уязвимость. Добор карты, затем 2 брони владельцу-Магу.' },
  'ice-echo': { effect: { index: 0, amount: 3 }, description: '3 урона. Накладывает Кровотечение 1. Добор карты.' },
  'frost-seal': { insert: { index: 2, effect: { type: 'armor', amount: 2, target: 'threatened' } }, description: 'Кровотечение срабатывает сейчас (сила −1). Накладывает Уязвимость, затем 2 брони цели врага.' },
  'blood-resonance': { effect: { index: 0, amount: 5 }, description: '5 урона и добор карты. Снимает Кровотечение: +1 урон за каждую силу.' },
}

export function upgradedDefinition(base: CardDefinition): CardDefinition {
  const delta = cardUpgrades[base.id]
  if (!delta) throw new Error('Нет улучшенной версии карты: ' + base.id)
  const effects = base.effects.map(effect => ({ ...effect }))
  if (delta.effect) {
    const effect = effects[delta.effect.index]
    if (!effect || !('amount' in effect)) throw new Error('Invalid upgrade delta: ' + base.id)
    effect.amount = delta.effect.amount
  }
  if (delta.insert) effects.splice(delta.insert.index, 0, { ...delta.insert.effect })
  return { ...base, upgrade: 1, description: delta.description, effects, tags: [...base.tags], ...(base.damageBonus ? { damageBonus: { ...base.damageBonus } } : {}) }
}
