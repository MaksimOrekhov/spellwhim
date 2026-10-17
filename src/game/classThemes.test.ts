import { describe, expect, it } from 'vitest'
import { cards } from './types'
import { classThemes, getClassTheme } from './classThemes'

describe('card class themes', () => {
  it('provides a matching theme and SVG emblem for every card class in use', () => {
    const classIds = new Set(cards.map(card => card.className))

    for (const classId of classIds) {
      const theme = getClassTheme(classId)
      expect(theme.id).toBe(classId)
      expect(theme.emblem).toMatch(/(?:\.svg(?:\?.*)?|image\/svg\+xml)/)
    }
  })

  it('keeps Warrior and Mage palettes and ornamental shapes distinct', () => {
    expect(classThemes.warrior).toMatchObject({
      primary: '#B95743',
      surface: '#382C2B',
      accent: '#D6A65E',
      secondary: '#515D69',
      ornament: 'angular',
    })
    expect(classThemes.mage).toMatchObject({
      primary: '#426EC2',
      surface: '#252C51',
      accent: '#9171C9',
      secondary: '#81DBED',
      ornament: 'arcane',
    })
  })

  it('fails clearly when a future card class has no visual theme', () => {
    expect(() => getClassTheme('unknown-class' as never)).toThrow('Missing visual theme for card class "unknown-class"')
  })
})
