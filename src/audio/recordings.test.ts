import { describe, expect, it } from 'vitest'
import { createRecordingSelector, recordingChoices } from './recordings'

describe('recorded SFX playback selection', () => {
  it('alternates approved A/B clips without using gameplay randomness', () => {
    const select = createRecordingSelector()
    expect([select('swing'), select('swing'), select('swing')]).toEqual([
      'sfx-rpg-knife-slice-a', 'sfx-rpg-knife-slice-b', 'sfx-rpg-knife-slice-a',
    ])
    expect([select('steel-hit'), select('shield-hit'), select('steel-hit')]).toEqual([
      'sfx-fantasy-sword-clash-a', 'sfx-fantasy-sword-clash-b', 'sfx-fantasy-sword-clash-a',
    ])
    expect(recordingChoices('fire-hit')).toEqual([])
  })
})
