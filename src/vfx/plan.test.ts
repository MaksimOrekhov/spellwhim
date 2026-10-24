import { describe, expect, it } from 'vitest'
import { createBattle, endTurn, forecastEnemyAction, resolveCardPlay, startCardPlay } from '../game/battle'
import { resolveCardDefinition } from '../game/cardProgression'
import { honestEconomies } from '../game/economy'
import { applyStatus } from '../game/statuses'
import { cards, experimentalCards } from '../game/types'
import type { BattleState, CardId, EnemyAction } from '../game/types'
import { cardVfxStyles } from './cardStyles'
import { cardVfxPlan, enemyVfxPlan, weightOf } from './plan'
import { vfxScenario, vfxScenarios } from './scenarios'
import type { Motion, VfxBeat, VfxPlan } from './types'

/** The card plan exactly as the game builds it: from the state after `startCardPlay`, with the pending play in hand. */
function cardPlan(state: BattleState, cardId?: CardId, motion: Motion = 'full') {
  const next = structuredClone(state)
  const started = startCardPlay(next, cardId ? next.hand.find(item => item.definitionId === cardId)!.instanceId : next.hand[0]!.instanceId)
  if (!started.ok) throw new Error('Cannot play: ' + started.reason)
  const plan = cardVfxPlan({ card: resolveCardDefinition(started.play.card), play: started.play, state: next, motion })
  return { plan, state: next, play: started.play }
}
const scene = (id: string) => vfxScenario(id)!.build()
const cardScene = (id: string) => cardPlan(scene(id))
const enemyPlan = (state: BattleState, motion: Motion = 'full') => enemyVfxPlan({ state, forecast: forecastEnemyAction(state), motion })

type Of<K extends VfxBeat['kind']> = Extract<VfxBeat, { kind: K }>
const only = <K extends VfxBeat['kind']>(plan: VfxPlan, kind: K): Of<K>[] => plan.beats.filter((beat): beat is Of<K> => beat.kind === kind)
const numbers = (plan: VfxPlan) => only(plan, 'number')
const texts = (plan: VfxPlan) => numbers(plan).map(item => item.text)
/** Health a plan names on a portrait: the plain `−N` labels of the given tones. */
const named = (plan: VfxPlan, anchor: string, tones: string[]) => numbers(plan).filter(entry => entry.anchor === anchor && tones.includes(entry.tone) && /^−\d+$/.test(entry.text)).reduce((sum, entry) => sum + Number(entry.text.slice(1)), 0)
const statusBeats = (plan: VfxPlan, status: string, mode: string) => only(plan, 'status').filter(beat => beat.status === status && beat.mode === mode)

