<script setup lang="ts">
import { computed, ref } from 'vue'
import { Bell, Crosshair, Gauge, Link2, Shield } from '@lucide/vue'
import SpellCard from './SpellCard.vue'
import CardNotes from './CardNotes.vue'
import DeckViewer from './DeckViewer.vue'
import { neutralPreview } from '../ui/cardDisplay'
import { artifactDefinition } from '../game/artifacts'
import type { ArtifactDefinition, ArtifactId, ArtifactInstance, CardDefinition, Hero, HeroId, PersistentCard } from '../game/types'

const props = defineProps<{
  options: CardDefinition[]
  artifacts: ArtifactDefinition[]
  heroes: Record<HeroId, Hero>
  ownedArtifacts: ArtifactInstance[]
  encounterName: string
  deck?: readonly PersistentCard[]
  offerId?: string
}>()
const emit = defineEmits<{
  chooseCard: [card: CardDefinition, offerId?: string]
  chooseArtifact: [artifactId: ArtifactId, ownerInstanceId: string, replaceInstanceId?: string, offerId?: string]
}>()
const section = ref<'cards' | 'artifacts'>('cards')
const selectedArtifactId = ref<ArtifactId | null>(null)
const selectedOwnerId = ref<string | null>(null)
const cardItems = computed(() => props.options.map(card => ({ card, preview: neutralPreview(card) })))
const currentArtifact = (ownerId: string) => props.ownedArtifacts.find(item => item.ownerInstanceId === ownerId)
const iconFor = (artifact: ArtifactDefinition) => ({ shield: Shield, link: Link2, crosshair: Crosshair, bell: Bell, gauge: Gauge })[artifact.icon]
const selectedArtifact = computed(() => props.artifacts.find(item => item.id === selectedArtifactId.value) ?? null)
const selectedOwner = computed(() => Object.values(props.heroes).find(hero => hero.instanceId === selectedOwnerId.value) ?? null)
const replaced = computed(() => selectedOwner.value ? currentArtifact(selectedOwner.value.instanceId) : undefined)
function selectArtifact(id: ArtifactId) {
  selectedArtifactId.value = id
  selectedOwnerId.value = null
}
function takeArtifact() {
  if (!selectedArtifact.value || !selectedOwner.value) return
  emit('chooseArtifact', selectedArtifact.value.id, selectedOwner.value.instanceId, replaced.value?.instanceId, props.offerId)
}
</script>

<template>
  <main class="elite-reward">
    <div class="elite-content">
      <p class="reward-kicker">ЭЛИТНАЯ НАХОДКА · {{ encounterName.toUpperCase() }}</p>
      <h1>Выберите одну награду</h1>
      <p class="reward-copy">Одна карта из пяти или один личный артефакт. Новая находка занимает слот выбранного героя.</p>

      <div class="reward-tabs" role="tablist" aria-label="Виды награды">
        <button role="tab" :aria-selected="section === 'cards'" @click="section = 'cards'; selectedArtifactId = null; selectedOwnerId = null">Карты · {{ options.length }}</button>
        <button role="tab" :aria-selected="section === 'artifacts'" @click="section = 'artifacts'">Артефакты · {{ artifacts.length }}</button>
      </div>

      <section v-if="section === 'cards'" class="card-offer" aria-label="Карты на выбор">
        <button v-for="{ card, preview } in cardItems" :key="card.id" class="reward-option" :aria-label="'Взять карту: ' + card.name + '. ' + card.description" @click="emit('chooseCard', card, offerId)">
          <SpellCard :card="card" :preview="preview" />
          <CardNotes class="reward-notes" :card="card" :preview="preview" mode="choose" />
        </button>
      </section>

      <section v-else class="artifact-offer" aria-label="Артефакты на выбор">
        <div class="artifact-inventory" aria-label="Текущие артефакты отряда">
          <article v-for="hero in [heroes.warrior, heroes.mage]" :key="hero.instanceId" class="inventory-slot">
            <strong>{{ hero.name }}</strong>
            <span v-if="currentArtifact(hero.instanceId)">{{ artifactDefinition(currentArtifact(hero.instanceId)!.definitionId).name }}</span>
            <span v-else class="slot-empty">Слот свободен</span>
          </article>
        </div>
        <div class="artifact-options">
          <button v-for="artifact in artifacts" :key="artifact.id" class="artifact-option" :class="{ 'is-selected': selectedArtifactId === artifact.id }" :aria-pressed="selectedArtifactId === artifact.id" @click="selectArtifact(artifact.id)">
            <component :is="iconFor(artifact)" :size="28" :stroke-width="2" aria-hidden="true" />
            <strong>{{ artifact.name }}</strong>
            <span>{{ artifact.description }}</span>
          </button>
        </div>
        <div v-if="selectedArtifact" class="owner-choice" aria-live="polite">
          <p>Кому отдать «{{ selectedArtifact.name }}»?</p>
          <div class="owner-options">
            <button v-for="hero in [heroes.warrior, heroes.mage]" :key="hero.instanceId" class="owner-option" :class="{ 'is-selected': selectedOwnerId === hero.instanceId }" :aria-pressed="selectedOwnerId === hero.instanceId" @click="selectedOwnerId = hero.instanceId">
              <strong>{{ hero.name }}</strong>
              <span v-if="currentArtifact(hero.instanceId)">Заменить: {{ artifactDefinition(currentArtifact(hero.instanceId)!.definitionId).name }}</span>
              <span v-else>Слот свободен</span>
            </button>
          </div>
          <p v-if="replaced" class="replacement-copy">У выбранного героя сейчас «{{ artifactDefinition(replaced.definitionId).name }}». Подтверждение заменит его на новую находку.</p>
          <button class="take-button" :disabled="!selectedOwner" @click="takeArtifact">{{ replaced ? 'Заменить и взять артефакт' : 'Взять артефакт' }}</button>
        </div>
      </section>
      <p v-if="section === 'artifacts'" class="decline-hint">Выбор карты в соседней вкладке означает отказаться от всех предложенных артефактов.</p>
      <DeckViewer v-if="deck" :deck="deck" />
    </div>
  </main>
