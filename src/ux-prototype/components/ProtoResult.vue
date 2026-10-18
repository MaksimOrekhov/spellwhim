<script setup lang="ts">
// Victory / defeat as a banner across the scene (not a generic dialog). The scene stays visible, dimmed, behind it.
import type { GameResult } from '../../game/types'
import GlyphIcon from './GlyphIcon.vue'
defineProps<{ result: Exclude<GameResult, null> }>()
defineEmits<{ next: []; again: [] }>()
</script>

<template>
  <section class="result" :class="'result--' + result" role="dialog" aria-modal="true" :aria-label="result === 'victory' ? 'Победа' : 'Поражение'">
    <div class="band">
      <span class="gem"><GlyphIcon :name="result === 'victory' ? 'crown' : 'skull'" /></span>
      <small>{{ result === 'victory' ? 'Путь открыт' : 'Отряд пал' }}</small>
      <h1>{{ result === 'victory' ? 'Победа!' : 'Поражение' }}</h1>
      <p>{{ result === 'victory' ? 'Чаща отступила. Пора двигаться дальше.' : 'Уязвимость и прикрытие героя под прицелом решают исход боя.' }}</p>
      <button class="cta" autofocus @click="result === 'victory' ? $emit('next') : $emit('again')">{{ result === 'victory' ? 'Выбрать награду' : 'Начать заново' }}</button>
    </div>
  </section>
</template>

<style scoped>
.result{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 50%,#0b141099,#05100cdd);animation:fade .35s ease-out}
@keyframes fade{from{opacity:0}}
.band{position:relative;width:100%;padding:2.4rem 0 2.6rem;text-align:center;background:linear-gradient(90deg,#0000,#5d430acc 14%,#7a5710dd 50%,#5d430acc 86%,#0000);border-block:.16rem solid #e8c97888;animation:band .6s var(--ease-out)}
.result--defeat .band{background:linear-gradient(90deg,#0000,#4a1209cc 14%,#6a1a0fdd 50%,#4a1209cc 86%,#0000);border-color:#ff9a6d88}
@keyframes band{from{opacity:0;transform:scaleY(.2)}}
.gem{display:inline-grid;place-items:center;width:5.4rem;height:5.4rem;margin-top:-5.2rem;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff3b8,#e0a53a 55%,#7a4a10);border:.28rem solid #4f3716;color:#3a2208;font-size:3rem;box-shadow:0 .5rem 1rem #000a,0 0 2rem #ffd56b99}
.result--defeat .gem{background:radial-gradient(circle at 35% 28%,#ffd1c2,#d2503a 55%,#6a1a0f);color:#2a0a05;box-shadow:0 .5rem 1rem #000a,0 0 2rem #ff6a3d88}
small{display:block;margin-top:.6rem;font:800 .85rem var(--f-ui);letter-spacing:.22em;text-transform:uppercase;color:#ffe9b0}
h1{margin:.2rem 0;font:800 5rem/1.1 var(--f-display);color:#fff3d6;text-shadow:0 .25rem .6rem #000b}
p{margin:0 0 1.4rem;font:600 1.2rem var(--f-ui);color:#f6e8c6}
.cta{padding:.9rem 3.2rem;border:.16rem solid #ffe3a7;border-radius:2.2rem 1.7rem 2.1rem 1.8rem/1.8rem 2.2rem 1.7rem 2.1rem;background:linear-gradient(#e8a24a,#9a5420);box-shadow:0 .3rem 0 #4a1f08,0 .8rem 1.2rem #000b;color:#fff8e0;font:800 1.4rem var(--f-display)}
.cta:hover{filter:brightness(1.1)}
@media (max-height:820px){h1{font-size:3.6rem}.band{padding:1.6rem 0 1.8rem}}
</style>
