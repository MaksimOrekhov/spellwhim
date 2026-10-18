<script setup lang="ts">
import { computed } from 'vue'
import varianPortrait from '../assets/art/varian.jpg'
import jainaPortrait from '../assets/art/jaina.jpg'
import guardianPortrait from '../assets/art/guardian.jpg'
import vulnerabilityIcon from '../assets/art/vulnerability.svg'
import GameTooltip from './GameTooltip.vue'
import { statusDefinitions } from '../game/types'
import type { Hero } from '../game/types'
const props = defineProps<{ hero: Hero; side: 'player' | 'enemy'; targeted?: boolean; damaged?: boolean; active?: boolean; vulnerable?: boolean; appearance?: 'root' | 'guardian' | 'heart'; bossPhase?: 1 | 2 }>()
const portrait = computed(() => props.side === 'enemy' ? guardianPortrait : props.hero.id === 'warrior' ? varianPortrait : jainaPortrait)
const role = computed(() => props.hero.title)
</script>
<template>
  <article class="hero" :class="['hero--' + side, 'hero--' + (appearance ?? hero.id), { 'is-targeted': targeted, 'is-damaged': damaged, 'is-acting': active, 'is-vulnerable': vulnerable, 'is-enraged': bossPhase === 2 }]" :aria-label="hero.name + ', здоровье ' + hero.health + ' из ' + hero.maxHealth + ', броня ' + hero.armor">
    <div class="portrait-wrap">
      <div class="hero-art" :data-fx-anchor="side === 'enemy' ? 'enemy' : hero.id"><img :src="portrait" :alt="hero.name" draggable="false" /></div>
      <span v-if="targeted" class="target-chip" aria-label="Цель следующей атаки">⌖</span>
      <span v-if="bossPhase" class="boss-phase">ФАЗА {{ bossPhase }}</span>
      <GameTooltip v-if="vulnerable" :label="statusDefinitions.vulnerability.name" class="portrait-status">
        <button class="status-chip" aria-label="Противник уязвим"><img :src="vulnerabilityIcon" alt="" /> <span>{{ statusDefinitions.vulnerability.shortName }}</span></button>
        <template #content><p>{{ statusDefinitions.vulnerability.description }}</p><p>Состояние сохраняется между ходами.</p></template>
      </GameTooltip>
    </div>
    <div class="hero-label"><strong>{{ hero.name }}</strong><span>{{ role }}</span></div>
    <div class="hero-stats"><span class="health-value" :class="{ 'health-value--low': hero.health <= 8 }"><i>♥</i> {{ hero.health }}<small>/{{ hero.maxHealth }}</small></span><GameTooltip v-if="hero.armor" label="Броня"><button class="armor-value">⬡ {{ hero.armor }}</button><template #content><p>Поглощает урон. Остаток исчезает после атаки по этому герою.</p></template></GameTooltip></div>
    <div class="health-track" aria-hidden="true"><span :style="{ width: (hero.health / hero.maxHealth * 100) + '%' }"></span></div>
  </article>
</template>
<style scoped>
.hero{--portrait-size:var(--hero-size);position:relative;display:flex;align-items:center;flex-direction:column;width:max-content;min-width:160px;z-index:2;gap:5px}.hero--enemy{--portrait-size:var(--enemy-size);min-width:260px}.portrait-wrap{position:relative}.hero-art{position:relative;width:var(--portrait-size);aspect-ratio:1;border-radius:50%;overflow:hidden;border:4px solid #ddb474;box-shadow:0 0 0 3px #374844,0 0 0 5px #a07d4b,0 10px 24px #08191b80;transition:transform .2s,box-shadow .2s,border-color .2s;background:#395252}.hero-art img{width:100%;height:100%;object-fit:cover;display:block}.hero--mage .hero-art{border-color:#bb9cdd}.hero--enemy .hero-art{border-color:#c6aa80}.hero--root img{filter:hue-rotate(28deg) saturate(1.12)}.hero--heart img{filter:hue-rotate(295deg) saturate(1.2)}
.hero-label{display:flex;align-items:baseline;justify-content:center;gap:8px;margin-top:5px;text-shadow:0 2px 5px #092320}.hero-label strong{font:700 clamp(17px,1.35vw,24px)/1.15 var(--display);color:#fff2d4}.hero-label>span{font-size:13px;color:#d1d4bd}.hero--enemy .hero-label{flex-direction:column;align-items:center;gap:2px}.hero--enemy .hero-label>span{display:none}.hero-stats{display:flex;justify-content:center;align-items:center;gap:10px;min-height:26px;font-weight:700}.health-value{font-size:clamp(19px,1.5vw,27px);line-height:1}.health-value i{font-size:.7em;color:#f48d7a;font-style:normal}.health-value small{font-size:.62em;color:#c9cbbb;font-weight:400}.health-value--low{color:#ffbd9f}.armor-value{border:1px solid #76c4d49c;padding:3px 8px;border-radius:8px;color:#c3f4f7;background:#204c5b;font-weight:700;font-size:16px}.health-track{height:5px;width:110px;border-radius:5px;background:#102d2e;border:1px solid #d2bf7e40;overflow:hidden}.health-track span{display:block;height:100%;background:linear-gradient(90deg,#be6654,#edac72);transition:width .2s}
.is-targeted .hero-art{border-color:#f6b16e;box-shadow:0 0 0 3px #393b32,0 0 0 5px #d68b51,0 8px 24px #08191b80}.target-chip{position:absolute;right:-9px;top:-7px;border:1px solid #ffd28d;border-radius:50%;background:#9b5833;color:#fff1c9;display:grid;place-items:center;width:30px;height:30px;font-size:22px}.boss-phase{position:absolute;left:50%;top:-17px;translate:-50% 0;white-space:nowrap;padding:4px 10px;border:1px solid #e8bf75;border-radius:12px;background:#392940;color:#fff0c5;font-size:12px;font-weight:800;letter-spacing:.12em}.is-enraged .hero-art{border-color:#ff9775;box-shadow:0 0 0 4px #8b493d,0 0 35px #ff7759a8,0 10px 24px #08191b80;animation:phase-awaken .65s ease-out}@keyframes phase-awaken{0%{filter:brightness(1.8);transform:scale(1.05)}100%{filter:brightness(1);transform:scale(1)}}.portrait-status{position:absolute;left:-13px;bottom:10px}.status-chip{display:flex;align-items:center;gap:4px;border:1px solid #f4cf85;border-radius:18px;background:#765b36;color:#fff2c7;min-height:36px;padding:0 9px}.status-chip img{display:block;width:25px;height:25px}.status-chip span{font-size:12px;font-weight:800}.is-vulnerable .hero-art{border-color:#e2bd78}.is-acting .hero-art{transform:translateY(-5px);box-shadow:0 0 0 4px #eaca89,0 12px 24px #09242799}.is-damaged .hero-art{animation:portrait-hit .3s ease-out}@keyframes portrait-hit{25%{transform:translateX(-6px);filter:brightness(1.5)}75%{transform:translateX(5px)}}
@media(max-height:700px){.hero{gap:3px;min-width:145px}.hero-label{margin-top:3px}.hero-label strong{font-size:17px}.hero-stats{min-height:22px}.health-value{font-size:20px}.hero--enemy{min-width:220px}.hero-label>span{font-size:12px}}
</style>
