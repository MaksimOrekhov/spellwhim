export type MusicTrackId = 'music-town-theme' | 'music-cave-theme' | 'music-battle-theme' | 'music-bossfight' | 'music-victory-fanfare-short'

export interface MusicRequest {
  track: MusicTrackId | null
  /** A one-shot result theme returns to this screen bed if the player leaves it alone. */
  resumeAfter?: MusicTrackId | null
}

export type MusicScreen = 'menu' | 'map' | 'battle' | 'complete'

export interface MusicContext {
  screen: MusicScreen
  encounterId?: string
  result?: 'victory' | 'defeat' | null
  finalBattle?: boolean
}

/** Pure presentation choice: stable encounter identity selects the boss theme, never the hidden prepared action. */
export function musicForContext(context: MusicContext): MusicRequest {
  if (context.result === 'victory') {
    return { track: 'music-victory-fanfare-short', resumeAfter: context.finalBattle ? 'music-town-theme' : 'music-cave-theme' }
  }
  if (context.result === 'defeat') return { track: null }
  if (context.screen === 'menu' || context.screen === 'complete') return { track: 'music-town-theme' }
  if (context.screen === 'battle') return {
    track: context.encounterId === 'old-mines-rhahk-zor' ? 'music-bossfight' : 'music-battle-theme',
  }
  return { track: 'music-cave-theme' }
}

export interface MusicTrack {
  id: MusicTrackId
  title: string
  author: string
  file: string
  /** Per-track headroom trim after comparing measured source RMS/peaks. */
  trim: number
  loop: boolean
}

export const musicTracks: Record<MusicTrackId, MusicTrack> = {
  'music-town-theme': { id: 'music-town-theme', title: 'Town Theme RPG', author: 'cynicmusic', file: 'town-theme.mp3', trim: .88, loop: true },
  'music-cave-theme': { id: 'music-cave-theme', title: 'Cave Theme', author: 'Brandon75689', file: 'cave-theme.ogg', trim: .78, loop: true },
  'music-battle-theme': { id: 'music-battle-theme', title: 'Battle Theme', author: 'Wolfgang_', file: 'battle-theme.mp3', trim: .86, loop: true },
  'music-bossfight': { id: 'music-bossfight', title: 'Bossfight_', author: 'G_P', file: 'bossfight.mp3', trim: .52, loop: true },
  'music-victory-fanfare-short': { id: 'music-victory-fanfare-short', title: 'Victory Fanfare Short', author: 'cynicmusic', file: 'victory-fanfare-cynic.wav', trim: .82, loop: false },
}

const musicUrls = import.meta.glob('./assets/music/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export function musicTrackUrl(id: MusicTrackId): string | undefined {
  return musicUrls[`./assets/music/${musicTracks[id].file}`]
}
