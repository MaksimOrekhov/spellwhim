import type { AmbientProfile } from '../ambient/profiles'
import type { SoundId } from './cues'
import { synthesize } from './synthesis'

export interface AudioSettings { muted: boolean; effects: number; ambience: number }
export const AUDIO_SETTINGS_KEY = 'spellwhim.audio.v1'
export const defaultAudioSettings: AudioSettings = { muted: false, effects: .65, ambience: .3 }
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface Dependencies { context?: () => AudioContext | null; storage?: () => Storage | undefined; random?: () => number }
type Bus = 'effects' | 'ambience'
interface Voice { source: AudioBufferSourceNode; gain: GainNode; bus: Bus; scope: string; dispose(): void }

/** A single lazy context, two buses, bounded short-lived sources. No part of this class calls the combat engine. */
export class GameAudio {
  settings = { ...defaultAudioSettings }
  private ctx: AudioContext | null = null
  private unavailable = false
  private unlocked = false
  private unlocking = false
  private hidden = false
  private effects: GainNode | null = null
  private ambience: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private voices = new Set<Voice>()
  private listeners = new Set<() => void>()
  private ambient: AmbientProfile | null = null
  private ambientTimer: ReturnType<typeof setTimeout> | undefined
  private ambientStep = 0
  private cooldown = new Map<SoundId, number>()
  private generation = 0
  private played = 0
  private dependencies: Dependencies

