import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, shallowRef } from 'vue'
import { endTurn, resolveCardPlay, startCardPlay } from '../game/battle'
import { vfxScenario } from '../vfx/scenarios'
import { runPlan } from '../vfx/run'
import type { PaintHost } from '../vfx/run'
import { Timeline } from '../vfx/timeline'
import type { Motion, VfxBeat } from '../vfx/types'
import { useBattleAnimation } from './useBattleAnimation'

// A minimal Vue host registers lifecycle hooks; no browser or graphics are needed.
const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {},
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})

/** A canvas stand-in: the same clock-and-paint contract as the Pixi runtime, driven by hand. */
class FakeCanvas implements PaintHost {
  timeline = new Timeline()
  painted: VfxBeat[] = []
  paint(beat: VfxBeat) { this.painted.push(beat) }
  after(ms: number, run: () => void) { this.timeline.after(ms, run) }
}

function mount(scenarioId: string, motion: Motion = 'full') {
  const state = shallowRef(vfxScenario(scenarioId)!.build())
  const resolvePlay = vi.fn((actionId: string) => {
    const next = structuredClone(state.value)
    const result = resolveCardPlay(next, actionId)
    if (result.ok) state.value = next
    return result
  })
  const finishTurn = vi.fn(() => { const next = structuredClone(state.value); if (endTurn(next)) state.value = next })
  let controls!: ReturnType<typeof useBattleAnimation>
  const app = renderer.createApp({ setup() {
    controls = useBattleAnimation({ state, resolvePlay, finishTurn, motion: () => motion })
    return () => null
  } })
  app.mount({})
  const canvas = new FakeCanvas()
  /** Plays the first card of the hand the way the app does, and lets the canvas run the plan of that action. */
  function playFirst(attach = true) {
    const next = structuredClone(state.value)
    const started = startCardPlay(next, next.hand[0]!.instanceId)
    if (!started.ok) throw new Error('Cannot play')
    state.value = next
    controls.play(started.play)
    const id = controls.animation.value.actionId!
    if (attach) attachCanvas(id)
    return { id, play: started.play }
  }
  function attachCanvas(id: string) {
    const plan = controls.animation.value.vfx!
    runPlan(plan, canvas, { current: () => controls.animation.value.actionId === id, onImpact: () => controls.impact(id) })
  }
  return { controls, state, resolvePlay, finishTurn, canvas, playFirst, attachCanvas, app }
}

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('window', globalThis) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('effects and the engine stay in step', () => {
  it('applies a card with several effects exactly once, however many beats and reports arrive', () => {
    const fixture = mount('shield-bash')
    const before = structuredClone(fixture.state.value)
    const { id, play } = fixture.playFirst()
    expect(fixture.canvas.timeline.pending).toBeGreaterThan(3)
    fixture.canvas.timeline.advance(3000)
    fixture.controls.impact(id)
    fixture.controls.impact(id)
    vi.advanceTimersByTime(3000)
    expect(fixture.resolvePlay).toHaveBeenCalledExactlyOnceWith(play.actionId)
    const after = fixture.state.value
    expect(before.enemy.health - after.enemy.health).toBe(play.preview.healthDamage)
    expect(after.heroes.warrior.armor).toBe(before.heroes.warrior.armor + play.preview.armor.warrior)
    expect(after.statuses.enemy.filter(item => item.id === 'vulnerability')).toHaveLength(1)
    expect(fixture.controls.animation.value.busy).toBe(false)
    expect(fixture.canvas.painted.length).toBeGreaterThan(3)
    fixture.app.unmount()
  })

  it('applies a group attack once although it draws two hits', () => {
    const fixture = mount('enemy-all')
    const before = structuredClone(fixture.state.value)
    fixture.controls.enemyTurn()
    const id = fixture.controls.animation.value.actionId!
    fixture.attachCanvas(id)
    expect(fixture.canvas.timeline.pending).toBeGreaterThan(4)
    fixture.canvas.timeline.advance(3000)
    expect(fixture.controls.animation.value.impactTarget).toBe('both')
    vi.advanceTimersByTime(3000)
    expect(fixture.finishTurn).toHaveBeenCalledTimes(1)
    expect(fixture.canvas.painted.filter(beat => beat.kind === 'strike')).toHaveLength(2)
    expect(fixture.state.value.heroes.warrior.health).toBe(before.heroes.warrior.health - 4)
    expect(fixture.state.value.heroes.mage.health).toBe(before.heroes.mage.health - 4)
    fixture.app.unmount()
  })

  it('lets a cancelled or replaced action draw and hit nothing later', () => {
    const fixture = mount('sword-strike')
    const first = fixture.playFirst()
    fixture.canvas.timeline.advance(40)
    fixture.controls.cancel()
    fixture.canvas.timeline.advance(5000)
    vi.advanceTimersByTime(5000)
    expect(fixture.resolvePlay).not.toHaveBeenCalled()
    expect(fixture.canvas.painted.filter(beat => beat.kind === 'strike')).toHaveLength(1)
    expect(fixture.controls.animation.value.vfx).toBeNull()
    expect(first.id).toBeTruthy()
    fixture.app.unmount()
  })

  it('keeps fast successive cards apart: each hits once, and the first leaves nothing behind', () => {
    const fixture = mount('sword-strike')
    const one = fixture.playFirst()
    fixture.canvas.timeline.advance(20)
    // A second card arrives while the first is still on the canvas: the canvas forgets the old clock, as BattleFx does at the start of a plan.
    const second = structuredClone(fixture.state.value)
    fixture.controls.cancel()
    fixture.canvas.timeline.clear()
    fixture.state.value = second
    fixture.state.value.pending = null
    const start = startCardPlay(fixture.state.value, fixture.state.value.hand[0]!.instanceId)
    expect(start.ok).toBe(true)
    if (!start.ok) return
    fixture.controls.play(start.play)
    const secondId = fixture.controls.animation.value.actionId!
    expect(secondId).not.toBe(one.id)
    fixture.attachCanvas(secondId)
    fixture.canvas.timeline.advance(5000)
    vi.advanceTimersByTime(5000)
    expect(fixture.resolvePlay).toHaveBeenCalledTimes(1)
    expect(fixture.resolvePlay).toHaveBeenCalledWith(start.play.actionId)
    expect(fixture.canvas.timeline.pending).toBe(0)
    fixture.app.unmount()
  })

  it('applies the action through the fallback timer if the canvas never reports, and releases input on time', () => {
    const fixture = mount('fireball')
    const { play } = fixture.playFirst(false)
    const plan = fixture.controls.animation.value.vfx!
    vi.advanceTimersByTime(plan.fallbackImpactMs - 1)
    expect(fixture.resolvePlay).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fixture.resolvePlay).toHaveBeenCalledExactlyOnceWith(play.actionId)
    expect(fixture.controls.animation.value.busy).toBe(true)
    vi.advanceTimersByTime(plan.recoveryMs - plan.fallbackImpactMs)
    expect(fixture.controls.animation.value.busy).toBe(false)
    fixture.app.unmount()
  })

  it('works the same under reduced motion, only shorter', () => {
    const full = mount('fireball')
    full.playFirst(false)
    const calm = mount('fireball', 'reduced')
    const { play } = calm.playFirst()
    expect(calm.controls.animation.value.vfx!.motion).toBe('reduced')
    expect(calm.controls.animation.value.vfx!.recoveryMs).toBeLessThan(full.controls.animation.value.vfx!.recoveryMs)
    calm.canvas.timeline.advance(3000)
    vi.advanceTimersByTime(3000)
    expect(calm.resolvePlay).toHaveBeenCalledExactlyOnceWith(play.actionId)
    expect(calm.controls.animation.value.busy).toBe(false)
    full.app.unmount()
    calm.app.unmount()
  })
})

