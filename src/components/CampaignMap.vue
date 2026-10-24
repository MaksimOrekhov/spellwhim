<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { Anvil, Check, Crown, FlameKindling, Gem, Lamp, ScrollText, Skull, Swords } from '@lucide/vue'
import DeckViewer from './DeckViewer.vue'
import GameTooltip from './GameTooltip.vue'
import { availableDungeonNodes } from '../game/campaign'
import type { DungeonMap, DungeonRunState } from '../game/campaign'
import { mapAriaLabel, mapFace, mapNodeState, mapPosition, mapRailPath, mapRowLabel, mapStateText } from '../ui/mapDisplay'
import type { MapFaceKind } from '../ui/mapDisplay'

const props = defineProps<{ map: DungeonMap; run: DungeonRunState }>()
const emit = defineEmits<{ enter: [nodeId: string]; mode: [] }>()
const columns = computed(() => props.map.configuration?.columns ?? 3)
const rows = computed(() => props.map.layers.length)
/** Maps of nine or ten rows (the long route) get a tighter rhythm; the route always runs left to right and scrolls sideways only in narrow windows. */
/** The sector's public name: the route variant after the dot ("· длинный путь") is an internal tag, the player just walks the Old Mines. */
const sectorTitle = computed(() => (props.map.configuration?.name ?? '').split(' · ')[0]!)
const dense = computed(() => rows.value > 8)
const viewport = useTemplateRef<HTMLElement>('viewport')
const nodes = computed(() => props.map.layers.flat())
const available = computed(() => new Set(availableDungeonNodes(props.run).map(node => node.id)))
const visited = computed(() => new Set(props.run.visitedNodeIds))
const current = computed(() => props.run.visitedNodeIds[props.run.visitedNodeIds.length - 1])

const cells = computed(() => nodes.value.map(node => {
  const face = mapFace(node, visited.value.has(node.id))
  const state = mapNodeState(node.id, visited.value, available.value, current.value)
  const position = mapPosition(node, rows.value, columns.value)
  return { node, face, state, position, style: { left: `${position.x}%`, top: `${position.y}%` }, aria: mapAriaLabel(node, face, state) }
}))
const positions = computed(() => new Map(cells.value.map(cell => [cell.node.id, cell.position])))
const edges = computed(() => nodes.value.flatMap(node => node.edges.map(targetId => ({
  id: `${node.id}:${targetId}`,
  path: mapRailPath(positions.value.get(node.id)!, positions.value.get(targetId)!),
  complete: visited.value.has(node.id) && visited.value.has(targetId),
  next: node.id === current.value && available.value.has(targetId),
}))))

/** Timber and lamps over the tunnel, set between the rows so they never sit on a room. */
const decor = computed(() => Array.from({ length: Math.max(0, rows.value - 1) }, (_, i) => ({ x: mapPosition({ layer: i + 0.5, column: 0 }, rows.value, columns.value).x, lamp: i % 2 === 0, post: i % 2 === 1 })))

const glyphs = { battle: Swords, elite: Crown, rest: FlameKindling, boss: Skull, forge: Anvil, treasure: Gem, event: ScrollText } as const
const glyphOf = (kind: MapFaceKind) => kind === 'unknown' ? null : glyphs[kind]

/** The route so far, one slot per visit: the true kind of every room already entered, empty slots for the rest. */
const history = computed(() => Array.from({ length: rows.value }, (_, i) => {
  const node = nodes.value.find(item => item.id === props.run.visitedNodeIds[i])
  return node ? { id: node.id, face: mapFace(node, true), row: mapRowLabel(node) } : null
}))

function enter(cell: (typeof cells.value)[number]) {
  if (cell.state === 'available') emit('enter', cell.node.id)
}

/** Arrow keys walk between the rooms the party can enter now; Tab does the same in reading order. */
function walk(event: KeyboardEvent) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  const open = Array.from(viewport.value?.querySelectorAll<HTMLElement>('.map-node[data-enterable]') ?? [])
  if (!open.length) return
  const index = open.indexOf(document.activeElement as HTMLElement)
  event.preventDefault()
  open[index < 0 ? (step > 0 ? 0 : open.length - 1) : (index + step + open.length) % open.length]!.focus()
}