describe('card effects follow the card, not its kind', () => {
  it('gives Fireball and Frostbolt different effects', () => {
    const fire = cardScene('fireball').plan
    const frost = cardScene('frostbolt').plan
    expect(only(fire, 'strike')[0]).toMatchObject({ style: 'fireball', school: 'fire', from: 'mage', to: 'enemy' })
    expect(only(frost, 'strike')[0]).toMatchObject({ style: 'frostbolt', school: 'frost', from: 'mage', to: 'enemy' })
    expect(fire.scenario).not.toBe(frost.scenario)
  })

  it('draws Thunderbolt as lightning, and faster than a Fireball', () => {
    const bolt = cardScene('thunderbolt').plan
    const fire = cardScene('fireball').plan
    expect(only(bolt, 'strike')[0]).toMatchObject({ style: 'lightning', school: 'lightning' })
    expect(bolt.impactMs).toBeLessThan(fire.impactMs)
    expect(only(bolt, 'draw')).toHaveLength(1)
  })

  it('shows no attacking projectile for a card that deals no damage', () => {
    for (const id of ['arcane-insight', 'arcane-mark', 'boil-blood', 'frost-seal']) {
      const { plan, play } = cardScene(id)
      expect(play.preview.damage, id).toBe(0)
      expect(only(plan, 'strike'), id).toHaveLength(0)
      expect(only(plan, 'result'), id).toHaveLength(0)
    }
    const insight = cardScene('arcane-insight').plan
    expect(only(insight, 'rune')[0]).toMatchObject({ sigil: 'insight', anchor: 'mage' })
    expect(only(insight, 'draw')).toHaveLength(1)
    // a card that does not hit moves no portrait
    expect(insight.reaction).toEqual({})
  })

  it('draws a heavy blow wider than a normal one, and a quick cut narrower', () => {
    expect(only(cardScene('sword-strike').plan, 'strike')[0]).toMatchObject({ style: 'slash', weight: 'normal' })
    expect(only(cardScene('quick-cut').plan, 'strike')[0]).toMatchObject({ style: 'lunge', weight: 'light' })
    expect(only(cardScene('crushing-swing').plan, 'strike')[0]).toMatchObject({ style: 'cleave', weight: 'heavy' })
    expect(only(cardScene('shield-bash').plan, 'strike')[0]).toMatchObject({ style: 'bash' })
    expect(cardScene('quick-cut').plan.impactMs).toBeLessThan(cardScene('sword-strike').plan.impactMs)
    expect(cardScene('sword-strike').plan.impactMs).toBeLessThan(cardScene('crushing-swing').plan.impactMs)
  })

  it('upgrades a plain swing to a cleave when the engine says the hit is big enough', () => {
    const state = scene('sword-strike')
    applyStatus(state, 'enemy', 'vulnerability')
    const { plan, play } = cardPlan(state)
    expect(play.preview.damage).toBe(9)
    expect(only(plan, 'strike')[0]).toMatchObject({ style: 'cleave', weight: 'heavy' })
    expect(only(cardScene('sword-strike').plan, 'strike')[0]!.style).toBe('slash')
  })

  it('tells the schools of defensive cards apart and gives each hero its own shield', () => {
    expect(only(cardScene('guard').plan, 'guard').map(beat => beat.style)).toEqual(['steel'])
    expect(only(cardScene('ice-ward').plan, 'guard').map(beat => beat.style)).toEqual(['frost', 'frost'])
    const bastion = only(cardScene('bastion').plan, 'guard')
    expect(bastion.map(beat => beat.style)).toEqual(['steel', 'steel'])
    expect(new Set(bastion.map(beat => beat.anchor))).toEqual(new Set(['warrior', 'mage']))
    // the shield of a warrior's card is steel even when it lands on the mage
    expect(only(cardScene('interpose').plan, 'guard')[0]).toMatchObject({ style: 'steel', anchor: 'mage' })
    expect(only(cardScene('guard').plan, 'guard')[0]!.style).not.toBe(only(cardScene('ice-ward').plan, 'guard')[0]!.style)
  })

  it('reads the armor each hero receives from the engine, artifacts included', () => {
    const { plan, play } = cardScene('bastion')
    for (const guard of only(plan, 'guard')) expect(texts(plan)).toContain(`+${play.preview.armor[guard.anchor as 'warrior' | 'mage']} брони`)
  })

  it('plays a counterblow with the guard of a defensive card, and only against an attacking enemy', () => {
    const parry = cardScene('parry').plan
    expect(only(parry, 'guard')).toHaveLength(1)
    expect(only(parry, 'strike')[0]).toMatchObject({ style: 'lunge', to: 'enemy' })
    const idle = cardScene('parry-idle')
    expect(idle.play.preview.damage).toBe(0)
    expect(only(idle.plan, 'strike')).toHaveLength(0)
  })

  it('accents a hit the engine says was empowered, and only then', () => {
    const empowered = cardPlan(scene('stance-strike'))
    expect(empowered.play.preview.armorBonus).toBe(2)
    expect(only(empowered.plan, 'strike')[0]!.empowered).toBe(true)
    const plain = cardPlan((() => { const state = scene('stance-strike'); state.heroes.warrior.armor = 0; return state })())
    expect(plain.play.preview.armorBonus).toBe(0)
    expect(only(plain.plan, 'strike')[0]!.empowered).toBeUndefined()
    expect(texts(empowered.plan).some(text => text.endsWith('+2'))).toBe(true)
  })
})