describe('only a portrait that really moves reacts', () => {
  it('moves the enemy for a hit, nobody for a draw, and nobody for a fully blocked blow', () => {
    const hit = mount('fireball')
    hit.playFirst()
    hit.canvas.timeline.advance(3000)
    expect(hit.controls.animation.value.impactTarget).toBe('enemy')
    expect(hit.controls.animation.value.reaction.enemy).toBe('normal')

    const draw = mount('arcane-insight')
    draw.playFirst()
    draw.canvas.timeline.advance(3000)
    expect(draw.resolvePlay).toHaveBeenCalledTimes(1)
    expect(draw.controls.animation.value.impactTarget).toBeNull()

    const block = mount('enemy-block')
    block.controls.enemyTurn()
    block.attachCanvas(block.controls.animation.value.actionId!)
    block.canvas.timeline.advance(3000)
    expect(block.finishTurn).toHaveBeenCalledTimes(1)
    expect(block.controls.animation.value.impactTarget).toBeNull()
    expect(block.state.value.heroes.warrior.health).toBe(21)
    for (const fixture of [hit, draw, block]) fixture.app.unmount()
  })

  it('moves the struck hero only, and no one for a stopped blow', () => {
    const single = mount('enemy-claw')
    single.controls.enemyTurn()
    single.attachCanvas(single.controls.animation.value.actionId!)
    single.canvas.timeline.advance(3000)
    expect(single.controls.animation.value.impactTarget).toBe('warrior')
    const stopped = mount('enemy-stopped')
    stopped.controls.enemyTurn()
    stopped.attachCanvas(stopped.controls.animation.value.actionId!)
    stopped.canvas.timeline.advance(3000)
    expect(stopped.finishTurn).toHaveBeenCalledTimes(1)
    expect(stopped.controls.animation.value.impactTarget).toBeNull()
    expect(stopped.canvas.painted.some(beat => beat.kind === 'strike')).toBe(false)
    single.app.unmount()
    stopped.app.unmount()
  })
})
