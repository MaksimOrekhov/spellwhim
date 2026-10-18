<script setup lang="ts">
import { computed } from 'vue'
import type { CardDefinition, CardPreview } from '../../game/types'
import { classThemeStyle, getClassTheme } from '../../game/classThemes'
import vFitText from '../../directives/fitText'
import { cardChips, cardLines } from '../cardGlyphs'
import { cardArt } from '../cardArt'
import GlyphIcon from './GlyphIcon.vue'

const props = defineProps<{ card: CardDefinition; preview: CardPreview; reason: 'mana' | 'busy' | 'finished' | null; hotkey?: string; mana?: number; id?: string; tabbable?: boolean; vis?: number; queued?: number }>()
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
        <span v-if="queued" class="pcard-queue">Дальше · {{ queued }}</span>
        <span v-if="sticker" class="pcard-sticker" title="Накладывает Уязвимость"><GlyphIcon name="vulnerable" /><small>Уязвим</small></span>
        <span v-if="locked" class="pcard-lock"><GlyphIcon name="lock" /> нужно {{ card.cost }}<template v-if="mana !== undefined"> · есть {{ mana }}</template></span>
      </span>
      <span class="pcard-name"><strong v-if="!dense" v-fit-text>{{ card.name }}</strong><strong v-else class="wrap">{{ card.name }}</strong></span>
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
/* frame: rim (metal / filigree) + face (leather / night sky). Soft forms only: no clip-path corners; every class gets
   generous radii with a deliberate small asymmetry. Class identity comes from material and proportion, not from sharp cuts. */
