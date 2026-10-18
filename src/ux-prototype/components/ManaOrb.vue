<script setup lang="ts">
// The party's shared mana as a glass crystal orb: the level IS the amount, the big number repeats it, pips show the cap.
import { computed } from 'vue'
const props = defineProps<{ mana: number; max: number; nextMax?: number }>()
const level = computed(() => props.max ? props.mana / props.max : 0)
const hint = computed(() => props.nextMax && props.nextMax !== props.max ? `следующий ход: до ${props.nextMax}` : props.max >= 5 ? 'максимум маны' : '')
</script>

<template>
  <div class="orb" role="img" :aria-label="`Мана отряда: ${mana} из ${max}`">
    <div class="sphere">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <radialGradient id="o-glass" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#2d5a86"/><stop offset=".6" stop-color="#0d2745"/><stop offset="1" stop-color="#061425"/></radialGradient>
          <linearGradient id="o-liquid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ee9ff"/><stop offset=".45" stop-color="#2fa8e8"/><stop offset="1" stop-color="#12489a"/></linearGradient>
          <clipPath id="o-clip"><circle cx="60" cy="60" r="47"/></clipPath>
        </defs>
        <circle cx="60" cy="60" r="47" fill="url(#o-glass)"/>
        <g clip-path="url(#o-clip)">
          <g class="liquid" :style="{ transform: `translateY(${(1 - level) * 94}px)` }">
            <path class="wave" d="M-60 13q15-9 30 0t30 0 30 0 30 0 30 0 30 0V140H-60z" fill="url(#o-liquid)"/>
            <path class="wave wave--b" d="M-60 11q15 8 30 0t30 0 30 0 30 0 30 0 30 0V140H-60z" fill="#9ee9ff" opacity=".35"/>
          </g>
        </g>
        <ellipse cx="44" cy="36" rx="20" ry="10" fill="#fff" opacity=".26" transform="rotate(-28 44 36)"/>
        <circle cx="60" cy="60" r="47" fill="none" stroke="#bfeaff" stroke-opacity=".5" stroke-width="1.5"/>
      </svg>
      <span class="num"><b>{{ mana }}</b><i>/{{ max }}</i></span>
      <span class="ring"></span>
    </div>
    <div class="pips" aria-hidden="true"><i v-for="n in max" :key="n" :class="{ on: n <= mana }"></i></div>
    <small class="label">Мана отряда</small>
    <small v-if="hint" class="hint">{{ hint }}</small>
  </div>
</template>

<style scoped>
.orb{position:relative;display:flex;flex-direction:column;align-items:center;width:10rem}
.sphere{position:relative;width:8.8rem;height:8.8rem;filter:drop-shadow(0 .5rem .7rem #000c) drop-shadow(0 0 1.2rem #3fb2f066)}
.sphere svg{width:100%;height:100%;display:block}
.liquid{transition:transform .55s var(--ease-out)}
.wave{animation:slosh 5s ease-in-out infinite}
.wave--b{animation-duration:3.6s;animation-direction:reverse}
@keyframes slosh{50%{translate:20px 0}}
.num{position:absolute;inset:0;display:flex;align-items:baseline;justify-content:center;padding-top:2.2rem;text-shadow:0 .1rem .25rem #04162d,0 0 .6rem #04162d}
.num b{font:800 3.6rem/1 var(--f-num);color:#fff}
.num i{font:700 1.4rem/1 var(--f-num);font-style:normal;color:#bfeaff}
.ring{position:absolute;inset:-.25rem;border-radius:50%;border:.42rem solid transparent;background:conic-gradient(from 200deg,#f7dc98,#8a6228,#e4bc66,#4f3716,#f7dc98) border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box exclude,linear-gradient(#000 0 0);mask:linear-gradient(#000 0 0) padding-box exclude,linear-gradient(#000 0 0);pointer-events:none}
.pips{display:flex;gap:.3rem;margin-top:.7rem}
.pips i{width:1rem;height:1.25rem;border-radius:46% 46% 50% 50%/36% 36% 64% 64%;background:#17344f;opacity:.8}
.pips i.on{background:linear-gradient(#bff0ff,#2c9fe6 60%,#14509e);box-shadow:0 0 .5rem #62d0ff;opacity:1}
.label{margin-top:.35rem;font:800 .72rem/1 var(--f-ui);letter-spacing:.18em;text-transform:uppercase;color:#bfe6f8;text-shadow:0 .1rem .2rem #000}
.hint{margin-top:.15rem;font:600 .74rem/1.2 var(--f-ui);color:#f0dfb4;text-shadow:0 .1rem .2rem #000;text-align:center}
</style>
