import catalog from '../../docs/audio/candidates.json'

export type Rating = 'like' | 'maybe' | 'nope'
type JsonAsset = typeof catalog.assets[number]
export type LibraryAsset = Omit<JsonAsset, 'durationSeconds' | 'bpm' | 'rmsDbfs' | 'peakDbfs'> & {
  durationSeconds: number | null
  bpm: number | null
  rmsDbfs: number | null
  peakDbfs: number | null
}
export const audioCandidates: LibraryAsset[] = catalog.assets
export const libraryAudioUrls = import.meta.glob('./candidate-assets/**/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export const libraryAudioUrl = (asset: LibraryAsset) => {
  const relativePath = asset.localPath.replace('src/audio/candidate-assets/', '')
  return libraryAudioUrls[`./candidate-assets/${relativePath}`]
}

export const audioRatingKey = 'spellwhim.audio-library.ratings.v1'

export function readRatings(storage: Pick<Storage, 'getItem'> | undefined): Record<string, Rating> {
  try {
    const value = storage?.getItem(audioRatingKey)
    if (!value) return {}
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, Rating] =>
      entry[1] === 'like' || entry[1] === 'maybe' || entry[1] === 'nope'))
  } catch { return {} }
}

export function writeRatings(storage: Pick<Storage, 'setItem'> | undefined, ratings: Record<string, Rating>): boolean {
  try { storage?.setItem(audioRatingKey, JSON.stringify(ratings)); return Boolean(storage) }
  catch { return false }
}
