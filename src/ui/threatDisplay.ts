import type { HeroId } from '../game/types'
import type { IntentKind, PublicIntent, RevealedHit } from '../game/observableIntent'

/**
 * Scene-side view of the PUBLIC intent. The visibility policy itself (what may be known while the enemy prepares a strike)
 * lives in game/observableIntent.ts and is shared with the Balance Lab bots; this module only adds texts and hero markers.
 * The scene never receives the engine forecast, so a hidden number cannot reach a banner, tooltip, `aria-label`, bar or ray.
 */
export type { IntentKind, PublicIntent, RevealedHit } from '../game/observableIntent'
export { publicIntent } from '../game/observableIntent'

/** What a portrait shows about the announced action: a marker, never a number for a strike that is still being prepared. */
export type HeroMark =
  | ({ when: 'now' } & RevealedHit)
  | { when: 'prepared'; hero: HeroId }

export function heroMarks(intent: PublicIntent): Partial<Record<HeroId, HeroMark>> {
  const marks: Partial<Record<HeroId, HeroMark>> = {}
  // A hit the party has stopped this turn marks nobody: it will do nothing.
  if (intent.kind === 'attack' || intent.kind === 'attack_all') for (const hit of intent.hits) { if (!hit.cancelled) marks[hit.hero] = { when: 'now', ...hit } }
  else if (intent.kind === 'prepare') for (const hero of intent.targets) marks[hero] = { when: 'prepared', hero }
  return marks
}

/** Heroes the current attack would kill. Empty for a preparation: its size, and so its lethality, is not public yet. */
export function lethalHeroes(intent: PublicIntent): HeroId[] {
  return intent.kind === 'attack' || intent.kind === 'attack_all' ? intent.hits.filter(hit => hit.lethal).map(hit => hit.hero) : []
}

export type HeroNames = Record<HeroId, string>

const kindLabel: Record<IntentKind, string> = { attack: 'Атака', attack_all: 'Атака по обоим', defend: 'Защита', prepare: 'Готовит удар', recover: 'Передышка' }

/** Heroes the announced action hits during this enemy turn (a hit the party has stopped hits nobody). A preparation lands a turn later. */
export function heroesStruckNow(intent: PublicIntent): HeroId[] {
  return intent.kind === 'attack' || intent.kind === 'attack_all' ? intent.hits.filter(hit => !hit.cancelled).map(hit => hit.hero) : []
}

/**
 * The properties an announced action carries beyond its numbers (the B1 enemy rules, part of the game since X04), as short lines of rule text.
 * Empty for enemies without them. A preparation shows only the kind of trick, because the size and the exact thresholds are not public yet.
 * Hero names are always the subject of a line ("Вариан Ринн — …"), so no line has to decline a name.
 */
export function traitLines(intent: PublicIntent, names: HeroNames): string[] {
  const lines: string[] = []
  if (intent.kind === 'prepare') {
    if (intent.traits?.pierce) lines.push('Удар будет бронебойным: часть брони он игнорирует.')
    if (intent.traits?.interruptible) lines.push('Этот удар можно будет сорвать уроном по здоровью врага. Порог станет известен вместе с ударом.')
    if (intent.traits?.exposes) lines.push('Удар пометит цель Уязвимостью.')
    return lines
  }
  if (intent.kind === 'defend' || intent.kind === 'recover') {
    if (intent.power) lines.push(`Ярость: каждый его удар, объявленный дальше, станет сильнее на ${intent.power}. Уже объявленное действие не меняется.`)
    return lines
  }
  if (intent.kind !== 'attack' && intent.kind !== 'attack_all') return lines
  const strike = intent as Extract<PublicIntent, { hits: RevealedHit[] }>
  for (const hit of strike.hits) {
    const who = names[hit.hero]
    if (hit.pierce) lines.push(`${who} — бронебойный удар: игнорирует ${hit.pierce} брони; чтобы поглотить его целиком, нужно ${hit.attack + hit.pierce} брони.`)
    if (hit.chill) lines.push(`${who} — Обморожение ослабило удар на ${hit.chill}.`)
    if (hit.exposes) lines.push(`${who} — метка: если герой переживёт удар, он станет Уязвимым, и следующий удар по нему будет сильнее на 3.`)
  }
  const unique = [...new Set(lines)]
  if (strike.interrupt) {
    const { need, dealt, broken } = strike.interrupt
    // The engine counts health the enemy lost this turn (battle.ts, `hurt`): damage its armor soaks up does not count.
    unique.unshift(broken ? 'Удар сорван: он ничего не сделает.' : `Можно сорвать: отнимите у врага ${need} здоровья за ход (сейчас ${dealt}). Урон по броне врага не в счёт. Сорванный удар не причинит вреда.`)
  }
  return unique
}

/** One screen-reader sentence; the visible banner carries no text beyond icons and numbers. */
export function intentSpoken(intent: PublicIntent, names: HeroNames): string {
  const head = `Намерение противника: ${kindLabel[intent.kind]}, ${intent.name}`
  const traits = traitLines(intent, names).join(' ')
  const tail = traits ? ' ' + traits : ''
  switch (intent.kind) {
    case 'prepare': return `${head}. Цель: ${intent.targets.map(id => names[id]).join(' и ')}. Сейчас урона нет, точный урон станет известен на следующем ходу.${tail}`
    case 'defend': return `${head}. Получит ${intent.armor} брони.${tail}`
    case 'recover': return `${head}. Восстановит ${intent.armor} брони.${tail}`
    default: return `${head}. ${intent.hits.map(hit => hitSpoken(hit, names[hit.hero])).join(' ')}${tail}`
  }
}

export function hitSpoken(hit: RevealedHit, name: string): string {
  if (hit.cancelled) return `${name}: удар сорван.`
  return `${name}: ${hit.blocked ? 'удар поглощён бронёй' : 'потеряет ' + hit.healthLoss + ' здоровья'}${hit.lethal ? ', смертельно' : ''}.`
}

/** Tooltip paragraphs: the detailed breakdown, only for numbers that are public. */
export function intentTooltip(intent: PublicIntent, names: HeroNames): string[] {
  switch (intent.kind) {
    case 'prepare':
      return [`${intent.name}. Готовит удар: ${intent.targets.map(id => names[id]).join(' и ')} — цель${intent.targets.length > 1 ? 'и' : ''}. Урона сейчас нет.`, 'Сколько урона принесёт удар, станет известно на следующем ходу, перед самым ударом: тогда можно успеть защититься.', ...traitLines(intent, names)]
    case 'defend': return [`${intent.name}. Противник получит ${intent.armor} брони.`, ...traitLines(intent, names)]
    case 'recover': return [`${intent.name}. Противник восстановит ${intent.armor} брони.`, ...traitLines(intent, names)]
    default: {
      const lines = intent.hits.map(hit => hit.cancelled ? `${names[hit.hero]}: удар сорван.` : `${names[hit.hero]}: удар ${hit.attack}${hit.absorbed ? ', броня поглощает ' + hit.absorbed : ''}${hit.blocked ? ' — здоровье цело' : ', здоровье −' + hit.healthLoss}${hit.lethal ? '. Смертельно.' : '.'}`)
      if (intent.kind === 'attack_all') lines.push('Удар по обоим героям: карта с бронёй «цели» спросит, кого прикрыть основной защитой.')
      return [intent.name + '.', ...lines, ...traitLines(intent, names)]
    }
  }
}

/** Spoken marker for a portrait. */
export function markSpoken(mark: HeroMark, name: string): string {
  return mark.when === 'prepared' ? 'Цель подготовленного удара, урон пока неизвестен' : hitSpoken(mark, name)
}
