<script setup lang="ts">
// Original, minimal glyph set for gameplay concepts. One glyph = one meaning on every screen.
// Drawn on a 24×24 grid, filled with currentColor so the chip/medallion decides the colour.
export type GlyphName = 'damage' | 'armor' | 'draw' | 'vulnerable' | 'exhaust' | 'heart' | 'wait' | 'recover' | 'deck' | 'discard' | 'lock' | 'help' | 'attack-all' | 'crown' | 'cart' | 'camp' | 'anvil' | 'chest' | 'scroll' | 'skull' | 'coin' | 'quill'
defineProps<{ name: GlyphName }>()
const paths: Record<GlyphName, string> = {
  damage: '<path d="M20.9 3.1 21.4 3.6 20.6 8.6 10.6 17.6 8.4 15.4 17.4 5.4z"/><path d="M5.6 12.4 7 11 13 17 11.6 18.4z"/><path d="M9.6 15.8 5.2 20.2 3.8 18.8 8.2 14.4z"/><circle cx="4.2" cy="19.8" r="1.6"/>',
  armor: '<path d="M12 2.2 20 5.2v6.4c0 4.8-3.3 8.4-8 10.2-4.7-1.8-8-5.4-8-10.2V5.2z"/><path fill="#0006" d="M12 5.2 17.2 7.2v4.4c0 3.1-2 5.6-5.2 7z"/>',
  draw: '<path d="M8.2 3h9.6A1.9 1.9 0 0 1 19.7 4.9V16a1.9 1.9 0 0 1-1.9 1.9H8.2A1.9 1.9 0 0 1 6.3 16V4.9A1.9 1.9 0 0 1 8.2 3z"/><path fill="#0005" d="M4.4 6.4v11.9a1.9 1.9 0 0 0 1.9 1.9h9.6v-1.4H6.4a.9.9 0 0 1-.6-.9V6.4z"/><path fill="#0007" d="M13 6.4l1.1 2.6 2.6 1.1-2.6 1.1L13 13.8l-1.1-2.6-2.6-1.1L11.9 9z"/>',
  vulnerable: '<path fill-rule="evenodd" d="M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6zm0 3.3a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11zm0 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/><path d="M11 .8h2v4.2h-2zM11 19h2v4.2h-2zM.8 11H5v2H.8zM19 11h4.2v2H19z"/>',
  exhaust: '<path d="M12.4 1.8c.5 3.3 3.2 4.7 4.9 7.2a6.7 6.7 0 0 1-5.2 11.9 6.6 6.6 0 0 1-5.4-6.6c0-2.2 1-3.7 2.2-4.8.1 1.6.8 2.6 1.8 3 .6-3.6-1-5.3-.3-10.7z"/>',
  heart: '<path d="M12 21.3 3.6 12.8A5.4 5.4 0 0 1 11 5l1 1 1-1a5.4 5.4 0 0 1 7.4 7.8z"/>',
  wait: '<path d="M5.5 2h13v2.2c0 2.6-1.6 4.4-3.4 5.8 1.8 1.4 3.4 3.2 3.4 5.8V22h-13v-6.2c0-2.6 1.6-4.4 3.4-5.8C7.1 8.6 5.5 6.8 5.5 4.2z"/>',
  recover: '<path d="M12 2.6c3.8 1.5 6.8 2 8.2 2.4v6.1c0 4.9-3.2 8.5-8.2 10.3-5-1.8-8.2-5.4-8.2-10.3V5c1.4-.4 4.4-.9 8.2-2.4z"/><path fill="#0007" d="M11 8h2v3h3v2h-3v3h-2v-3H8v-2h3z"/>',
  deck: '<path d="M4 7.2 12 3.6l8 3.6-8 3.6zM4 11.2l8 3.6 8-3.6v2.2l-8 3.6-8-3.6zM4 15.4l8 3.6 8-3.6v2.2L12 21.2 4 17.6z"/>',
  discard: '<path d="M12 4.4a7.6 7.6 0 1 1-6.9 4.4l1.9.9a5.5 5.5 0 1 0 5-3.2V9l-4.4-3.3L12 2.4z"/>',
  lock: '<path d="M7 10V7.4a5 5 0 0 1 10 0V10h1.5v10.6h-13V10zM9.2 10h5.6V7.4a2.8 2.8 0 0 0-5.6 0z"/>',
  help: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.2 15.8h-2.1V16h2.1zm1.4-5.6c-.9.7-1.1 1-1.1 1.8h-2c0-1.5.6-2.2 1.6-3 .7-.5 1.1-.9 1.1-1.6 0-.7-.6-1.2-1.4-1.2-.9 0-1.5.5-1.6 1.5H7.9c.1-2 1.5-3.2 3.6-3.2 2 0 3.4 1.1 3.4 2.9 0 1.3-.7 2-1.3 2.6z"/>',
  'attack-all': '<path d="M12 2.5 14.4 8.4 20.8 9 16 13.3l1.5 6.3L12 16.3l-5.5 3.3L8 13.3 3.2 9l6.4-.6z"/>',
  crown: '<path d="M3 8l4.5 3.6L12 4l4.5 7.6L21 8l-1.8 11H4.8zM5.2 20.4h13.6v2H5.2z"/>',
  cart: '<path d="M2.5 7h19l-2 9h-15zM6 18.2a2 2 0 1 0 0 .1zM18 18.2a2 2 0 1 0 0 .1zM8 3.4h8v2.2H8z"/>',
  camp: '<path d="M12 2.4 22 20.5H2zM12 8.2 7.2 17.5h9.6z" fill-rule="evenodd"/><path d="M12 11.4c.6 1.2 2 1.9 2 3.3a2 2 0 0 1-4 0c0-.9.4-1.6 1-2 .1.5.4.8.8.9z"/>',
  anvil: '<path d="M2 6h15.6c1 0 1.8.7 1.8 1.7 0 2-1.6 3.3-3.6 3.3h-.8l1.5 3.4H20v2.6H4v-2.6h1.9l1.5-3.4C4.4 10.6 2.7 8.6 2 6zM6 18.4h12V21H6z"/>',
  chest: '<path d="M3 9a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v2H3zM3 12.4h7.4v2.2h3.2v-2.2H21V20H3z"/>',
  scroll: '<path d="M6 3h11a3 3 0 0 1 3 3v1.5h-3V6a.5.5 0 0 0-1 0v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-1.5h10V19a1 1 0 0 0 2 0V6a1 1 0 0 0-1-1H6zM6.2 7.4h6v1.6h-6zM6.2 11h6v1.6h-6z"/>',
  skull: '<path d="M12 2.4c4.6 0 8 3 8 7.4 0 2.6-1.2 4.4-2.8 5.5V19h-3v-2h-1.4v2h-1.6v-2H9.8v2h-3v-3.7C5.2 14.2 4 12.4 4 9.8c0-4.4 3.4-7.4 8-7.4zM8.6 9a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zm6.8 0a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z" fill-rule="evenodd"/>',
  coin: '<path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19zm0 3.2a6.3 6.3 0 1 1 0 12.6 6.3 6.3 0 0 1 0-12.6z" fill-rule="evenodd"/>',
  quill: '<path d="M20.5 2.5c-5.6.4-10.3 3-13.1 7.5l-1.8 4.4L8.2 12 5.4 20.5l1.6.5 2.6-5.6 1.4.6 2.6-2.8-2-.8 2.2-2 1.4.5 2-3.8-1.8-.7z"/>',
}
</script>
<template><svg class="glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" v-html="paths[name]"></svg></template>
<style scoped>.glyph{display:block;width:1em;height:1em;overflow:visible}</style>
