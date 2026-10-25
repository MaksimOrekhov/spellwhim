<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import BattleBoard from './components/BattleBoard.vue'
import AudioSettings from './components/AudioSettings.vue'
import { gameAudio } from './audio/engine'
import { musicForContext } from './audio/music'
import BattleHand from './components/BattleHand.vue'
import CampaignMap from './components/CampaignMap.vue'
import CardReward from './components/CardReward.vue'
import EliteReward from './components/EliteReward.vue'
import RestSite from './components/RestSite.vue'
import BossReward from './components/BossReward.vue'
import SectorTransition from './components/SectorTransition.vue'
import RunComplete from './components/RunComplete.vue'
import DungeonRoom from './components/DungeonRoom.vue'
import MainMenu from './components/MainMenu.vue'
import { useBattle } from './composables/useBattle'
import { useBattleControls } from './composables/useBattleControls'
import { useBattleAnimation } from './composables/useBattleAnimation'
import { availableDungeonNodes, battleStartArmor, claimDungeonArtifact, claimDungeonReward, createAdventureRun, createDungeonRun, dungeonArtifactOptions, dungeonEncounter, dungeonNode, dungeonRewardOptions, dungeonRunPhase, enterDungeonNode, resolveDungeonBattle, resolveDungeonRest, upgradeDungeonRest, skipDungeonReward } from './game/campaign'
import { resolveRoom, selectRoom } from './game/dungeonRooms'
import { claimBossCard, claimBossDevelopment } from './game/bossReward'
import type { BossCardCommand, BossDevelopmentCommand } from './game/bossReward'
import type { RoomCommand, RoomSelection } from './game/dungeonRooms'
import type { DungeonRunState } from './game/campaign'
import { createRunSaveStore } from './game/runSave'
import type { RunSnapshot, SaveStorage } from './game/runSave'
import { resolveCardDefinition } from './game/cardProgression'
import { armorChoice, forecastEnemyAction } from './game/battle'
import { heroesStruckNow, publicIntent } from './ui/threatDisplay'
import type { ArmorChoice } from './game/battle'
import ArmorChoiceDialog from './components/ArmorChoiceDialog.vue'
import { drawForTurn, economyFromSearch, manaForTurn } from './game/economy'
import { requestedSeed, resolveLaunch, startingDeckFor } from './game/rulesMode'
import { provideRules, rulesInfoOf } from './ui/rulesInfo'
import type { CardDefinition, HeroId } from './game/types'

// The game is Honest Turn B2 on the long Sector I (Decision Log X04). A development build alone can open another set of rules, and only through
// an explicit `?dev-rules=` (docs/design/default-b2-long-v1.md); every other address, in every build, plays the default game.
const launch = resolveLaunch(window.location.search, import.meta.env.DEV)
const rulesMode = launch.mode
const startDeck = startingDeckFor(rulesMode, launch.search)
// `?seed=N` (laboratory only) makes the next run start from that seed.
let seedOnce = requestedSeed(launch.search)
const configuredEconomy = rulesMode.economy ?? economyFromSearch(launch.search || (import.meta.env.VITE_SPELLWHIM_ECONOMY ? '?economy=' + import.meta.env.VITE_SPELLWHIM_ECONOMY : ''))
const props = defineProps<{ saveStorage?: SaveStorage }>()
const saveStore = createRunSaveStore(() => props.saveStorage ?? window.localStorage, rulesMode.saveKey)
const slot = saveStore.load()
// A slot holds only runs of its own rules; a foreign record is left in storage untouched and never played.
const foreign = !!slot.snapshot && !!rulesMode.economy && slot.snapshot.economy.id !== rulesMode.economy.id
const loaded = foreign ? { snapshot: null, blocked: true, message: 'Сохранённый поход создан по другим правилам боя, и эта версия игры не может его продолжить. Данные оставлены в хранилище нетронутыми: их можно скачать.' } : slot
const saved = shallowRef<RunSnapshot | null>(loaded.snapshot)
const economy = loaded.snapshot?.economy ?? configuredEconomy
const rules = rulesInfoOf(economy, { frost: rulesMode.economy?.id === economy.id && rulesMode.frost === true })
provideRules(rules)
const experimental = launch.lab
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
const finalBattle = computed(() => dungeonNode(run.value.map, selectedNodeId.value ?? '')?.type === 'final')
const musicRequest = computed(() => musicForContext({
  screen: phase.value === 'start' || phase.value === 'resume' ? 'menu' : phase.value === 'battle' ? 'battle' : phase.value === 'complete' || phase.value === 'boss-reward' || phase.value === 'transition' ? 'complete' : 'map',
  encounterId: state.value.enemy.encounterId,
  result: phase.value === 'battle' ? state.value.result : null,
  finalBattle: finalBattle.value,
}))
watch(musicRequest, request => gameAudio.setMusic(request), { immediate: true })
/** Heroes whose new armor would expire before any blow reaches them: under armor that lasts one enemy turn, everyone the enemy does not hit now. */
const idleArmor = computed<HeroId[]>(() => {
  if (!rules.armorExpires || state.value.result) return []
  const struck = heroesStruckNow(publicIntent(forecastEnemyAction(state.value)))
  return (Object.keys(state.value.heroes) as HeroId[]).filter(id => !struck.includes(id))
})
/** The sector boss whose reward is open (or just closed): its name heads the reward screen. */
const bossName = computed(() => {
  const node = dungeonNode(run.value.map, run.value.bossReward?.nodeId ?? run.value.map.finalNodeId)
  return node ? dungeonEncounter(node, economy).name : ''
})
const encounterName = computed(() => {
  const node = run.value.currentNodeId ? dungeonNode(run.value.map, run.value.currentNodeId) : undefined
  return node && ['battle','elite','final'].includes(node.type) ? dungeonEncounter(node, economy).name : ''
})

