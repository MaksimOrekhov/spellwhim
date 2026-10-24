import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentMotion, getMotionPreference, setMotionPreference } from './motion'
import { ParticlePool } from './particles'
import { runPlan } from './run'
import type { PaintHost } from './run'
import { Timeline } from './timeline'
import type { VfxBeat, VfxPlan } from './types'

class FakeHost implements PaintHost {
  readonly timeline = new Timeline()
  readonly painted: { at: number; beat: VfxBeat }[] = []
  paint(beat: VfxBeat) { this.painted.push({ at: Math.round(this.timeline.now), beat }) }
  after(ms: number, run: () => void) { this.timeline.after(ms, run) }
}

const number = (at: number, text: string): VfxBeat => ({ at, kind: 'number', anchor: 'enemy', tone: 'damage', size: 'l', text, priority: 1, lane: 0, durMs: 600 })
const plan = (beats: VfxBeat[], impactMs: number): VfxPlan => ({ scenario: 'test', actor: 'card', motion: 'full', beats, impactMs, fallbackImpactMs: impactMs + 260, recoveryMs: 900, endMs: 800, reaction: {} })

describe('Timeline', () => {
  it('runs callbacks in time order, and in scheduling order at the same time', () => {
    const timeline = new Timeline()
    const order: string[] = []
    timeline.after(100, () => order.push('b'))
    timeline.after(50, () => order.push('a'))
    timeline.after(100, () => order.push('c'))
    timeline.advance(49)
    expect(order).toEqual([])
    timeline.advance(60)
    expect(order).toEqual(['a', 'b', 'c'])
    expect(timeline.pending).toBe(0)
  })

  it('runs work scheduled for "now" by a callback in the same advance, and forgets everything on clear', () => {
    const timeline = new Timeline()
    const order: string[] = []
    timeline.after(10, () => { order.push('first'); timeline.after(0, () => order.push('chained')) })
    timeline.after(500, () => order.push('late'))
    timeline.advance(20)
    expect(order).toEqual(['first', 'chained'])
    timeline.clear()
    timeline.advance(1000)
    expect(order).toEqual(['first', 'chained'])
    expect(timeline.now).toBe(1000)
  })
})

describe('ParticlePool', () => {
  const spec = { x: 0, y: 0, vx: 100, vy: 0, life: 100, size: 3, color: 0xffffff }

  it('never holds more than its cap: the newest sparks are dropped, not the frame rate', () => {
    const pool = new ParticlePool(5)
    const accepted = Array.from({ length: 12 }, () => pool.emit(spec)).filter(Boolean).length
    expect(accepted).toBe(5)
    expect(pool.count).toBe(5)
  })

  it('moves, ages out and reuses particles without growing', () => {
    const pool = new ParticlePool(4)
    pool.emit({ ...spec, gravity: 1000 })
    pool.update(100 / 2)
    expect(pool.live[0]!.x).toBeCloseTo(5)
    expect(pool.live[0]!.vy).toBeCloseTo(50)
    pool.update(60)
    expect(pool.count).toBe(0)
    for (let round = 0; round < 50; round += 1) { pool.emit(spec); pool.update(150) }
    expect(pool.count).toBe(0)
    pool.emit(spec)
    pool.clear()
    expect(pool.count).toBe(0)
  })
})

describe('runPlan', () => {
  it('reports the impact exactly once, at the plan’s moment, and paints every beat on time', () => {
    const host = new FakeHost()
    const onImpact = vi.fn()
    runPlan(plan([number(0, 'a'), number(200, 'b'), number(500, 'c')], 150), host, { onImpact, current: () => true })
    host.timeline.advance(0)
    host.timeline.advance(149)
    expect(onImpact).not.toHaveBeenCalled()
    host.timeline.advance(1)
    expect(onImpact).toHaveBeenCalledTimes(1)
    for (let ms = 0; ms < 5000; ms += 1) host.timeline.advance(1)
    expect(onImpact).toHaveBeenCalledTimes(1)
    expect(host.painted.map(item => [item.beat.kind === 'number' ? item.beat.text : '', item.at])).toEqual([['a', 0], ['b', 200], ['c', 500]])
  })

  it('does not report or paint anything once the action is no longer current', () => {
    const host = new FakeHost()
    let current = true
    const onImpact = vi.fn()
    runPlan(plan([number(0, 'a'), number(300, 'late'), number(600, 'later')], 200), host, { onImpact, current: () => current })
    host.timeline.advance(100)
    current = false
    host.timeline.advance(5000)
    expect(onImpact).not.toHaveBeenCalled()
    expect(host.painted).toHaveLength(1)
  })

  it('leaves no leftovers from a plan that was replaced: clearing the clock drops its remaining beats', () => {
    const host = new FakeHost()
    const first = vi.fn()
    const second = vi.fn()
    runPlan(plan([number(0, 'first'), number(700, 'first-late')], 100), host, { onImpact: first, current: () => false })
    host.timeline.clear()
    runPlan(plan([number(0, 'second')], 100), host, { onImpact: second, current: () => true })
    host.timeline.advance(5000)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(host.painted.map(item => item.beat.kind === 'number' && item.beat.text)).toEqual(['second'])
    expect(host.timeline.pending).toBe(0)
  })
})

describe('motion preference', () => {
  afterEach(() => { setMotionPreference('auto'); vi.unstubAllGlobals() })

  it('follows prefers-reduced-motion unless overridden', () => {
    vi.stubGlobal('window', { matchMedia: (query: string) => ({ matches: query.includes('reduce') }) })
    expect(getMotionPreference()).toBe('auto')
    expect(currentMotion()).toBe('reduced')
    setMotionPreference('full')
    expect(currentMotion()).toBe('full')
    setMotionPreference('reduced')
    expect(currentMotion()).toBe('reduced')
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    setMotionPreference('auto')
    expect(currentMotion()).toBe('full')
  })

  it('falls back to full motion where the browser cannot say', () => {
    vi.stubGlobal('window', {})
    expect(currentMotion()).toBe('full')
  })
})
