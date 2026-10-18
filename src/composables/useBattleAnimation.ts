import { computed, onUnmounted, shallowRef } from 'vue'
import { cardDefinition } from '../game/types'
import { forecastEnemyAction } from '../game/battle'
import { getClassTheme } from '../game/classThemes'
import { cardOwner, partnerOf } from '../game/party'
import type { EnemyActionForecast, PlayResult } from '../game/battle'
import type { Ref } from 'vue'
import type { BattleState, HeroId, PendingPlay } from '../game/types'

export type BattlePhase = 'player' | 'card' | 'enemy' | 'finished'
export interface BattlePresentation {
  actionId: string | null
  pulse: number
  phase: 'player' | 'card' | 'enemy'
  effect: 'attack' | 'spell' | 'guard' | 'hit' | 'heavy' | 'hit-all' | 'defend' | 'prepare' | 'recover' | ''
  busy: boolean
  source: HeroId | 'enemy' | null
  target: HeroId | 'enemy'
  amount: number
  bonusDamage: number
  partnerArmor: number
  label: string
  impactTarget: HeroId | 'enemy' | 'both' | null
  incoming: EnemyActionForecast | null
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
    if (['attack', 'spell', 'hit', 'heavy', 'hit-all'].includes(current.effect)) animation.value = { ...current, impactTarget: current.effect === 'hit-all' ? 'both' : current.target }
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
    const target = state.enemy.focus
    const partner = partnerOf(state.heroes, target)
    // The acting hero is whoever owns the card's class; an absent or ambiguous owner is not guessed.
    const owner = cardOwner(state.heroes, card)
    const actor = owner.ok ? state.heroes[owner.hero].name : getClassTheme(card.className).name
    start({
      phase: 'card', source: owner.ok ? owner.hero : null, incoming: null,
      effect: card.kind === 'defense' ? 'guard' : card.kind === 'spell' ? 'spell' : 'attack',
      target: card.kind === 'defense' ? target : 'enemy',
      amount: card.kind === 'defense' ? preview.armor[target] : preview.healthDamage,
      partnerArmor: preview.armor[partner], bonusDamage: preview.bonusDamage,
      label: actor + ' · ' + card.name,
    }, card.kind === 'spell' ? 820 : 560, card.kind === 'spell' ? 1300 : card.kind === 'defense' ? 1120 : 880, () => {
      const result = options.resolvePlay(play.actionId)
      if (!result?.ok) return
      const detail = card.kind === 'defense' ? '+' + preview.armor[target] + ' брони: ' + state.heroes[target].name : '−' + result.damageDealt + ' здоровья' + (preview.armorDamage ? ' · снято ' + preview.armorDamage + ' брони врага' : '')
      animation.value = { ...animation.value, label: actor + ' · ' + detail + (result.drawn ? ' · +' + result.drawn + ' карта' : '') }
    })
  }
  function enemyTurn() {
    const state = options.state.value
    const incoming = forecastEnemyAction(state)
    const action = incoming.action
    const primary = incoming.threatened[0] ?? state.enemy.focus
    const effect = action.kind === 'attack_all' ? 'hit-all' : action.kind === 'defend' ? 'defend' : action.kind === 'prepare' ? 'prepare' : action.kind === 'recover' ? 'recover' : action.damage >= 9 ? 'heavy' : 'hit'
    const suffix = incoming.threatened.length > 1 ? ' → оба героя' : incoming.threatened.length ? ' → ' + state.heroes[primary].name : ''
    start({ phase: 'enemy', source: 'enemy', effect, target: effect === 'defend' || effect === 'prepare' || effect === 'recover' ? 'enemy' : primary, incoming, amount: incoming.targets.reduce((sum, target) => sum + target.healthLoss, 0) || incoming.armorGain, bonusDamage: 0, partnerArmor: 0, label: action.name + suffix }, 560, 880, () => {
      options.finishTurn()
      animation.value = { ...animation.value, label: action.name + ' выполнено' }
    })
  }
  function cancel() { clearTimers(); pending = null; animation.value = { ...idle(), pulse: animation.value.pulse + 1 } }
  onUnmounted(cancel)
  return { animation, phase, impact, play, enemyTurn, cancel }
}
