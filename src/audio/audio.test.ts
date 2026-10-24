import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameAudio, AUDIO_SETTINGS_KEY } from './engine'
import { soundCues } from './cues'
import { synthesize } from './synthesis'
import { ambientParticleCount, ambientProfile } from '../ambient/profiles'
import { battleBackground } from '../ui/battleBackground'
import { vfxScenario } from '../vfx/scenarios'
import { cardVfxPlan, enemyVfxPlan } from '../vfx/plan'
import { forecastEnemyAction, startCardPlay } from '../game/battle'
import { resolveCardDefinition } from '../game/cardProgression'
import { runPlan } from '../vfx/run'
import { Timeline } from '../vfx/timeline'

function plan(id: string, motion: 'full' | 'reduced' = 'full') {
  const scene = vfxScenario(id)!, state = scene.build()
  if (scene.run.kind === 'enemy') return enemyVfxPlan({ state, forecast: forecastEnemyAction(state), motion })
  const play = startCardPlay(state, state.hand[0]!.instanceId)
  if (!play.ok) throw new Error('invalid scene')
  return cardVfxPlan({ state, card: resolveCardDefinition(play.play.card), play: play.play, motion })
}
function fakeAudio() {
  const sources: { stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; onended: (() => void) | null; start: ReturnType<typeof vi.fn> }[] = []
  const gain = () => ({ gain: { value: 1, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })
  const context = {
    state: 'suspended', currentTime: 1, destination: {},
    resume: vi.fn(async () => { context.state = 'running' }), close: vi.fn(async () => { context.state = 'closed' }),
    createGain: gain,
    createDynamicsCompressor: () => ({ connect: vi.fn(), disconnect: vi.fn(), threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 } }),
    createBuffer: (_channels: number, size: number) => ({ getChannelData: () => new Float32Array(size) }),
    createBufferSource: () => { const s = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }; sources.push(s); return s },
  }
  const factory = vi.fn(() => context as unknown as AudioContext)
  return { context, sources, factory }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('public sound cues on the VFX clock', () => {
  it('lands Fireball and sword sounds at their own visual impact', () => {
    for (const [id, launch, hit] of [['fireball', 'fire-launch', 'fire-hit'], ['sword-strike', 'swing', 'steel-hit']] as const) {
      const p = plan(id)
      expect(soundCues(p)).toContainEqual({ at: 0, sound: launch, gain: .7 })
      expect(soundCues(p).find(c => c.sound === hit)?.at).toBe(p.impactMs)
    }
  })
  it('replaces a blocked body impact and distinguishes armor breaking', () => {
    for (const motion of ['full', 'reduced'] as const) {
      expect(soundCues(plan('enemy-block', motion)).filter(c => ['steel-hit', 'heavy-hit', 'block'].includes(c.sound)).map(c => c.sound)).toEqual(['block'])
      expect(soundCues(plan('sword-vs-armor', motion)).filter(c => ['steel-hit', 'heavy-hit', 'block'].includes(c.sound)).map(c => c.sound)).toEqual(['block'])
    }
    expect(soundCues(plan('sword-breaks-armor')).some(c => c.sound === 'armor-break')).toBe(true)
  })
  it('only shatters real consumed frost, and draws without an attack sound', () => {
    expect(soundCues(plan('ice-breaker-frost')).filter(c => c.sound === 'ice-crack')).toHaveLength(1)
    expect(soundCues(plan('ice-breaker-plain')).some(c => c.sound === 'ice-crack')).toBe(false)
    expect(soundCues(plan('arcane-insight')).map(c => c.sound)).toEqual(['draw'])
  })
  it('plays two group landings but applies just one impact, even after extra clock advances', () => {
    const p = plan('enemy-all'), clock = new Timeline(), sounds: string[] = [], impact = vi.fn()
    runPlan(p, { paint() {}, after: (ms, fn) => clock.after(ms, fn) }, { current: () => true, onImpact: impact, onSound: c => sounds.push(c.sound) })
    clock.advance(5000); clock.advance(5000)
    expect(sounds.filter(s => s === 'steel-hit' || s === 'heavy-hit')).toHaveLength(2)
    expect(impact).toHaveBeenCalledTimes(1)
  })
  it('cancels late sounds with the action, and audio exceptions cannot break impact', () => {
    const p = plan('fireball'), clock = new Timeline(), sound = vi.fn(), impact = vi.fn()
    let current = true
    runPlan(p, { paint() {}, after: (ms, fn) => clock.after(ms, fn) }, { current: () => current, onImpact: impact, onSound: sound })
    clock.advance(1); current = false; clock.advance(5000)
    expect(sound).toHaveBeenCalledTimes(1); expect(impact).not.toHaveBeenCalled()
    runPlan(p, { paint() {}, after: (ms, fn) => clock.after(ms, fn) }, { current: () => true, onImpact: impact, onSound: () => { throw new Error('audio failed') } })
    expect(() => clock.advance(5000)).not.toThrow(); expect(impact).toHaveBeenCalledTimes(1)
  })
  it('retimes sound with reduced motion instead of disabling it', () => {
    const p = plan('fireball', 'reduced')
    expect(soundCues(p).find(c => c.sound === 'fire-hit')?.at).toBe(p.impactMs)
  })
  it('does not expose a preparation size through sound', () => {
    const state = vfxScenario('boss-prepare')!.build()
    const before = soundCues(enemyVfxPlan({ state, forecast: forecastEnemyAction(state) }))
    if (state.enemy.nextAction.kind !== 'prepare') throw new Error('not preparing')
    const hidden = state.enemy.nextAction.prepared
    if (hidden.kind === 'attack' || hidden.kind === 'attack_all') hidden.damage += 99
    expect(soundCues(enemyVfxPlan({ state, forecast: forecastEnemyAction(state) }))).toEqual(before)
  })
})