describe('status effects happen only when the engine says the status does', () => {
  it('shatters ice only when Frostbite is really spent', () => {
    const frozen = cardScene('ice-breaker-frost')
    expect(frozen.play.consumedStatuses).toContainEqual({ carrier: 'enemy', id: 'frostbite', amount: 1 })
    expect(statusBeats(frozen.plan, 'frostbite', 'consume')).toHaveLength(1)
    expect(texts(frozen.plan)).toContain('Обморожение +7')
    const plain = cardScene('ice-breaker-plain')
    expect(plain.play.consumedStatuses).toEqual([])
    expect(only(plain.plan, 'status')).toHaveLength(0)
    expect(texts(plain.plan).join(' ')).not.toContain('Обморожение')
  })

  it('shows Vulnerability being put on, spent, and spent then renewed', () => {
    const fresh = cardScene('frostbolt').plan
    expect(statusBeats(fresh, 'vulnerability', 'apply')).toHaveLength(1)
    expect(statusBeats(fresh, 'vulnerability', 'consume')).toHaveLength(0)
    const marked = cardScene('shield-bash-vuln').plan
    expect(statusBeats(marked, 'vulnerability', 'consume')).toHaveLength(1)
    expect(statusBeats(marked, 'vulnerability', 'apply')).toHaveLength(1)
    expect(texts(marked)).toContain('Уязвимость +3')
    const spentOnly = cardPlan((() => { const state = scene('sword-strike'); applyStatus(state, 'enemy', 'vulnerability'); return state })())
    expect(statusBeats(spentOnly.plan, 'vulnerability', 'consume')).toHaveLength(1)
    expect(statusBeats(spentOnly.plan, 'vulnerability', 'apply')).toHaveLength(0)
  })

  it('does not re-announce a status that is already there and does not stack', () => {
    const state = scene('frostbolt')
    applyStatus(state, 'enemy', 'vulnerability')
    // Frostbolt spends the old mark and puts a new one: both are real
    expect(statusBeats(cardPlan(state).plan, 'vulnerability', 'apply')).toHaveLength(1)
    const crowded = scene('arcane-mark')
    applyStatus(crowded, 'enemy', 'vulnerability')
    const { plan, play } = cardPlan(crowded)
    expect(play.consumedStatuses).toEqual([])
    expect(statusBeats(plan, 'vulnerability', 'apply')).toHaveLength(0)
  })

  it('shows Bleeding being applied, spent in a burst, and ticking early, each only when it happens', () => {
    expect(statusBeats(cardScene('rend').plan, 'bleeding', 'apply')).toHaveLength(1)
    const burst = cardScene('reaping-blow')
    expect(statusBeats(burst.plan, 'bleeding', 'burst')).toHaveLength(1)
    expect(texts(burst.plan)).toContain('Кровотечение +6')
    const empty = cardPlan((() => { const state = scene('reaping-blow'); state.statuses.enemy = []; return state })())
    expect(statusBeats(empty.plan, 'bleeding', 'burst')).toHaveLength(0)
    const tick = cardScene('boil-blood')
    expect(tick.play.preview.statusDamage).toBe(3)
    expect(statusBeats(tick.plan, 'bleeding', 'tick')).toHaveLength(1)
    expect(texts(tick.plan)).toContain('−3')
    const none = cardPlan((() => { const state = scene('boil-blood'); state.statuses.enemy = []; return state })())
    expect(none.play.preview.statusDamage).toBe(0)
    expect(statusBeats(none.plan, 'bleeding', 'tick')).toHaveLength(0)
  })

  it('shows enemy armor holding or breaking exactly as the split says', () => {
    const holds = cardScene('sword-vs-armor')
    expect(holds.play.preview.armorDamage).toBe(6)
    expect(only(holds.plan, 'armor-fx')[0]!.mode).toBe('hit')
    const breaks = cardScene('sword-breaks-armor')
    expect(breaks.state.enemy.armor).toBe(4)
    expect(only(breaks.plan, 'armor-fx')[0]!.mode).toBe('break')
    expect(only(cardScene('sword-strike').plan, 'armor-fx')).toHaveLength(0)
    // fully absorbed: no health number, the armor number leads
    const wall = cardPlan((() => { const state = scene('sword-strike'); state.enemy.armor = 8; return state })())
    expect(wall.play.preview.healthDamage).toBe(0)
    expect(numbers(wall.plan).some(item => item.tone === 'damage')).toBe(false)
    expect(wall.plan.reaction).toEqual({})
  })
})

