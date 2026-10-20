/** Independent deterministic stream identity; never consumes another system's RNG. */
export function deriveDungeonSeed(seed: number, scope: string): number {
  let hash = 0x811c9dc5 ^ (seed >>> 0)
  for (const character of scope) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
