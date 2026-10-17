import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, shallowRef } from 'vue'
import { createBattle, startCardPlay } from '../game/battle'
import { useBattleAnimation } from './useBattleAnimation'

// A minimal Vue host registers lifecycle hooks; no browser or graphics are needed.
const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {},
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})

function mountAnimation() {
  const state = shallowRef(createBattle(undefined, undefined, { deck: ['sword-strike'] }))
  const resolvePlay = vi.fn()
  const finishTurn = vi.fn()
  let controls!: ReturnType<typeof useBattleAnimation>
  const app = renderer.createApp({ setup() {
    controls = useBattleAnimation({ state, resolvePlay, finishTurn })
    return () => null
  } })
  app.mount({})
  const start = startCardPlay(state.value, state.value.hand[0]!.instanceId)
  if (!start.ok) throw new Error('Expected a card')
  return { controls, app, state, play: start.play, resolvePlay, finishTurn }
}

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('animation action correlation', () => {
  it('applies one impact even when Pixi, fallback and recovery all report it', () => {
    const fixture = mountAnimation()
    fixture.controls.play(fixture.play)
    const id = fixture.controls.animation.value.actionId!
    fixture.controls.impact(id)
    fixture.controls.impact(id)
    vi.advanceTimersByTime(2000)
    expect(fixture.resolvePlay).toHaveBeenCalledExactlyOnceWith(fixture.play.actionId)
    expect(fixture.controls.animation.value.busy).toBe(false)
    fixture.app.unmount()
  })

  it('ignores stale events and cancels old timers after moving to a new action', () => {
    const fixture = mountAnimation()
    fixture.controls.play(fixture.play)
    const oldId = fixture.controls.animation.value.actionId!
    fixture.controls.cancel()
    fixture.controls.play(fixture.play)
    const newId = fixture.controls.animation.value.actionId!
    expect(newId).not.toBe(oldId)
    fixture.controls.impact(oldId)
    expect(fixture.resolvePlay).not.toHaveBeenCalled()
    vi.advanceTimersByTime(560)
    expect(fixture.resolvePlay).toHaveBeenCalledTimes(1)
    fixture.controls.impact(newId)
    expect(fixture.resolvePlay).toHaveBeenCalledTimes(1)
    fixture.app.unmount()
  })

  it('does not end an enemy turn twice on duplicate impact events', () => {
    const fixture = mountAnimation()
    fixture.controls.enemyTurn()
    const id = fixture.controls.animation.value.actionId!
    fixture.controls.impact(id)
    fixture.controls.impact(id)
    vi.advanceTimersByTime(2000)
    expect(fixture.finishTurn).toHaveBeenCalledTimes(1)
    fixture.app.unmount()
  })

  it('keeps explicit card/enemy phases through impact and recovery independently of effect type', () => {
    const fixture = mountAnimation()
    expect(fixture.controls.phase.value).toBe('player')
    fixture.controls.play(fixture.play)
    expect(fixture.controls.phase.value).toBe('card')
    fixture.controls.animation.value = { ...fixture.controls.animation.value, effect: '' }
    expect(fixture.controls.phase.value).toBe('card')
    fixture.controls.impact(fixture.controls.animation.value.actionId!)
    expect(fixture.controls.phase.value).toBe('card')
    vi.advanceTimersByTime(880)
    expect(fixture.controls.phase.value).toBe('player')
    fixture.controls.enemyTurn()
    expect(fixture.controls.phase.value).toBe('enemy')
    fixture.controls.impact(fixture.controls.animation.value.actionId!)
    expect(fixture.controls.phase.value).toBe('enemy')
    vi.advanceTimersByTime(880)
    expect(fixture.controls.phase.value).toBe('player')
    fixture.state.value = { ...fixture.state.value, result: 'victory' }
    expect(fixture.controls.phase.value).toBe('finished')
    fixture.app.unmount()
  })

  it('cancels callbacks when the scene unmounts', () => {
    const fixture = mountAnimation()
    fixture.controls.play(fixture.play)
    fixture.app.unmount()
    vi.advanceTimersByTime(2000)
    expect(fixture.resolvePlay).not.toHaveBeenCalled()
  })
})