describe('enemy actions', () => {
  it('draws a normal, a heavy and a group attack differently', () => {
    const normal = enemyPlan(scene('enemy-claw'))
    const heavy = enemyPlan(scene('enemy-heavy'))
    const group = enemyPlan(scene('enemy-all'))
    expect(only(normal, 'strike').map(beat => [beat.style, beat.to])).toEqual([['claw', 'warrior']])
    expect(only(heavy, 'strike').map(beat => [beat.style, beat.weight])).toEqual([['slam', 'heavy']])
    expect(only(group, 'strike').map(beat => beat.to).sort()).toEqual(['mage', 'warrior'])
    expect(group.reaction).toEqual({ warrior: 'normal', mage: 'normal' })
  })

  it('reports a group attack once, after the second hit lands', () => {
    const plan = enemyPlan(scene('enemy-all'))
    const strikes = only(plan, 'strike')
    expect(strikes).toHaveLength(2)
    expect(plan.impactMs).toBe(Math.max(...strikes.map(beat => beat.at + beat.landMs)))
  })

  it('separates a full block, a partial block and a hit through armor, and never shows −0', () => {
    const state = scene('enemy-block')
    const block = enemyPlan(state)
    expect(only(block, 'result')[0]).toMatchObject({ outcome: 'block', hero: 'warrior' })
    expect(texts(block)).toContain('БЛОК')
    expect(texts(block).some(text => /^−\d+$/.test(text))).toBe(false)
    expect(block.reaction).toEqual({})
    const partial = enemyPlan(scene('enemy-partial'))
    expect(only(partial, 'result')[0]).toMatchObject({ outcome: 'shatter' })
    expect(texts(partial)).toContain('−2')
    expect(texts(partial)).toContain('−4 брони')
    expect(partial.reaction).toEqual({ warrior: 'light' })
    const direct = enemyPlan(scene('enemy-claw'))
    expect(only(direct, 'result')).toHaveLength(0)
    for (const item of vfxScenarios) {
      const built = item.build()
      const plan = item.run.kind === 'enemy' ? enemyPlan(built) : cardPlan(built).plan
      expect(texts(plan).filter(text => /^[−+-]0(\s|$)/.test(text)), item.id).toEqual([])
    }
  })

  it('draws a piercing blow through armor, not as a block', () => {
    const plan = enemyPlan(scene('enemy-pierce'))
    expect(only(plan, 'strike')[0]).toMatchObject({ style: 'needle', to: 'mage' })
    expect(only(plan, 'result')[0]).toMatchObject({ outcome: 'pierce', hero: 'mage' })
    expect(texts(plan)).toContain('Бронебой')
    // Without armor there is nothing to pierce: an ordinary hit
    const bare = scene('enemy-pierce')
    bare.heroes.mage.armor = 0
    const bareplan = enemyPlan(bare)
    expect(only(bareplan, 'strike')[0]!.style).not.toBe('needle')
    expect(only(bareplan, 'result')).toHaveLength(0)
  })

  it('draws a stopped blow as a break and touches no hero', () => {
    const plan = enemyPlan(scene('enemy-stopped'))
    expect(only(plan, 'break')).toHaveLength(1)
    expect(only(plan, 'strike')).toHaveLength(0)
    expect(only(plan, 'result')).toHaveLength(0)
    expect(plan.reaction).toEqual({})
    expect(texts(plan)).toEqual(['Удар сорван'])
  })

  it('spends Frostbite visibly and shows the weakened blow honestly', () => {
    const plan = enemyPlan(scene('enemy-frost'))
    expect(statusBeats(plan, 'frostbite', 'consume')).toHaveLength(1)
    expect(only(plan, 'strike')[0]!.chilled).toBe(true)
    expect(texts(plan).some(text => text.startsWith('Мороз −'))).toBe(true)
    expect(statusBeats(enemyPlan(scene('enemy-claw')), 'frostbite', 'consume')).toHaveLength(0)
  })

  it('shows a Bleeding tick before the attack, and ends the plan there if the tick is lethal', () => {
    const plan = enemyPlan(scene('enemy-bleed'))
    expect(statusBeats(plan, 'bleeding', 'tick')).toHaveLength(1)
    expect(plan.beats[0]).toMatchObject({ kind: 'status', mode: 'tick' })
    expect(Math.min(...only(plan, 'strike').map(beat => beat.at))).toBeGreaterThan(plan.beats[0]!.at)
    expect(plan.reaction.enemy).toBe('light')
    const dying = scene('enemy-bleed')
    dying.enemy.health = 2
    const lethal = enemyPlan(dying)
    expect(lethal.scenario).toBe('enemy:bleed-out')
    expect(only(lethal, 'strike')).toHaveLength(0)
  })

  it('marks the hero a blow exposes, and spent marks on the hero as a bonus', () => {
    const plan = enemyPlan(scene('enemy-exposes'))
    expect(only(plan, 'status').filter(beat => beat.anchor === 'mage' && beat.status === 'vulnerability' && beat.mode === 'apply')).toHaveLength(1)
    const state = scene('enemy-claw')
    applyStatus(state, 'warrior', 'vulnerability')
    const spent = enemyPlan(state)
    expect(only(spent, 'strike')[0]!.empowered).toBe(true)
    expect(texts(spent)).toContain('Уязвимость +3')
  })

  it('gives Rak’Zor heavier variants than an ordinary enemy', () => {
    const boss = enemyPlan(scene('boss-heavy'))
    const regular = enemyPlan(scene('enemy-heavy'))
    expect(only(boss, 'strike')[0]!.boss).toBe(true)
    expect(only(regular, 'strike')[0]!.boss).toBeUndefined()
    const group = enemyPlan(scene('boss-all'))
    expect(only(group, 'strike').map(beat => [beat.style, beat.boss])).toEqual([['slam', true], ['slam', true]])
    expect(boss.scenario).toContain('boss')
    expect(only(enemyPlan(scene('boss-prepare')), 'gather')[0]!.boss).toBe(true)
  })

  it('shows armor and rage as what they are', () => {
    const defend = enemyPlan(scene('enemy-defend'))
    expect(only(defend, 'guard')[0]).toMatchObject({ style: 'plate', anchor: 'enemy' })
    expect(texts(defend)).toEqual(['+3 брони'])
    const rage = enemyPlan(scene('enemy-rage'))
    expect(statusBeats(rage, 'rage', 'apply')).toHaveLength(1)
    expect(texts(rage)).toContain('Ярость +3')
    const capped = scene('enemy-defend')
    capped.enemy.armor = 8
    expect(texts(enemyPlan(capped))).toEqual(['Броня на пределе'])
  })
})

