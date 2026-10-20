import { artifactDefinitions } from './artifacts'
import { cardUpgrades } from './cardUpgrades'
import { cards } from './types'
import { defaultDungeonRoster } from './encountersV10'
import { deriveDungeonSeed, dungeonEncounter, dungeonNode, validateDungeonMap } from './campaign'
import type { DungeonRunState } from './campaign'
import { playableEconomies } from './economy'
import type { EconomyConfig } from './economy'

export const RUN_SAVE_KEY = 'spellwhim.run.v1'
export const SAVE_SCHEMA_VERSION = 1
export const RULES_VERSION = 'combat-upgrades-1'
export const GENERATOR_VERSION = 'dungeon-six-layers-1'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => JSON.stringify(key) + ':' + canonical(entry)).join(',') + '}'
  return JSON.stringify(value)
}

function checksum(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return (hash >>> 0).toString(16)
}

const FOUNDATION_CATALOG_VERSION = 'edd7267b'
const baseCatalogue = { cards, artifacts: artifactDefinitions, normal: defaultDungeonRoster.normal, elite: defaultDungeonRoster.elite, final: defaultDungeonRoster.final }
const baseCatalogueVersion = checksum(canonical(baseCatalogue))
/** Conservative automatic catalogue fingerprint plus explicit rule/generator versions. */
export const CATALOG_VERSION = checksum(canonical({ ...baseCatalogue, upgrades: cardUpgrades }))

export interface RunSnapshot {
  schemaVersion: 1
  rulesVersion: string
  generatorVersion: string
  catalogVersion: string
  revision: number
  economy: EconomyConfig
  run: DungeonRunState
}

type Check = (value: unknown) => boolean
const text: Check = value => typeof value === 'string' && value.length > 0 && value.length <= 500
const integer = (min = 0, max = Number.MAX_SAFE_INTEGER): Check => value => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
const uint = integer(0, 0xffffffff)
const oneOf = (...values: unknown[]): Check => value => values.includes(value)
const nullable = (check: Check): Check => value => value === null || check(value)
const list = (check: Check, max = 10000): Check => value => Array.isArray(value) && value.length <= max && value.every(check)
function object(required: Record<string, Check>, optional: Record<string, Check> = {}): Check {
  return value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const data = value as Record<string, unknown>
    return Object.keys(data).every(key => Object.prototype.hasOwnProperty.call(required, key) || Object.prototype.hasOwnProperty.call(optional, key))
      && Object.entries(required).every(([key, check]) => Object.prototype.hasOwnProperty.call(data, key) && check(data[key]))
      && Object.entries(optional).every(([key, check]) => !Object.prototype.hasOwnProperty.call(data, key) || check(data[key]))
  }
}
const cardId: Check = value => cards.some(card => card.id === value)
const artifactId: Check = value => artifactDefinitions.some(item => item.id === value)
const acquisition = object({ definitionId: cardId, upgrade: oneOf(0, 1) })
const hero = object({ id: oneOf('warrior', 'mage'), characterId: text, classId: oneOf('warrior', 'mage'), partySlot: oneOf('first', 'second'), instanceId: text, name: text, title: text, health: integer(0, 999), maxHealth: integer(1, 999), armor: oneOf(0), icon: text })
const node = object({ id: text, layer: integer(0, 6), column: integer(0, 2), type: oneOf('battle', 'elite', 'rest', 'final'), edges: list(text, 3) }, { encounterId: text, encounterHealth: integer(1, 10000), rewardCount: integer(1, 5), healAmount: integer(0, 999) })
const runShape = object({
  runId: text, nextCardId: integer(1), decisions: list(text),
  deckOperations: list(object({ sourceId: text, kind: oneOf('remove', 'replace', 'upgrade'), options: list(acquisition, 100), resolved: oneOf(true, false) })),
  battleEntry: nullable(object({ nodeId: text, seed: uint })),
  seed: uint, mapSeed: uint,
  map: object({ seed: uint, layers: list(list(node, 3), 7), startNodeIds: list(text, 3), finalNodeId: text }),
  currentNodeId: nullable(text), visitedNodeIds: list(text, 7), completedNodeIds: list(text, 7),
  deck: list(object({ instanceId: text, definitionId: cardId, upgrade: oneOf(0, 1) })),
  heroes: object({ warrior: hero, mage: hero }), artifacts: list(object({ instanceId: text, definitionId: artifactId, ownerInstanceId: text }), 2),
  status: oneOf('active', 'victory', 'defeat'),
  pendingReward: nullable(object({ id: text, nodeId: text, seed: uint, artifactSeed: uint, count: oneOf(3, 5), elite: oneOf(true, false), cards: list(acquisition, 5), artifactIds: list(artifactId, 3) })),
}, { excludedRewards: list(cardId) })

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error('Повреждены данные сохранённого похода.')
}
const unique = (values: readonly unknown[]) => new Set(values).size === values.length