const otherRulesNotice = 'Сохранённый поход создан по другим правилам боя. Перезапустите игру, чтобы загрузить его.'
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
  startBattle(dungeonEncounter(dungeonNode(run.value.map, entry.nodeId)!, economy), run.value.heroes, entry.seed, entry.nodeId, run.value.artifacts, battleStartArmor(run.value))
}
function continueSavedRun() {
  if (!saved.value) return
  if (saved.value.economy.id !== economy.id) {
    loadNotice.value = otherRulesNotice
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
  if (result.snapshot && result.snapshot.economy.id !== economy.id) loadNotice.value = otherRulesNotice
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
  if (pending) { gameAudio.play('card'); play(pending) }
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
  if (!animation.value.busy && !isOver.value) { gameAudio.play('turn'); enemyTurn() }
}

useBattleControls({ enabled: () => phase.value === 'battle' && battlePhase.value === 'player', cards: () => cards.value, play: playCard, endTurn: onEndTurn })

function enterNode(nodeId: string) {
  if (phase.value !== 'map' || !availableDungeonNodes(run.value).some(node => node.id === nodeId)) return
  const nextRun = enterDungeonNode(run.value, nodeId)
  if (nextRun.battleEntry) gameAudio.play('weapon-draw', .45, 'battle-start')
  else if (nextRun.room?.type === 'treasure') gameAudio.play('lock', .48, 'room-open')
  else if (nextRun.room) gameAudio.play('door', .38, 'room-open')
  else gameAudio.play('room', .32, 'room-open')
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
  gameAudio.play('reward')
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
  gameAudio.play('reward')
  phase.value = 'map'
}

function chooseBossCard(offerId: string, command: BossCardCommand) {
  if (phase.value !== 'boss-reward' || run.value.bossReward?.id !== offerId) return
  publish(claimBossCard(run.value, offerId, command))
  if (command.kind !== 'skip') gameAudio.play('reward')
  phase.value = dungeonRunPhase(run.value)
}

function chooseBossDevelopment(offerId: string, command: BossDevelopmentCommand) {
  if (phase.value !== 'boss-reward' || run.value.bossReward?.id !== offerId) return
  publish(claimBossDevelopment(run.value, offerId, command))
  if (command.kind !== 'skip') gameAudio.play('reward')
  phase.value = dungeonRunPhase(run.value)
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

function restartRun() {
  cancel()
  const nextSeed = seedOnce ?? (((Date.now() >>> 0) === run.value.seed ? run.value.seed + 1 : Date.now()) >>> 0)
  seedOnce = null
  publish(createAdventureRun(nextSeed, economy, startDeck))
  restart(nextSeed)
  saved.value = null
  loadNotice.value = ''
  phaseBeforeStart.value = null
  phase.value = 'map'
}
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
      <AudioSettings />
      <p v-if="experimental" class="economy-badge" :title="economy.label">Лаборатория · {{ economy.label }}</p>
      <MainMenu v-if="phase === 'start' || phase === 'resume'" :saved="saved ? { active: saved.run.status === 'active' || dungeonRunPhase(saved.run) === 'transition', atExit: dungeonRunPhase(saved.run) === 'transition' } : null" :can-return="!!phaseBeforeStart && phaseBeforeStart !== 'resume'" :finished="phaseBeforeStart === 'complete'" :notice="loadNotice" :unreadable="phase === 'resume' && !saved" @continue="continueSavedRun" @return="phase = phaseBeforeStart!" @new-run="restartRun" @download="downloadSave" @retry="retryLoad" />
      <CampaignMap v-else-if="phase === 'map'" :map="run.map" :run="run" @enter="enterNode" @mode="showStart" />
      <DungeonRoom v-else-if="phase === 'room'" :key="run.room!.id" :run="run" @select="chooseRoom" @confirm="confirmRoom" />
      <EliteReward v-else-if="phase === 'reward' && run.pendingReward?.elite" :key="run.pendingReward.id" :offer-id="run.pendingReward.id" :deck="run.deck" :options="rewardOptions" :artifacts="dungeonArtifactOptions(run)" :heroes="run.heroes" :owned-artifacts="run.artifacts" :encounter-name="encounterName" :gold="run.pendingReward.rarity === 'gold'" @choose-card="chooseReward" @choose-artifact="chooseArtifact" />
      <CardReward v-else-if="phase === 'reward'" :key="run.pendingReward!.id" :offer-id="run.pendingReward!.id" :deck="run.deck" :options="rewardOptions" :encounter-name="encounterName" @choose="chooseReward" @skip="skipReward" />
      <BossReward v-else-if="phase === 'boss-reward' && run.bossReward" :key="run.bossReward.id" :reward="run.bossReward" :boss-name="bossName" :deck="run.deck" :heroes="run.heroes" :owned-artifacts="run.artifacts" @claim-card="chooseBossCard" @claim-development="chooseBossDevelopment" />
      <RestSite v-else-if="phase === 'rest'" :key="run.runId + '/' + selectedNodeId" :source-id="run.runId + '/' + selectedNodeId" :heroes="run.heroes" :deck="run.deck" :heal-amount="selectedNodeId ? dungeonNode(run.map, selectedNodeId)?.healAmount ?? 6 : 6" @choose="chooseRestTarget" @upgrade="chooseRestUpgrade" />
      <SectorTransition v-else-if="phase === 'transition' && run.journey" :run="run" @menu="showStart" />
      <RunComplete v-else-if="phase === 'complete'" :result="run.status === 'defeat' ? 'defeat' : 'victory'" :run="run" @new-run="restartRun" @menu="showStart" />
      <template v-else>
        <BattleBoard :state="state" :animation="animation" :phase="battlePhase" :artifact-notices="state.artifactNotices" :continue-label="finalBattle ? (run.journey ? 'Забрать трофеи босса' : run.campaign ? 'Завершить сектор I' : 'Завершить поход') : 'Выбрать награду'" :final="finalBattle" :trophies="finalBattle && !!run.journey" @impact="impact" @end-turn="onEndTurn" @continue="onBattleContinue" />
        <BattleHand v-if="!isOver" :cards="cards" :outgoing="pendingCard" :outgoing-index="state.pending?.handIndex ?? 0" :draw-count="drawCount" :discard-count="discardCount" :exhausted-count="state.exhausted.length" :phase="battlePhase" :mana="state.mana" :max-mana="state.maxMana" :next-mana="manaForTurn(state.economy, state.turn + 1)" :next-draw="drawForTurn(state.economy, state.turn + 1)" :draw-boost-from="state.economy.drawSchedule.boost?.fromTurn" :draw-boost-amount="state.economy.drawSchedule.boost?.amount" :idle-armor="idleArmor" @play="playCard" @end-turn="onEndTurn" />
      </template>
      <ArmorChoiceDialog v-if="choosing" :card="choosing.card" :choice="choosing.choice" :heroes="state.heroes" @pick="pickArmorTarget" @cancel="cancelArmorChoice" />
      <aside v-if="saveError && phase !== 'resume'" class="save-error" role="alert"><p>{{ saveError }}</p><button class="game-button" @click="persist">Повторить сохранение</button><button class="game-button" @click="downloadSave">Скачать копию</button></aside>
    </div>
  </div>
</template>
<style scoped>
.save-error{position:absolute;z-index:100;bottom:var(--sp-3);left:50%;transform:translateX(-50%);width:min(760px,95%);padding:var(--sp-3);border:var(--border-brass);border-radius:var(--shape-scroll);background:var(--wood-1);color:var(--ink);box-shadow:var(--shadow-3)}.save-error p{margin:0 0 var(--sp-2)}.save-error button{margin-right:var(--sp-2);font-size:var(--fs-sm)}
.economy-badge{position:absolute;z-index:40;top:64px;left:24px;max-width:230px;margin:0;padding:5px 12px;border-radius:12px;border:1px solid #f0c36a;background:#3b2a52e6;color:#ffe8b0;font-size:12px;line-height:1.35;pointer-events:none;letter-spacing:.02em}
</style>
