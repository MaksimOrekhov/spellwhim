import { describe, expect, it } from 'vitest'
import { allBattleBackgrounds, battleBackground, deadminesBackgrounds } from './battleBackground'
import { defaultDungeonRoster } from '../game/encountersV10'
import { expansionElites, knownSectorEncounters } from '../game/sectorLong'
import { rhahkZor, sectorOneElite } from '../game/sectorContent'

describe('battle background', () => {
  it('shows the forge for Rak\'Zor, the crystal mine for the elite and the plain mine for everything else', () => {
    expect(battleBackground(rhahkZor.id).id).toBe('deadmines-rakzor-forge')
    expect(battleBackground(sectorOneElite.id).id).toBe('deadmines-elite-crystal')
    for (const enemy of expansionElites) expect(battleBackground(enemy.id).id, enemy.id).toBe('deadmines-elite-crystal')
    for (const enemy of knownSectorEncounters.filter(item => item.id !== rhahkZor.id && item.id !== sectorOneElite.id && !expansionElites.includes(item))) expect(battleBackground(enemy.id).id, enemy.id).toBe('deadmines-regular')
    for (const enemy of defaultDungeonRoster.normal) expect(battleBackground(enemy.id).id, enemy.id).toBe('deadmines-regular')
  })
  it('follows the encounter ID alone: the node suffix of a campaign battle changes nothing', () => {
    expect(battleBackground(`${rhahkZor.id}/n7`)).toBe(deadminesBackgrounds.boss)
    expect(battleBackground(`${sectorOneElite.id}/n2`)).toBe(deadminesBackgrounds.elite)
  })
  it('falls back to the standard mine for an unknown encounter or sector', () => {
    expect(battleBackground('nobody-here')).toBe(deadminesBackgrounds.normal)
    expect(battleBackground(rhahkZor.id, 'unknown-sector')).toBe(deadminesBackgrounds.normal)
    expect(battleBackground(sectorOneElite.id, 'unknown-sector')).toBe(deadminesBackgrounds.normal)
    expect(battleBackground('', 'unknown-sector')).toBe(deadminesBackgrounds.normal)
  })
  it('has three different painted files with unique ids', () => {
    expect(allBattleBackgrounds).toHaveLength(3)
    expect(new Set(allBattleBackgrounds.map(item => item.id)).size).toBe(3)
    expect(new Set(allBattleBackgrounds.map(item => item.src)).size).toBe(3)
  })
})