.pcard-rim,.pcard-face{position:absolute;inset:0;display:block}
.pcard-rim{background:linear-gradient(145deg,color-mix(in srgb,var(--class-accent) 62%,#fff) 0%,var(--class-primary) 26%,color-mix(in srgb,var(--class-accent) 82%,#000) 50%,color-mix(in srgb,var(--class-primary) 60%,#000) 100%);border-radius:1.5em 1.3em 1.7em 1.35em/1.45em 1.55em 1.3em 1.6em;box-shadow:inset 0 .12em .12em #fff6,inset 0 -.2em .3em #0005}
.pcard-face{inset:.38em;border-radius:1.2em 1em 1.35em 1.05em/1.15em 1.25em 1em 1.3em;background:linear-gradient(175deg,color-mix(in srgb,var(--class-primary) 36%,var(--class-surface)),var(--class-surface) 46%,color-mix(in srgb,var(--class-surface) 68%,#000));box-shadow:inset 0 0 1.4em #000a,inset 0 .12em .12em #fff3}
/* Воин: плотная «подушка» из бронзы и кожи, заклёпки, мягкая диагональная асимметрия */
.pcard--angular .pcard-face{background:repeating-linear-gradient(90deg,#fff0 0 .12em,#ffffff08 .12em .2em),linear-gradient(175deg,color-mix(in srgb,var(--class-primary) 34%,var(--class-surface)),var(--class-surface) 46%,color-mix(in srgb,var(--class-surface) 66%,#000))}
.pcard--angular .pcard-face::before,.pcard--angular .pcard-face::after{content:'';position:absolute;top:9.6em;width:.4em;height:.4em;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2c4,#d6a65e 55%,#6b4220);box-shadow:0 .08em .12em #000a}
.pcard--angular .pcard-face::before{left:.28em}.pcard--angular .pcard-face::after{right:.28em}
/* Маг: высокая арка, ночное небо, самоцвет снизу */
.pcard--arcane .pcard-rim{border-radius:2.3em 2.3em 1.4em 1.5em/2.2em 2.4em 1.5em 1.4em}
.pcard--arcane .pcard-face{border-radius:2em 2em 1.1em 1.2em/1.9em 2.1em 1.2em 1.1em;background:radial-gradient(circle at 18% 22%,#fff9 0 .05em,#0000 .12em),radial-gradient(circle at 78% 64%,#9ee7ff99 0 .05em,#0000 .12em),radial-gradient(circle at 44% 90%,#fff7 0 .05em,#0000 .12em),radial-gradient(120% 75% at 50% 0,color-mix(in srgb,var(--class-primary) 58%,var(--class-surface)),var(--class-surface) 58%,color-mix(in srgb,var(--class-surface) 52%,#000))}
.pcard--arcane .pcard-face::after{content:'';position:absolute;left:50%;bottom:.3em;width:.62em;height:.62em;translate:-50% 0;border-radius:50% 50% 48% 48%/42% 42% 58% 58%;background:radial-gradient(circle at 35% 30%,#fff,var(--class-secondary) 55%,#2a6a9a);box-shadow:0 0 .7em .15em var(--class-secondary)}
.pcard-inner{position:absolute;inset:.7em .66em .56em;display:flex;flex-direction:column}
/* art window */
.pcard-art{position:relative;display:block;flex:none;height:7.6em;overflow:hidden;border:.13em solid color-mix(in srgb,var(--class-accent) 80%,#fff);border-radius:1.05em .85em 1em .9em/.95em 1.05em .85em 1em;background:var(--class-surface);box-shadow:inset 0 0 .9em #000a,0 .1em .3em #0008}
.pcard--arcane .pcard-art{border-radius:1.7em 1.7em .9em 1em/1.6em 1.8em 1em .9em}
.pcard-art>img:first-child{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%;transition:transform .35s var(--ease-out)}
.pcard-shade{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,#0000 55%,#0007),linear-gradient(#0000 60%,#000a)}
.pcard-kind{position:absolute;right:.4em;top:.4em;display:grid;place-items:center;width:1.7em;height:1.7em;padding:.3em;border-radius:50%;background:color-mix(in srgb,var(--class-surface) 80%,#000);border:.1em solid var(--class-accent);box-shadow:0 .1em .3em #000a}
.pcard-kind img{width:100%;height:100%;display:block}
.pcard--angular .pcard-kind{background:var(--class-accent);border-color:#fff3c4}
.pcard--angular .pcard-kind img{filter:brightness(0) opacity(.85)}
.pcard-lock{position:absolute;inset:auto .4em .4em;display:flex;align-items:center;justify-content:center;gap:.35em;padding:.25em .5em;border-radius:1em;background:#2a0d12e0;border:.08em solid #ff9a86;color:#ffd0c6;font:700 .74em/1 var(--f-ui);letter-spacing:.03em;white-space:nowrap}
.pcard-lock svg{width:1.1em;height:1.1em}
/* name plate overlaps the art edge: a soft banner, never a notched strip */
.pcard-name{position:relative;z-index:1;display:grid;place-items:center;flex:none;height:2.1em;margin:-.95em -.2em 0;padding:0 .95em}
.pcard-name::before{content:'';position:absolute;inset:0;z-index:-1;border-radius:1.1em .8em 1.1em .85em/1em 1.1em .85em 1.05em;background:linear-gradient(180deg,color-mix(in srgb,var(--class-primary) 70%,var(--class-accent)),color-mix(in srgb,var(--class-primary) 55%,#000));border:.1em solid var(--class-accent);box-shadow:0 .18em .35em #000a,inset 0 .1em #fff4}
.pcard--angular .pcard-name::before{background:linear-gradient(180deg,color-mix(in srgb,var(--class-accent) 85%,#fff),color-mix(in srgb,var(--class-accent) 62%,#3a1e0e));border-color:#fff0c0}
.pcard--arcane .pcard-name::before{border-radius:1.1em}
.pcard-name strong{display:block;max-width:100%;overflow:hidden;white-space:nowrap;font:700 1.12em/1.1 var(--f-display);color:#fff4d8;text-shadow:0 .08em .12em #000c;letter-spacing:.01em}
.pcard--angular .pcard-name strong{color:#2a1608;text-shadow:0 .06em 0 #fff6}
/* chips — the glanceable "what does it do" */
.pcard-chips{display:flex;flex-wrap:nowrap;gap:.3em;flex:1;min-height:3.15em;margin-top:.15em;align-items:center}
.pcard-chips.is-solo .chip{font-size:1.28em;padding-right:.7em}
.is-dense .chip{padding-right:.35em;column-gap:.2em}
.is-dense .chip-cap{display:none}
.is-dense .chip-num{font-size:1.4em}
.is-dense .pcard-name{padding-right:calc((1 - var(--vis,1)) * 11.6em + .35em)}
.is-dense .pcard-name{height:2.6em;margin-top:-1.2em}
.is-dense .pcard-name strong.wrap{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:.98em;line-height:1.05;text-align:left}
.is-dense .pcard-lines{min-height:1.2em}
.is-dense .rule:nth-child(n+2){display:none}
.pcard-queue{position:absolute;left:50%;bottom:1.45em;translate:-50% 0;padding:.15em .8em;border-radius:1em;background:linear-gradient(#24507c,#152c4d);border:.1em solid #bfe0ff;color:#e7f3ff;font:800 .72em/1.2 var(--f-ui);letter-spacing:.06em;white-space:nowrap;box-shadow:0 .15em .35em #000a}
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
.pcard-cost{position:absolute;left:-.6em;top:-.65em;z-index:3;display:grid;place-items:center;width:3.2em;height:3.5em;border-radius:46% 46% 50% 50%/38% 38% 62% 62%;background:linear-gradient(150deg,#d4f6ff 0%,#4cb8f0 34%,#1c62b5 76%,#12407f 100%);box-shadow:0 .15em .25em #000c,inset 0 .12em .1em #fff9}
.pcard-cost::before{content:'';position:absolute;inset:.2em;border-radius:inherit;background:linear-gradient(150deg,#8fe0ff,#2a86d4 55%,#17519a);box-shadow:inset 0 0 .5em #fff6}
.pcard-cost b{position:relative;font:800 1.9em/1 var(--f-num);color:#fff;text-shadow:0 .06em .1em #06223f,0 0 .2em #06223f}
.pcard-cost.is-short::before{background:linear-gradient(150deg,#5d6b78,#2f3a45 60%,#1c242c)}
.pcard-cost.is-short b{color:#ff9d8a}
/* states */
.is-locked .pcard-rim,.is-locked .pcard-face,.is-locked .pcard-art>img:first-child,.is-locked .pcard-chips,.is-locked .pcard-name{filter:grayscale(.65) brightness(.74)}
.is-dim{filter:drop-shadow(0 .45em .6em #000a) saturate(.8) brightness(.9)}
.is-bonus{filter:drop-shadow(0 0 .55em #ffd56bcc) drop-shadow(0 .45em .6em #000a)}
.is-bonus .pcard-rim{background:linear-gradient(145deg,#fff2b8,var(--bonus) 30%,color-mix(in srgb,var(--class-accent) 70%,#a56a14) 60%,var(--class-primary))}
</style>
