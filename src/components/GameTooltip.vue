<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch, useId, useTemplateRef } from 'vue'
const props = withDefaults(defineProps<{ label: string; placement?: 'top' | 'bottom'; disabled?: boolean }>(), { placement: 'top' })
const anchor = useTemplateRef<HTMLElement>('anchor')
const tip = useTemplateRef<HTMLElement>('tip')
const opened = ref(false)
const hovered = ref(false)
const focused = ref(false)
const position = ref({ left: '0px', top: '0px', visibility: 'hidden' as 'hidden' | 'visible' })
const id = useId()
async function show() {
  if (props.disabled) return
  opened.value = true
  await nextTick()
  const rect = anchor.value?.getBoundingClientRect()
  const box = tip.value?.getBoundingClientRect()
  if (!rect || !box) return
  const below = props.placement === 'bottom' || rect.top < box.height + 16
  position.value = {
    left: Math.max(12, Math.min(window.innerWidth - box.width - 12, rect.left + rect.width / 2 - box.width / 2)) + 'px',
    top: Math.max(12, Math.min(window.innerHeight - box.height - 12, below ? rect.bottom + 12 : rect.top - box.height - 12)) + 'px',
    visibility: 'visible',
  }
}
function enter() { hovered.value = true; show() }
function leave() { hovered.value = false; if (!focused.value) hide() }
function focus() { focused.value = true; show() }
function blur() { focused.value = false; if (!hovered.value) hide() }
function hide() { opened.value = false; position.value.visibility = 'hidden' }
watch(() => props.disabled, disabled => { if (disabled) hide() })
function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') hide() }
// Keep the popup anchored when the viewport changes; scrolling dismisses it.
function reposition() { if (opened.value) void show() }
window.addEventListener('resize', reposition)
window.addEventListener('scroll', hide, true)
window.addEventListener('keydown', closeOnEscape)
onUnmounted(() => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', hide, true); window.removeEventListener('keydown', closeOnEscape) })
</script>
<template>
  <span ref="anchor" class="tooltip-anchor" :aria-describedby="opened ? id : undefined" @mouseenter="enter" @mouseleave="leave" @focusin="focus" @focusout="blur">
    <slot />
    <Teleport to="body">
      <div v-if="opened" :id="id" ref="tip" class="game-tooltip" role="tooltip" :style="position">
        <strong>{{ label }}</strong><slot name="content" />
      </div>
    </Teleport>
  </span>
</template>
<style scoped>
.tooltip-anchor{display:inline-flex;position:relative;min-width:0}
.game-tooltip{position:fixed;z-index:1000;width:max-content;max-width:min(320px,calc(100vw - 24px));padding:16px 18px;border:1px solid #e4c58c;border-radius:10px;background:linear-gradient(145deg,#314342,#182b30);box-shadow:0 12px 32px #071416a8;color:#fff0d2;font:15px/1.45 'Trebuchet MS',Arial,sans-serif;pointer-events:none;text-align:left}
.game-tooltip>strong{display:block;font:700 19px/1.2 Georgia,serif;margin-bottom:8px;color:#ffe3a8}.game-tooltip :deep(p){margin:6px 0}.game-tooltip :deep(.tooltip-accent){color:#e0bcff;font-weight:700}.game-tooltip :deep(.tooltip-reason){color:#ffd09d;border-top:1px solid #b99f6955;padding-top:8px}
</style>