/** Validate before publication; never repair, regenerate content, discard cards or heal on load. */
export function validateRun(value: unknown): asserts value is DungeonRunState {
  requireValid(runShape(value))
  const run = value as DungeonRunState
  requireValid(run.mapSeed === deriveDungeonSeed(run.seed, 'map') && run.map.seed === run.mapSeed)
  requireValid(run.map.layers.length === 7 && run.map.layers.every((layer, i) => layer.length === (i === 6 ? 1 : 3)))
  requireValid(validateDungeonMap(run.map).length === 0)
  run.map.layers.forEach((layer, i) => layer.forEach((entry, j) => {
    requireValid(entry.layer === i && entry.column === (i === 6 ? 1 : j) && unique(entry.edges))
    if (entry.type === 'rest') requireValid(entry.healAmount === 6 && entry.encounterId === undefined && entry.encounterHealth === undefined && entry.rewardCount === undefined)
    else {
      dungeonEncounter(entry)
      requireValid(entry.healAmount === undefined && (entry.type === 'final' ? entry.rewardCount === undefined : entry.rewardCount === (entry.type === 'elite' ? 5 : 3)))
    }
  }))
  requireValid(unique(run.visitedNodeIds) && unique(run.completedNodeIds) && unique(run.decisions))
  requireValid(run.currentNodeId === (run.visitedNodeIds[run.visitedNodeIds.length - 1] ?? null))
  run.visitedNodeIds.forEach((id, index) => {
    const allowed = index === 0 ? run.map.startNodeIds : dungeonNode(run.map, run.visitedNodeIds[index - 1]!)?.edges
    requireValid(allowed?.includes(id))
  })
  requireValid(run.completedNodeIds.length >= run.visitedNodeIds.length - 1 && run.completedNodeIds.length <= run.visitedNodeIds.length)
  requireValid(run.completedNodeIds.every((id, i) => run.visitedNodeIds[i] === id))
  const current = run.currentNodeId ? dungeonNode(run.map, run.currentNodeId) : undefined
  const incomplete = !!current && !run.completedNodeIds.includes(current.id)
  requireValid(!!run.battleEntry === (incomplete && current?.type !== 'rest'))
  if (run.battleEntry) requireValid(run.battleEntry.nodeId === current?.id && run.battleEntry.seed === deriveDungeonSeed(run.seed, `battle:${current?.id}`))
  const heroes = Object.values(run.heroes)
  requireValid(unique(heroes.map(entry => entry.instanceId)) && unique(heroes.map(entry => entry.partySlot)))
  requireValid(run.heroes.warrior.id === 'warrior' && run.heroes.mage.id === 'mage')
  heroes.forEach(entry => requireValid(entry.health <= entry.maxHealth))
  requireValid(unique(run.deck.map(card => card.instanceId)))
  run.deck.forEach(card => {
    const prefix = run.runId + '/card/'
    const number = Number(card.instanceId.slice(prefix.length))
    requireValid(card.instanceId === prefix + number && integer(1, run.nextCardId - 1)(number))
  })
  requireValid(unique(run.artifacts.map(item => item.instanceId)) && unique(run.artifacts.map(item => item.definitionId)) && unique(run.artifacts.map(item => item.ownerInstanceId)))
  run.artifacts.forEach(item => requireValid(heroes.some(entry => entry.instanceId === item.ownerInstanceId)))
  const offer = run.pendingReward
  if (offer) {
    requireValid(run.status === 'active' && current && !incomplete && current.type !== 'rest' && current.type !== 'final')
    requireValid(offer.id === `${run.runId}/reward/${current.id}` && offer.nodeId === current.id && !run.decisions.includes(offer.id))
    requireValid(offer.seed === deriveDungeonSeed(run.seed, `reward:${current.id}`) && offer.artifactSeed === deriveDungeonSeed(run.seed, `artifact-reward:${current.id}`))
    requireValid(offer.elite === (current.type === 'elite') && offer.count === (offer.elite ? 5 : 3))
    requireValid(offer.cards.length === offer.count && unique(offer.cards.map(card => card.definitionId)) && unique(offer.artifactIds))
    requireValid(offer.cards.every(choice => cards.some(card => card.id === choice.definitionId && card.reward) && !run.excludedRewards?.includes(choice.definitionId)))
    requireValid(offer.elite ? offer.artifactIds.every(id => !run.artifacts.some(item => item.definitionId === id)) : offer.artifactIds.length === 0)
  }
  requireValid(run.status === 'active' ? heroes.every(entry => entry.health > 0) && !run.completedNodeIds.includes(run.map.finalNodeId) : !incomplete && !offer && !!current)
  if (run.status === 'victory') requireValid(current?.id === run.map.finalNodeId && heroes.every(entry => entry.health > 0))
  if (run.status === 'defeat') requireValid(heroes.some(entry => entry.health === 0) && current?.type !== 'rest')
  requireValid(unique(run.deckOperations.map(item => item.sourceId)))
  run.deckOperations.forEach(service => {
    requireValid((service.kind === 'replace') === (service.options.length > 0))
    requireValid(service.resolved === run.decisions.includes(`deck:${service.sourceId}`))
  })
  const expectedDecisions = run.deckOperations.filter(item => item.resolved).map(item => `deck:${item.sourceId}`)
  run.completedNodeIds.forEach(id => {
    const entry = dungeonNode(run.map, id)!
    expectedDecisions.push(`${entry.type === 'rest' ? 'rest' : 'battle'}:${id}`)
    if (entry.type !== 'rest' && entry.type !== 'final' && !(run.status === 'defeat' && id === current?.id) && offer?.nodeId !== id) expectedDecisions.push(`${run.runId}/reward/${id}`)
  })
  requireValid(run.decisions.length === expectedDecisions.length && expectedDecisions.every(id => run.decisions.includes(id)))
}