describe('lazy audio, settings and resource lifetime', () => {
  it('does not create or play audio before input, then reuses one context and buffers', async () => {
    const f = fakeAudio(), audio = new GameAudio({ context: f.factory })
    audio.setAmbient('mine'); audio.play('fire-hit')
    expect(f.factory).not.toHaveBeenCalled(); expect(audio.stats().sources).toBe(0)
    await audio.unlock(); await audio.unlock()
    audio.play('fire-hit', 1, 'one'); audio.play('fire-hit', 1, 'two')
    expect(f.factory).toHaveBeenCalledTimes(1); expect(audio.stats().buffers).toBe(1)
    f.sources[0]!.onended!(); expect(audio.stats().sources).toBe(1)
    audio.stopScope('two'); expect(audio.stats().sources).toBe(0)
    audio.dispose()
  })
  it('phase two keeps one ambient timer and one bed; switching fight or leaving stops the old source', async () => {
    vi.useFakeTimers()
    const f = fakeAudio(), audio = new GameAudio({ context: f.factory, random: () => .5 })
    await audio.unlock(); audio.setAmbient('forge'); vi.advanceTimersByTime(500)
    expect(audio.stats()).toMatchObject({ ambientSources: 1, ambientTimers: 1 })
    audio.setAmbient('forge-fury')
    expect(audio.stats()).toMatchObject({ ambientSources: 1, ambientTimers: 1 })
    expect(f.sources[0]!.stop).not.toHaveBeenCalled()
    audio.setAmbient('crystal'); expect(f.sources[0]!.stop).toHaveBeenCalledOnce()
    audio.setAmbient(null); vi.advanceTimersByTime(60000)
    expect(audio.stats()).toMatchObject({ sources: 0, ambientTimers: 0 }); audio.dispose()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('mute and hiding stop all sources; resume schedules no backlog', async () => {
    vi.useFakeTimers()
    const f = fakeAudio(), audio = new GameAudio({ context: f.factory })
    await audio.unlock(); audio.setAmbient('mine'); vi.advanceTimersByTime(500); audio.play('heavy-hit')
    audio.update({ muted: true })
    expect(audio.stats()).toMatchObject({ sources: 0, ambientTimers: 0 })
    audio.update({ muted: false }); audio.play('fire-hit'); audio.setHidden(true)
    expect(audio.stats()).toMatchObject({ sources: 0, ambientTimers: 0 })
    vi.advanceTimersByTime(60000); const count = f.sources.length
    audio.setHidden(false); expect(f.sources).toHaveLength(count)
    expect(audio.stats().ambientTimers).toBe(1); audio.dispose()
  })
  it('persists separately from run saves, clamps settings and tolerates blocked storage', () => {
    const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
    const audio = new GameAudio({ storage: () => storage })
    audio.update({ muted: true, effects: .35, ambience: .1 })
    expect(new GameAudio({ storage: () => storage }).settings).toEqual(audio.settings)
    expect([...data.keys()]).toEqual([AUDIO_SETTINGS_KEY])
    data.set(AUDIO_SETTINGS_KEY, '{"effects":25,"ambience":-5,"muted":"no"}')
    expect(new GameAudio({ storage: () => storage }).settings).toEqual({ effects: 1, ambience: 0, muted: false })
    expect(() => new GameAudio({ storage: () => { throw Error('blocked') } }).update({ muted: true })).not.toThrow()
  })
  it('handles absent and rejecting Web Audio without throwing or retry loops', async () => {
    vi.useFakeTimers()
    const factory = vi.fn(() => null), audio = new GameAudio({ context: factory })
    await audio.unlock(); await audio.unlock(); audio.play('fire-hit'); audio.setAmbient('forge')
    expect(factory).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0)
    const f = fakeAudio(); f.context.resume.mockRejectedValue(Error('blocked'))
    const rejected = new GameAudio({ context: f.factory }); await expect(rejected.unlock()).resolves.toBeUndefined()
    expect(rejected.stats().sources).toBe(0); expect(vi.getTimerCount()).toBe(0); rejected.dispose()
  })
  it('bounds sources and disconnects nodes on completion, cancellation and disposal', async () => {
    const f = fakeAudio(), audio = new GameAudio({ context: f.factory }); await audio.unlock()
    for (let i = 0; i < 60; i++) audio.play('swing', 1, 'combat')
    expect(audio.stats().sources).toBe(16)
    audio.dispose(); expect(audio.stats()).toMatchObject({ sources: 0, contexts: 0, buffers: 0 })
    expect(f.sources.every(s => s.disconnect.mock.calls.length === 1 && s.stop.mock.calls.length === 1)).toBe(true)
  })
})

describe('atmosphere and original timbres', () => {
  it('selects three paintings and the visible boss phase, with a fixed particle cap', () => {
    expect(ambientProfile(battleBackground('old-mines-raider'), 2)).toBe('mine')
    expect(ambientProfile(battleBackground('old-mines-johnson'), 1)).toBe('crystal')
    expect(ambientProfile(battleBackground('old-mines-rhahk-zor'), 1)).toBe('forge')
    expect(ambientProfile(battleBackground('old-mines-rhahk-zor'), 2)).toBe('forge-fury')
    expect(Math.max(...Object.values(ambientParticleCount))).toBeLessThanOrEqual(26)
  })
  it('generates bounded finite, distinct waveforms with quiet ends', () => {
    const ids = ['steel-hit', 'fire-hit', 'frost-hit', 'lightning', 'arcane-hit', 'draw', 'mine-air'] as const
    const signatures = ids.map(id => {
      const samples = synthesize(id)
      let energy = 0, peak = 0
      for (const sample of samples) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample }
      expect(Number.isFinite(energy)).toBe(true); expect(peak).toBeLessThan(1)
      expect(energy).toBeGreaterThan(1); expect(Math.abs(samples[samples.length - 1]!)).toBeLessThan(.001)
      return samples.length + ':' + energy.toFixed(4)
    })
    expect(new Set(signatures).size).toBe(ids.length)
  })
})
