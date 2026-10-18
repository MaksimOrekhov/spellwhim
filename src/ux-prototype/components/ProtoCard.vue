<script setup lang="ts">
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../../game/types'
import { classThemeStyle, getClassTheme } from '../../game/classThemes'
import vFitText from '../../directives/fitText'
import { cardChips, cardLines } from '../cardGlyphs'
import { cardArt } from '../cardArt'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ card: CardDefinition; preview: CardPreview; reason: 'mana' | 'busy' | 'finished' | null; hotkey?: string; mana?: number; id?: string; tabbable?: boolean; vis?: number }>()
defineEmits<{ play: [] }>()
const theme = computed(() => getClassTheme(props.card.className))
/** Fraction of the card that is not covered by its neighbour in an overlapped hand. */
const vis = computed(() => props.vis ?? 1)
const dense = computed(() => vis.value < 0.86)
const style = computed(() => ({ ...classThemeStyle(props.card.className), '--vis': String(vis.value) }))
const allChips = computed(() => cardChips(props.card, props.preview))
// Rule: at most two numeric chips; statuses become a round "sticker" on the art so the chip row survives a 10-card overlap.
const chips = computed(() => allChips.value.filter(c => c.kind !== 'status').slice(0, 2))
const sticker = computed(() => allChips.value.some(c => c.kind === 'status'))
const lines = computed(() => cardLines(props.card, props.preview))
const bonus = computed(() => !props.reason && props.preview.bonusDamage > 0)
const locked = computed(() => props.reason === 'mana')
const aria = computed(() => `${props.hotkey ? props.hotkey + '. ' : ''}${props.card.name}, ${props.card.cost} маны. Класс: ${theme.value.name}. ${props.card.description}${locked.value ? ' Недостаточно маны.' : ''}`)
</script>

<template>
  <button :id="id" class="pcard" :class="['pcard--' + theme.ornament, { 'is-locked': locked, 'is-bonus': bonus, 'is-dense': dense, 'is-dim': reason === 'busy' || reason === 'finished' }]" :style="style" :aria-disabled="!!reason" :aria-label="aria" :tabindex="tabbable === false ? -1 : 0" @click="$emit('play')">
    <span class="pcard-rim" aria-hidden="true"></span>
    <span class="pcard-face" aria-hidden="true"></span>
    <span class="pcard-inner">
      <span class="pcard-art">
        <img :src="cardArt[card.id]" alt="" draggable="false" />
        <span class="pcard-shade"></span>
        <span class="pcard-kind" aria-hidden="true"><img :src="theme.emblem" alt="" draggable="false" /></span>
        <span v-if="sticker" class="pcard-sticker" title="Накладывает Уязвимость"><GlyphIcon name="vulnerable" /><small>Уязвим</small></span>
        <span v-if="locked" class="pcard-lock"><GlyphIcon name="lock" /> нужно {{ card.cost }}<template v-if="mana !== undefined"> · есть {{ mana }}</template></span>
      </span>
      <span class="pcard-name"><strong v-fit-text>{{ card.name }}</strong></span>
      <span class="pcard-chips" :class="{ 'is-solo': chips.length === 1 }">
        <span v-for="(chip, i) in chips" :key="i" class="chip" :class="['chip--' + chip.kind, { 'is-boosted': chip.boosted, 'is-dim': chip.dim }]">
          <i class="chip-disc"><GlyphIcon :name="chip.icon" /></i>
          <b v-if="chip.value !== undefined" class="chip-num">{{ chip.value }}</b>
          <small class="chip-cap">{{ chip.caption }}</small>
        </span>
      </span>
      <span class="pcard-lines">
        <span v-for="(line, i) in lines" :key="i" class="rule" :class="'rule--' + line.tone"><GlyphIcon v-if="line.icon" :name="line.icon" /> <span>{{ line.text }}</span></span>
      </span>
      <span class="pcard-foot"><kbd v-if="hotkey">{{ hotkey }}</kbd><span class="pcard-class">{{ theme.label }}</span></span>
    </span>
    <span class="pcard-cost" :class="{ 'is-short': locked }" aria-hidden="true"><b>{{ card.cost }}</b></span>
  </button>
</template>