class IncompatibleSave extends Error {}
export function encodeSnapshot(run: DungeonRunState, economy: EconomyConfig, revision: number): string {
  validateRun(run)
  requireValid(integer(1)(revision))
  requireValid(Object.values(playableEconomies).some(known => canonical(known) === canonical(economy)))
  const payload: RunSnapshot = { schemaVersion: SAVE_SCHEMA_VERSION, rulesVersion: RULES_VERSION, generatorVersion: GENERATOR_VERSION, catalogVersion: CATALOG_VERSION, revision, economy, run }
  return JSON.stringify({ payload, checksum: checksum(canonical(payload)) })
}

export function decodeSnapshot(raw: string): RunSnapshot {
  const data: unknown = JSON.parse(raw)
  requireValid(object({ payload: value => !!value && typeof value === 'object', checksum: text })(data))
  const envelope = data as { payload: RunSnapshot; checksum: string }
  const snapshot = envelope.payload
  requireValid(object({ schemaVersion: integer(1), rulesVersion: text, generatorVersion: text, catalogVersion: text, revision: integer(1), economy: () => true, run: () => true })(snapshot))
  const legacy = baseCatalogueVersion === FOUNDATION_CATALOG_VERSION && snapshot.schemaVersion === 1 && snapshot.rulesVersion === 'combat-progression-1' && snapshot.catalogVersion === FOUNDATION_CATALOG_VERSION && snapshot.generatorVersion === GENERATOR_VERSION
  if (!legacy && (snapshot.schemaVersion !== SAVE_SCHEMA_VERSION || snapshot.rulesVersion !== RULES_VERSION || snapshot.generatorVersion !== GENERATOR_VERSION || snapshot.catalogVersion !== CATALOG_VERSION)) throw new IncompatibleSave('Сохранение создано для другой версии игры. Оно оставлено в хранилище; начните новый поход или вернитесь к совместимой версии.')
  requireValid(object({ schemaVersion: oneOf(1), rulesVersion: text, generatorVersion: text, catalogVersion: text, revision: integer(1), economy: value => Object.values(playableEconomies).some(known => canonical(known) === canonical(value)), run: () => true })(snapshot))
  requireValid(envelope.checksum === checksum(canonical(snapshot)))
  validateRun(snapshot.run)
  if (legacy) {
    const acquisitions = [...snapshot.run.deck, ...(snapshot.run.pendingReward?.cards ?? []), ...snapshot.run.deckOperations.flatMap(offer => offer.options)]
    if (acquisitions.some(card => card.upgrade !== 0)) throw new IncompatibleSave('Старое сохранение содержит неподдержанное улучшение. Исходные данные доступны для скачивания; нужен прежний каталог игры.')
    return { ...snapshot, rulesVersion: RULES_VERSION, catalogVersion: CATALOG_VERSION }
  }
  return snapshot
}

