<script setup lang="ts">
import { computed, ref } from 'vue'
import CardReward from './CardReward.vue'
import HandCard from './HandCard.vue'
import { cards, type CardDefinition, type CardPreview } from '../game/types'
import { classThemeStyle } from '../game/classThemes'
import defensiveParryArt from '../../art-exploration/card-design-system-v01/warrior-defensive-parry.png'
import mageFireballArt from '../../art-exploration/card-design-system-v01/mage-fireball.png'
import arcaneBoltArt from '../../art-exploration/card-design-system-v01/mage-arcane-bolt.png'

const mode = ref<'hand' | 'reward'>('hand')
const lastPlayed = ref('')
const handCount = ref(8)
const sampleIds = ['sword-strike', 'fireball', 'guard', 'thunderbolt', 'parry', 'shield-bash', 'interpose', 'frostbolt', 'arcane-insight', 'ice-ward'] as const
const sampleCards = computed(() => sampleIds.slice(0, handCount.value).map((id, index) => ({
  card: cards.find(card => card.id === id)!,
  instanceId: `preview-${index}`,
  preview: previewFor(id),
  reason: index === 7 ? 'Недостаточно маны: нужно 2, доступно 1.' : null,
  playing: false,
  index,
  artOverride: id === 'guard' ? defensiveParryArt : id === 'fireball' ? mageFireballArt : id === 'thunderbolt' ? arcaneBoltArt : undefined,
})))
const rewardOptions = computed(() => ['parry', 'fireball', 'ice-ward'].map(id => cards.find(card => card.id === id)!))
const rewardArtOverrides = { 'fireball': mageFireballArt, 'guard': defensiveParryArt }

function previewFor(id: CardDefinition['id']): CardPreview {
  const preview: CardPreview = {
    damage: 0,
    armorDamage: 0,
    healthDamage: 0,
    bonusDamage: 0,
    vulnerabilityBonus: 0,
    armorBonus: 0,
    armor: { warrior: 0, mage: 0 },
    draw: 0,
    bonuses: [],
    appliedStatuses: [],
  }
  if (id === 'sword-strike') return { ...preview, damage: 9, healthDamage: 9, bonusDamage: 3, vulnerabilityBonus: 3, bonuses: ['Уязвимость'] }
  if (id === 'fireball') return { ...preview, damage: 8, healthDamage: 8 }
  if (id === 'thunderbolt') return { ...preview, damage: 6, healthDamage: 6, bonusDamage: 2, armorBonus: 2, draw: 1, bonuses: ['Броня Джайны'] }
  if (id === 'quick-cut') return { ...preview, damage: 3, healthDamage: 3 }
  if (id === 'guard') return { ...preview, armor: { warrior: 4, mage: 0 } }
  if (id === 'parry') return { ...preview, damage: 3, healthDamage: 3, armor: { warrior: 3, mage: 0 } }
  if (id === 'shield-bash') return { ...preview, damage: 8, healthDamage: 8, armor: { warrior: 3, mage: 0 }, vulnerabilityBonus: 3, bonuses: ['Уязвимость'] }
  if (id === 'interpose') return { ...preview, armor: { warrior: 0, mage: 5 } }
  if (id === 'frostbolt') return { ...preview, damage: 6, healthDamage: 6, armorBonus: 2, bonuses: ['Броня Джайны'], appliedStatuses: ['vulnerability'] }
  if (id === 'arcane-insight') return { ...preview, draw: 1 }
  if (id === 'ice-ward') return { ...preview, armor: { warrior: 2, mage: 3 } }
  return { ...preview, armor: { warrior: 6, mage: 3 } }
}

function recordPlay(card: CardDefinition) {
  lastPlayed.value = `Демо-клик: ${card.name}`
}
</script>

