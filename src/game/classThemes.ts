import type { CSSProperties } from 'vue'
import warriorEmblem from '../assets/art/warrior-class-sword-clash.svg'
import mageEmblem from '../assets/art/mage-class-wizard-staff.svg'
import type { CardClassId } from './types'

export interface ClassTheme {
  id: string
  name: string
  label: string
  primary: string
  surface: string
  accent: string
  secondary: string
  emblem: string
  ornament: 'angular' | 'arcane'
  artDirection: string
}

export const classThemes = {
  warrior: {
    id: 'warrior',
    name: 'Воин',
    label: 'ВОИН',
    primary: '#B95743',
    surface: '#382C2B',
    accent: '#D6A65E',
    secondary: '#515D69',
    emblem: warriorEmblem,
    ornament: 'angular',
    artDirection: 'Steel & Ember',
  },
  mage: {
    id: 'mage',
    name: 'Маг',
    label: 'МАГ',
    primary: '#426EC2',
    surface: '#252C51',
    accent: '#9171C9',
    secondary: '#81DBED',
    emblem: mageEmblem,
    ornament: 'arcane',
    artDirection: 'Arcane & Wonder',
  },
} as const satisfies Record<string, ClassTheme>

export function getClassTheme(classId: CardClassId): ClassTheme {
  const theme = classThemes[classId as keyof typeof classThemes]
  if (!theme) throw new Error(`Missing visual theme for card class "${classId}"`)
  return theme
}

export function classThemeStyle(classId: CardClassId): CSSProperties {
  const theme = getClassTheme(classId)
  return {
    '--class-primary': theme.primary,
    '--class-surface': theme.surface,
    '--class-accent': theme.accent,
    '--class-secondary': theme.secondary,
  } as CSSProperties
}