describe('a preparation hides what the party may not know', () => {
  const prepared = (damage: number, traits: object = {}) => {
    const state = createBattle(undefined, undefined, { seed: 3, economy: honestEconomies['honest-b2'] })
    state.enemy.nextAction = { kind: 'prepare', name: 'Готовится', prepared: { kind: 'attack', name: 'Удар', damage, target: 'warrior', ...traits } as EnemyAction & { kind: 'attack' } }
    state.enemy.focus = 'warrior'
    return state
  }

  it('looks the same for a weak and a crushing blow, whatever armor the heroes hold', () => {
    const weak = enemyPlan(prepared(3))
    const crushing = enemyPlan(prepared(40))
    expect(crushing).toEqual(weak)
    const armored = prepared(40)
    armored.heroes.warrior.armor = 25
    expect(enemyPlan(armored)).toEqual(weak)
    expect(only(weak, 'gather')[0]!.targets).toEqual(['warrior'])
    expect(JSON.stringify(weak)).not.toMatch(/futureTargets|damage|prepared/)
    expect(texts(weak)).toEqual(['Готовит удар'])
    expect(weak.reaction).toEqual({})
  })

  it('does not reveal the hidden traits of the blow either', () => {
    expect(enemyPlan(prepared(12, { pierce: 6, exposes: 'vulnerability', interrupt: 20 }))).toEqual(enemyPlan(prepared(12)))
  })
})

