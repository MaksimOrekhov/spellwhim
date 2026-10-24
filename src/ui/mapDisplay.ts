import type { DungeonMapNode } from '../game/campaign'

/**
 * Pure presentation model of the dungeon map (Map UI v2). It holds no rules: the generator decides what a room is,
 * this module decides only what the player may be told about it. Forges, treasuries and events share one face
 * ("unknown") until the party has entered; the true kind then appears on the map and in the route history.
 */
export type MapFaceKind = 'battle' | 'elite' | 'rest' | 'boss' | 'unknown' | 'forge' | 'treasure' | 'event'
export type MapNodeState = 'current' | 'visited' | 'available' | 'locked'

export interface MapFace {
  kind: MapFaceKind
  label: string
  /** One short sentence about the category, safe to show before the room is entered. */
  hint: string
}

const faces: Record<MapFaceKind, Omit<MapFace, 'kind'>> = {
  battle: { label: 'Обычный бой', hint: 'Схватка с противником. За победу — карта на выбор.' },
  elite: { label: 'Элитный бой', hint: 'Опасный противник. Добровольный риск, но награда щедрее.' },
  rest: { label: 'Привал', hint: 'Костёр в штреке: можно залечить раны или улучшить карту.' },
  boss: { label: 'Босс', hint: 'Главный противник сектора. Здесь поход подходит к развязке.' },
  unknown: { label: 'Неизвестная комната', hint: 'Что внутри, станет ясно, только когда отряд войдёт.' },
  forge: { label: 'Кузница', hint: 'Здесь можно улучшить, убрать или заменить карту.' },
  treasure: { label: 'Сокровищница', hint: 'Здесь можно выбрать артефакт или карту.' },
  event: { label: 'Событие', hint: 'Что-то случилось в штреке: решение за отрядом.' },
}

/** The face of a room. `visited` is the only thing that lets a forge, treasury or event show its true kind. */
export function mapFace(node: Pick<DungeonMapNode, 'type'>, visited: boolean): MapFace {
  const kind: MapFaceKind = node.type === 'final' ? 'boss'
    : node.type === 'battle' || node.type === 'elite' || node.type === 'rest' ? node.type
    : visited ? node.type : 'unknown'
  return { kind, ...faces[kind] }
}

export function mapNodeState(nodeId: string, visited: ReadonlySet<string>, available: ReadonlySet<string>, currentId: string | undefined): MapNodeState {
  if (nodeId === currentId) return 'current'
  if (visited.has(nodeId)) return 'visited'
  return available.has(nodeId) ? 'available' : 'locked'
}

export function mapRowLabel(node: Pick<DungeonMapNode, 'type' | 'layer'>): string {
  return node.type === 'final' ? 'Финал' : `Штрек ${node.layer + 1}`
}

const stateText: Record<MapNodeState, string> = {
  current: 'Отряд здесь',
  visited: 'Пройдено',
  available: 'Доступно: нажмите, чтобы войти',
  locked: 'Путь пока закрыт',
}
export const mapStateText = (state: MapNodeState): string => stateText[state]

export function mapAriaLabel(node: Pick<DungeonMapNode, 'type' | 'layer'>, face: MapFace, state: MapNodeState): string {
  return `${mapRowLabel(node)}. ${face.label}. ${state === 'current' ? 'Пройдено, отряд здесь' : state === 'visited' ? 'Пройдено' : state === 'available' ? 'Доступно' : 'Закрыто'}.`
}

/** Position of a room inside the map box, in percent: the route runs left to right, columns are lanes. */
export function mapPosition(node: Pick<DungeonMapNode, 'layer' | 'column'>, rows: number, columns: number): { x: number; y: number } {
  const lane = columns > 1 ? Math.min(29, 72 / (columns - 1)) : 0
  return { x: 6.5 + (rows > 1 ? node.layer * (87 / (rows - 1)) : 0), y: 50 + (node.column - (columns - 1) / 2) * lane }
}

/** Curve of a rail between two rooms in the 1000×1000 box of the route SVG. */
export function mapRailPath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const a = { x: from.x * 10, y: from.y * 10 }
  const b = { x: to.x * 10, y: to.y * 10 }
  const reach = Math.abs(b.x - a.x) * 0.5
  return `M ${a.x} ${a.y} C ${a.x + reach} ${a.y}, ${b.x - reach} ${b.y}, ${b.x} ${b.y}`
}