/** Brings the rooms the party can enter next (or, failing that, the party itself) to the middle of a scrolled map. */
function centreOnParty() {
  void nextTick(() => {
    const box = viewport.value
    const target = box?.querySelector<HTMLElement>('.map-node[data-enterable]') ?? box?.querySelector<HTMLElement>('.map-node.is-current')
    const slot = target?.closest<HTMLElement>('.map-slot')
    if (!box || !slot) return
    box.scrollTo({ left: Math.max(0, slot.offsetLeft - box.clientWidth / 2), behavior: 'auto' })
  })
}
onMounted(centreOnParty)
watch(current, centreOnParty)
</script>

<template>
  <main class="campaign-screen">
    <header class="campaign-header">
      <div class="campaign-topline"><Lamp :size="22" aria-hidden="true"/><span>{{ map.configuration ? 'СЕКТОР I · '+sectorTitle.toUpperCase() : 'КОНТРОЛЬНЫЙ ПОХОД · 7 ПОСЕЩЕНИЙ' }}</span><span class="seed-chip">ЗЕРНО {{ run.seed }}</span><button class="game-button new-run" @click="emit('mode')">Главное меню</button><DeckViewer :deck="run.deck" /></div>
      <h1>Выберите штрек</h1>
      <p>{{ run.campaign ? 'Следуйте освещённым рельсам. Знак вопроса скрывает комнату, пока отряд в неё не войдёт.' : 'Следуйте рельсам. Привал лечит или улучшает карту, а элита предлагает больше карт на выбор.' }}</p>
      <p v-if="run.journal?.length" class="last-decision" role="status">{{ run.journal[run.journal.length-1]?.text }}</p>
    </header>

    <section ref="viewport" class="map-viewport" :class="{ 'is-dense': dense }" aria-label="Карта подземелья" @keydown="walk">
      <div class="dungeon-graph" :style="{ '--rows': rows }">
        <div class="tunnel-beam" aria-hidden="true"></div>
        <div class="tunnel-floor" aria-hidden="true"></div>
        <template v-for="(item, index) in decor" :key="index">
          <i v-if="item.post" class="mine-post" :style="{ left: `${item.x}%` }" aria-hidden="true"></i>
          <i v-if="item.lamp" class="lamp-hang" :style="{ left: `${item.x}%`, animationDelay: `${(index % 4) * -0.9}s` }" aria-hidden="true"></i>
        </template>
        <svg class="route-edges" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          <g v-for="edge in edges" :key="edge.id" :class="{ 'is-travelled': edge.complete, 'is-next': edge.next }">
            <path class="rail-bed" :d="edge.path" /><path class="rail-steel" :d="edge.path" /><path class="rail-ties" :d="edge.path" />
          </g>
        </svg>

        <GameTooltip v-for="cell in cells" :key="cell.node.id" :label="cell.face.label" class="map-slot" :class="`map-slot--${cell.face.kind}`" :style="cell.style">
          <template #content><p>{{ cell.face.hint }}</p><p class="tooltip-reason">{{ mapStateText(cell.state) }}</p></template>
          <button
            class="map-node"
            :class="[`map-node--${cell.face.kind}`, `is-${cell.state}`]"
            :tabindex="cell.state === 'available' ? 0 : -1"
            :aria-disabled="cell.state === 'available' ? undefined : 'true'"
            :data-enterable="cell.state === 'available' ? '' : undefined"
            :aria-label="cell.aria"
            @click="enter(cell)"
          >
            <span class="medal-halo" aria-hidden="true"></span>
            <span class="medal-flare" aria-hidden="true"></span>
            <span class="medal-rim" aria-hidden="true"><span class="medal-face">
              <component :is="glyphOf(cell.face.kind)" v-if="glyphOf(cell.face.kind)" class="medal-glyph" :stroke-width="2.3" />
              <b v-else class="medal-mark">?</b>
            </span></span>
            <span v-if="cell.state === 'visited' || cell.state === 'current'" class="medal-check" aria-hidden="true"><Check :size="12" :stroke-width="3.6" /></span>
            <span v-if="cell.state === 'current'" class="party-token" aria-hidden="true"><i>⚔</i><i>✦</i></span>
          </button>
        </GameTooltip>
      </div>
    </section>

    <footer class="party-status">
      <div class="party-hero"><span class="hero-medallion hero-medallion--warrior">⚔</span><span><small>ВАРИАН РИНН</small><strong>{{ run.heroes.warrior.health }} / {{ run.heroes.warrior.maxHealth }} HP</strong></span></div>
      <span class="party-divider" aria-hidden="true">✦</span>
      <div class="party-hero"><span class="hero-medallion hero-medallion--mage">✦</span><span><small>ДЖАЙНА ПРАУДМУР</small><strong>{{ run.heroes.mage.health }} / {{ run.heroes.mage.maxHealth }} HP</strong></span></div>
      <span class="route-progress">
        <ol class="route-history" aria-label="Пройденный путь">
          <li v-for="(step, index) in history" :key="index" :class="step ? `is-${step.face.kind}` : 'is-empty'" :title="step ? `${step.row}: ${step.face.label}` : undefined" :aria-label="step ? `${step.row}: ${step.face.label}` : undefined">
            <component :is="glyphOf(step.face.kind)" v-if="step && glyphOf(step.face.kind)" :size="13" :stroke-width="2.6" aria-hidden="true" />
          </li>
        </ol>
        <span>{{ run.completedNodeIds.length }}/{{ rows }} ПОСЕЩЕНИЙ · {{ run.deck.length }} КАРТ В КОЛОДЕ</span>
      </span>
    </footer>
  </main>