describe('plans match the engine', () => {
  it('names exactly the health a card takes from the enemy', () => {
    for (const item of vfxScenarios.filter(entry => entry.run.kind === 'card')) {
      const { plan, state } = cardPlan(item.build())
      const before = state.enemy.health
      const resolved = structuredClone(state)
      const result = resolveCardPlay(resolved, resolved.pending!.actionId)
      const lost = before - resolved.enemy.health
      const shown = named(plan, 'enemy', ['damage', 'bleed'])
      expect(shown, item.id).toBe(lost)
      expect(result.ok, item.id).toBe(true)
      expect(Object.keys(plan.reaction).length > 0, item.id).toBe(lost > 0)
    }
  })

  it('names exactly the health each hero loses to the enemy turn', () => {
    for (const item of vfxScenarios.filter(entry => entry.run.kind === 'enemy')) {
      const state = item.build()
      const plan = enemyPlan(state)
      const before = { warrior: state.heroes.warrior.health, mage: state.heroes.mage.health, enemy: state.enemy.health }
      const after = structuredClone(state)
      endTurn(after)
      for (const hero of ['warrior', 'mage'] as const) {
        const shown = named(plan, hero, ['damage', 'lethal'])
        expect(shown, `${item.id} ${hero}`).toBe(before[hero] - after.heroes[hero].health)
        expect(Boolean(plan.reaction[hero]), `${item.id} ${hero} reaction`).toBe(before[hero] > after.heroes[hero].health)
      }
      const tick = named(plan, 'enemy', ['bleed'])
      expect(tick, `${item.id} bleeding`).toBe(before.enemy - after.enemy.health)
    }
  })

  it('takes every beat inside the time the plan holds input for', () => {
    for (const item of vfxScenarios) {
      const built = item.build()
      for (const motion of ['full', 'reduced'] as const) {
        const plan = item.run.kind === 'enemy' ? enemyPlan(built, motion) : cardPlan(built, undefined, motion).plan
        expect(plan.beats.length, item.id).toBeGreaterThan(0)
        for (const beat of plan.beats) {
          expect(beat.at, item.id).toBeGreaterThanOrEqual(0)
          expect(beat.at + beat.durMs, item.id).toBeLessThanOrEqual(plan.endMs)
        }
        expect(plan.recoveryMs, item.id).toBeGreaterThanOrEqual(plan.endMs)
        expect(plan.fallbackImpactMs, item.id).toBeGreaterThan(plan.impactMs)
        expect(plan.recoveryMs, item.id).toBeGreaterThan(plan.impactMs)
        expect(plan.beats.map(beat => beat.at), item.id).toEqual([...plan.beats.map(beat => beat.at)].sort((a, b) => a - b))
        expect(plan.motion).toBe(motion)
      }
    }
  })

  it('never puts more than four labels on one portrait at a time', () => {
    for (const item of vfxScenarios) {
      const built = item.build()
      const plan = item.run.kind === 'enemy' ? enemyPlan(built) : cardPlan(built).plan
      for (const label of numbers(plan)) {
        const alive = numbers(plan).filter(other => other.anchor === label.anchor && other.at < label.at + label.durMs && label.at < other.at + other.durMs)
        expect(alive.length, item.id).toBeLessThanOrEqual(4)
        expect(new Set(alive.map(other => other.lane)).size, item.id).toBe(alive.length)
      }
    }
  })
})

