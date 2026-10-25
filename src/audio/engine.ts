import type { AmbientProfile } from '../ambient/profiles'
import type { SoundId } from './cues'
import { synthesize } from './synthesis'
import { musicTrackUrl, musicTracks } from './music'
import type { MusicRequest, MusicTrackId } from './music'
import { createRecordingSelector, recordingChoices, recordingUrl } from './recordings'
import type { RecordedSfxId } from './recordings'

export interface AudioSettings { muted: boolean; music: number; effects: number; ambience: number }
export const AUDIO_SETTINGS_KEY = 'spellwhim.audio.v1'
export const defaultAudioSettings: AudioSettings = { muted: false, music: .55, effects: .65, ambience: .3 }
interface Storage { getItem(key: string): string | null; setItem(key: string, value: string): void }
interface Dependencies { context?: () => AudioContext | null; storage?: () => Storage | undefined; random?: () => number; audio?: () => HTMLAudioElement | null }
type Bus = 'effects' | 'ambience'
interface Voice { source: AudioBufferSourceNode; gain: GainNode; bus: Bus; scope: string; dispose(): void }
interface NativeVoice { element: HTMLAudioElement; url?: string; bus: Bus; scope: string; dispose(): void }

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
  private musicBus: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private buffers = new Map<SoundId, AudioBuffer>()
  private recordedBuffers = new Map<RecordedSfxId, AudioBuffer>()
  private recordingLoads = new Map<RecordedSfxId, Promise<void>>()
  private unavailableRecordings = new Set<RecordedSfxId>()
  private voices = new Set<Voice>()
  private nativeVoices = new Set<NativeVoice>()
  private listeners = new Set<() => void>()
  private ambient: AmbientProfile | null = null
  private ambientTimer: ReturnType<typeof setTimeout> | undefined
  private ambientStep = 0
  private cooldown = new Map<SoundId, number>()
  private generation = 0
  private played = 0
  private playedRecorded = 0
  private nextRecording = createRecordingSelector()
  private musicElement: HTMLAudioElement | null = null
  private musicSource: MediaElementAudioSourceNode | null = null
  private musicTrackGain: GainNode | null = null
  private musicRequest: MusicRequest | null = null
  private activeMusic: MusicTrackId | null = null
  private musicTrim = 1
  private musicEnvelope = 0
  private musicGeneration = 0
  private musicTransitionTimer: ReturnType<typeof setTimeout> | undefined
  private musicFadeTimer: ReturnType<typeof setInterval> | undefined
  private loopFadeStarted = false
  private dependencies: Dependencies

  constructor(dependencies: Dependencies = {}) {
    this.dependencies = dependencies
    try {
      const raw = this.storage()?.getItem(AUDIO_SETTINGS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (typeof saved.muted === 'boolean') this.settings.muted = saved.muted
        for (const key of ['music', 'effects', 'ambience'] as const) if (typeof saved[key] === 'number' && Number.isFinite(saved[key])) this.settings[key] = Math.max(0, Math.min(1, saved[key]))
      }
    } catch { /* storage may be blocked; sound settings still work for this session */ }
  }
  private storage() { return this.dependencies.storage ? this.dependencies.storage() : typeof window === 'undefined' ? undefined : window.localStorage }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  update(patch: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...patch }
    for (const key of ['music', 'effects', 'ambience'] as const) this.settings[key] = Number.isFinite(this.settings[key]) ? Math.max(0, Math.min(1, this.settings[key])) : defaultAudioSettings[key]
    try { this.storage()?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings)) } catch { /* optional persistence */ }
    this.applyGains()
    if (this.settings.muted) { this.stopVoices(); this.stopNativeVoices(); this.clearAmbientTimer() }
    else {
      if (!this.settings.effects) this.stopVoices('effects')
      if (!this.settings.effects) this.stopNativeVoices()
      if (!this.settings.ambience) { this.stopVoices('ambience'); this.clearAmbientTimer() }
      this.ensureAmbient()
    }
    this.applyMusicVolume()
    this.listeners.forEach(listener => listener())
  }
  /** Must be called by a trusted input listener. Constructing the service never creates an AudioContext. */
  async unlock() {
    if (this.hidden || this.settings.muted || this.unlocking) return
    if (this.unavailable) { this.unlocked = true; this.ensureMusicElement(); this.syncMusic(); return }
    this.unlocking = true
    const generation = this.generation
    try {
      if (!this.ctx) {
        this.ctx = this.dependencies.context ? this.dependencies.context() : typeof AudioContext === 'undefined' ? null : new AudioContext()
        if (!this.ctx) {
          this.unavailable = true
          this.unlocked = true // Trusted input also permits the native media-element fallback.
          this.ensureMusicElement()
          this.syncMusic()
          return
        }
        this.effects = this.ctx.createGain(); this.ambience = this.ctx.createGain()
        this.musicBus = this.ctx.createGain()
        this.compressor = this.ctx.createDynamicsCompressor()
        this.compressor.threshold.value = -12; this.compressor.knee.value = 12; this.compressor.ratio.value = 5
        this.effects.connect(this.compressor); this.ambience.connect(this.compressor); this.musicBus.connect(this.compressor); this.compressor.connect(this.ctx.destination)
        this.applyGains()
        this.ensureMusicElement()
      }
      const ctx = this.ctx
      if (ctx.state === 'suspended') await ctx.resume()
      if (generation !== this.generation || this.ctx !== ctx) return
      this.unlocked = ctx.state === 'running'
      this.ensureAmbient()
      if (this.unlocked) { this.syncMusic(); if (typeof window !== 'undefined') void this.preloadRecordings() }
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
    if (this.musicBus) {
      this.musicBus.gain.cancelScheduledValues(now)
      this.musicBus.gain.setTargetAtTime(this.settings.muted ? 0 : this.settings.music, now, .025)
    }
  }
  play(sound: SoundId, gain = 1, scope = 'ui', bus: Bus = 'effects') {
    if (!this.unlocked || this.hidden || this.settings.muted || !this.settings[bus]) return
    // UI sounds are quiet and repeated identical events cannot pile up; combat landings may be 110ms apart.
    const ctx = this.ctx
    const now = ctx?.currentTime ?? performance.now() / 1000
    if (scope === 'ui' && now - (this.cooldown.get(sound) ?? -100) < .09) return
    if (scope === 'ui') { this.cooldown.set(sound, now); gain *= .3 }
    if (!ctx || ctx.state !== 'running') { this.playNative(sound, gain, scope, bus); return }
    const recording = this.nextRecording(sound)
    const recorded = recording ? this.recordedBuffers.get(recording) : undefined
    if (recorded) {
      this.playBuffer(recorded, gain, scope, bus, true)
      // Keep the approved hammer impact's low procedural body beneath the recording, at restrained level.
      if (sound === 'heavy-hit') this.playBuffer(this.syntheticBuffer(sound), gain * .18, scope, bus, false)
      return
    }
    this.playBuffer(this.syntheticBuffer(sound), gain, scope, bus, false)
    if (recording && typeof window !== 'undefined') void this.loadRecording(recording)
  }
  private syntheticBuffer(sound: SoundId) {
    const ctx = this.ctx!
    let buffer = this.buffers.get(sound)
    if (!buffer) {
      const samples = synthesize(sound)
      buffer = ctx.createBuffer(1, samples.length, 24000)
      buffer.getChannelData(0).set(samples)
      this.buffers.set(sound, buffer)
    }
    return buffer
  }
  private playBuffer(buffer: AudioBuffer, gain: number, scope: string, bus: Bus, recorded: boolean) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || this.voices.size + this.nativeVoices.size >= 16) return
    let source: AudioBufferSourceNode | null = null, volume: GainNode | null = null
    try {
      source = ctx.createBufferSource(); volume = ctx.createGain()
      source.buffer = buffer; volume.gain.value = Math.max(0, Math.min(1, gain))
      source.connect(volume); volume.connect(this[bus]!)
      const src = source, vol = volume
      const voice: Voice = { source: src, gain: vol, bus, scope, dispose: () => { src.onended = null; src.disconnect(); vol.disconnect(); this.voices.delete(voice) } }
      src.onended = voice.dispose
      this.voices.add(voice)
      try { src.start(); this.played++; if (recorded) this.playedRecorded++ } catch { voice.dispose() }
    } catch { source?.disconnect(); volume?.disconnect() /* decoration must never throw into input or impact */ }
  }
  private async preloadRecordings() {
    const ids = new Set<RecordedSfxId>()
    for (const sound of ['swing','heavy-swing','steel-hit','heavy-hit','shield-hit','draw','card','reward','room','weapon-draw','door','lock','creak'] as SoundId[]) for (const id of recordingChoices(sound)) ids.add(id)
    await Promise.all([...ids].map(id => this.loadRecording(id)))
  }
  private loadRecording(id: RecordedSfxId): Promise<void> {
    const existing = this.recordingLoads.get(id)
    if (existing) return existing
    const url = recordingUrl(id), ctx = this.ctx, generation = this.generation
    if (!url || !ctx || typeof fetch !== 'function') { this.unavailableRecordings.add(id); return Promise.resolve() }
    const loading = fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Audio asset request failed: ${response.status}`)
      return ctx.decodeAudioData(await response.arrayBuffer())
    }).then(buffer => {
      if (this.ctx === ctx && this.generation === generation) this.recordedBuffers.set(id, buffer)
    }).catch(() => { this.unavailableRecordings.add(id) })
    this.recordingLoads.set(id, loading)
    return loading
  }
  private playNative(sound: SoundId, gain: number, scope: string, bus: Bus) {
    if (this.nativeVoices.size + this.voices.size >= 16 || (!this.dependencies.audio && typeof Audio === 'undefined')) return
    const recording = this.nextRecording(sound)
    const url = recording ? recordingUrl(recording) : undefined
    const mediaUrl = url ?? this.waveDataUrl(synthesize(sound))
    if (!mediaUrl) return
    let element: HTMLAudioElement
    try {
      element = this.dependencies.audio ? this.dependencies.audio()! : new Audio()
      if (!element) return
      element.src = mediaUrl
      element.volume = Math.max(0, Math.min(1, gain * this.settings[bus]))
      const voice: NativeVoice = { element, url: url ? undefined : mediaUrl, bus, scope, dispose: () => { element.onended = null; element.onerror = null; element.pause(); element.removeAttribute('src'); this.nativeVoices.delete(voice); if (voice.url) URL.revokeObjectURL(voice.url) } }
      element.onended = voice.dispose
      element.onerror = voice.dispose
      this.nativeVoices.add(voice)
      void element.play().then(() => { this.played++; if (url) this.playedRecorded++ }).catch(voice.dispose)
    } catch { /* AudioElement playback can also be unavailable in embedded browsers. */ }
  }
  private waveDataUrl(samples: Float32Array): string | undefined {
    try {
      const header = new ArrayBuffer(44), view = new DataView(header), data = new Int16Array(samples.length)
      const write = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)) }
      write(0,'RIFF'); view.setUint32(4,36 + data.byteLength,true); write(8,'WAVE'); write(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,24000,true); view.setUint32(28,48000,true); view.setUint16(32,2,true); view.setUint16(34,16,true); write(36,'data'); view.setUint32(40,data.byteLength,true)
      for (let i = 0; i < samples.length; i++) data[i] = Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767)
      return URL.createObjectURL(new Blob([header, data], { type: 'audio/wav' }))
    } catch { return undefined }
  }
  private stopNativeVoices(bus?: Bus) { for (const voice of [...this.nativeVoices]) if (!bus || voice.bus === bus) voice.dispose() }

  /** Sets one desired music stream. Repeated state updates with the same ID never restart the track. */
  setMusic(request: MusicRequest) {
    const next = { track: request.track, ...(request.resumeAfter !== undefined ? { resumeAfter: request.resumeAfter } : {}) }
    // A screen change after victory updates the return destination without cutting the one-shot fanfare short.
    if (this.activeMusic === 'music-victory-fanfare-short' && next.track !== 'music-victory-fanfare-short') {
      this.musicRequest = { track: 'music-victory-fanfare-short', resumeAfter: next.track }
      return
    }
    if (this.musicRequest?.track === next.track && this.musicRequest?.resumeAfter === next.resumeAfter) return
    this.musicRequest = next
    this.syncMusic()
  }
  private ensureMusicElement() {
    if (this.musicElement) return
    const element = this.dependencies.audio ? this.dependencies.audio() : typeof Audio === 'undefined' ? null : new Audio()
    if (!element) return
    this.musicElement = element
    element.preload = 'none'
    element.loop = false // Every loop passes through a short silence ramp to suppress a hard file seam.
    element.addEventListener('timeupdate', this.onMusicTime)
    element.addEventListener('ended', this.onMusicEnded)
    element.addEventListener('error', this.onMusicError)
    if (this.ctx && this.musicBus) {
      try {
        this.musicSource = this.ctx.createMediaElementSource(element)
        this.musicTrackGain = this.ctx.createGain()
        this.musicTrackGain.gain.value = 0
        this.musicSource.connect(this.musicTrackGain)
        this.musicTrackGain.connect(this.musicBus)
      } catch { this.musicSource = null; this.musicTrackGain = null /* Native element volume is a safe fallback. */ }
    }
    this.applyMusicVolume()
  }
  private syncMusic() {
    if (!this.unlocked || this.hidden || this.settings.muted) return
    this.ensureMusicElement()
    const element = this.musicElement, next = this.musicRequest?.track ?? null
    if (!element) return
    if (next === this.activeMusic) {
      if (next && element.paused) {
        void element.play().then(() => { this.fadeMusic(1, 240) }).catch(() => {})
      }
      return
    }
    const generation = ++this.musicGeneration
    this.cancelMusicFade()
    if (!this.activeMusic || element.paused) { this.startMusic(next, generation); return }
    this.musicTransitionTimer = setTimeout(() => {
      this.musicTransitionTimer = undefined
      this.fadeMusic(0, 260, () => {
        if (generation !== this.musicGeneration) return
        element.pause()
        this.activeMusic = null
        this.startMusic(next, generation)
      })
    }, 0)
  }
  private startMusic(track: MusicTrackId | null, generation: number) {
    const element = this.musicElement
    if (!element || generation !== this.musicGeneration) return
    this.cancelMusicFade()
    element.pause()
    this.loopFadeStarted = false
    if (!track) {
      this.activeMusic = null
      this.fadeMusic(0, 180)
      return
    }
    const url = musicTrackUrl(track)
    if (!url) { this.activeMusic = null; return }
    this.activeMusic = track
    this.musicTrim = musicTracks[track].trim
    this.musicEnvelope = 0
    if (this.musicTrackGain && this.ctx) {
      this.musicTrackGain.gain.cancelScheduledValues(this.ctx.currentTime)
      this.musicTrackGain.gain.setValueAtTime(0, this.ctx.currentTime)
    }
    element.src = url
    element.preload = 'none'
    element.loop = false
    try { element.load() } catch { /* load() is optional on test doubles and embedded media elements. */ }
    this.applyMusicVolume()
    void element.play().then(() => {
      if (generation === this.musicGeneration && this.activeMusic === track) this.fadeMusic(1, 520)
    }).catch(() => {
      if (generation === this.musicGeneration) { this.activeMusic = null; this.musicEnvelope = 0; this.applyMusicVolume() }
    })
  }
  private fadeMusic(target: number, milliseconds: number, done?: () => void) {
    this.cancelMusicFade()
    const from = this.musicEnvelope
    if (milliseconds <= 0 || from === target) { this.musicEnvelope = target; this.applyMusicVolume(); done?.(); return }
    if (this.musicTrackGain && this.ctx) {
      const param = this.musicTrackGain.gain, now = this.ctx.currentTime
      param.cancelScheduledValues(now)
      param.setValueAtTime(this.musicTrim * from, now)
      param.linearRampToValueAtTime(this.musicTrim * target, now + milliseconds / 1000)
      this.musicFadeTimer = setTimeout(() => {
        this.musicFadeTimer = undefined
        this.musicEnvelope = target
        this.applyMusicVolume()
        done?.()
      }, milliseconds)
      return
    }
    const started = performance.now()
    this.musicFadeTimer = setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / milliseconds)
      this.musicEnvelope = from + (target - from) * progress
      this.applyMusicVolume()
      if (progress >= 1) {
        this.cancelMusicFade()
        this.musicEnvelope = target
        done?.()
      }
    }, 20)
  }
  private applyMusicVolume() {
    if (this.musicTrackGain && this.ctx) {
      if (!this.musicFadeTimer) this.musicTrackGain.gain.value = this.musicTrim * this.musicEnvelope
      return
    }
    if (this.musicElement) this.musicElement.volume = this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.music * this.musicTrim * this.musicEnvelope))
  }
  private cancelMusicFade() {
    if (this.musicFadeTimer !== undefined) { clearTimeout(this.musicFadeTimer); clearInterval(this.musicFadeTimer); this.musicFadeTimer = undefined }
    if (this.musicTransitionTimer !== undefined) { clearTimeout(this.musicTransitionTimer); this.musicTransitionTimer = undefined }
    if (this.musicTrackGain && this.ctx) {
      const param = this.musicTrackGain.gain, now = this.ctx.currentTime, current = param.value
      param.cancelScheduledValues(now)
      param.setValueAtTime(current, now)
      this.musicEnvelope = this.musicTrim ? Math.max(0, Math.min(1, current / this.musicTrim)) : 0
    }
  }
  private onMusicTime = () => {
    const element = this.musicElement
    if (!element || !this.activeMusic || !musicTracks[this.activeMusic].loop || this.loopFadeStarted || !Number.isFinite(element.duration)) return
    if (element.duration - element.currentTime <= .75) {
      this.loopFadeStarted = true
      this.fadeMusic(0, 320)
    }
  }
  private onMusicEnded = () => {
    const track = this.activeMusic, element = this.musicElement
    if (!track || !element || this.hidden) return
    if (track === 'music-victory-fanfare-short') {
      const resumeAfter = this.musicRequest?.track === track ? this.musicRequest.resumeAfter : null
      if (resumeAfter) { this.activeMusic = null; this.musicEnvelope = 0; this.setMusic({ track: resumeAfter }); return }
    }
    if (!musicTracks[track].loop) { this.activeMusic = null; this.musicEnvelope = 0; this.applyMusicVolume(); return }
    this.loopFadeStarted = false
    element.currentTime = 0
    this.musicEnvelope = 0
    if (this.musicTrackGain && this.ctx) this.musicTrackGain.gain.value = 0
    this.applyMusicVolume()
    const generation = this.musicGeneration
    void element.play().then(() => { if (generation === this.musicGeneration) this.fadeMusic(1, 420) }).catch(() => {})
  }
  private onMusicError = () => { this.activeMusic = null; this.musicEnvelope = 0; this.applyMusicVolume() }
  stopScope(scope: string) { for (const voice of [...this.voices]) if (voice.scope === scope) this.stop(voice); for (const voice of [...this.nativeVoices]) if (voice.scope === scope) voice.dispose() }
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
    if (hidden) {
      this.clearAmbientTimer(); this.stopVoices(); this.stopNativeVoices(); this.cancelMusicFade()
      this.musicElement?.pause()
    } else {
      this.ensureAmbient()
      if (this.unlocked) void this.unlock()
    }
  }
  stats() { return { sources: this.voices.size + this.nativeVoices.size, ambientSources: [...this.voices].filter(v => v.bus === 'ambience').length, ambientTimers: this.ambientTimer === undefined ? 0 : 1, buffers: this.buffers.size + this.recordedBuffers.size, recordedBuffers: this.recordedBuffers.size, contexts: this.ctx ? 1 : 0, unlocked: this.unlocked, unavailable: this.unavailable, hidden: this.hidden, profile: this.ambient, played: this.played, playedRecorded: this.playedRecorded, proceduralSoundIds: [...this.buffers.keys()], musicTrack: this.activeMusic, musicRequested: this.musicRequest?.track ?? null, musicPlaying: !!this.musicElement && !this.musicElement.paused, musicPlayers: this.musicElement && !this.musicElement.paused ? 1 : 0, musicTime: this.musicElement?.currentTime ?? 0, musicGain: this.settings.muted ? 0 : this.settings.music * this.musicTrim * this.musicEnvelope } }
  dispose() {
    this.generation++
    this.musicGeneration++
    this.clearAmbientTimer(); this.stopVoices(); this.ambient = null
    this.stopNativeVoices(); this.cancelMusicFade()
    if (this.musicElement) {
      this.musicElement.pause()
      this.musicElement.removeEventListener('timeupdate', this.onMusicTime)
      this.musicElement.removeEventListener('ended', this.onMusicEnded)
      this.musicElement.removeEventListener('error', this.onMusicError)
      this.musicElement.removeAttribute('src')
    }
    this.musicSource?.disconnect(); this.musicTrackGain?.disconnect()
    this.effects?.disconnect(); this.ambience?.disconnect(); this.musicBus?.disconnect(); this.compressor?.disconnect()
    void this.ctx?.close().catch(() => {})
    this.ctx = null; this.effects = this.ambience = this.musicBus = null; this.compressor = null
    this.musicElement = null; this.musicSource = null; this.musicTrackGain = null; this.activeMusic = null
    this.buffers.clear(); this.recordedBuffers.clear(); this.recordingLoads.clear(); this.unavailableRecordings.clear(); this.cooldown.clear(); this.unlocked = false
  }
}

export const gameAudio = new GameAudio()