</template>

<style scoped>
.elite-reward{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:clamp(12px,2.5vh,24px) clamp(14px,3vw,48px);background:radial-gradient(ellipse at 50% 30%,#758768,#35564e 62%,#203c3a);color:var(--ink)}
.elite-content{width:min(1320px,100%);text-align:center}.reward-kicker{margin:4px 0;color:var(--gold);font:800 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
h1{margin:0;color:var(--parch-1);font:700 clamp(26px,3vw,42px)/var(--lh-tight) var(--font-display)}.reward-copy{margin:6px 0 12px;color:var(--muted);font-size:var(--fs-md)}
.reward-tabs{display:flex;justify-content:center;gap:var(--sp-2);margin:0 auto var(--sp-3)}.reward-tabs button,.owner-option,.take-button{border:var(--border-soft);border-radius:var(--shape-plank);background:var(--mat-quiet);color:var(--ink);font:800 var(--fs-sm) var(--font-ui);cursor:pointer}
.reward-tabs button{min-height:40px;padding:7px 20px}.reward-tabs button[aria-selected=true]{border-color:var(--brass-1);background:var(--mat-brass);color:var(--parch-ink)}
.card-offer{display:flex;justify-content:center;align-items:flex-start;gap:clamp(10px,1.3vw,22px)}.reward-option{display:flex;flex-direction:column;align-items:center;gap:.65em;width:min(19vw,245px);padding:.2em;border:0;border-radius:var(--shape-dialog);background:none;font-size:clamp(12px,min(1.3vw,2.4vh),22px);cursor:pointer;transition:transform var(--dur-base) var(--ease-out)}.reward-option:hover,.reward-option:focus-visible{transform:translateY(-.35em)}.reward-option:focus-visible,.artifact-option:focus-visible,.owner-option:focus-visible,.reward-tabs button:focus-visible,.take-button:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}.reward-notes{font-size:.68em;pointer-events:none}
.artifact-inventory{display:flex;justify-content:center;gap:var(--sp-3);margin-bottom:var(--sp-3)}.inventory-slot{display:grid;gap:2px;min-width:min(36vw,300px);padding:var(--sp-2) var(--sp-4);border:var(--border-soft);border-radius:var(--shape-banner);background:var(--mat-teal-panel);text-align:left}.inventory-slot strong{color:var(--brass-1);font:800 var(--fs-sm) var(--font-display)}.inventory-slot span{font-size:var(--fs-xs)}.slot-empty{color:var(--muted)}
.artifact-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-3);max-width:1050px;margin:0 auto}.artifact-option{display:grid;justify-items:center;align-content:start;gap:var(--sp-2);min-height:138px;padding:var(--sp-3);border:var(--border-soft);border-radius:var(--shape-dialog);background:var(--mat-quiet);color:var(--ink);font:500 var(--fs-sm)/var(--lh-body) var(--font-ui);cursor:pointer}.artifact-option svg{color:var(--gold)}.artifact-option strong{font:800 var(--fs-md) var(--font-display);color:var(--parch-1)}.artifact-option.is-selected,.owner-option.is-selected{border-color:var(--brass-1);box-shadow:var(--glow-bonus);background:var(--mat-wood)}
.owner-choice{max-width:900px;margin:var(--sp-3) auto 0}.owner-choice>p:first-child{margin:0 0 var(--sp-2);color:var(--parch-1);font:800 var(--fs-lg) var(--font-display)}.owner-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--sp-2)}.owner-option{display:grid;gap:2px;min-height:54px;padding:8px 12px;text-align:left}.owner-option span{color:var(--muted);font:600 var(--fs-xs) var(--font-ui)}.replacement-copy,.decline-hint{margin:var(--sp-2) 0;color:var(--gold);font-size:var(--fs-xs)}.take-button{margin-top:var(--sp-2);min-height:42px;padding:7px 20px;background:var(--mat-brass);color:var(--parch-ink)}.take-button:disabled{opacity:.5;cursor:default}
@media(max-height:760px){.elite-reward{padding-top:8px;padding-bottom:8px}.reward-copy{margin:4px 0 8px}.artifact-option{min-height:110px;padding:8px}.artifact-option svg{width:22px;height:22px}.artifact-inventory{margin-bottom:8px}.owner-choice{margin-top:8px}.owner-option{min-height:46px}}
@media(max-width:850px){.elite-reward{align-items:start}.card-offer{flex-wrap:wrap}.reward-option{width:min(42vw,245px)}.artifact-options{grid-template-columns:1fr}.artifact-option{min-height:unset}.inventory-slot{min-width:0;flex:1}.artifact-inventory{gap:6px}}
@media(prefers-reduced-motion:reduce){.reward-option{transition:none}.reward-option:hover,.reward-option:focus-visible{transform:none}}
</style>
