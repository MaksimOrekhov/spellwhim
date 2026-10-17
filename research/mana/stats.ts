import type { BattleRecord, RunRecord, TurnRecord } from './core'

export interface Summary {
  config: string
  bot: string
  runs: number
  winPct: number
  /** Win % of the encounter among runs that reached it. */
  encounterWinPct: number[]
  reached: number[]
  /** Mean turns per encounter (all battles that happened). */
  encounterTurns: number[]
  turnsPerRun: number
  /** Mean per player turn, over every turn of every battle. */
  perTurn: {
    available: number; spent: number; unused: number; plays: number; handStart: number; handEnd: number
    held: number; unaffordable: number; links: number; damage: number; hpLost: number
  }
  /** Share of turns on which the model is at its mana cap. */
  atCapPct: number
  /** Share of battles that ended before the cap turn was reached (progression never "finished"). */
  endedBeforeCapPct: number
  /** Share of turns with unused mana AND no affordable card (card-flow limited). */
  flowLimitedPct: number
  /** Share of turns that ended with an unaffordable card still in hand (mana limited). */
  manaBoundPct: number
  /** Share of turns that ended with an affordable card deliberately held. */
  holdPct: number
  /** Share of turns that spent all available mana. */
  spentAllPct: number
  /** Mean end HP of heroes (all runs) and HP lost per battle. */
  endHp: { warrior: number; mage: number }
  hpLostPerBattle: number[]
  blockedDraws: number
  /** Mean turns on which a link triggered at least once. */
  turnsWithLinkPct: number
  cardPlays: Record<string, number>
  /** Pressure and defense economy. */
  pressure: {
    incomingPerTurn: number; absorbedPerTurn: number; hpLostPerTurn: number
    defenseManaShare: number
    /** Battles in which either hero dropped to <= 40% / <= 20% HP at some enemy resolution. */
    lowHpBattlePct: number; criticalBattlePct: number
    /** Mean over battles of the lowest hero HP fraction reached. */
    minHpFrac: number
  }
  /** How long cards wait in hand: mean turns before a play, share of plays that waited 3+ turns is approximated by the mean; copies left unplayed at battle end. */
  waiting: { meanAge: number; stuckPerBattle: number; byCard: Record<string, { plays: number; meanAge: number; stuck: number }> }
  /** Planner diagnostics (0 for bots without them). */
  decisions: { marginalMana: number; bindingPct: number; sets: number; nearBest: number; gap: number; probed: number }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

export function summarize(runs: RunRecord[], bot: string, config: string, encounterCount = 3): Summary {
  const battles: BattleRecord[] = runs.flatMap(r => r.battles)
  const turns: TurnRecord[] = battles.flatMap(b => b.turnLog)
  const byIndex = (i: number) => battles.filter(b => b.index === i)
  const cardPlays: Record<string, number> = {}
  for (const b of battles) for (const [id, n] of Object.entries(b.plays)) cardPlays[id] = (cardPlays[id] ?? 0) + n
  const pct = (n: number, d: number) => (d ? (n / d) * 100 : 0)
  const wins = runs.filter(r => r.status === 'victory')
  const last = runs.map(r => r.battles[r.battles.length - 1]!)
  return {
    config, bot, runs: runs.length,
    winPct: pct(wins.length, runs.length),
    encounterWinPct: Array.from({ length: encounterCount }, (_, i) => pct(byIndex(i).filter(b => b.result === 'victory').length, byIndex(i).length)),
    reached: Array.from({ length: encounterCount }, (_, i) => byIndex(i).length),
    encounterTurns: Array.from({ length: encounterCount }, (_, i) => mean(byIndex(i).map(b => b.turns))),
    turnsPerRun: mean(runs.map(r => r.battles.reduce((s, b) => s + b.turns, 0))),
    perTurn: {
      available: mean(turns.map(t => t.available)),
      spent: mean(turns.map(t => t.spent)),
      unused: mean(turns.map(t => t.unused)),
      plays: mean(turns.map(t => t.plays)),
      handStart: mean(turns.map(t => t.handStart)),
      handEnd: mean(turns.map(t => t.handEnd)),
      held: mean(turns.map(t => t.held)),
      unaffordable: mean(turns.map(t => t.unaffordable)),
      links: mean(turns.map(t => t.links)),
      damage: mean(turns.map(t => t.damage)),
      hpLost: mean(turns.map(t => t.hpLost)),
    },
    atCapPct: pct(turns.filter(t => t.atCap).length, turns.length),
    endedBeforeCapPct: pct(battles.filter(b => b.turns < b.capTurn).length, battles.length),
    flowLimitedPct: pct(turns.filter(t => t.unused > 0 && t.held === 0).length, turns.length),
    manaBoundPct: pct(turns.filter(t => t.unaffordable > 0).length, turns.length),
    holdPct: pct(turns.filter(t => t.held > 0).length, turns.length),
    spentAllPct: pct(turns.filter(t => t.unused === 0).length, turns.length),
    endHp: { warrior: mean(last.map(b => b.endHp.warrior)), mage: mean(last.map(b => b.endHp.mage)) },
    hpLostPerBattle: Array.from({ length: encounterCount }, (_, i) => mean(byIndex(i).map(b => b.startHp.warrior + b.startHp.mage - b.endHp.warrior - b.endHp.mage))),
    blockedDraws: mean(battles.map(b => b.blockedDraws)),
    turnsWithLinkPct: pct(turns.filter(t => t.links > 0).length, turns.length),
    cardPlays,
    pressure: {
      incomingPerTurn: mean(turns.map(x => x.incoming)),
      absorbedPerTurn: mean(turns.map(x => x.absorbed)),
      hpLostPerTurn: mean(turns.map(x => x.hpLost)),
      defenseManaShare: turns.reduce((n, x) => n + x.spent, 0) ? turns.reduce((n, x) => n + x.defMana, 0) / turns.reduce((n, x) => n + x.spent, 0) * 100 : 0,
      lowHpBattlePct: pct(battles.filter(b => b.minHpFrac <= 0.4).length, battles.length),
      criticalBattlePct: pct(battles.filter(b => b.minHpFrac <= 0.2).length, battles.length),
      minHpFrac: mean(battles.map(b => b.minHpFrac)),
    },
    waiting: (() => {
      const byCard: Record<string, { plays: number; age: number; stuck: number }> = {}
      for (const b of battles) for (const [id, w] of Object.entries(b.waits ?? {})) {
        const row = (byCard[id] ??= { plays: 0, age: 0, stuck: 0 })
        row.plays += w.plays; row.age += w.age; row.stuck += w.stuck
      }
      const plays = Object.values(byCard).reduce((n, w) => n + w.plays, 0)
      const age = Object.values(byCard).reduce((n, w) => n + w.age, 0)
      const stuck = Object.values(byCard).reduce((n, w) => n + w.stuck, 0)
      return {
        meanAge: plays ? age / plays : 0,
        stuckPerBattle: battles.length ? stuck / battles.length : 0,
        byCard: Object.fromEntries(Object.entries(byCard).map(([id, w]) => [id, { plays: w.plays, meanAge: w.plays ? w.age / w.plays : 0, stuck: w.stuck }])),
      }
    })(),
    decisions: {
      marginalMana: mean(turns.filter(x => x.marginal !== null).map(x => x.marginal!)),
      bindingPct: pct(turns.filter(x => x.marginal !== null && x.marginal > 1).length, turns.filter(x => x.marginal !== null).length),
      sets: mean(turns.filter(x => x.sets !== null).map(x => x.sets!)),
      nearBest: mean(turns.filter(x => x.nearBest !== null).map(x => x.nearBest!)),
      gap: mean(turns.filter(x => x.gap !== null).map(x => Math.min(x.gap!, 20))),
      probed: turns.filter(x => x.marginal !== null).length,
    },
  }
}