<template>
  <main class="card-preview-page">
    <header class="card-preview-header">
      <div>
        <p class="card-preview-kicker">SPELLWHIM · CLASS CARD IDENTITY v0.1</p>
        <h1>Классовые темы карт</h1>
        <p>Цвет, форма и эмблема различают классы; индикаторы Уязвимости и маны остаются отдельными.</p>
      </div>
      <nav aria-label="Режим предпросмотра">
        <button :aria-pressed="mode === 'hand' && handCount === 8" @click="mode = 'hand'; handCount = 8">Рука · 8</button>
        <button :aria-pressed="mode === 'hand' && handCount === 10" @click="mode = 'hand'; handCount = 10">Рука · 10</button>
        <button :aria-pressed="mode === 'reward'" @click="mode = 'reward'">Награда</button>
      </nav>
    </header>

    <template v-if="mode === 'hand'">
      <section class="card-preview-legend" aria-label="Классовые цветовые темы">
        <div class="card-preview-class" :style="classThemeStyle('warrior')"><span class="legend-swatch"></span><span><b>ВОИН · STEEL & EMBER</b><small>Багряный · бронза · сталь</small></span></div>
        <div class="card-preview-class" :style="classThemeStyle('mage')"><span class="legend-swatch"></span><span><b>МАГ · ARCANE & WONDER</b><small>Сапфир · аметист · лёд</small></span></div>
        <p class="card-preview-status">{{ lastPlayed || 'Уязвимость и нехватка маны показаны для проверки состояний.' }}</p>
      </section>
      <section class="card-preview-hand" aria-label="Смешанная рука из восьми карт">
        <div class="card-preview-hand-heading"><h2>Смешанная рука · {{ handCount }} карт</h2><span>Наведите на карту, чтобы поднять и прочитать</span></div>
        <div class="card-preview-hand-scroll">
          <div class="hand-cards" :class="{ 'hand-cards--fan': sampleCards.length > 4 }"><HandCard v-for="sample in sampleCards" :key="sample.instanceId" v-bind="sample" @play="recordPlay(sample.card)" /></div>
        </div>
      </section>
      <footer class="card-preview-footnote">Экран предпросмотра · демонстрационные игровые состояния</footer>
    </template>

    <CardReward v-else :options="rewardOptions" :art-overrides="rewardArtOverrides" encounter-name="Шахтный забой" @choose="mode = 'hand'" />
  </main>
</template>

<style>
.card-preview-page{position:relative;width:100%;height:100%;min-height:560px;overflow:hidden;padding:clamp(20px,3vh,44px) clamp(18px,4vw,72px);background:radial-gradient(ellipse at 50% 18%,#385453,#203636 67%,#152a2b);color:var(--ink)}
.card-preview-header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}.card-preview-header h1{margin:3px 0 6px;font:700 clamp(28px,2.5vw,42px) var(--display);color:#fff0ca}.card-preview-header p:not(.card-preview-kicker){margin:0;color:#d7d9c8;font-size:15px}.card-preview-kicker{margin:0;color:#ecd29d;font-size:12px;font-weight:800;letter-spacing:.16em}.card-preview-header nav{display:flex;gap:8px}.card-preview-header nav button{border:1px solid #d7b57988;border-radius:8px;padding:10px 14px;background:#203436;color:#f5e8c9;font-weight:700}.card-preview-header nav button[aria-pressed="true"]{border-color:#ffe1a2;background:#644b38}
.card-preview-legend{display:flex;align-items:center;gap:clamp(16px,3vw,48px);margin-top:clamp(22px,4vh,48px);padding:12px 18px;border:1px solid #d7b57952;border-radius:12px;background:#172b2bcc}.card-preview-class{display:flex;align-items:center;gap:10px}.card-preview-class b,.card-preview-class small{display:block}.card-preview-class b{font-size:12px;letter-spacing:.08em}.card-preview-class small{margin-top:4px;color:#c4c8ba;font-size:12px}.legend-swatch{width:22px;height:22px;border:2px solid var(--class-accent);border-radius:6px;background:var(--class-primary);box-shadow:0 0 12px color-mix(in srgb,var(--class-primary) 60%,transparent)}.card-preview-status{margin:0 0 0 auto;color:#e8d6ff;font-size:13px;text-align:right}
.card-preview-hand{position:absolute;left:clamp(14px,3vw,56px);right:clamp(14px,3vw,56px);bottom:32px}.card-preview-hand-heading{display:flex;justify-content:space-between;align-items:baseline;margin:0 6px 10px}.card-preview-hand-heading h2{margin:0;color:#fff0ca;font:700 19px var(--display)}.card-preview-hand-heading span{color:#c4c8ba;font-size:12px}.card-preview-hand-scroll{height:var(--hand-height);padding:6px 10px 14px;overflow:visible}.card-preview-hand-scroll .hand-cards{display:flex;width:100%;height:100%;align-items:flex-end;justify-content:center;gap:0;overflow:visible}.card-preview-hand-scroll .hand-card-wrap{height:var(--card-height)}.card-preview-hand-scroll .hand-cards--fan .hand-card-wrap{flex:0 0 clamp(130px,10vw,190px);margin-left:clamp(-85px,-4.5vw,-54px)}.card-preview-hand-scroll .hand-cards--fan .hand-card-wrap:first-child{margin-left:0}.card-preview-footnote{position:absolute;right:clamp(18px,4vw,72px);top:12px;color:#aeb8ae;font-size:10px;letter-spacing:.08em}
@media(max-height:760px){.card-preview-page{padding-top:20px}.card-preview-legend{margin-top:18px}.card-preview-hand{bottom:20px}.card-preview-hand-scroll .hand-card-wrap{flex-basis:clamp(132px,13vw,196px)}}
@media(max-width:900px){.card-preview-header{flex-direction:column}.card-preview-legend{flex-wrap:wrap}.card-preview-status{width:100%;margin-left:0;text-align:left}.card-preview-hand-heading span{display:none}}
</style>