<style scoped>
.pcard{--w:11.6em;position:relative;display:block;flex:none;width:var(--w);height:17em;padding:0;border:0;background:none;color:var(--text);text-align:left;font-size:calc(1rem * var(--card-scale,1));font-family:var(--f-ui);filter:drop-shadow(0 .45em .6em #000a)}
.pcard>*{pointer-events:none}
/* frame: rim (metal / filigree) + face (leather / night sky) */
.pcard-rim,.pcard-face{position:absolute;inset:0;display:block}
.pcard-rim{background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 62%,#fff) 0%,var(--class-primary) 26%,color-mix(in srgb,var(--class-accent) 82%,#000) 50%,color-mix(in srgb,var(--class-primary) 60%,#000) 100%);border-radius:1.1em}
.pcard-face{inset:.32em;border-radius:.85em;background:linear-gradient(175deg,color-mix(in srgb,var(--class-primary) 36%,var(--class-surface)),var(--class-surface) 46%,color-mix(in srgb,var(--class-surface) 68%,#000));box-shadow:inset 0 0 1.2em #0009,inset 0 .1em .1em #fff3}
.pcard--angular .pcard-rim{clip-path:polygon(0 .95em,.95em 0,calc(100% - .95em) 0,100% .95em,100% calc(100% - .95em),calc(100% - .95em) 100%,.95em 100%,0 calc(100% - .95em));border-radius:0}
.pcard--angular .pcard-face{clip-path:polygon(0 .75em,.75em 0,calc(100% - .75em) 0,100% .75em,100% calc(100% - .75em),calc(100% - .75em) 100%,.75em 100%,0 calc(100% - .75em));border-radius:0;background:repeating-linear-gradient(90deg,#fff0 0 .12em,#ffffff08 .12em .2em),linear-gradient(175deg,color-mix(in srgb,var(--class-primary) 34%,var(--class-surface)),var(--class-surface) 46%,color-mix(in srgb,var(--class-surface) 66%,#000))}
.pcard--arcane .pcard-rim{border-radius:1.5em 1.5em 1.1em 1.1em}
.pcard--arcane .pcard-face{border-radius:1.25em 1.25em .85em .85em;background:radial-gradient(circle at 18% 22%,#fff9 0 .05em,#0000 .12em),radial-gradient(circle at 78% 64%,#9ee7ff99 0 .05em,#0000 .12em),radial-gradient(circle at 44% 90%,#fff7 0 .05em,#0000 .12em),radial-gradient(120% 75% at 50% 0,color-mix(in srgb,var(--class-primary) 58%,var(--class-surface)),var(--class-surface) 58%,color-mix(in srgb,var(--class-surface) 52%,#000))}
/* rivets / runes */
.pcard--angular .pcard-face::before,.pcard--angular .pcard-face::after{content:'';position:absolute;left:.55em;right:.55em;height:.38em;background:radial-gradient(circle,#f6d79a 0 .13em,#7a5428 .16em .2em,#0000 .22em) 0 0/100% 100% no-repeat;opacity:.0}
.pcard--arcane .pcard-face::after{content:'';position:absolute;left:50%;bottom:.28em;width:.5em;height:.5em;translate:-50% 0;rotate:45deg;background:var(--class-secondary);box-shadow:0 0 .7em .15em var(--class-secondary);border-radius:.1em}
.pcard-inner{position:absolute;inset:.62em .62em .5em;display:flex;flex-direction:column}
/* art window */
.pcard-art{position:relative;display:block;flex:none;height:7.6em;overflow:hidden;border:.12em solid color-mix(in srgb,var(--class-accent) 80%,#fff);border-radius:.55em .55em .3em .3em;background:var(--class-surface);box-shadow:inset 0 0 .9em #000a,0 .1em .3em #0008}
.pcard--arcane .pcard-art{border-radius:.9em .9em .4em .4em}
.pcard--angular .pcard-art{border-radius:.25em .7em .2em .2em}
.pcard-art>img:first-child{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%;transition:transform .35s var(--ease-out)}
.pcard-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#0000 55%,#0007),linear-gradient(#0000 60%,#000a)}
.pcard-kind{position:absolute;right:.35em;top:.35em;display:grid;place-items:center;width:1.55em;height:1.55em;padding:.3em;border-radius:50%;background:color-mix(in srgb,var(--class-surface) 80%,#000);border:.1em solid var(--class-accent);box-shadow:0 .1em .3em #000a}
.pcard-kind img{width:100%;height:100%;display:block}
.pcard--angular .pcard-kind{border-radius:.2em;clip-path:polygon(12% 0,88% 0,100% 28%,86% 84%,50% 100%,14% 84%,0 28%);width:1.65em;height:1.75em;border:0;background:var(--class-accent)}
.pcard--angular .pcard-kind img{filter:brightness(0) opacity(.85)}
.pcard-lock{position:absolute;inset:auto .4em .4em;display:flex;align-items:center;justify-content:center;gap:.35em;padding:.25em .4em;border-radius:.5em;background:#2a0d12e0;border:.08em solid #ff9a86;color:#ffd0c6;font:700 .74em/1 var(--f-ui);letter-spacing:.03em;white-space:nowrap}
.pcard-lock svg{width:1.1em;height:1.1em}
/* name plate overlaps the art edge */
.pcard-name{position:relative;z-index:1;display:grid;place-items:center;flex:none;height:2.05em;margin:-.95em -.15em 0;padding:0 .9em}
.pcard-name::before{content:'';position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,color-mix(in srgb,var(--class-primary) 70%,var(--class-accent)),color-mix(in srgb,var(--class-primary) 55%,#000));border:.1em solid var(--class-accent);box-shadow:0 .15em .35em #000a,inset 0 .1em #fff4}
.pcard--angular .pcard-name::before{clip-path:polygon(0 0,100% 0,calc(100% - .55em) 50%,100% 100%,0 100%,.55em 50%);border:0;background:linear-gradient(180deg,color-mix(in srgb,var(--class-accent) 85%,#fff),color-mix(in srgb,var(--class-accent) 62%,#3a1e0e))}
.pcard--arcane .pcard-name::before{border-radius:1em}
.pcard-name strong{display:block;max-width:100%;overflow:hidden;white-space:nowrap;font:700 1.12em/1.1 var(--f-display);color:#fff4d8;text-shadow:0 .08em .12em #000c;letter-spacing:.01em}
.pcard--angular .pcard-name strong{color:#2a1608;text-shadow:0 .06em 0 #fff6}
/* chips — the glanceable "what does it do" */
.pcard-chips{display:flex;flex-wrap:nowrap;gap:.3em;flex:1;min-height:3.15em;margin-top:.15em;align-items:center}
.pcard-chips.is-solo .chip{font-size:1.28em;padding-right:.7em}
.is-dense .chip{padding-right:.35em;column-gap:.2em}
.is-dense .chip-cap{display:none}
.is-dense .chip-num{font-size:1.4em}
.is-dense .pcard-name{padding-right:calc((1 - var(--vis,1)) * 11.6em + .35em)}
.is-dense .pcard-name strong{text-align:left}
.pcard-sticker{position:absolute;left:2.75em;top:.4em;display:flex;align-items:center;gap:.25em;padding:.12em .55em .12em .15em;border-radius:1em;background:linear-gradient(#5a3b05,#2c1b02);border:.1em solid var(--vuln);color:#ffdca3;box-shadow:0 .12em .3em #000a}
.pcard-sticker svg{width:1.45em;height:1.45em;color:var(--vuln)}
.pcard-sticker small{font:800 .62em/1 var(--f-ui);letter-spacing:.06em;text-transform:uppercase}
.is-dense .pcard-sticker small{display:none}
.is-dense .pcard-sticker{padding-right:.15em}
.chip{--c:#ff7a4d;position:relative;display:grid;grid-template:auto auto/1.55em auto;align-items:center;column-gap:.25em;padding:.18em .45em .12em .2em;border-radius:.7em;background:linear-gradient(#0009,#0006);border:.08em solid color-mix(in srgb,var(--c) 70%,#000);box-shadow:inset 0 0 .6em color-mix(in srgb,var(--c) 22%,transparent)}
.chip--armor{--c:#9fc8f0}.chip--draw{--c:#f4c95d}.chip--status{--c:#ffb23d}
.chip-disc{grid-row:1;display:grid;place-items:center;width:1.55em;height:1.55em;border-radius:50%;background:radial-gradient(circle at 35% 28%,color-mix(in srgb,var(--c) 55%,#fff),var(--c) 55%,color-mix(in srgb,var(--c) 55%,#000));color:#2a1608;font-size:.98em;box-shadow:0 .08em .2em #000a;font-style:normal}
.chip-disc svg{width:.95em;height:.95em}
.chip-num{grid-row:1;font:800 1.55em/1 var(--f-num);color:#fff;text-shadow:0 .06em .1em #000,0 0 .3em color-mix(in srgb,var(--c) 60%,transparent)}
.chip-cap{grid-column:1/-1;margin-top:.1em;font:700 .6em/1 var(--f-ui);letter-spacing:.08em;text-transform:uppercase;color:color-mix(in srgb,var(--c) 70%,#fff);white-space:nowrap}
.chip--status{padding-right:.5em}
.chip.is-dim{opacity:.55;filter:saturate(.5)}
.chip.is-boosted{--c:var(--bonus);background:linear-gradient(#4a3300d0,#1d1300c0);box-shadow:0 0 .8em .05em #ffd56b99,inset 0 0 .7em #ffd56b55;animation:boost-pulse 1.8s ease-in-out infinite}
.chip.is-boosted .chip-num{color:var(--bonus);font-size:1.75em}
@keyframes boost-pulse{50%{box-shadow:0 0 1.1em .2em #ffd56bcc,inset 0 0 .8em #ffd56b66}}
/* ≤2 short rule lines */
.pcard-lines{display:flex;flex-direction:column;justify-content:flex-end;gap:.12em;flex:none;min-height:2.3em;margin-top:.1em}
.rule{display:flex;align-items:center;gap:.3em;font:600 .74em/1.15 var(--f-ui);color:#e8dcc0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rule svg{flex:none;width:1.05em;height:1.05em}
.rule--on{color:var(--bonus);font-weight:800}
.rule--off{color:#a99c82;font-weight:500}
.rule--off svg{opacity:.6}
.pcard-foot{display:flex;align-items:center;gap:.5em;flex:none;height:1.15em;margin-top:.2em;border-top:.06em solid color-mix(in srgb,var(--class-accent) 40%,transparent);padding-top:.25em}
.pcard-class{font:800 .62em/1 var(--f-ui);letter-spacing:.16em;color:var(--class-accent)}
.pcard-foot kbd{min-width:1.35em;padding:.05em .3em;border:.07em solid #ffffff4d;border-radius:.3em;background:#0006;font:700 .72em/1.25 var(--f-num);text-align:center;color:#e6d9bd}
/* cost gem (shared by every class: blue crystal = mana) */
.pcard-cost{position:absolute;left:-.55em;top:-.6em;z-index:3;display:grid;place-items:center;width:3.1em;height:3.5em;clip-path:polygon(50% 0,96% 22%,92% 76%,50% 100%,8% 76%,4% 22%);background:linear-gradient(150deg,#d4f6ff 0%,#4cb8f0 34%,#1c62b5 76%,#12407f 100%);filter:drop-shadow(0 .15em .2em #000c)}
.pcard-cost::before{content:'';position:absolute;inset:.14em;clip-path:inherit;background:linear-gradient(150deg,#8fe0ff,#2a86d4 55%,#17519a)}
.pcard-cost b{position:relative;font:800 1.9em/1 var(--f-num);color:#fff;text-shadow:0 .06em .1em #06223f,0 0 .2em #06223f}
.pcard-cost.is-short::before{background:linear-gradient(150deg,#5d6b78,#2f3a45 60%,#1c242c)}
.pcard-cost.is-short b{color:#ff9d8a}
/* states */
.is-locked .pcard-rim,.is-locked .pcard-face,.is-locked .pcard-art>img:first-child,.is-locked .pcard-chips,.is-locked .pcard-name{filter:grayscale(.65) brightness(.74)}
.is-dim{filter:drop-shadow(0 .45em .6em #000a) saturate(.8) brightness(.9)}
.is-bonus{filter:drop-shadow(0 0 .55em #ffd56bcc) drop-shadow(0 .45em .6em #000a)}
.is-bonus .pcard-rim{background:linear-gradient(145deg,#fff2b8,var(--bonus) 30%,color-mix(in srgb,var(--class-accent) 70%,#a56a14) 60%,var(--class-primary))}
</style>
