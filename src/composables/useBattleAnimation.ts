import { onUnmounted, shallowRef } from 'vue'
import { cardDefinition } from '../game/types'
import type { Ref } from 'vue'
import type { BattleState, HeroId, PendingPlay } from '../game/types'

export interface BattlePresentation {
  actionId: string | null
  pulse: number
  effect: 'attack' | 'spell' | 'guard' | 'hit' | ''
  busy: boolean
  target: HeroId | 'enemy'
  amount: number
  bonusDamage: number
  partnerArmor: number
  label: string
  impactTarget: HeroId | 'enemy' | null
}

export function useBattleAnimation(options: { state: Readonly<Ref<BattleState>>; resolvePlay: (id: string) => void; finishTurn: () => void }) {
  const idle = (): BattlePresentation => ({ actionId: null, pulse: 0, effect: '', busy: false, target: 'enemy', amount: 0, bonusDamage: 0, partnerArmor: 0, label: '', impactTarget: null })
  const animation = shallowRef(idle())
  let sequence = 0
  let impactTimer: ReturnType<typeof setTimeout> | undefined
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined
  let pending: { id: string; resolve: () => void } | null = null

  function clearTimers() {
    window.clearTimeout(impactTimer)
    window.clearTimeout(recoveryTimer)
  }

  function impact(actionId: string) {
    if (!pending || pending.id !== actionId) return
    const resolve = pending.resolve
    pending = null
    window.clearTimeout(impactTimer)
    const current = animation.value
    if (current.effect !== 'guard') animation.value = { ...current, impactTarget: current.target }
    resolve()
  }

  function start(data: Pick<BattlePresentation, 'effect' | 'target' | 'amount' | 'bonusDamage' | 'partnerArmor' | 'label'>, impactMs: number, recoveryMs: number, resolve: () => void) {
    clearTimers()
    const actionId = 'animation/' + ++sequence
    pending = { id: actionId, resolve }
    animation.value = { ...data, actionId, pulse: animation.value.pulse + 1, busy: true, impactTarget: null }
    impactTimer = window.setTimeout(() => impact(actionId), impactMs)
    recoveryTimer = window.setTimeout(() => {
      if (animation.value.actionId !== actionId) return
      impact(actionId)
      animation.value = { ...animation.value, busy: false, effect: '', impactTarget: null }
    }, recoveryMs)
  }

  function play(play: PendingPlay) {
    const card = cardDefinition(play.card.definitionId)
    const preview = play.preview
    const target = options.state.value.enemy.intent
    const partner = target === 'warrior' ? 'mage' : 'warrior'
    let label = card.name + ' · ' + preview.damage + ' урона'
    if (card.kind === 'defense') label = options.state.value.heroes[target].name + ' +' + preview.armor[target] + ' брони · резонанс готов'
    if (preview.bonusDamage) label += ' (+' + preview.bonusDamage + ') · СВЯЗКА'
    start({
      effect: card.kind === 'defense' ? 'guard' : card.kind === 'spell' ? 'spell' : 'attack',
      target: card.kind === 'defense' ? target : 'enemy',
      amount: card.kind === 'defense' ? preview.armor[target] : preview.damage,
      partnerArmor: preview.armor[partner], bonusDamage: preview.bonusDamage, label,
    }, card.kind === 'spell' ? 820 : 560, card.kind === 'spell' ? 1300 : card.kind === 'defense' ? 1120 : 880, () => options.resolvePlay(play.actionId))
  }

  function enemyTurn() {
    const state = options.state.value
    const target = state.enemy.intent
    const hero = state.heroes[target]
    const amount = Math.min(hero.health, Math.max(0, state.enemy.attack - hero.armor))
    start({ effect: 'hit', target, amount, bonusDamage: 0, partnerArmor: 0, label: amount ? hero.name + ' получает ' + amount + ' урона' : 'Броня защитила героя: ' + hero.name }, 560, 880, options.finishTurn)
  }

  function cancel() {
    clearTimers()
    pending = null
    animation.value = { ...idle(), pulse: animation.value.pulse + 1 }
  }
  onUnmounted(cancel)
  return { animation, impact, play, enemyTurn, cancel }
}
