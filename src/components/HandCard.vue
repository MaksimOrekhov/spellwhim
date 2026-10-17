<script setup lang="ts">
import { computed } from 'vue'
import { useCardDrag } from '../composables/useCardDrag'
import type { CardDefinition, CardPreview } from '../game/types'
import GameTooltip from './GameTooltip.vue'
import swordStrikeArt from '../assets/art/sword-strike.jpg'
import fireballArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
const props = defineProps<{ card: CardDefinition; instanceId: string; preview: CardPreview; reason: string | null; playing: boolean; index: number }>()
const emit = defineEmits<{ play: [instanceId: string]; dragging: [active: boolean, ready: boolean] }>()
const cardArt = { 'sword-strike': swordStrikeArt, fireball: fireballArt, guard: guardArt, 'quick-cut': swordStrikeArt, thunderbolt: fireballArt, bastion: guardArt }
const { dragging, offset, bounds, down, click } = useCardDrag({
  available: () => !props.reason && !props.playing,
  play: () => emit('play', props.instanceId),
  changed: (active, ready) => emit('dragging', active, ready),
})
const cardStyle = computed(() => dragging.value ? { opacity: .12 } : undefined)
const ghostStyle = computed(() => ({ left: bounds.value.left + offset.value.x + 'px', top: bounds.value.top + offset.value.y + 'px', width: bounds.value.width + 'px', height: bounds.value.height + 'px' }))
</script>
<template>
  <GameTooltip :label="card.name" :disabled="dragging || playing" class="hand-card-wrap">
    <button :id="'card-' + instanceId" class="spell-card" :class="['spell-card--' + card.className, { 'is-unavailable': !!reason, 'is-link-ready': preview.links.length > 0 && !reason, 'is-playing': playing, 'is-dragging': dragging }]" :style="cardStyle" :aria-disabled="!!reason || playing" :aria-label="(index + 1) + '. ' + card.name + ', ' + card.cost + ' маны. ' + (reason ?? card.description)" @pointerdown="down" @dragstart.prevent @click="click">
      <span class="card-cost">{{ card.cost }}</span><span class="card-art"><img :src="cardArt[card.id]" alt="" draggable="false" /></span>
      <strong class="card-name">{{ card.name }}</strong><span class="card-description">{{ card.description }}</span>
      <span class="card-footer"><span>{{ card.className === 'warrior' ? 'Бранн · Воин' : 'Лира · Маг' }}</span><b v-if="preview.links.length" class="card-link" aria-label="Связка готова">✦ +{{ preview.bonusDamage }}</b><kbd v-else>{{ index + 1 }}</kbd></span>
    </button>
    <template #content><p>{{ card.description }}</p><p v-if="preview.links.length" class="tooltip-accent">{{ preview.links.join(' · ') }}: +{{ preview.bonusDamage }} → {{ preview.damage }} урона.</p><p v-if="preview.draw">Добор: до {{ preview.draw }} {{ preview.draw === 1 ? 'карты' : 'карт' }}.</p><p v-if="card.exhaust">Эта копия выбывает до конца боя.</p><p v-if="reason" class="tooltip-reason">{{ reason }}</p><p v-else class="tooltip-reason">Кликните или потяните вверх — точно целиться не нужно.</p></template>
  </GameTooltip>
  <Teleport to="body"><div v-if="dragging" class="drag-preview" :class="{ 'drag-preview--ready': offset.y < -55 }" :style="ghostStyle" aria-hidden="true"><img :src="cardArt[card.id]" alt="" /><strong>{{ card.name }}</strong><span>{{ card.description }}</span><b>{{ card.cost }} маны</b></div></Teleport>
</template>
<style scoped>
.drag-preview{position:fixed;z-index:1100;display:grid;grid-template-rows:minmax(50px,1fr) auto auto auto;gap:6px;padding:10px;border:2px solid #dfbf84;border-radius:14px;background:#3e4940;color:#fff0d2;box-shadow:0 12px 30px #0a202090;pointer-events:none;text-align:center;font:14px/1.3 'Trebuchet MS',Arial,sans-serif}.drag-preview img{width:100%;height:100%;min-height:0;object-fit:cover;border-radius:8px}.drag-preview strong{font:700 18px var(--display)}.drag-preview b{color:#c3eaf0}.drag-preview--ready{border-color:#b8e9c0;box-shadow:0 0 0 3px #9ce5bc50,0 12px 30px #0a202090}
.hand-card-wrap{flex:0 0 clamp(180px,14vw,250px);height:var(--card-height);transition:transform .18s ease;transform-origin:bottom center}.hand-card-wrap:hover,.hand-card-wrap:focus-within{z-index:12;transform:translateY(-12px) scale(1.035)}.spell-card{position:relative;display:grid;grid-template-rows:minmax(62px,1fr) auto minmax(52px,auto) 18px;gap:5px;width:100%;height:100%;padding:9px 10px 10px;border:2px solid #c79454;border-radius:15px 15px 12px 12px;background:linear-gradient(130deg,#bc8a4f,#644935 12%,#41403a 45%,#343a34);box-shadow:0 6px 16px #0b202c70,inset 0 0 0 2px #d0a46444;color:#fff0d3;text-align:center;touch-action:none;cursor:grab;transition:filter .16s,border-color .16s}.spell-card--mage{background:linear-gradient(130deg,#b19ac4,#63506d 12%,#413e50 45%,#323b45);border-color:#ac8ec2}.card-art{position:relative;overflow:hidden;border:1px solid #d4b36e;border-radius:9px 9px 4px 4px;min-height:0}.card-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 47%}.card-cost{position:absolute;z-index:2;left:0;top:0;display:grid;place-items:center;width:36px;height:42px;clip-path:polygon(50% 0,96% 23%,88% 78%,50% 100%,12% 78%,4% 23%);background:linear-gradient(135deg,#a8edee,#2a84a5 70%);color:white;font:bold 26px var(--display);text-shadow:0 2px 3px #174d6b;filter:drop-shadow(0 2px 2px #152d39)}.card-name{display:grid;place-items:center;min-height:33px;font:700 clamp(16px,1.05vw,20px)/1.1 var(--display);color:#fff0cb}.card-description{font-size:clamp(14px,1vw,17px);line-height:1.28;align-self:center;color:#f0e4cb}.card-footer{display:flex;align-items:center;justify-content:space-between;gap:5px;border-top:1px solid #dcc0914d;padding-top:5px;font-size:12px;color:#d2c5a7}.card-footer kbd{font:12px inherit;border:1px solid #ad9d7766;border-radius:4px;padding:0 4px}.card-link{color:#edc6ff;font-size:14px}.is-link-ready{border-color:#d5abec;box-shadow:0 0 0 1px #e2c9f3,0 6px 16px #0b202c70}.is-unavailable{filter:saturate(.55);border-color:#6c8078}.is-unavailable .card-cost{filter:grayscale(.5);opacity:.75}.is-dragging{cursor:grabbing;transition:none}.is-playing{pointer-events:none;animation:card-play .36s ease-in forwards}@keyframes card-play{to{transform:translateY(-100px) scale(.55);opacity:0}}
@media(max-height:700px){.spell-card{grid-template-rows:minmax(45px,1fr) auto minmax(47px,auto) 16px;gap:3px;padding:7px 8px}.card-name{font-size:16px;min-height:27px}.card-description{font-size:14px}.card-footer{font-size:11px;padding-top:3px}.card-cost{width:31px;height:36px;font-size:23px}}
</style>
