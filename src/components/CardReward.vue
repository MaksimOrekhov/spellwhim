<script setup lang="ts">
import swordArt from '../assets/art/sword-strike.jpg'
import fireArt from '../assets/art/fireball.jpg'
import guardArt from '../assets/art/guard.jpg'
import quickCutArt from '../assets/art/quick-cut.jpg'
import thunderboltArt from '../assets/art/thunderbolt.jpg'
import bastionArt from '../assets/art/bastion.jpg'
import type { CardDefinition } from '../game/types'

defineProps<{ options: CardDefinition[]; encounterName: string }>()
const emit = defineEmits<{ choose: [card: CardDefinition] }>()
const artById = { 'sword-strike': swordArt, fireball: fireArt, guard: guardArt, 'quick-cut': quickCutArt, thunderbolt: thunderboltArt, bastion: bastionArt }
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
.reward-screen{position:absolute;z-index:8;inset:0;display:grid;place-items:center;overflow:auto;padding:4vh 5vw;background:radial-gradient(ellipse at 50% 30%,#758768,#35564e 62%,#203c3a);color:var(--ink)}.reward-content{width:min(1100px,94vw);text-align:center}.reward-spark{font-size:36px;color:#ffe1a0}.reward-kicker{margin:8px 0;font-size:14px;color:#e1d4b4}.reward-content h1{margin:0;font:700 clamp(30px,3vw,46px) var(--display);color:#fff0ca}.reward-copy{margin:12px 0 28px;color:#e4dfcb;font-size:17px}.reward-options{display:flex;justify-content:center;gap:24px}.reward-card{position:relative;display:flex;flex:1;flex-direction:column;align-items:center;max-width:290px;min-width:0;padding:15px 18px 20px;border:2px solid #cea36a;border-radius:16px;background:linear-gradient(145deg,#645340,#334b43);color:var(--ink);box-shadow:0 12px 30px #173b3466;transition:transform .2s}.reward-card:hover{transform:translateY(-7px);border-color:#ffe0a4}.reward-card--mage{border-color:#bd9fd1;background:linear-gradient(145deg,#62566b,#324b4a)}.reward-card-cost{position:absolute;z-index:1;top:12px;left:10px;display:grid;place-items:center;width:36px;height:42px;clip-path:polygon(50% 0,95% 25%,87% 77%,50% 100%,13% 77%,5% 25%);background:linear-gradient(145deg,#a8efff,#237cb5);font:700 26px var(--display)}.reward-card img{width:100%;height:clamp(130px,20vh,250px);object-fit:cover;border:1px solid #d3b078;border-radius:10px}.reward-card strong{min-height:44px;margin-top:12px;display:grid;place-items:center;font:700 clamp(18px,1.5vw,24px) var(--display);color:#ffebbd}.reward-card small{margin:8px 0;color:#d5ceb7;font-size:12px}.reward-card-description{min-height:64px;font-size:17px;line-height:1.4;margin:5px 0 12px}.reward-select{margin-top:auto;padding:10px 20px;border:1px solid #e7c18a;border-radius:8px;background:#986b3f;color:#fff0d1;font-size:15px;font-weight:700}
@media(max-height:700px){.reward-screen{padding:18px}.reward-spark{display:none}.reward-copy{margin:8px 0 18px;font-size:15px}.reward-card{padding:12px;max-width:250px}.reward-card img{height:125px}.reward-card strong{font-size:19px;margin-top:8px}.reward-card-description{font-size:15px;min-height:60px}.reward-content h1{font-size:30px}}
</style>
