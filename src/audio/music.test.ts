import { describe, expect, it } from 'vitest'
import { musicForContext } from './music'

describe('music selection follows the visible game phase', () => {
  it('uses the town theme for menu and complete screens, and the cave theme across map services', () => {
    expect(musicForContext({ screen: 'menu' })).toEqual({ track: 'music-town-theme' })
    expect(musicForContext({ screen: 'complete' })).toEqual({ track: 'music-town-theme' })
    for (const screen of ['map'] as const) expect(musicForContext({ screen })).toEqual({ track: 'music-cave-theme' })
  })

  it('uses Battle Theme for regular/elite fights and keeps the boss theme stable across Rak’Zor phases', () => {
    expect(musicForContext({ screen: 'battle', encounterId: 'old-mines-raider' })).toEqual({ track: 'music-battle-theme' })
    expect(musicForContext({ screen: 'battle', encounterId: 'old-mines-johnson' })).toEqual({ track: 'music-battle-theme' })
    const phaseOne = musicForContext({ screen: 'battle', encounterId: 'old-mines-rhahk-zor' })
    const phaseTwo = musicForContext({ screen: 'battle', encounterId: 'old-mines-rhahk-zor' })
    expect(phaseOne).toEqual({ track: 'music-bossfight' })
    expect(phaseTwo).toEqual(phaseOne)
  })

  it('plays one fanfare on victory and no victory theme on defeat', () => {
    expect(musicForContext({ screen: 'battle', result: 'victory', finalBattle: false })).toEqual({ track: 'music-victory-fanfare-short', resumeAfter: 'music-cave-theme' })
    expect(musicForContext({ screen: 'battle', result: 'victory', finalBattle: true })).toEqual({ track: 'music-victory-fanfare-short', resumeAfter: 'music-town-theme' })
    expect(musicForContext({ screen: 'battle', result: 'defeat' })).toEqual({ track: null })
  })
})