  constructor(dependencies: Dependencies = {}) {
    this.dependencies = dependencies
    try {
      const raw = this.storage()?.getItem(AUDIO_SETTINGS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (typeof saved.muted === 'boolean') this.settings.muted = saved.muted
        for (const key of ['effects', 'ambience'] as const) if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) this.settings[key] = Math.max(0, Math.min(1, saved[key]))
      }
    } catch { /* storage may be blocked; sound settings still work for this session */ }
  }
  private storage() { return this.dependencies.storage ? this.dependencies.storage() : typeof window === 'undefined' ? undefined : window.localStorage }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  update(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch }
    for (const key of ['effects', 'ambience'] as const) this.settings[key] = Number.isFinite(this.settings[key]) ? Math.max(0, Math.min(1, this.settings[key])) : defaultAudioSettings[key]
    try { this.storage()?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings)) } catch { /* optional persistence */ }
    this.applyGains()
    if (this.settings.muted) { this.stopVoices(); this.clearAmbientTimer() }
    else {
      if (!this.settings.effects) this.stopVoices('effects')
      if (!this.settings.ambience) { this.stopVoices('ambience'); this.clearAmbientTimer() }
      this.ensureAmbient()
    }
    this.listeners.forEach(listener => listener())
  }
  /** Must be called by a trusted input listener. Constructing the service never creates an AudioContext. */
  async unlock() {
    if (this.unavailable || this.hidden || this.settings.muted || this.unlocking) return
    this.unlocking = true
    const generation = this.generation
    try {
      if (!this.ctx) {
        this.ctx = this.dependencies.context ? this.dependencies.context() : typeof AudioContext === 'undefined' ? null : new AudioContext()
        if (!this.ctx) { this.unavailable = true; return }
        this.effects = this.ctx.createGain(); this.ambience = this.ctx.createGain()
        this.compressor = this.ctx.createDynamicsCompressor()
        this.compressor.threshold.value = -12; this.compressor.knee.value = 12; this.compressor.ratio.value = 5
        this.effects.connect(this.compressor); this.ambience.connect(this.compressor); this.compressor.connect(this.ctx.destination)
        this.applyGains()
      }
      const ctx = this.ctx
      if (ctx.state === 'suspended') await ctx.resume()
      if (generation !== this.generation || this.ctx !== ctx) return
      this.unlocked = ctx.state === 'running'
      this.ensureAmbient()
    } catch { this.unlocked = false; if (!this.ctx) this.unavailable = true /* a blocked resume is retried only on another genuine input */ }
    finally { this.unlocking = false }
  }
  private applyGains() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const bus of ['effects', 'ambience'] as const) {
      const node = this[bus]
      if (!node) continue
      node.gain.cancelScheduledValues(now)
      node.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings[bus], now, .025)
    }
  }
  play(sound: SoundId, gain = 1, scope = 'ui', bus: Bus = 'effects') {
    const ctx = this.ctx
    if (!ctx || !this.unlocked || ctx.state !== 'running' || this.hidden || this.settings.muted || !this.settings[bus]) return
    // UI sounds are quiet and repeated identical events cannot pile up; combat landings may be 110ms apart.
    const now = ctx.currentTime
    if (scope === 'ui' && now - (this.cooldown.get(sound) ?? -100) < .09) return
    if (scope === 'ui') { this.cooldown.set(sound, now); gain *= .3 }
    if (this.voices.size >= 16) return
    let source: AudioBufferSourceNode | null = null, volume: GainNode | null = null
    try {
      let buffer = this.buffers.get(sound)
      if (!buffer) {
        const samples = synthesize(sound)
        buffer = ctx.createBuffer(1, samples.length, 24000)
        buffer.getChannelData(0).set(samples)
        this.buffers.set(sound, buffer)
      }
      source = ctx.createBufferSource(); volume = ctx.createGain()
      source.buffer = buffer; volume.gain.value = Math.max(0, Math.min(1, gain))
      source.connect(volume); volume.connect(this[bus]!)
      const src = source, vol = volume
      const voice: Voice = { source: src, gain: vol, bus, scope, dispose: () => { src.onended = null; src.disconnect(); vol.disconnect(); this.voices.delete(voice) } }
      src.onended = voice.dispose
      this.voices.add(voice)
      try { src.start(); this.played++ } catch { voice.dispose() }
    } catch { source?.disconnect(); volume?.disconnect() /* decoration must never throw into input or impact */ }
  }
  stopScope(scope: string) { for (const voice of [...this.voices]) if (voice.scope === scope) this.stop(voice) }
  private stop(voice: Voice) { try { voice.source.stop() } catch { /* already ended */ } voice.dispose() }
  private stopVoices(bus?: Bus) { for (const voice of [...this.voices]) if (!bus || voice.bus === bus) this.stop(voice) }
  setAmbient(profile: AmbientProfile | null) {
    if (this.ambient === profile) return
    const oldFamily = this.ambient?.startsWith('forge') ? 'forge' : this.ambient
    const family = profile?.startsWith('forge') ? 'forge' : profile
    this.ambient = profile
    // Phase two changes the next accent; it never creates a parallel bed or restarts the furnace.
    if (family !== oldFamily) { this.clearAmbientTimer(); this.stopVoices('ambience'); this.ambientStep = 0 }
    this.ensureAmbient()
  }
  private clearAmbientTimer() { clearTimeout(this.ambientTimer); this.ambientTimer = undefined }
  private ensureAmbient() {
    if (this.ambientTimer !== undefined || !this.ambient || !this.ctx || !this.unlocked || this.hidden || this.settings.muted || !this.settings.ambience) return
    this.ambientTimer = setTimeout(() => {
      this.ambientTimer = undefined
      const profile = this.ambient
      if (!profile) return
      const family = profile.startsWith('forge') ? 'forge' : profile
      const step = this.ambientStep++ % 3
      const sound: SoundId = step === 0 ? family === 'mine' ? 'mine-air' : family === 'crystal' ? 'crystal-air' : 'forge-air'
        : family === 'mine' ? step === 1 ? 'creak' : 'distant-metal' : family === 'crystal' ? 'crystal-chime' : step === 1 ? 'embers' : 'distant-metal'
      this.play(sound, step === 0 ? .28 : profile === 'forge-fury' ? .2 : .16, 'ambient', 'ambience')
      this.ensureAmbient()
    }, this.ambientStep === 0 ? 500 : 9000 + (this.dependencies.random?.() ?? Math.random()) * 8000)
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden
    if (hidden) { this.clearAmbientTimer(); this.stopVoices() }
    else this.ensureAmbient()
  }
  stats() { return { sources: this.voices.size, ambientSources: [...this.voices].filter(v => v.bus === 'ambience').length, ambientTimers: this.ambientTimer === undefined ? 0 : 1, buffers: this.buffers.size, contexts: this.ctx ? 1 : 0, unlocked: this.unlocked, unavailable: this.unavailable, hidden: this.hidden, profile: this.ambient, played: this.played } }
  dispose() {
    this.generation++
    this.clearAmbientTimer(); this.stopVoices(); this.ambient = null
    this.effects?.disconnect(); this.ambience?.disconnect(); this.compressor?.disconnect()
    void this.ctx?.close().catch(() => {})
    this.ctx = null; this.effects = this.ambience = null; this.compressor = null
    this.buffers.clear(); this.cooldown.clear(); this.unlocked = false
  }
}

export const gameAudio = new GameAudio()
