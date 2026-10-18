<script setup lang="ts">
// The end-turn plaque. Brass-framed plank; it starts to glow when the player has nothing left to play, so the next step is obvious.
import GlyphIcon from './GlyphIcon.vue'
defineProps<{ state: 'ready' | 'urgent' | 'busy'; label: string; sub: string }>()
defineEmits<{ press: [] }>()
</script>

<template>
  <button class="end" :class="'end--' + state" :disabled="state === 'busy'" @click="$emit('press')">
    <span class="end-plank"></span>
    <span class="end-copy"><strong>{{ label }}</strong><small>{{ sub }}</small></span>
    <kbd v-if="state !== 'busy'">Enter</kbd>
    <GlyphIcon v-else name="wait" class="end-wait" />
  </button>
</template>

<style scoped>
.end{position:relative;display:flex;align-items:center;justify-content:center;gap:.8rem;width:16rem;height:5.6rem;padding:0 1.2rem;border:0;background:none;color:#fff3d6;filter:drop-shadow(0 .5rem .6rem #000b)}
.end-plank{position:absolute;inset:0;border-radius:2.7rem 2.1rem 2.5rem 2.2rem/2.3rem 2.7rem 2.1rem 2.5rem;background:linear-gradient(180deg,#f5d58b,#c4893a 14%,#a1642a 50%,#7a461b 100%);box-shadow:0 .35rem 0 #4f2a10,inset 0 .12rem .1rem #fff8}
.end-plank::after{content:'';position:absolute;inset:.32rem;border-radius:inherit;background:linear-gradient(180deg,#d8923f,#b3672a 45%,#8a4a1d);box-shadow:inset 0 .12rem .1rem #ffe3a766}
.end-copy{position:relative;display:flex;flex-direction:column;align-items:center;gap:.15rem;text-shadow:0 .12rem .2rem #4a1f08}
.end-copy strong{font:800 1.5rem/1.1 var(--f-display);white-space:nowrap}
.end-copy small{font:700 .72rem/1.1 var(--f-ui);letter-spacing:.06em;color:#ffe6b8;opacity:.9}
.end kbd{position:relative;padding:.1rem .45rem;border:.08rem solid #ffe6b88a;border-radius:.35rem;background:#0004;font:700 .78rem/1.3 var(--f-num);color:#ffe6b8}
.end-wait{position:relative;width:1.5rem;height:1.5rem;animation:spin 3s linear infinite}
@keyframes spin{to{rotate:360deg}}
.end:not(:disabled):hover{filter:drop-shadow(0 .5rem .6rem #000b) brightness(1.12);translate:0 -.1rem}
.end:not(:disabled):active{translate:0 .15rem}
.end--busy{filter:drop-shadow(0 .5rem .6rem #000b) grayscale(.6) brightness(.75)}
.end--urgent{animation:urgent 1.5s ease-in-out infinite}
@keyframes urgent{50%{filter:drop-shadow(0 .5rem .6rem #000b) drop-shadow(0 0 1.3rem #ffd56bcc) brightness(1.12)}}
</style>
