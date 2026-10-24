<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import BattleBoard from './components/BattleBoard.vue'
import BattleHand from './components/BattleHand.vue'
import CampaignMap from './components/CampaignMap.vue'
import CardReward from './components/CardReward.vue'
import EliteReward from './components/EliteReward.vue'
import RestSite from './components/RestSite.vue'
import RunComplete from './components/RunComplete.vue'
import DungeonRoom from './components/DungeonRoom.vue'
import RulesSwitch from './components/RulesSwitch.vue'
import { useBattle } from './composables/useBattle'
import { useBattleControls } from './composables/useBattleControls'
import { useBattleAnimation } from './composables/useBattleAnimation'
import { availableDungeonNodes, claimDungeonArtifact, claimDungeonReward, createDungeonRun, createSectorRun, dungeonArtifactOptions, dungeonEncounter, dungeonNode, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, upgradeDungeonRest, skipDungeonReward } from './game/campaign'
import { resolveRoom, selectRoom } from './game/dungeonRooms'
import type { RoomCommand, RoomSelection } from './game/dungeonRooms'
import type { DungeonRunState } from './game/campaign'
import { createRunSaveStore } from './game/runSave'
import type { RunSnapshot, SaveStorage } from './game/runSave'
import { resolveCardDefinition } from './game/cardProgression'
import { armorChoice } from './game/battle'
import type { ArmorChoice } from './game/battle'
import ArmorChoiceDialog from './components/ArmorChoiceDialog.vue'
import { drawForTurn, economyFromSearch, gameEconomy, isHonestEconomy, manaForTurn } from './game/economy'
import { deckVariantFor, requestedSeed, resolveRulesMode, startingDeckFor } from './game/rulesMode'
import { armorSources } from './game/honestDecks'
import { provideRules, rulesInfoOf } from './ui/rulesInfo'
import type { CardDefinition, HeroId } from './game/types'

// Model B is the standard economy in development, production and Tauri. A and U remain dev-only comparisons.
// EXPERIMENT "Honest Turn": `?rules=honest-a08|honest-a09` plays other battle rules in every build, in a save slot of its own.
const rulesMode = resolveRulesMode(window.location.search)
// B1/B2 also start from a chosen deck (`?deck=armor10|armor8|armor6`); the standard game and A keep the standard deck.
const startDeck = startingDeckFor(rulesMode, window.location.search)
const deckVariant = deckVariantFor(rulesMode, window.location.search)
// `?seed=N` makes the next run start from that seed, so the same map can be played under two sets of rules.
let seedOnce = requestedSeed(window.location.search)
const configuredEconomy = rulesMode.economy ?? (import.meta.env.DEV
  ? economyFromSearch(window.location.search || (import.meta.env.VITE_SPELLWHIM_ECONOMY ? '?economy=' + import.meta.env.VITE_SPELLWHIM_ECONOMY : ''))
  : gameEconomy)
const props = defineProps<{ saveStorage?: SaveStorage }>()
const saveStore = createRunSaveStore(() => props.saveStorage ?? window.localStorage, rulesMode.saveKey)
const slot = saveStore.load()
// A slot holds only runs of its own rules; a foreign record is left in storage untouched and never played.
const foreign = !!slot.snapshot && !!rulesMode.economy && slot.snapshot.economy.id !== rulesMode.economy.id
const loaded = foreign ? { snapshot: null, blocked: true, message: 'В этом слоте лежит поход по другим правилам боя. Он оставлен в хранилище и не тронут; откройте его через нужный набор правил.' } : slot
const saved = shallowRef<RunSnapshot | null>(loaded.snapshot)
const economy = loaded.snapshot?.economy ?? configuredEconomy
provideRules(rulesInfoOf(economy, { frost: rulesMode.economy?.id === economy.id && rulesMode.frost === true }))
const experimental = economy.id !== gameEconomy.id
const saveError = ref('')
const loadNotice = ref(loaded.message)
const initialSeed = Date.now() >>> 0
const run = shallowRef(createDungeonRun(initialSeed, economy))
const { state, isOver, cards, pendingCard, drawCount, discardCount, beginPlay, resolvePlay, finishTurn, startBattle, restart } = useBattle({ economy, seed: initialSeed, runDeck: () => run.value.deck })
const { animation, phase: battlePhase, impact, play, enemyTurn, cancel } = useBattleAnimation({ state, resolvePlay, finishTurn })
const phase = ref<ReturnType<typeof dungeonRunPhase> | 'resume' | 'start'>(loaded.snapshot || loaded.blocked ? 'resume' : 'start')
const phaseBeforeStart = ref<Exclude<typeof phase.value, 'start'> | null>(null)
const rewardOptions = computed(() => dungeonRewardOptions(run.value))
const selectedNodeId = computed(() => run.value.currentNodeId)
const encounterName = computed(() => {
  const node = run.value.currentNodeId ? dungeonNode(run.value.map, run.value.currentNodeId) : undefined
  return node && ['battle','elite','final'].includes(node.type) ? dungeonEncounter(node, economy).name : ''
})

