// Fonts are declared once in CSS (assets/fonts.css, tokens in assets/tokens.css). Canvas consumers (PixiJS text, measureText)
// need the resolved family string and the faces to be loaded; these helpers keep that in one place.
const fallback = { '--font-display': "'El Messiri', Georgia, serif", '--font-ui': "'Nunito', 'Segoe UI', sans-serif", '--font-num': "'Rubik', 'Nunito', sans-serif" } as const

export type FontToken = keyof typeof fallback

/** Resolved CSS font-family for a font token, e.g. for new Text({ style: { fontFamily } }). */
export function fontFamily(token: FontToken): string {
  if (typeof document === 'undefined') return fallback[token]
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback[token]
}

/** Starts loading the faces the first screen needs; resolves when they are ready or after `timeoutMs` (never blocks the game for long). */
export function preloadFonts(timeoutMs = 1500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  const faces = ['700 24px "El Messiri"', '600 24px "El Messiri"', '500 16px "Nunito"', '800 16px "Nunito"', '800 24px "Rubik"']
  const loading = Promise.all(faces.map(face => document.fonts.load(face, 'Аа Яя 0123456789'))).then(() => undefined, () => undefined)
  return Promise.race([loading, new Promise<void>(resolve => window.setTimeout(resolve, timeoutMs))])
}