describe('reduced motion', () => {
  it('keeps the same events as short, calm confirmations', () => {
    for (const id of ['fireball', 'shield-bash-vuln', 'ice-ward', 'reaping-blow']) {
      const state = scene(id)
      const full = cardPlan(state).plan
      const calm = cardPlan(state, undefined, 'reduced').plan
      expect(calm.beats.map(beat => beat.kind), id).toEqual(full.beats.map(beat => beat.kind))
      expect(calm.impactMs, id).toBeLessThan(full.impactMs)
      expect(calm.recoveryMs, id).toBeLessThan(full.recoveryMs)
      expect(calm.reaction, id).toEqual(full.reaction)
      expect(texts(calm), id).toEqual(texts(full))
      for (const [index, beat] of calm.beats.entries()) if (beat.kind === 'strike') expect(beat.landMs, id).toBeLessThan((full.beats[index] as typeof beat).landMs)
    }
    const calmEnemy = enemyPlan(scene('boss-all'), 'reduced')
    expect(calmEnemy.recoveryMs).toBeLessThan(enemyPlan(scene('boss-all')).recoveryMs)
  })
})

describe('the catalogue', () => {
  it('has a look for every card and builds a plan for each in several situations', () => {
    const ids = [...cards, ...experimentalCards].map(card => card.id)
    expect(Object.keys(cardVfxStyles).sort()).toEqual([...ids].sort())
    const situations: ((state: BattleState) => void)[] = [
      () => undefined,
      state => { applyStatus(state, 'enemy', 'vulnerability') },
      state => { applyStatus(state, 'enemy', 'bleeding', 3) },
      state => { applyStatus(state, 'enemy', 'frostbite') },
      state => { state.heroes.mage.armor = 4; state.heroes.warrior.armor = 3 },
      state => { state.enemy.armor = 8 },
      state => { state.enemy.health = 3 },
      state => { state.drawPile = []; state.discardPile = [] },
    ]
    for (const id of ids) {
      for (const [index, mutate] of situations.entries()) {
        const state = createBattle(undefined, undefined, { seed: 5 + index, economy: honestEconomies['honest-b2'] })
        state.mana = state.maxMana = 9
        state.hand = [{ instanceId: 'x/1', definitionId: id }]
        mutate(state)
        const { plan, play } = cardPlan(state)
        expect(plan.actor).toBe('card')
        expect(plan.impactMs, `${id} #${index}`).toBeGreaterThanOrEqual(0)
        expect(plan.beats.length, `${id} #${index}`).toBeGreaterThan(0)
        // A card that does not hit never shows a projectile or a blow.
        if (play.preview.damage === 0) expect(only(plan, 'strike'), `${id} #${index}`).toHaveLength(0)
        // A card that draws shows draw only if something was drawn.
        expect(only(plan, 'draw').length > 0, `${id} #${index}`).toBe(play.preview.draw > 0)
      }
    }
  })

  it('weighs a blow by the number the player sees', () => {
    expect([weightOf(2), weightOf(3), weightOf(4), weightOf(8), weightOf(9), weightOf(14)]).toEqual(['light', 'light', 'normal', 'normal', 'heavy', 'heavy'])
  })
})

