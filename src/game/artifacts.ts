import type { ArtifactDefinition, ArtifactId } from './types'

/** Initial five-item pool; effects are resolved only by the canonical battle engine. */
export const artifactDefinitions: readonly ArtifactDefinition[] = [
  { id: 'reliable-wedge', name: 'Верный расклин', description: 'Первый удар по владельцу в бою ослабляется до 2 урона до брони. Заряд расходуется при попадании, даже если броня поглотила весь урон; от смертельного удара не спасает.', icon: 'shield', trigger: 'incoming-hit' },
  { id: 'double-pulley', name: 'Сдвоенный полиспаст', description: 'Раз за ход, когда карта даёт владельцу броню, напарник получает 2 брони.', icon: 'link', trigger: 'owner-armor' },
  { id: 'weakpoint-lens', name: 'Линза слабой точки', description: 'Раз за бой, когда карта расходует Уязвимость врага, владелец получает 2 брони.', icon: 'crosshair', trigger: 'vulnerability-consumed' },
  { id: 'shift-whistle', name: 'Свисток мастера смены', description: 'Раз за бой, когда враг готовит одиночный удар по владельцу, тот получает 3 брони.', icon: 'bell', trigger: 'prepared-hit' },
  { id: 'tension-spool', name: 'Натяжной шкив', description: 'Если владелец начинает ход с бронёй, первая наносящая урон карта отряда в этот ход получает +2 урона. Может срабатывать снова в следующих ходах, если условие выполнено.', icon: 'gauge', trigger: 'armor-at-turn-start' },
]

export function artifactDefinition(id: ArtifactId): ArtifactDefinition {
  const definition = artifactDefinitions.find(item => item.id === id)
  if (!definition) throw new Error('Unknown artifact: ' + id)
  return definition
}
