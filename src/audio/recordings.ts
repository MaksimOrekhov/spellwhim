import type { SoundId } from './cues'

export type RecordedSfxId =
  | 'sfx-rpg-draw-knife' | 'sfx-rpg-knife-slice-a' | 'sfx-rpg-knife-slice-b'
  | 'sfx-rpg-metal-click' | 'sfx-rpg-metal-latch' | 'sfx-rpg-door-open' | 'sfx-rpg-book-flip' | 'sfx-rpg-coin-handling'
  | 'sfx-fantasy-sword-clash-a' | 'sfx-fantasy-sword-clash-b' | 'sfx-fantasy-hammer-hit-a' | 'sfx-fantasy-hammer-hit-b'
  | 'sfx-fantasy-book-page' | 'sfx-fantasy-coins' | 'sfx-fantasy-floor-creak' | 'sfx-fantasy-lock-turn'
  | 'sfx-fantasy-whoosh-a' | 'sfx-fantasy-whoosh-b'

const choices: Partial<Record<SoundId, readonly RecordedSfxId[]>> = {
  swing: ['sfx-rpg-knife-slice-a', 'sfx-rpg-knife-slice-b'],
  'heavy-swing': ['sfx-fantasy-whoosh-a', 'sfx-fantasy-whoosh-b'],
  'steel-hit': ['sfx-fantasy-sword-clash-a', 'sfx-fantasy-sword-clash-b'],
  'heavy-hit': ['sfx-fantasy-hammer-hit-a', 'sfx-fantasy-hammer-hit-b'],
  'shield-hit': ['sfx-fantasy-sword-clash-a', 'sfx-fantasy-sword-clash-b'],
  draw: ['sfx-rpg-book-flip'],
  card: ['sfx-fantasy-book-page'],
  reward: ['sfx-rpg-coin-handling', 'sfx-fantasy-coins'],
  room: ['sfx-rpg-metal-click'],
  'weapon-draw': ['sfx-rpg-draw-knife'],
  door: ['sfx-rpg-door-open'],
  lock: ['sfx-rpg-metal-latch', 'sfx-fantasy-lock-turn'],
  creak: ['sfx-fantasy-floor-creak'],
}

const soundUrls = import.meta.glob('./assets/sfx/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export function recordingChoices(sound: SoundId): readonly RecordedSfxId[] {
  return choices[sound] ?? []
}

/** Alternates only playback assets; it has no access to the battle seed or deterministic engine RNG. */
export function createRecordingSelector() {
  const counters = new Map<string, number>()
  return (sound: SoundId): RecordedSfxId | undefined => {
    const variants = recordingChoices(sound)
    if (!variants.length) return undefined
    const group = sound === 'steel-hit' || sound === 'shield-hit' ? 'steel-contact' : sound
    const index = counters.get(group) ?? 0
    counters.set(group, index + 1)
    return variants[index % variants.length]
  }
}

export function recordingUrl(id: RecordedSfxId): string | undefined {
  return soundUrls[`./assets/sfx/${recordingFile(id)}`]
}

export function recordingFile(id: RecordedSfxId): string {
  const names: Record<RecordedSfxId, string> = {
    'sfx-rpg-draw-knife': 'rpg-draw-knife.ogg',
    'sfx-rpg-knife-slice-a': 'rpg-knife-slice-a.ogg', 'sfx-rpg-knife-slice-b': 'rpg-knife-slice-b.ogg',
    'sfx-rpg-metal-click': 'rpg-metal-click.ogg', 'sfx-rpg-metal-latch': 'rpg-metal-latch.ogg', 'sfx-rpg-door-open': 'rpg-door-open.ogg',
    'sfx-rpg-book-flip': 'rpg-book-flip.ogg', 'sfx-rpg-coin-handling': 'rpg-coin-handling.ogg',
    'sfx-fantasy-sword-clash-a': 'fantasy-sword-clash-a.wav', 'sfx-fantasy-sword-clash-b': 'fantasy-sword-clash-b.wav',
    'sfx-fantasy-hammer-hit-a': 'fantasy-hammer-hit-a.wav', 'sfx-fantasy-hammer-hit-b': 'fantasy-hammer-hit-b.wav',
    'sfx-fantasy-book-page': 'fantasy-book-page.wav', 'sfx-fantasy-coins': 'fantasy-coins.wav',
    'sfx-fantasy-floor-creak': 'fantasy-floor-creak.wav', 'sfx-fantasy-lock-turn': 'fantasy-lock-turn.wav',
    'sfx-fantasy-whoosh-a': 'fantasy-whoosh-a.wav', 'sfx-fantasy-whoosh-b': 'fantasy-whoosh-b.wav',
  }
  return names[id]
}
