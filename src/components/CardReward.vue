<script setup lang="ts">
import swordArt from '../assets/art/sword-strike.jpg'
import fireArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
import type { CardDefinition } from '../game/types'

defineProps<{ options: CardDefinition[]; encounterName: string }>()
const emit = defineEmits<{ choose: [card: CardDefinition] }>()
const artById = { 'sword-strike': swordArt, fireball: fireArt, guard: guardArt, 'quick-cut': swordArt, thunderbolt: fireArt, bastion: guardArt }
</script>

<template>
  <main class="reward-screen">
    <div class="reward-content">
      <span class="reward-spark">✦</span>
      <p class="reward-kicker">ПОБЕДА · {{ encounterName.toUpperCase() }}</p>
      <h1>Найдите новую силу</h1>
      <p class="reward-copy">Выберите одну карту. Она останется с отрядом до конца похода.</p>
      <div class="reward-options">
        <button v-for="card in options" :key="card.id" class="reward-card" :class="[`reward-card--${card.className}`]" @click="emit('choose', card)">
          <span class="reward-card-cost">{{ card.cost }}</span>
          <img :src="artById[card.id]" alt="" aria-hidden="true" />
          <strong>{{ card.name }}</strong>
          <small>{{ card.className === 'mage' ? 'ЧАРОДЕЙКА' : 'ВОИН' }} · {{ card.kind === 'defense' ? 'ЗАЩИТА' : card.kind === 'spell' ? 'ЗАКЛИНАНИЕ' : 'АТАКА' }}</small>
          <span class="reward-card-description">{{ card.description }}</span>
          <span class="reward-select">ВЗЯТЬ КАРТУ</span>
        </button>
      </div>
    </div>
  </main>
</template>

<style scoped>
.reward-screen{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:4vh 5vw;background:radial-gradient(ellipse at 50% 44%,#403954f5,#1b1c2cf7 72%,#101520fa);color:#fff1d1}
.reward-content{width:min(980px,94vw);text-align:center}
.reward-spark{display:block;color:#ffe1a0;font-size:32px;text-shadow:0 0 20px #ffc65c}
.reward-kicker{margin:8px 0;color:#e4c582;font:700 9px Cinzel,Georgia,serif;letter-spacing:.2em}
.reward-content h1{margin:0;color:#fff0ca;font:700 clamp(25px,3vw,40px) Cinzel,Georgia,serif;text-shadow:0 4px 14px #0008}
.reward-copy{margin:10px 0 25px;color:#d5c7ae;font:500 13px Manrope,Arial,sans-serif}
.reward-options{display:flex;justify-content:center;gap:clamp(10px,2vw,24px)}
.reward-card{position:relative;display:flex;flex:1;flex-direction:column;align-items:center;max-width:245px;min-width:0;padding:12px 15px 16px;border:1px solid #e7c688;border-radius:9px;background:linear-gradient(150deg,#c89556 0 3%,#2c2839 8% 94%,#bc854e 98%);color:#fff0d2;box-shadow:0 12px 30px #0008,inset 0 0 24px #e6bd6b17;cursor:pointer;transition:transform .2s,box-shadow .2s,border-color .2s}
.reward-card:hover{transform:translateY(-8px);border-color:#fff0b5;box-shadow:0 20px 40px #0009,0 0 25px #ffcb6a3c,inset 0 0 24px #e6bd6b2b}
.reward-card--mage{background:linear-gradient(150deg,#d6b2f2 0 3%,#30273f 8% 94%,#b18bd0 98%)}
.reward-card-cost{position:absolute;z-index:1;top:13px;left:13px;display:grid;place-items:center;width:30px;height:34px;clip-path:polygon(50% 0,95% 25%,87% 77%,50% 100%,13% 77%,5% 25%);background:linear-gradient(145deg,#a8efff,#237cb5);color:white;font:800 18px Cinzel,Georgia,serif;text-shadow:0 2px 3px #174363}
.reward-card img{width:100%;height:clamp(115px,18vh,185px);object-fit:cover;border:2px solid #e7c47e;border-radius:48% 48% 8px 8px;box-shadow:0 0 22px #ffdc8d34}
.reward-card--mage img{border-color:#ddb8ff;box-shadow:0 0 22px #b879ff35}
.reward-card strong{display:grid;place-items:center;width:100%;min-height:38px;margin-top:8px;border:1px solid #e8c58b;border-radius:16px;background:#3c2c35;color:#fff0cb;font:700 clamp(11px,1vw,14px) Cinzel,Georgia,serif}
.reward-card--mage strong{border-color:#dfb8ff;background:#392b49}
.reward-card small{margin-top:9px;color:#e2c682;font:700 8px Cinzel,Georgia,serif;letter-spacing:.14em}
.reward-card-description{min-height:34px;margin-top:8px;color:#e5dac6;font:500 11px/1.45 Manrope,Arial,sans-serif}
.reward-select{margin-top:8px;padding:8px 12px;border:1px solid #f0d18e;border-radius:4px;background:linear-gradient(#b98343,#86552c);color:#fff0c9;font:700 8px Cinzel,Georgia,serif;letter-spacing:.12em}
@media(max-width:650px){.reward-screen{padding:3vh 3vw}.reward-options{gap:7px;align-items:stretch}.reward-card{padding:8px 7px 10px;border-radius:6px}.reward-card img{height:clamp(90px,15vh,145px)}.reward-card-cost{top:8px;left:8px;width:25px;height:29px;font-size:15px}.reward-card strong{font-size:9px;min-height:34px}.reward-card small{font-size:6px}.reward-card-description{font-size:8px}.reward-select{padding:7px 5px;font-size:6px}.reward-copy{margin-bottom:17px;font-size:11px}}
</style>
