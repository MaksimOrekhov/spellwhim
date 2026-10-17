import { computed, onUnmounted, shallowRef } from 'vue'
import { cardDefinition } from '../game/types'
import { forecastEnemyAttack } from '../game/battle'
import type { EnemyAttackForecast, PlayResult } from '../game/battle'
import type { Ref } from 'vue'
import type { BattleState, HeroId, PendingPlay } from '../game/types'

export type BattlePhase = 'player' | 'card' | 'enemy' | 'finished'
export interface BattlePresentation {
  actionId: string | null
  pulse: number
  phase: 'player' | 'card' | 'enemy'
  effect: 'attack' | 'spell' | 'guard' | 'hit' | ''
  busy: boolean
  source: HeroId | 'enemy' | null
  target: HeroId | 'enemy'
  amount: number
  bonusDamage: number
  partnerArmor: number
  label: string
  impactTarget: HeroId | 'enemy' | null
  incoming: EnemyAttackForecast | null
}

export function useBattleAnimation(options: { state: Readonly<Ref<BattleState>>; resolvePlay: (id: string) => PlayResult | void; finishTurn: () => void }) {
  const idle = (): BattlePresentation => ({ actionId: null, pulse: 0, phase: 'player', effect: '', busy: false, source: null, target: 'enemy', amount: 0, bonusDamage: 0, partnerArmor: 0, label: '', impactTarget: null, incoming: null })
  const animation = shallowRef(idle())
  const phase = computed<BattlePhase>(() => options.state.value.result ? 'finished' : animation.value.phase)
  let sequence = 0
  let impactTimer: ReturnType<typeof setTimeout> | undefined
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined
  let pending: { id: string; resolve: () => void } | null = null

  function clearTimers() { window.clearTimeout(impactTimer); window.clearTimeout(recoveryTimer) }
  function impact(actionId: string) {
    if (!pending || pending.id !== actionId) return
    const resolve = pending.resolve
    pending = null
    window.clearTimeout(impactTimer)
    const current = animation.value
    if (current.effect !== 'guard') animation.value = { ...current, impactTarget: current.target }
    resolve()
  }
  type ActionData = Pick<BattlePresentation, 'phase' | 'effect' | 'source' | 'target' | 'amount' | 'bonusDamage' | 'partnerArmor' | 'label' | 'incoming'>
  function start(data: ActionData, impactMs: number, recoveryMs: number, resolve: () => void) {
    clearTimers()
    const actionId = 'animation/' + ++sequence
    pending = { id: actionId, resolve }
    animation.value = { ...data, actionId, pulse: animation.value.pulse + 1, busy: true, impactTarget: null }
    impactTimer = window.setTimeout(() => impact(actionId), impactMs)
    recoveryTimer = window.setTimeout(() => {
      if (animation.value.actionId !== actionId) return
      impact(actionId)
      animation.value = { ...animation.value, phase: 'player', busy: false, effect: '', source: null, impactTarget: null }
    }, recoveryMs)
  }
  function play(play: PendingPlay) {
    const card = cardDefinition(play.card.definitionId)
    const state = options.state.value
    const preview = play.preview
    const target = state.enemy.intent
    const partner = target === 'warrior' ? 'mage' : 'warrior'
    const actor = state.heroes[card.className].name
    start({
      phase: 'card', source: card.className, incoming: null,
      effect: card.kind === 'defense' ? 'guard' : card.kind === 'spell' ? 'spell' : 'attack',
      target: card.kind === 'defense' ? target : 'enemy',
      amount: card.kind === 'defense' ? preview.armor[target] : Math.min(state.enemy.health, preview.damage),
      partnerArmor: preview.armor[partner], bonusDamage: preview.bonusDamage,
      label: actor + ' · ' + card.name,
    }, card.kind === 'spell' ? 820 : 560, card.kind === 'spell' ? 1300 : card.kind === 'defense' ? 1120 : 880, () => {
      const result = options.resolvePlay(play.actionId)
      if (!result?.ok) return
      const detail = card.kind === 'defense' ? '+' + preview.armor[target] + ' брони: ' + state.heroes[target].name : '−' + result.damageDealt + ' здоровья'
      animation.value = { ...animation.value, label: actor + ' · ' + detail + (result.drawn ? ' · +' + result.drawn + ' карта' : '') }
    })
  }
  function enemyTurn() {
    const state = options.state.value
    const incoming = forecastEnemyAttack(state)
    const target = incoming.target
    const hero = state.heroes[target]
    start({ phase: 'enemy', source: 'enemy', effect: 'hit', target, incoming, amount: incoming.healthLoss, bonusDamage: 0, partnerArmor: 0, label: state.enemy.name + ' → ' + hero.name }, 560, 880, () => {
      options.finishTurn()
      animation.value = { ...animation.value, label: hero.name + ': −' + incoming.healthLoss + ' здоровья' + (incoming.absorbed ? ' · броня поглотила ' + incoming.absorbed : '') }
    })
  }
  function cancel() { clearTimers(); pending = null; animation.value = { ...idle(), pulse: animation.value.pulse + 1 } }
  onUnmounted(cancel)
  return { animation, phase, impact, play, enemyTurn, cancel }
}
