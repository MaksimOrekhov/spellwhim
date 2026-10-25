import type { SoundId } from './cues'

interface Timbre { seconds: number; hz: number; end?: number; noise: number; metal?: boolean; attack?: number; air?: boolean }
const timbres: Record<SoundId, Timbre> = {
  swing: { seconds: .19, hz: 210, end: 70, noise: .85 }, 'heavy-swing': { seconds: .28, hz: 145, end: 36, noise: .9 },
  'steel-hit': { seconds: .32, hz: 380, end: 260, noise: .5, metal: true }, 'heavy-hit': { seconds: .48, hz: 115, end: 45, noise: .72, metal: true },
  'shield-hit': { seconds: .34, hz: 180, noise: .4, metal: true },
  'fire-launch': { seconds: .37, hz: 95, end: 210, noise: .95, attack: .05 }, 'fire-hit': { seconds: .52, hz: 100, end: 28, noise: 1 },
  'frost-launch': { seconds: .4, hz: 1350, end: 520, noise: .55, attack: .05 }, 'frost-hit': { seconds: .4, hz: 1950, end: 850, noise: .5, metal: true },
  lightning: { seconds: .22, hz: 110, end: 55, noise: 1, metal: true },
  'arcane-launch': { seconds: .28, hz: 320, end: 630, noise: .2, attack: .04 }, 'arcane-hit': { seconds: .65, hz: 440, end: 360, noise: .16, metal: true },
  'steel-guard': { seconds: .4, hz: 270, noise: .22, metal: true }, 'magic-guard': { seconds: .65, hz: 610, end: 810, noise: .13, metal: true, attack: .07 },
  block: { seconds: .48, hz: 720, noise: .26, metal: true }, 'armor-break': { seconds: .42, hz: 370, end: 115, noise: .82, metal: true },
  bleed: { seconds: .16, hz: 90, end: 48, noise: .9 }, 'ice-crack': { seconds: .46, hz: 2470, end: 770, noise: .8, metal: true },
  'ice-form': { seconds: .48, hz: 940, end: 1470, noise: .3, metal: true, attack: .04 }, interrupt: { seconds: .55, hz: 580, end: 65, noise: .5, metal: true },
  draw: { seconds: .16, hz: 710, end: 970, noise: .75, attack: .025 }, gather: { seconds: .6, hz: 75, end: 115, noise: .3, attack: .12 },
  victory: { seconds: 1.25, hz: 392, noise: .08, metal: true, attack: .02 }, defeat: { seconds: 1.3, hz: 155, end: 73, noise: .17, metal: true, attack: .07 },
  card: { seconds: .1, hz: 420, end: 580, noise: .75 }, turn: { seconds: .2, hz: 235, end: 170, noise: .25, metal: true },
  reward: { seconds: .7, hz: 740, noise: .08, metal: true }, room: { seconds: .18, hz: 160, end: 90, noise: .62 },
  'weapon-draw': { seconds: .3, hz: 270, end: 120, noise: .75, metal: true }, door: { seconds: .55, hz: 105, end: 70, noise: .65 }, lock: { seconds: .28, hz: 430, end: 180, noise: .55, metal: true },
  'mine-air': { seconds: 7, hz: 43, noise: .95, attack: 1.6, air: true },
  'crystal-air': { seconds: 8, hz: 148, noise: .6, attack: 2, air: true },
  'forge-air': { seconds: 7, hz: 56, noise: 1, attack: 1.5, air: true },
  creak: { seconds: 1.3, hz: 145, end: 90, noise: .45, metal: true, attack: .15 },
  'distant-metal': { seconds: 1.8, hz: 310, noise: .1, metal: true },
  'crystal-chime': { seconds: 2.4, hz: 1174, noise: .06, metal: true, attack: .04 },
  embers: { seconds: 1.4, hz: 80, noise: 1, attack: .05 },
}

/** Original offline synthesis. One cached mono buffer per timbre, no live oscillators or external assets. */
export function synthesize(sound: SoundId, sampleRate = 24000): Float32Array {
  const t = timbres[sound]
  const data = new Float32Array(Math.ceil(t.seconds * sampleRate))
  let seed = [...sound].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17)
  let phase = 0, low = 0, previous = 0
  for (let i = 0; i < data.length; i++) {
    const seconds = i / sampleRate, p = seconds / t.seconds
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    const white = (seed >>> 0) / 2147483648 - 1
    low += (white - low) * (t.air ? .018 : .24)
    const high = white - previous; previous = white
    let hz = t.hz + ((t.end ?? t.hz) - t.hz) * p
    if (sound === 'victory') hz *= p < .22 ? 1 : p < .45 ? 1.25 : 1.5
    if (sound === 'reward') hz *= p < .3 ? 1 : 1.5
    if (sound === 'creak') hz *= 1 + .06 * Math.sin(seconds * 37)
    phase += Math.PI * 2 * hz / sampleRate
    const tone = Math.sin(phase) * .55 + Math.sin(phase * (t.metal ? 2.756 : 2)) * .28 * Math.exp(-p * 5) + Math.sin(phase * (t.metal ? 5.405 : 3)) * .17 * Math.exp(-p * 9)
    const noise = t.air ? low * 3.5 : sound.includes('ice') || sound === 'lightning' ? high * .5 * (.5 + .5 * Math.sin(seconds * 170)) : low * 1.8
    const attack = Math.min(1, seconds / (t.attack ?? .004))
    const envelope = t.air ? Math.sin(Math.PI * p) ** 2 : attack * Math.exp(-p * 5.5) * Math.min(1, (1 - p) * 20)
    data[i] = Math.tanh((tone * (1 - Math.min(.95, t.noise)) + noise * t.noise) * 1.2) * envelope * .65
  }
  return data
}
