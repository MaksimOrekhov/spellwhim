<script setup lang="ts">
import { computed } from 'vue'
import HandCard from './HandCard.vue'
import GameTooltip from './GameTooltip.vue'
import type { HandCardView } from '../composables/useBattle'
import type { BattlePhase } from '../composables/useBattleAnimation'
const props = defineProps<{ cards: HandCardView[]; outgoing: HandCardView | null; outgoingIndex: number; drawCount: number; discardCount: number; exhaustedCount: number; phase: BattlePhase; mana: number; maxMana: number; nextMana?: number; nextDraw?: number; drawBoostFrom?: number; drawBoostAmount?: number }>()
const emit = defineEmits<{ play: [instanceId: string]; endTurn: [] }>()
const displayed = computed(() => { const cards = [...props.cards]; if (props.outgoing) cards.splice(props.outgoingIndex, 0, props.outgoing); return cards })
const manaHint = computed(() => {
  if (props.nextMana === undefined || props.nextMana === props.maxMana) return props.maxMana >= 5 ? 'Максимум маны: 5' : ''
  return 'Следующий ход: максимум ' + props.nextMana
})
const drawHint = computed(() => props.drawBoostFrom !== undefined && props.drawBoostAmount !== undefined
  ? 'В начале каждого хода после первого добираются 2 карты; с ' + props.drawBoostFrom + '-го хода — ' + props.drawBoostAmount + '. Несыгранные карты остаются в руке.'
  : 'В начале каждого следующего хода добираются ' + (props.nextDraw ?? 2) + ' карты. Несыгранные карты остаются в руке.')
function reason(item: HandCardView): string | null {
  if (props.phase === 'finished') return 'Бой завершён.'
  if (props.phase === 'enemy') return 'Сейчас ход противника. Дождитесь начала хода отряда.'
  if (props.phase === 'card') return 'Дождитесь завершения текущей способности.'
  if (props.mana < item.card.cost) return 'Недостаточно маны: нужно ' + item.card.cost + ', доступно ' + props.mana + '.'
  return item.playable ? null : 'Карта сейчас недоступна.'
}
</script>
<template>
  <footer class="battle-dock">
    <aside class="hand-resources">
      <div class="mana-pool" aria-label="Мана отряда"><span>Мана</span><strong>{{ mana }}<small>/{{ maxMana }}</small></strong><div class="mana-pips" aria-hidden="true"><i v-for="pip in maxMana" :key="pip" :class="{ 'is-spent': pip > mana }"></i></div><em v-if="manaHint" class="mana-next">{{ manaHint }}</em></div>
      <GameTooltip label="Общая колода"><button class="deck-counts" aria-label="Колода и сброс"><span>▤ Колода <b>{{ drawCount }}</b></span><span>↻ Сброс <b>{{ discardCount }}</b></span></button><template #content><p>В начале боя в руке 8 карт. {{ drawHint }}</p><p>Максимум руки — 10. Карты сверх лимита остаются в колоде. Выбывших до конца боя: {{ exhaustedCount }}.</p></template></GameTooltip>
    </aside>
    <section class="hand-area" aria-label="Карты в руке">
      <p class="hand-hint">{{ displayed.length }} / 10 карт · наведите для полного описания · клавиши 1–9, 0</p>
      <div class="hand-scroll"><div class="hand-cards" :class="{ 'hand-cards--fan': displayed.length > 4 }"><HandCard v-for="(item, index) in displayed" :key="item.instanceId" :card="item.card" :instance-id="item.instanceId" :preview="item.preview" :reason="reason(item)" :index="index" :fan="displayed.length > 4" :playing="outgoing?.instanceId === item.instanceId" @play="emit('play', $event)" /><p v-if="!displayed.length" class="empty-hand">Рука пуста.<br />Завершите ход, чтобы добрать карты.</p></div></div>
    </section>
    <aside class="turn-controls"><button class="game-button end-turn" :disabled="phase !== 'player'" @click="emit('endTurn')"><span>{{ phase === 'enemy' ? 'Ход врага' : phase === 'card' ? 'Действие…' : 'Завершить ход' }}</span><kbd>Enter</kbd></button><small>{{ phase === 'player' ? 'После этого враг атакует' : 'Дождитесь окончания действия' }}</small></aside>
  </footer>
</template>
<style scoped>
.battle-dock{position:absolute;z-index:10;left:0;right:0;bottom:0;height:var(--hand-height);display:grid;grid-template-columns:150px minmax(0,1fr) 180px;align-items:center;gap:20px;padding:0 clamp(24px,3vw,70px);background:linear-gradient(#1c34332b,#172e30 28%);border-top:1px solid #c5b07b29}.hand-resources{display:grid;gap:18px;justify-items:start}.mana-pool{display:grid;grid-template-columns:auto 1fr;gap:3px 12px;align-items:baseline}.mana-pool>span{font-size:16px;color:#d7e7de}.mana-pool strong{font-size:36px;color:#bce9ed;line-height:1}.mana-pool small{font-size:18px;color:#b4c7c3;font-weight:400}.mana-pool{width:100%}.mana-pips{grid-column:1/-1;display:flex;gap:5px}.mana-next{grid-column:1/-1;font-style:normal;font-size:12px;color:#f3dfb3}.mana-pips i{height:12px;flex:0 1 22px;min-width:0;border-radius:4px;background:#7ac6cd;border:1px solid #b7edec}.mana-pips .is-spent{background:#38504f;border-color:#55716a}.deck-counts{display:grid;gap:7px;width:128px;padding:0;border:0;background:none;color:#ced4bd;font-size:14px;text-align:left}.deck-counts span{display:flex;align-items:center;gap:5px}.deck-counts b{margin-left:auto;color:#f3dfb3}.hand-area{min-width:0;height:100%;position:relative;display:grid;grid-template-rows:27px minmax(0,1fr);container:hand / inline-size}.hand-hint{margin:0;align-self:end;text-align:center;color:#e0d9c2;font-size:13px;white-space:nowrap}.hand-scroll{overflow:visible;padding:23px 6px 8px;min-height:0}.hand-cards{position:relative;display:flex;gap:0;align-items:flex-end;justify-content:center;width:100%;min-width:0;height:100%;overflow:visible}.empty-hand{text-align:center;align-self:center;font-size:16px;line-height:1.5;color:#d1cfba;padding:0 30px}.turn-controls{display:grid;gap:12px;text-align:center;align-content:center}.end-turn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:74px;padding:12px 14px;font-size:17px;white-space:nowrap}.end-turn kbd{font:12px 'Trebuchet MS',Arial,sans-serif;font-weight:400;opacity:.7}.turn-controls>small{font-size:12px;line-height:1.4;color:#c0caba}
@media(min-width:1800px){.battle-dock{grid-template-columns:190px minmax(0,1fr) 220px;gap:35px}.mana-pool strong{font-size:42px}.hand-hint{font-size:15px}.deck-counts{width:155px;font-size:16px}.turn-controls>small{font-size:14px}.end-turn{font-size:20px}}
@media(max-width:1100px){.battle-dock{grid-template-columns:110px minmax(0,1fr) 140px;gap:10px;padding:0 20px}.end-turn{font-size:14px;padding:10px 8px}.deck-counts{width:100px;font-size:13px}.mana-pool{gap:3px 7px}.mana-pool strong{font-size:30px}.mana-pool>span{font-size:14px}.turn-controls>small{font-size:12px}.hand-hint{font-size:12px}}
</style>