</template>

<style scoped>
.campaign-screen{position:absolute;z-index:8;inset:0;display:flex;flex-direction:column;align-items:center;gap:var(--sp-2);overflow:auto;padding:var(--sp-3) clamp(14px,2vw,40px);background:radial-gradient(ellipse at 50% 42%,#f0a64a30,#0000 52%),var(--mat-mine-map);color:var(--ink)}
.campaign-screen::before{position:absolute;inset:0;content:"";pointer-events:none;background:repeating-linear-gradient(95deg,#0000 0 46px,#0000000d 46px 48px),radial-gradient(ellipse at 50% 50%,#0000 52%,#000a 100%)}
.campaign-screen::after{position:absolute;inset:var(--sp-2);content:"";pointer-events:none;border:var(--border-panel);border-radius:var(--shape-dialog);box-shadow:var(--shadow-4)}
.campaign-header,.map-viewport,.party-status{position:relative;z-index:1}
.campaign-header{width:min(1800px,100%);text-align:center;flex:0 0 auto}
.campaign-topline{display:flex;align-items:center;justify-content:center;gap:var(--sp-3);color:var(--brass-1);font:700 var(--fs-xs) var(--font-display);letter-spacing:var(--ls-caps)}
.campaign-topline .game-button{font-size:var(--fs-xs);padding:var(--sp-2)}
.seed-chip{padding:var(--sp-2);border:var(--border-panel);border-radius:var(--shape-chip);font-family:var(--font-num)}
.campaign-header h1{margin:var(--sp-1) 0;color:var(--parch-1);font:700 clamp(24px,2.6vw,36px) var(--font-display);text-shadow:0 2px 0 #000a,0 0 22px #f0a64a55}
.campaign-header p{margin:0;color:var(--muted);font:600 var(--fs-sm) var(--font-ui)}
.campaign-header .last-decision{color:var(--brass-1);margin-top:var(--sp-1)}

/* the tunnel: one wide corridor, the route runs left to right */
.map-viewport{container-type:inline-size;width:min(1800px,100%);min-height:380px;flex:1;margin:var(--sp-1) 0;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;scrollbar-color:var(--brass-3) transparent}
.dungeon-graph{--m:clamp(46px,min(calc(54cqw / (var(--rows) - 1)),11vh),92px);position:relative;width:100%;min-width:calc(var(--rows) * 84px);height:100%;min-height:380px;isolation:isolate;overflow:clip}
.tunnel-beam{position:absolute;z-index:-2;inset:0 0 auto;height:14px;border-radius:var(--r-1);background:linear-gradient(#6b4424,#3a2412);box-shadow:inset 0 0 0 2px #1a0f08,var(--shadow-2);opacity:.75}
.tunnel-floor{position:absolute;z-index:-2;inset:auto 0 0;height:38px;border-radius:var(--r-2);background:linear-gradient(#0000,#0b0806aa);opacity:.8}
.mine-post{position:absolute;z-index:-2;top:10px;bottom:0;width:12px;margin-left:-6px;border-radius:var(--r-1);background:linear-gradient(90deg,#2b1a0d,#6b4424 45%,#3a2412);opacity:.4;-webkit-mask:linear-gradient(#000,#0000);mask:linear-gradient(#000,#0000)}
.lamp-hang{position:absolute;z-index:-1;top:12px;width:2px;height:24px;margin-left:-1px;background:#0009;pointer-events:none}
.lamp-hang::after{content:"";position:absolute;left:-8px;top:100%;width:18px;height:20px;border-radius:7px;background:var(--c-bonus);box-shadow:0 0 0 3px #3a2a1c,var(--map-glow-lamp);animation:flicker 3.6s ease-in-out infinite;animation-delay:inherit}
@keyframes flicker{0%,100%{opacity:1}45%{opacity:.82}60%{opacity:.95}}

/* a route is a mine rail: bed, steel and sleepers; the road ahead glows, the road behind is bright brass */
.route-edges{position:absolute;z-index:-1;inset:0;width:100%;height:100%;overflow:visible}
.route-edges path{fill:none;stroke-linecap:round;vector-effect:non-scaling-stroke}
.rail-bed{stroke:#0b0806;stroke-width:8;opacity:.4}
.rail-steel{stroke:var(--brass-3);stroke-width:3;opacity:.4}
.rail-ties{stroke:var(--wood-3);stroke-width:9;stroke-dasharray:2 12;stroke-linecap:butt!important;opacity:.5}
.is-next .rail-bed{opacity:.6}
.is-next .rail-steel{stroke:var(--brass-1);stroke-width:4;opacity:1;filter:drop-shadow(0 0 6px var(--c-bonus))}
.is-next .rail-ties{stroke:var(--brass-3);opacity:.9}
.is-travelled .rail-bed{opacity:.6}
.is-travelled .rail-steel{stroke:var(--brass-2);stroke-width:4.5;opacity:1}
.is-travelled .rail-ties{stroke:var(--brass-4);opacity:.95}

/* rooms are enamelled brass medallions; the glyph is the whole label */
.dungeon-graph>.map-slot{position:absolute;display:block;width:var(--m);height:var(--m);transform:translate(-50%,-50%)}
.map-slot--elite{width:calc(var(--m) * 1.14)!important;height:calc(var(--m) * 1.14)!important}
.map-slot--boss{width:calc(var(--m) * 1.5)!important;height:calc(var(--m) * 1.5)!important}
.map-slot:hover,.map-slot:focus-within{z-index:3}
.map-node{--enamel:var(--map-enamel-battle);--glyph:var(--parch-1);position:relative;display:block;width:100%;height:100%;padding:0;border:0;border-radius:50%;background:none;color:var(--glyph);cursor:default;transition:transform var(--dur-base) var(--ease-snap),filter var(--dur-base)}
.map-node::after{content:"";position:absolute;inset:-7px;border-radius:50%}
.map-node:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.map-node--battle{--enamel:var(--map-enamel-battle);--glyph:#e4f1fc}
.map-node--elite{--enamel:var(--map-enamel-elite);--glyph:#ffe3c8}
.map-node--rest{--enamel:var(--map-enamel-rest);--glyph:#fff0b0}
.map-node--unknown{--enamel:var(--map-enamel-unknown);--glyph:var(--brass-1)}
.map-node--boss{--enamel:var(--map-enamel-boss);--glyph:#f6e0ff}
.map-node--forge{--enamel:var(--map-enamel-forge);--glyph:#ffe0c0}
.map-node--treasure{--enamel:var(--map-enamel-treasure);--glyph:#fff4c2}
.map-node--event{--enamel:var(--map-enamel-event);--glyph:#d6f7fa}
.medal-rim{position:absolute;inset:0;border-radius:50%;background:var(--map-rim);box-shadow:var(--shadow-2),inset 0 0 0 1px #0007}
.medal-rim::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 7%,#2e1d0c 0 4.5%,#0000 5.5%),radial-gradient(circle at 50% 93%,#2e1d0c 0 4.5%,#0000 5.5%),radial-gradient(circle at 7% 50%,#2e1d0c 0 4.5%,#0000 5.5%),radial-gradient(circle at 93% 50%,#2e1d0c 0 4.5%,#0000 5.5%)}
.medal-face{position:absolute;inset:14%;display:grid;place-items:center;border-radius:50%;background:var(--enamel);box-shadow:inset 0 3px 8px #000a,inset 0 -2px 4px #fff3,0 0 0 2px #0008;overflow:hidden}
.medal-face::after{content:"";position:absolute;inset:6% 16% 52%;border-radius:50%;background:linear-gradient(#fff5,#fff0);pointer-events:none}
.medal-glyph{position:relative;width:54%;height:54%;color:var(--glyph);filter:drop-shadow(0 2px 2px #000b)}
.medal-mark{position:relative;color:var(--glyph);font:700 calc(var(--m) * .5) / 1 var(--font-display);text-shadow:0 2px 2px #000b,0 0 12px #b9a4ff99}
.medal-halo{position:absolute;inset:-48%;border-radius:50%;background:var(--map-halo-available);opacity:0;pointer-events:none;transition:opacity var(--dur-base)}
.medal-flare{position:absolute;inset:-11%;border-radius:50%;opacity:0;pointer-events:none}
.map-node--elite .medal-rim{background:var(--map-rim-elite)}
.map-node--elite .medal-flare{opacity:.9;background:repeating-conic-gradient(var(--c-threat) 0 5deg,#0000 5deg 20deg);-webkit-mask:radial-gradient(farthest-side,#0000 78%,#000 80%);mask:radial-gradient(farthest-side,#0000 78%,#000 80%);filter:drop-shadow(0 0 4px var(--c-threat))}
.map-node--boss .medal-rim{background:var(--map-rim-boss);box-shadow:0 0 0 3px #3a1d4a,0 0 30px 6px #b36bff66,var(--shadow-3)}
.map-node--boss .medal-flare{opacity:.85;inset:-14%;background:repeating-conic-gradient(#d9a0ff 0 4deg,#0000 4deg 15deg);-webkit-mask:radial-gradient(farthest-side,#0000 80%,#000 82%);mask:radial-gradient(farthest-side,#0000 80%,#000 82%);filter:drop-shadow(0 0 6px #b36bff)}
.map-node--unknown .medal-face::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 70% 75%,#62d0ff40,#0000 55%);animation:wisp 4.2s ease-in-out infinite}
@keyframes wisp{50%{opacity:.25}}

/* states: the road ahead lights up, the party stands tall, the road behind is calm */
.map-node.is-locked{filter:saturate(.55) brightness(.78)}
.map-node.is-visited{filter:saturate(.6) brightness(.86)}
.map-node.is-visited .medal-face{background:var(--map-enamel-visited)}
.map-node.is-visited .medal-glyph,.map-node.is-visited .medal-mark{color:var(--muted)}
.map-node.is-available{cursor:pointer;transform:scale(1.08)}
.map-node.is-available .medal-halo{opacity:1;animation:lantern-pulse 2.4s ease-in-out infinite}
.map-node.is-available .medal-rim{box-shadow:0 0 0 2px var(--brass-1),var(--glow-bonus),var(--shadow-2)}
.map-node.is-available:hover,.map-node.is-available:focus-visible{transform:scale(1.2);filter:brightness(1.15)}
.map-node.is-current{transform:scale(1.1)}
.map-node.is-current .medal-rim{box-shadow:0 0 0 3px var(--brass-1),0 0 22px 4px #ffd56bcc,var(--shadow-2)}
@keyframes lantern-pulse{50%{opacity:.45;transform:scale(1.12)}}
.medal-check{position:absolute;z-index:2;right:-2px;bottom:-2px;display:grid;place-items:center;width:calc(var(--m) * .36);height:calc(var(--m) * .36);border-radius:50%;background:var(--c-heal);color:var(--wood-0);box-shadow:0 0 0 2px var(--wood-1),var(--shadow-1)}
.party-token{position:absolute;z-index:3;left:50%;bottom:calc(100% + 2px);display:flex;translate:-50% 0;pointer-events:none;animation:bob 2.4s ease-in-out infinite}
.party-token i{display:grid;place-items:center;width:24px;height:24px;margin:0 -4px;border:var(--border-brass);border-radius:50%;background:var(--mat-quiet);color:var(--brass-1);font:700 12px/1 var(--font-ui);font-style:normal;box-shadow:var(--shadow-2)}
.party-token i+i{color:var(--c-mana)}
@keyframes bob{50%{translate:-50% -4px}}

.party-status{display:flex;align-items:center;justify-content:center;gap:var(--sp-4);width:min(1800px,100%);flex:0 0 auto;padding:var(--sp-2) var(--sp-4);border:var(--border-panel);border-radius:var(--shape-banner);background:var(--mat-wood);box-shadow:var(--shadow-2)}
.party-hero{display:flex;align-items:center;gap:var(--sp-2)}.party-hero>span:last-child{display:grid;gap:2px}.party-hero small{color:var(--brass-1);font:700 10px var(--font-display)}.party-hero strong{font:700 var(--fs-sm) var(--font-num)}
.hero-medallion{display:grid;place-items:center;width:32px;height:32px;border:var(--border-brass);border-radius:var(--r-pill);background:var(--mat-quiet);color:var(--brass-1)}.hero-medallion--mage{color:var(--c-mana)}.party-divider{color:var(--brass-2)}
.route-progress{display:flex;align-items:center;gap:var(--sp-3);margin-left:auto;color:var(--muted);font:700 var(--fs-xs) var(--font-ui);text-align:right}
.route-history{display:flex;gap:4px;margin:0;padding:0;list-style:none}
.route-history li{display:grid;place-items:center;width:22px;height:22px;border:2px solid var(--brass-3);border-radius:50%;background:var(--wood-0);color:var(--wood-0)}
.route-history li.is-empty{width:10px;height:10px;align-self:center;border-width:2px}
.route-history li:not(.is-empty){border-color:var(--brass-2);background:var(--brass-2);box-shadow:0 0 8px #ffd56b66}
.route-history li.is-elite{background:var(--c-threat-line);border-color:var(--c-threat-line)}
.route-history li.is-rest{background:var(--c-bonus);border-color:var(--c-bonus)}
.route-history li.is-forge{background:#f08a4a;border-color:#f08a4a}
.route-history li.is-treasure{background:var(--c-bonus);border-color:var(--c-bonus)}
.route-history li.is-event{background:var(--c-focus);border-color:var(--c-focus)}
.route-history li.is-boss{background:#d9a0ff;border-color:#d9a0ff}

@media(prefers-reduced-motion:reduce){.lamp-hang::after,.medal-halo,.party-token,.map-node--unknown .medal-face::before{animation:none!important}.map-node{transition:none}}
@media(max-width:800px){.campaign-screen{align-items:stretch;padding:var(--sp-3)}.campaign-topline{flex-wrap:wrap;gap:var(--sp-2)}.map-viewport{container-type:inline-size;width:100%}.party-status{flex-wrap:wrap;gap:var(--sp-2)}.route-progress{width:100%;justify-content:center;flex-wrap:wrap}.seed-chip{display:none}}
@media(max-height:760px){.campaign-header h1{font-size:24px}.campaign-header p{font-size:12px}.campaign-topline{letter-spacing:normal}.campaign-screen{gap:var(--sp-1)}.map-viewport,.dungeon-graph{min-height:340px}}
@media(max-height:660px){.campaign-header p{display:none}.campaign-header .last-decision{display:block}.campaign-header h1{margin:2px 0}.party-status{padding:var(--sp-1) var(--sp-4)}.map-viewport,.dungeon-graph{min-height:320px}}
</style>
