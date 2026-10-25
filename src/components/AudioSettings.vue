<script setup lang="ts">
import { ref } from 'vue'
import { Volume2, VolumeX } from '@lucide/vue'
import { useAudio } from '../audio/useAudio'
const open = ref(false)
const { settings, update, unlock } = useAudio()
function mute() { update({ muted: !settings.value.muted }); if (!settings.value.muted) void unlock() }
</script>

<template>
  <aside class="audio-control" @keydown.esc.stop="open = false">
    <button class="audio-toggle" type="button" aria-label="Настройки звука" :aria-expanded="open" aria-controls="audio-options" @click="open = !open"><VolumeX v-if="settings.muted" :size="19" /><Volume2 v-else :size="19" /></button>
    <div v-if="open" id="audio-options" class="audio-options">
      <strong>Звук</strong>
      <button class="game-button" type="button" :aria-pressed="settings.muted" @click="mute">{{ settings.muted ? 'Включить звук' : 'Выключить звук' }}</button>
      <label>Музыка <output>{{ Math.round(settings.music * 100) }}%</output><input aria-label="Громкость музыки" type="range" min="0" max="1" step="0.05" :value="settings.music" @input="update({ music: Number(($event.target as HTMLInputElement).value) })" /></label>
      <label>Эффекты <output>{{ Math.round(settings.effects * 100) }}%</output><input aria-label="Громкость эффектов" type="range" min="0" max="1" step="0.05" :value="settings.effects" @input="update({ effects: Number(($event.target as HTMLInputElement).value) })" /></label>
      <label>Окружение <output>{{ Math.round(settings.ambience * 100) }}%</output><input aria-label="Громкость окружения" type="range" min="0" max="1" step="0.05" :value="settings.ambience" @input="update({ ambience: Number(($event.target as HTMLInputElement).value) })" /></label>
      <button type="button" class="audio-close" @click="open = false">Закрыть</button>
    </div>
  </aside>
</template>

<style scoped>
.audio-control{position:absolute;z-index:85;right:var(--sp-3);top:calc(var(--sp-3) + 72px);color:var(--ink);font:var(--fs-sm)/var(--lh-snug) var(--font-ui)}
.audio-toggle{display:grid;place-items:center;width:34px;height:34px;border:var(--border-brass);border-radius:var(--shape-chip);color:var(--gold);background:var(--wood-1);box-shadow:var(--shadow-1);cursor:pointer}
.audio-options{position:absolute;right:42px;top:0;display:grid;gap:var(--sp-3);width:240px;padding:var(--sp-4);border:var(--border-brass);border-radius:var(--shape-scroll);background:var(--wood-1);box-shadow:var(--shadow-3)}
.audio-options strong{font-family:var(--font-display);color:var(--gold)}.audio-options label{display:grid;grid-template-columns:1fr auto;gap:var(--sp-1)}.audio-options input{grid-column:1/-1;width:100%;accent-color:var(--gold)}.audio-options .game-button{font-size:var(--fs-sm)}
.audio-close{justify-self:end;background:none;border:0;color:var(--gold);font:inherit;cursor:pointer;text-decoration:underline}
</style>
