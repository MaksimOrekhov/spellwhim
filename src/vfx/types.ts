import type { HeroId, StatusId } from '../game/types'

/**
 * Combat Feel & VFX v1: the vocabulary shared by the plan builders (pure, ./plan.ts) and the PixiJS painters (./painters).
 *
 * A VfxPlan is a list of timed beats. It is derived from what the rules engine has ALREADY decided (the pending play's preview and
 * consumed statuses, the enemy forecast), never from the card's `kind`, and it never computes a rule: damage, armor, statuses and
 * draws are read from the engine's own numbers. The painters only draw; the one thing that reaches back into the game is the
 * plan's `impactMs`, which BattleFx reports as an `impact` event carrying the action ID, exactly as before.
 */
export type VfxAnchor = HeroId | 'enemy'
/** Where an effect can be drawn: a portrait, or the hand (the target of drawn cards). */
export type VfxPoint = VfxAnchor | 'hand'
export type School = 'physical' | 'fire' | 'frost' | 'lightning' | 'arcane' | 'blood'
export type Weight = 'light' | 'normal' | 'heavy'
/** `reduced` follows prefers-reduced-motion: short, calm confirmations with no flying particles. */
export type Motion = 'full' | 'reduced'

export type StrikeStyle =
  | 'slash' | 'lunge' | 'cleave' | 'bash'
  | 'fireball' | 'frostbolt' | 'lightning' | 'arcane-bolt' | 'chill'
  | 'claw' | 'slam' | 'needle'
export type GuardStyle = 'steel' | 'arcane' | 'frost' | 'plate'
export type RuneSigil = 'insight' | 'mark' | 'seal' | 'heat'
/** `apply`: the status was put on. `consume`: a hit spent it. `tick`: it acted on its own. `burst`: a card spent all of it for extra damage. */
export type StatusMode = 'apply' | 'consume' | 'tick' | 'burst'
/** What a landed enemy hit did to a hero's armor. Never produced when armor played no part. */
export type HeroOutcome = 'block' | 'shatter' | 'pierce' | 'fizzle'
export type NumberTone = 'damage' | 'armor-hit' | 'armor-gain' | 'bonus' | 'bleed' | 'frost' | 'vulnerability' | 'draw' | 'block' | 'info' | 'rage' | 'lethal'
export type NumberSize = 'xl' | 'l' | 'm' | 's'

interface Timed { durMs: number }

export type Paint =
  /** A blow or a projectile. `landMs` is when it reaches `to`. */
  | (Timed & { kind: 'strike'; style: StrikeStyle; school: School; from: VfxAnchor | null; to: VfxAnchor; weight: Weight; landMs: number; boss?: boolean; empowered?: boolean; chilled?: boolean })
  /** Armor appearing on a portrait. `landMs`: the shield is complete. */
  | (Timed & { kind: 'guard'; style: GuardStyle; anchor: VfxAnchor; landMs: number })
  /** A cast that is not a blow: a sigil at a portrait. */
  | (Timed & { kind: 'rune'; sigil: RuneSigil; school: School; anchor: VfxAnchor; landMs: number })
  /** A status being applied, spent or ticking. */
  | (Timed & { kind: 'status'; status: StatusId | 'rage'; mode: StatusMode; anchor: VfxAnchor })
  /** New cards arriving in the hand. */
  | (Timed & { kind: 'draw'; from: VfxAnchor; count: number })
  /** The enemy gathering a blow. Shows who is aimed at (public) and nothing about its size. */
  | (Timed & { kind: 'gather'; anchor: 'enemy'; boss?: boolean; targets: HeroId[]; landMs: number })
  /** A gathered blow that the party has stopped: it falls apart. */
  | (Timed & { kind: 'break'; anchor: 'enemy'; boss?: boolean; landMs: number })
  /** How a landed enemy hit met a hero's armor. */
  | (Timed & { kind: 'result'; outcome: HeroOutcome; hero: HeroId; style: GuardStyle })
  /** The enemy's armor meeting a card: sparks when it holds, shards when it is gone. */
  | (Timed & { kind: 'armor-fx'; mode: 'hit' | 'break'; anchor: 'enemy' })
  | (Timed & { kind: 'number'; anchor: VfxAnchor; tone: NumberTone; size: NumberSize; text: string; priority: number; lane: number; heavy?: boolean })

export type VfxBeat = Paint & { /** Milliseconds from the start of the plan. */ at: number }

/** Who flinches when the action lands. Only a hit that costs health (or a status tick) moves a portrait. */
export type Reaction = Partial<Record<VfxAnchor, Weight>>

export interface VfxPlan {
  /** Readable name of the scenario, for the lab and the tests: `card:fireball`, `enemy:attack`, `enemy:attack_all:boss`. */
  scenario: string
  actor: 'card' | 'enemy'
  motion: Motion
  beats: VfxBeat[]
  /** When the visuals reach the target and BattleFx reports `impact`. */
  impactMs: number
  /** Used only if the canvas never reports (hidden tab, no WebGL): the game still moves on. Always later than `impactMs`. */
  fallbackImpactMs: number
  /** When input is released again; every beat has ended by then. */
  recoveryMs: number
  /** End of the last beat. */
  endMs: number
  reaction: Reaction
}