export interface SaveStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface SaveResult { ok: boolean; message: string }
export interface LoadResult { snapshot: RunSnapshot | null; message: string; blocked: boolean }

/** Small synchronous snapshots work in browser and Tauri webviews. Each setItem is atomic. */
export function createRunSaveStore(storage: () => SaveStorage) {
  let revision = 0
  let exported = ''
  function load(): LoadResult {
    const valid: { snapshot: RunSnapshot; key: string; raw: string }[] = []
    const errors: Error[] = []
    const originals: { key: string; raw: string }[] = []
    for (const key of [RUN_SAVE_KEY, RUN_SAVE_KEY + '.backup']) {
      try {
        const raw = storage().getItem(key)
        if (raw !== null) {
          originals.push({ key, raw })
          valid.push({ snapshot: decodeSnapshot(raw), key, raw })
        }
      } catch (error) { errors.push(error instanceof Error ? error : new Error(String(error))) }
    }
    exported = originals.length ? JSON.stringify({ records: originals }) : ''
    // An incompatible generation must never silently roll back to an older compatible campaign.
    const incompatible = errors.find(error => error instanceof IncompatibleSave)
    if (incompatible) return { snapshot: null, message: incompatible.message, blocked: true }
    valid.sort((a, b) => b.snapshot.revision - a.snapshot.revision)
    const latest = valid[0]
    if (!latest) return { snapshot: null, message: errors.length ? 'Не удалось прочитать сохранение. Данные оставлены в хранилище. Можно повторить загрузку или начать новый поход.' : '', blocked: errors.length > 0 }
    revision = latest.snapshot.revision
    exported = latest.raw
    return { snapshot: latest.snapshot, message: errors.length || latest.key.endsWith('.backup') ? 'Поход восстановлен из резервной копии. Проверьте последнее действие.' : '', blocked: false }
  }
  function save(run: DungeonRunState, economy: EconomyConfig): SaveResult {
    try {
      const raw = encodeSnapshot(run, economy, revision + 1)
      exported = raw
      // The previous mirrored generation survives failure of the primary atomic write.
      storage().setItem(RUN_SAVE_KEY, raw)
      revision += 1
      // Mirror the committed snapshot too: corruption of one record cannot resurrect a spent reward.
      storage().setItem(RUN_SAVE_KEY + '.backup', raw)
      return { ok: true, message: '' }
    } catch {
      return { ok: false, message: 'Прогресс не удалось надёжно сохранить. Не закрывайте игру: повторите сохранение или скачайте копию. Хранилище может быть недоступно или переполнено.' }
    }
  }
  return { load, save, exportSnapshot: () => exported }
}
