<script setup lang="ts">
import brannPortrait from '../assets/art/brann.jpg'
import liraPortrait from '../assets/art/lira.jpg'
import guardianPortrait from '../assets/art/guardian.jpg'
import type { Hero } from '../game/types'
const props = defineProps<{ hero: Hero; side: 'player' | 'enemy'; targeted?: boolean; damaged?: boolean; appearance?: 'root' | 'guardian' | 'heart' }>()
const portraits = { warrior: brannPortrait, mage: liraPortrait }
const portrait = props.side === 'enemy' ? guardianPortrait : portraits[props.hero.id]
</script>
<template>
  <article class="hero" :class="[`hero--${side}`, appearance ? `hero--appearance-${appearance}` : '', { 'is-targeted': targeted, 'is-damaged': damaged }]">
    <div class="hero-aura"></div>
    <div class="hero-art" :class="`hero-art--${hero.id}`"><img class="hero-image" :src="portrait" :alt="hero.name" /><span class="portrait-sheen"></span></div>
    <div class="hero-label"><strong>{{ hero.name }}</strong><small>{{ hero.title }}</small></div>
    <div class="health-orb" :class="{ 'health-orb--low': hero.health <= 8 }"><span>{{ hero.health }}</span><i>♥</i></div>
    <div v-if="hero.armor" class="armor-badge">⬡ {{ hero.armor }}</div>
  </article>
</template>