function persist() {
  const result = saveStore.save(run.value, economy)
  saveError.value = result.message
}
function publish(next: DungeonRunState) {
  run.value = next
  persist()
}

function startCurrentBattle() {
  const entry = run.value.battleEntry!
  startBattle(dungeonEncounter(dungeonNode(run.value.map, entry.nodeId)!, economy), run.value.heroes, entry.seed, entry.nodeId, run.value.artifacts)
}
function continueSavedRun() {
  if (!saved.value) return
  if (saved.value.economy.id !== economy.id) {
    loadNotice.value = 'Перезапустите приложение, чтобы загрузить поход с другой моделью экономики.'
    return
  }
  try {
    saved.value.run.deck.forEach(resolveCardDefinition)
    saved.value.run.pendingReward?.cards.forEach(resolveCardDefinition)
    cancel()
    run.value = structuredClone(saved.value.run)
    if (run.value.battleEntry) startCurrentBattle()
    phase.value = dungeonRunPhase(run.value)
    persist()
    saved.value = null
  } catch (error) { loadNotice.value = error instanceof Error ? error.message : 'Не удалось восстановить поход.' }
}
function retryLoad() {
  const result = saveStore.load()
  saved.value = result.snapshot
  loadNotice.value = result.message
  if (result.snapshot && result.snapshot.economy.id !== economy.id) loadNotice.value = 'Перезапустите приложение, чтобы загрузить поход с другой моделью экономики.'
}
function downloadSave() {
  const raw = saveStore.exportSnapshot()
  if (!raw) return
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'spellwhim-run.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

// Commit victory/defeat immediately, even if the result panel has not been acknowledged yet.
watch(() => state.value.result, result => {
  if (result && phase.value === 'battle' && run.value.battleEntry) publish(resolveDungeonBattle(run.value, state.value))
}, { flush: 'sync' })

/** A card that spreads armor over "the threatened hero" and "the partner" asks who gets the main share, but only against a hit on both heroes. */
const choosing = ref<{ instanceId: string; card: CardDefinition; choice: ArmorChoice } | null>(null)
function playCard(instanceId: string, armorFocus?: HeroId) {
  if (animation.value.busy || isOver.value) return
  if (armorFocus === undefined) {
    const instance = state.value.hand.find(item => item.instanceId === instanceId)
    const card = instance ? resolveCardDefinition(instance) : null
    const choice = card && !state.value.pending && state.value.mana >= card.cost ? armorChoice(state.value, instanceId) : null
    if (card && choice) { choosing.value = { instanceId, card, choice }; return }
  }
  const pending = beginPlay(instanceId, armorFocus)
  if (pending) play(pending)
  else document.getElementById('card-' + instanceId)?.focus()
}
function pickArmorTarget(focus: HeroId) {
  const picked = choosing.value
  choosing.value = null
  if (picked) playCard(picked.instanceId, focus)
}
function cancelArmorChoice() {
  const picked = choosing.value
  choosing.value = null
  if (picked) void nextTick(() => document.getElementById('card-' + picked.instanceId)?.focus())
}

function onEndTurn() {
  if (!animation.value.busy && !isOver.value) enemyTurn()
}

useBattleControls({ enabled: () => phase.value === 'battle' && battlePhase.value === 'player', cards: () => cards.value, play: playCard, endTurn: onEndTurn })

function enterNode(nodeId: string) {
  if (phase.value !== 'map' || !availableDungeonNodes(run.value).some(node => node.id === nodeId)) return
  const nextRun = enterDungeonNode(run.value, nodeId)
  publish(nextRun)
  if (!nextRun.battleEntry) {
    phase.value = dungeonRunPhase(nextRun)
    return
  }
  cancel()
  startCurrentBattle()
  phase.value = 'battle'
}

function onBattleContinue() {
  if (phase.value !== 'battle' || !isOver.value || run.value.battleEntry) return
  cancel()
  phase.value = dungeonRunPhase(run.value)
}

function chooseReward(card: CardDefinition, offerId?: string) {
  if (phase.value !== 'reward' || !offerId || run.value.pendingReward?.id !== offerId) return
  publish(claimDungeonReward(run.value, card, offerId))
  phase.value = 'map'
}

function skipReward(offerId: string) {
  if (phase.value !== 'reward' || run.value.pendingReward?.id !== offerId) return
  publish(skipDungeonReward(run.value, offerId))
  phase.value = 'map'
}

function chooseArtifact(artifactId: Parameters<typeof claimDungeonArtifact>[1], ownerInstanceId: string, replaceInstanceId?: string, offerId?: string) {
  if (phase.value !== 'reward' || !offerId || run.value.pendingReward?.id !== offerId) return
  publish(claimDungeonArtifact(run.value, artifactId, ownerInstanceId, replaceInstanceId, offerId))
  phase.value = 'map'
}

function chooseRestTarget(heroId: HeroId | null, sourceId?: string) {
  if (phase.value !== 'rest' || sourceId !== run.value.runId + '/' + run.value.currentNodeId) return
  publish(resolveDungeonRest(run.value, heroId))
  phase.value = 'map'
}

function chooseRestUpgrade(instanceId: string, sourceId: string) {
  if (phase.value !== 'rest' || sourceId !== `${run.value.runId}/${run.value.currentNodeId}`) return
  publish(upgradeDungeonRest(run.value, instanceId, sourceId))
  phase.value = 'map'
}

function restartRun(mode: 'sector' | 'legacy') {
  cancel()
  const nextSeed = seedOnce ?? (((Date.now() >>> 0) === run.value.seed ? run.value.seed + 1 : Date.now()) >>> 0)
  seedOnce = null
  publish(mode === 'sector' ? createSectorRun(nextSeed, economy, startDeck) : createDungeonRun(nextSeed, economy))
  restart(nextSeed)
  saved.value = null
  loadNotice.value = ''
  phaseBeforeStart.value = null
  phase.value = 'map'
}
// The seed a rules switch carries: the run being played, else the saved one, else the one the address asked for.
const startDeckArmor = startDeck ? armorSources(startDeck) : 10
const switchSeed = computed(() => phaseBeforeStart.value && phaseBeforeStart.value !== 'resume' ? run.value.seed : (saved.value?.run.seed ?? seedOnce))
function showStart() {
  if (phase.value !== 'start') phaseBeforeStart.value = phase.value
  phase.value = 'start'
}
function chooseRoom(selection: RoomSelection | null) {
  if (phase.value !== 'room' || !run.value.room) return
  publish(selectRoom(run.value, run.value.room.id, selection))
}
function confirmRoom(command: RoomCommand) {
  if (phase.value !== 'room' || run.value.room?.id !== command.roomId) return
  publish(resolveRoom(run.value, command))
  phase.value = dungeonRunPhase(run.value)
}
</script>
<template>
  <div class="app-shell">
    <div class="game-wrap">
      <p v-if="experimental" class="economy-badge" :title="economy.label">{{ isHonestEconomy(economy) ? 'Эксперимент · ' + economy.label : 'Режим сравнения · модель ' + economy.manaCurve + ' · ' + economy.label }}<template v-if="deckVariant && phase === 'start'"><br>Новый поход: колода «броня {{ startDeckArmor }}»</template></p>
      <main v-if="phase === 'start'" class="resume-screen">
        <section class="resume-panel"><h1>Мёртвые копи</h1><h2>Выберите поход</h2><p>Вариан и Джайна спускаются в Старые штольни. Шесть посещений, развилки, кузницы, тайники и встреча с Рак'Зором.</p><RulesSwitch :current="rulesMode.id" :seed="switchSeed" :deck="deckVariant" /><button class="game-button" @click="restartRun('sector')">Сектор I — Старые штольни</button><button v-if="!isHonestEconomy(economy)" class="game-button" @click="restartRun('legacy')">Контрольный поход · 7 посещений</button><p>Начало нового похода заменит текущее сохранение.</p><button v-if="phaseBeforeStart" class="game-button" @click="phase = phaseBeforeStart">Назад</button></section>
      </main>
      <main v-else-if="phase === 'resume'" class="resume-screen">
        <section class="resume-panel">
          <h1>Spellwhim</h1>
          <p v-if="saved?.run.status === 'active'">Отряд ждёт у последней комнаты. Прерванный бой начнётся заново с тем же здоровьем и колодой.</p>
          <p v-else-if="saved">Сохранённый поход завершён.</p>
          <p v-if="loadNotice" role="status">{{ loadNotice }}</p>
          <RulesSwitch :current="rulesMode.id" :seed="switchSeed" :deck="deckVariant" />
          <button v-if="saved" class="game-button" @click="continueSavedRun">{{ saved.run.status === 'active' ? 'Продолжить поход' : 'Посмотреть итог' }}</button>
          <button v-if="saved || loadNotice" class="game-button" @click="downloadSave">Скачать копию</button>
          <button v-if="!saved" class="game-button" @click="retryLoad">Повторить загрузку</button>
          <button class="game-button" @click="showStart">Начать новый поход</button>
        </section>
      </main>
      <CampaignMap v-else-if="phase === 'map'" :map="run.map" :run="run" @enter="enterNode" @mode="showStart" />
      <DungeonRoom v-else-if="phase === 'room'" :key="run.room!.id" :run="run" @select="chooseRoom" @confirm="confirmRoom" />
      <EliteReward v-else-if="phase === 'reward' && run.pendingReward?.elite" :key="run.pendingReward.id" :offer-id="run.pendingReward.id" :deck="run.deck" :options="rewardOptions" :artifacts="dungeonArtifactOptions(run)" :heroes="run.heroes" :owned-artifacts="run.artifacts" :encounter-name="encounterName" @choose-card="chooseReward" @choose-artifact="chooseArtifact" />
      <CardReward v-else-if="phase === 'reward'" :key="run.pendingReward!.id" :offer-id="run.pendingReward!.id" :deck="run.deck" :options="rewardOptions" :encounter-name="encounterName" @choose="chooseReward" @skip="skipReward" />
      <RestSite v-else-if="phase === 'rest'" :key="run.runId + '/' + selectedNodeId" :source-id="run.runId + '/' + selectedNodeId" :heroes="run.heroes" :deck="run.deck" :heal-amount="selectedNodeId ? dungeonNode(run.map, selectedNodeId)?.healAmount ?? 6 : 6" @choose="chooseRestTarget" @upgrade="chooseRestUpgrade" />
      <RunComplete v-else-if="phase === 'complete'" :result="run.status === 'defeat' ? 'defeat' : 'victory'" :run="run" @restart="showStart" />
      <template v-else>
        <BattleBoard :state="state" :animation="animation" :phase="battlePhase" :artifact-notices="state.artifactNotices" :continue-label="dungeonNode(run.map, selectedNodeId ?? '')?.type === 'final' ? (run.campaign ? 'Завершить сектор I' : 'Завершить поход') : 'Выбрать награду'" @impact="impact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <BattleHand v-if="!isOver" :cards="cards" :outgoing="pendingCard" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="drawCount" :discard-count="discardCount" :exhausted-count="state.exhausted.length" :phase="battlePhase" :mana="state.mana" :max-mana="state.maxMana" :next-mana="manaForTurn(state.economy, state.turn + 1)" :next-draw="drawForTurn(state.economy, state.turn + 1)" :draw-boost-from="state.economy.drawSchedule.boost?.fromTurn" :draw-boost-amount="state.economy.drawSchedule.boost?.amount" @play="playCard" @end-turn="onEndTurn" />
      </template>
      <ArmorChoiceDialog v-if="choosing" :card="choosing.card" :choice="choosing.choice" :heroes="state.heroes" @pick="pickArmorTarget" @cancel="cancelArmorChoice" />
      <aside v-if="saveError && phase !== 'resume'" class="save-error" role="alert"><p>{{ saveError }}</p><button class="game-button" @click="persist">Повторить сохранение</button><button class="game-button" @click="downloadSave">Скачать копию</button></aside>
    </div>
  </div>
</template>
<style scoped>
.resume-screen{position:absolute;inset:0;display:grid;place-items:center;background:var(--mat-wood);color:var(--ink)}.resume-panel{max-width:650px;padding:var(--sp-6);border:var(--border-brass);border-radius:var(--shape-dialog);background:var(--mat-quiet);box-shadow:var(--shadow-4)}.resume-panel h1{font:700 var(--fs-4xl) var(--font-display);margin:0}.resume-panel p{line-height:var(--lh-body)}.resume-panel button{margin:var(--sp-2)}
.save-error{position:absolute;z-index:100;bottom:var(--sp-3);left:50%;transform:translateX(-50%);width:min(760px,95%);padding:var(--sp-3);border:var(--border-brass);border-radius:var(--shape-scroll);background:var(--wood-1);color:var(--ink);box-shadow:var(--shadow-3)}.save-error p{margin:0 0 var(--sp-2)}.save-error button{margin-right:var(--sp-2);font-size:var(--fs-sm)}
.economy-badge{position:absolute;z-index:40;top:64px;left:24px;max-width:230px;margin:0;padding:5px 12px;border-radius:12px;border:1px solid #f0c36a;background:#3b2a52e6;color:#ffe8b0;font-size:12px;line-height:1.35;pointer-events:none;letter-spacing:.02em}
</style>
