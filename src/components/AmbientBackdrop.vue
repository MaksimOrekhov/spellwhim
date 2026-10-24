<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ambientParticleCount, type AmbientProfile } from '../ambient/profiles'
import { currentMotion, observeMotion } from '../vfx/motion'
const props = defineProps<{ profile: AmbientProfile; reduced?: boolean }>()
const reducedMotion = ref(currentMotion() === 'reduced')
const hidden = ref(false)
const calm = computed(() => props.reduced || reducedMotion.value)
const particles = computed(() => Array.from({ length: ambientParticleCount[props.profile] }, (_, i) => ({
  left: `${(i * 37.7 + 7) % 100}%`, top: `${8 + (i * 23.3) % 83}%`,
  '--delay': `${-(i * 2.83) % 23}s`, '--life': `${props.profile.startsWith('forge') ? 7 + i % 8 : 16 + i % 13}s`,
  '--drift': `${(i % 2 ? 1 : -1) * (12 + i % 23)}px`, '--size': `${i % 5 === 0 ? 3 : 1.5}px`,
})))
let release: (() => void) | undefined
function visibility() { hidden.value = document.hidden }
onMounted(() => { release = observeMotion(() => { reducedMotion.value = currentMotion() === 'reduced' }); visibility(); document.addEventListener('visibilitychange', visibility) })
onUnmounted(() => { release?.(); document.removeEventListener('visibilitychange', visibility) })
</script>

<template>
  <div class="ambient" :class="['ambient--' + profile, { 'is-paused': hidden, 'is-calm': calm }]" :data-ambient="profile" :data-ambient-paused="hidden || calm" aria-hidden="true">
    <template v-if="!calm">
      <div class="ambient-light ambient-light--near" /><div class="ambient-light ambient-light--far" /><div v-if="profile.startsWith('forge')" class="heat" />
      <i v-for="(style, i) in particles" :key="i" class="mote" :class="{ spark: i % 6 === 0 }" :style="style" />
    </template>
  </div>
</template>

<style scoped>
/* Behind the arena, clipped above the hand. All gradients are static rasters; only opacity/transform animate. No canvas, blur or frame loop. */
.ambient{position:absolute;inset:0;overflow:hidden;pointer-events:none;--ambient-light:var(--ambient-mine-light);--ambient-mote:var(--ambient-mine-mote);--rise:-48px}
.ambient--crystal{--ambient-light:var(--ambient-crystal-light);--ambient-mote:var(--ambient-crystal-mote)}
.ambient--forge,.ambient--forge-fury{--ambient-light:var(--ambient-forge-light);--ambient-mote:var(--ambient-forge-mote);--rise:-210px}
.ambient--forge-fury{--ambient-light:var(--ambient-fury-light);--ambient-mote:var(--ambient-fury-mote)}
.ambient-light{position:absolute;width:42%;height:65%;background:radial-gradient(ellipse,var(--ambient-light),transparent 68%);opacity:.12;animation:ambient-breathe 11s ease-in-out infinite alternate}
.ambient-light--near{left:-9%;top:5%}.ambient-light--far{right:-4%;top:8%;width:35%;animation-duration:17s;animation-delay:-7s}
.ambient--crystal .ambient-light--near{left:12%;top:-10%}.ambient--crystal .ambient-light--far{right:1%;top:16%;animation-duration:13s}
.ambient--forge .ambient-light--near,.ambient--forge-fury .ambient-light--near{left:48%;top:15%;width:54%;height:100%;animation-duration:5.7s}
.ambient--forge-fury .ambient-light--near{animation-name:forge-breathe}
.heat{position:absolute;right:5%;bottom:0;width:30%;height:48%;background:radial-gradient(ellipse at 50% 100%,var(--ambient-light),transparent 70%);opacity:.1;animation:heat-drift 13s ease-in-out infinite alternate}
.mote{position:absolute;width:var(--size);height:var(--size);border-radius:50%;background:var(--ambient-mote);opacity:0;animation:ambient-drift var(--life) linear var(--delay) infinite}
.spark{animation-name:ambient-spark}.ambient--crystal .spark{border-radius:0;rotate:45deg}.ambient--forge-fury .spark{animation-duration:6.3s}
.is-paused *{animation-play-state:paused!important}
@keyframes ambient-drift{0%{opacity:0;transform:translate(0,20px)}20%{opacity:.28}70%{opacity:.2}100%{opacity:0;transform:translate(var(--drift),var(--rise))}}
@keyframes ambient-spark{0%,72%,100%{opacity:0;transform:translate(0,0)}77%{opacity:.55}90%{opacity:.15}99%{transform:translate(var(--drift),var(--rise))}}
@keyframes ambient-breathe{0%,100%{opacity:.07}38%{opacity:.17}57%{opacity:.11}78%{opacity:.21}}
@keyframes forge-breathe{0%,100%{opacity:.12}47%{opacity:.25}52%{opacity:.3}70%{opacity:.16}}
@keyframes heat-drift{from{opacity:.06;transform:translateY(0) scaleX(.94)}to{opacity:.13;transform:translateY(-22px) scaleX(1.05)}}
@media(prefers-reduced-motion:reduce){.ambient *{animation:none!important;display:none}}
</style>
