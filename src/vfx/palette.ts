import type { School } from './types'

/** Colours of the effects. Presentation constants of the canvas (classes keep their own theme in game/classThemes.ts). */
export interface Palette { core: number; mid: number; deep: number; spark: number; accent: number }

export const palettes: Record<School, Palette> = {
  physical: { core: 0xfff6dc, mid: 0xffc66e, deep: 0xffa642, spark: 0xe6eef7, accent: 0xffe7a8 },
  fire: { core: 0xfff3c4, mid: 0xffa23a, deep: 0xff5b1e, spark: 0xffd477, accent: 0xb45aff },
  frost: { core: 0xf2feff, mid: 0x8fe6ff, deep: 0x3aa4ee, spark: 0xcff6ff, accent: 0xffffff },
  lightning: { core: 0xffffff, mid: 0xfff06a, deep: 0x79a8ff, spark: 0xfff59a, accent: 0xa77bff },
  arcane: { core: 0xf6e8ff, mid: 0xc08cff, deep: 0x7a46e0, spark: 0xe6c8ff, accent: 0x7fe3ff },
  blood: { core: 0xffd0d0, mid: 0xff4a60, deep: 0xa51430, spark: 0xff8a8a, accent: 0xb57bff },
}

export const palette = {
  steel: 0xdfe8f2, steelMid: 0xa4b4c8, steelDark: 0x66758a, bronze: 0xc98f3a, gold: 0xffd27c, goldHot: 0xfff1c4,
  vuln: 0xffc24a, vulnDeep: 0xff7a1f,
  blood: 0xe0243c, bloodLight: 0xff8a8a, bloodDeep: 0x7a0f20,
  frost: 0xcff6ff, frostMid: 0x7fe3ff, frostDeep: 0x2f9be8,
  arcane: 0xe6c8ff, arcaneMid: 0xb57bff, arcaneDeep: 0x6b3bd6,
  magma: 0xff8a3a, magmaDeep: 0xd8340f, ember: 0xffc15a, stone: 0xb8a58a, stoneDark: 0x6b5a46, dust: 0xcdbb9f,
  enemy: 0xff8a5c, enemyDeep: 0xc4361c, plate: 0xc9b79b, plateDark: 0x7c6a52,
  rage: 0xff7a3a,
}
