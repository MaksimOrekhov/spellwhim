<script setup lang="ts">
import { onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { Application, Container, Graphics, Text } from 'pixi.js'
import type { HeroId } from '../game/types'

type Effect = 'attack' | 'spell' | 'guard' | 'hit' | ''
const props = defineProps<{ pulse: number; effect: Effect; target: HeroId | 'enemy'; source: HeroId | 'enemy' | null; damage: number; actionId: string | null; bonusDamage: number; partnerArmor: number }>()
const emit = defineEmits<{ impact: [actionId: string] }>()
const canvasHost = useTemplateRef<HTMLDivElement>('canvasHost')
let app: Application | null = null
let effects: Container | null = null
let resizeObserver: ResizeObserver | null = null
let disposed = false
type EffectTick = (ticker: { deltaMS: number }) => void
const effectTicks = new Set<EffectTick>()
const effectTimers = new Set<ReturnType<typeof setTimeout>>()
function addEffectTick(tick: EffectTick) { effectTicks.add(tick); app?.ticker.add(tick) }
function removeEffectTick(tick: EffectTick) { effectTicks.delete(tick); app?.ticker.remove(tick) }
function scheduleEffect(callback: () => void, delay: number) {
  const timer = window.setTimeout(() => { effectTimers.delete(timer); if (!disposed) callback() }, delay)
  effectTimers.add(timer)
}

function center(key: HeroId | 'enemy') {
  const canvas = canvasHost.value
  const anchor = canvas?.closest('[data-battle-scene]')?.querySelector<HTMLElement>('[data-fx-anchor="' + key + '"]')
  if (!canvas || !anchor) return null
  const hostRect = canvas.getBoundingClientRect()
  const targetRect = anchor.getBoundingClientRect()
  return { x: targetRect.left + targetRect.width / 2 - hostRect.left, y: targetRect.top + targetRect.height / 2 - hostRect.top }
}

function clearEffects() {
  for (const tick of effectTicks) app?.ticker.remove(tick)
  effectTicks.clear()
  for (const timer of effectTimers) window.clearTimeout(timer)
  effectTimers.clear()
  if (!effects) return
  for (const child of [...effects.children]) child.destroy()
}

function popAt(x: number, y: number, color: number, amount: number) {
  if (!effects || !app) return
  const ring = new Graphics().circle(0, 0, 30).stroke({ color, width: 6, alpha: 0.95 })
  ring.position.set(x, y)
  effects.addChild(ring)
  const label = new Text({ text: amount === 0 ? 'БЛОК' : `−${amount}`, style: { fontFamily: 'Georgia, serif', fontSize: Math.max(28, Math.min(46, (canvasHost.value?.clientHeight ?? 720) * .04)), fontWeight: 'bold', fill: '#fff4d6', stroke: { color: 0x38222b, width: 6 }, dropShadow: { color: 0x120e20, blur: 10, distance: 4 } } })
  label.anchor.set(0.5)
  label.position.set(x, y - 10)
  effects.addChild(label)
  let elapsed = 0
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const progress = Math.min(elapsed / 650, 1)
    const entrance = Math.min(elapsed / 120, 1)
    const pop = 1 + Math.sin(entrance * Math.PI) * 0.2
    ring.scale.set(0.35 + progress * 1.9)
    ring.alpha = 1 - progress
    label.scale.set((0.7 + entrance * 0.3) * pop)
    label.position.y = y - 10 - 54 * progress
    label.rotation = Math.sin(progress * Math.PI) * -0.06
    label.alpha = 1 - progress
    if (progress >= 1) {
      removeEffectTick(tick)
      ring.destroy()
      label.destroy()
    }
  }
  addEffectTick(tick)
  for (let index = 0; index < 16; index += 1) {
    const angle = Math.PI * 2 * index / 16
    const distance = 45 + Math.random() * 55
    const spark = new Graphics().circle(0, 0, 3 + Math.random() * 2).fill({ color })
    spark.position.set(x, y)
    effects.addChild(spark)
    let age = 0
    const fly = (ticker: { deltaMS: number }) => {
      age += ticker.deltaMS
      const p = Math.min(age / 440, 1)
      spark.position.set(x + Math.cos(angle) * distance * p, y + Math.sin(angle) * distance * p)
      spark.alpha = 1 - p
      if (p >= 1) { removeEffectTick(fly); spark.destroy() }
    }
    addEffectTick(fly)
  }
}

function swordSlashAt(x: number, y: number, onImpact: () => void, impactColor = 0xffd27c) {
  if (!effects || !app) return
  const width = canvasHost.value?.clientWidth ?? 1280
  const reach = Math.max(50, Math.min(104, width * 0.055))
  const start = { x: x - reach, y: y + reach * 0.68 }
  const control = { x: x + reach * 0.35, y: y + reach * 0.2 }
  const end = { x: x + reach * 0.85, y: y - reach * 0.78 }
  const slash = new Graphics()
  effects.addChild(slash)
  let elapsed = 0
  let impactHold = 0
  let didImpact = false

  function pointAt(progress: number) {
    const inverse = 1 - progress
    return {
      x: inverse * inverse * start.x + 2 * inverse * progress * control.x + progress * progress * end.x,
      y: inverse * inverse * start.y + 2 * inverse * progress * control.y + progress * progress * end.y,
    }
  }

  const tick = (ticker: { deltaMS: number }) => {
    if (didImpact) impactHold += ticker.deltaMS
    else elapsed += ticker.deltaMS

    const progress = Math.max(0, Math.min((elapsed - 75) / 175, 1))
    const tail = Math.max(0, Math.min((elapsed - 75 - 35) / 175, 1))
    const head = pointAt(progress)
    const tailPoint = pointAt(tail)
    const fade = didImpact ? Math.max(0, 1 - Math.max(0, impactHold - 70) / 90) : 1

    slash.clear()
    if (progress > 0) {
      slash.moveTo(tailPoint.x, tailPoint.y).quadraticCurveTo(control.x, control.y, head.x, head.y).stroke({ color: 0xffa642, width: 28, alpha: 0.19 * fade, cap: 'round', join: 'round' })
      slash.moveTo(tailPoint.x, tailPoint.y).quadraticCurveTo(control.x, control.y, head.x, head.y).stroke({ color: 0xffc66e, width: 15, alpha: 0.62 * fade, cap: 'round', join: 'round' })
      slash.moveTo(tailPoint.x, tailPoint.y).quadraticCurveTo(control.x, control.y, head.x, head.y).stroke({ color: 0xfff6d8, width: 5, alpha: 0.98 * fade, cap: 'round', join: 'round' })
      slash.circle(head.x, head.y, 5 + Math.sin(elapsed * 0.04) * 1.5).fill({ color: 0xffffff, alpha: fade })
    }

    if (progress >= 1 && !didImpact) {
      didImpact = true
      onImpact()
      impactFlashAt(x, y)
      scheduleEffect(() => popAt(x, y, impactColor, props.damage), 65)
    }
    if (didImpact && impactHold >= 160) {
      removeEffectTick(tick)
      slash.destroy()
    }
  }
  addEffectTick(tick)
}

function impactFlashAt(x: number, y: number, color = 0xffc46b) {
  if (!effects || !app) return
  const flash = new Graphics().circle(0, 0, 34).fill({ color: 0xfff7df, alpha: 0.85 })
  const ring = new Graphics().circle(0, 0, 31).stroke({ color, width: 7, alpha: 0.95 })
  flash.position.set(x, y)
  ring.position.set(x, y)
  effects.addChild(flash, ring)
  let elapsed = 0
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const progress = Math.min(elapsed / 145, 1)
    flash.scale.set(0.65 + progress * 1.4)
    flash.alpha = Math.max(0, 0.85 * (1 - progress) ** 2)
    ring.scale.set(0.45 + progress * 1.8)
    ring.alpha = 1 - progress
    if (progress >= 1) {
      removeEffectTick(tick)
      flash.destroy()
      ring.destroy()
    }
  }
  addEffectTick(tick)
}

function floatingLabelAt(x: number, y: number, text: string, color: string) {
  if (!effects || !app) return
  const label = new Text({ text, style: { fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 'bold', fill: color, stroke: { color: 0x102333, width: 5 }, dropShadow: { color: 0x071521, blur: 8, distance: 3 } } })
  label.anchor.set(0.5)
  label.position.set(x, y - 30)
  effects.addChild(label)
  let elapsed = 0
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const progress = Math.min(elapsed / 620, 1)
    label.position.y = y - 30 - 50 * progress
    label.scale.set(0.82 + Math.min(elapsed / 100, 1) * 0.18)
    label.alpha = Math.min(elapsed / 70, 1) * (1 - progress)
    if (progress >= 1) {
      removeEffectTick(tick)
      label.destroy()
    }
  }
  addEffectTick(tick)
}

function guardAt(x: number, y: number, armor: number, onImpact: () => void) {
  if (!effects || !app) return
  const shield = new Graphics()
    .moveTo(0, -50).lineTo(36, -36).lineTo(31, 7)
    .quadraticCurveTo(24, 36, 0, 51).quadraticCurveTo(-24, 36, -31, 7)
    .lineTo(-36, -36).closePath()
    .fill({ color: 0x37b9ef, alpha: 0.2 })
    .stroke({ color: 0xbdf7ff, width: 5, alpha: 0.98 })
  shield.position.set(x, y)
  effects.addChild(shield)
  const innerShield = new Graphics()
    .moveTo(0, -34).lineTo(23, -25).lineTo(20, 5)
    .quadraticCurveTo(16, 24, 0, 35).quadraticCurveTo(-16, 24, -20, 5)
    .lineTo(-23, -25).closePath()
    .stroke({ color: 0x91eaff, width: 2, alpha: 0.8 })
  innerShield.position.set(x, y)
  effects.addChild(innerShield)
  const glow = new Graphics().circle(0, 0, 72).stroke({ color: 0x55bfff, width: 3, alpha: 0.58 })
  glow.position.set(x, y)
  effects.addChild(glow)
  const orbit = new Graphics().ellipse(0, 0, 88, 25).stroke({ color: 0x8deaff, width: 2, alpha: 0.65 })
  orbit.position.set(x, y + 6)
  effects.addChild(orbit)
  let elapsed = 0
  let impactSent = false
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const p = Math.min(elapsed / 900, 1)
    const charge = Math.min(elapsed / 280, 1)
    const easeOut = 1 - Math.pow(1 - charge, 3)
    const pulse = Math.sin(elapsed * 0.018) * 0.035
    const fade = p < 0.62 ? 1 : Math.max(0, 1 - (p - 0.62) / 0.38)
    shield.scale.set(0.42 + easeOut * 0.58 + pulse)
    innerShield.scale.copyFrom(shield.scale)
    glow.scale.set(0.68 + easeOut * 0.42 + pulse)
    orbit.scale.set(0.72 + easeOut * 0.28)
    orbit.rotation = elapsed * 0.0011
    shield.alpha = innerShield.alpha = glow.alpha = orbit.alpha = fade
    if (elapsed >= 250 && !impactSent) {
      impactSent = true
      onImpact()
      impactFlashAt(x, y, 0x72e8ff)
      scheduleEffect(() => floatingLabelAt(x, y, `+${armor} БРОНИ`, '#bdf7ff'), 65)
    }
    if (p >= 1) { removeEffectTick(tick); shield.destroy(); innerShield.destroy(); glow.destroy(); orbit.destroy() }
  }
  addEffectTick(tick)
}

function fireball(from: { x: number; y: number }, to: { x: number; y: number }, onImpact: () => void) {
  if (!effects || !app) return
  const trail = new Graphics()
  const emberTrail = Array.from({ length: 5 }, (_, index) => {
    const ember = new Graphics().circle(0, 0, 5 - index * 0.55).fill({ color: index < 2 ? 0xff9a35 : 0xffd477, alpha: 0.78 })
    effects?.addChild(ember)
    return ember
  })
  const orb = new Graphics()
    .circle(0, 0, 33).fill({ color: 0xb45aff, alpha: 0.22 })
    .circle(0, 0, 23).fill({ color: 0xff6b27, alpha: 0.94 })
    .circle(-3, -4, 15).fill({ color: 0xffbf52, alpha: 0.95 })
    .circle(-5, -7, 8).fill({ color: 0xfff6c4, alpha: 1 })
  orb.position.set(from.x, from.y)
  effects.addChild(trail, orb)
  let elapsed = 0
  const pointAt = (progress: number) => {
    const eased = 1 - Math.pow(1 - progress, 2)
    return {
      x: from.x + (to.x - from.x) * eased,
      y: from.y + (to.y - from.y) * eased - Math.sin(progress * Math.PI) * 72,
    }
  }
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const p = Math.min(elapsed / 520, 1)
    const point = pointAt(p)
    const tail = pointAt(Math.max(0, p - 0.18))
    const { x, y } = point
    orb.position.set(x, y)
    const flicker = 1 + Math.sin(elapsed * 0.04) * 0.1
    orb.scale.set(flicker)
    trail.clear()
      .moveTo(tail.x, tail.y).lineTo(x, y).stroke({ color: 0xb24aff, width: 29, alpha: 0.16 * (1 - p * 0.35), cap: 'round' })
      .moveTo(tail.x, tail.y).lineTo(x, y).stroke({ color: 0xff742b, width: 17, alpha: 0.55 * (1 - p * 0.35), cap: 'round' })
      .moveTo(tail.x, tail.y).lineTo(x, y).stroke({ color: 0xffd879, width: 5, alpha: 0.9 * (1 - p * 0.35), cap: 'round' })
    emberTrail.forEach((ember, index) => {
      const emberProgress = Math.max(0, p - 0.035 * (index + 1))
      const emberPoint = pointAt(emberProgress)
      ember.position.set(emberPoint.x, emberPoint.y)
      ember.alpha = p > 0 ? Math.max(0.18, 0.85 - index * 0.12) * (p < 0.96 ? 1 : 1 - (p - 0.96) / 0.04) : 0
    })
    if (p >= 1) {
      removeEffectTick(tick)
      orb.destroy()
      trail.destroy()
      emberTrail.forEach(ember => ember.destroy())
      onImpact()
      fireballImpactAt(to.x, to.y)
      scheduleEffect(() => popAt(to.x, to.y, 0xffab4d, props.damage), 75)
    }
  }
  addEffectTick(tick)
}

function fireballImpactAt(x: number, y: number) {
  if (!effects || !app) return
  const core = new Graphics().circle(0, 0, 32).fill({ color: 0xffedbd, alpha: 0.95 })
  const flameRing = new Graphics().circle(0, 0, 29).stroke({ color: 0xff8b36, width: 9, alpha: 0.95 })
  const magicRing = new Graphics().circle(0, 0, 39).stroke({ color: 0xd28aff, width: 4, alpha: 0.8 })
  core.position.set(x, y)
  flameRing.position.set(x, y)
  magicRing.position.set(x, y)
  effects.addChild(core, flameRing, magicRing)
  let elapsed = 0
  const tick = (ticker: { deltaMS: number }) => {
    elapsed += ticker.deltaMS
    const p = Math.min(elapsed / 320, 1)
    core.scale.set(0.8 + p * 2.2)
    core.alpha = Math.max(0, (1 - p) ** 2)
    flameRing.scale.set(0.45 + p * 2.4)
    flameRing.alpha = 1 - p
    magicRing.scale.set(0.35 + p * 1.9)
    magicRing.alpha = 0.8 * (1 - p)
    if (p >= 1) {
      removeEffectTick(tick)
      core.destroy()
      flameRing.destroy()
      magicRing.destroy()
    }
  }
  addEffectTick(tick)
}

onMounted(async () => {
  const instance = new Application()
  await instance.init({ backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: canvasHost.value! })
  if (disposed || !canvasHost.value) { instance.destroy(true); return }
  app = instance
  canvasHost.value.appendChild(instance.canvas)
  effects = new Container()
  instance.stage.addChild(effects)
  resizeObserver = new ResizeObserver(() => {
    if (app && canvasHost.value) app.renderer.resize(canvasHost.value.clientWidth, canvasHost.value.clientHeight)
  })
  resizeObserver.observe(canvasHost.value)
  trigger()
})

onUnmounted(() => {
  disposed = true
  resizeObserver?.disconnect()
  clearEffects()
  if (app) {
    app.ticker.stop()
    app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true })
    app = null
    effects = null
  }
})

function trigger() {
  clearEffects()
  if (!app || !effects || !canvasHost.value || !props.effect || !props.actionId) return
  const target = center(props.target)
  if (!target) return
  const source = center(props.source ?? 'mage')
  const actionId = props.actionId
  const bonus = props.bonusDamage
  const partnerArmor = props.partnerArmor
  const partner = center(props.target === 'mage' ? 'warrior' : 'mage')
  const onImpact = () => {
    if (disposed || props.actionId !== actionId) return
    emit('impact', actionId)
    if (bonus > 0) {
      impactFlashAt(target.x, target.y, 0xce9aff)
      floatingLabelAt(target.x, target.y + 52, 'Связка +' + bonus, '#ebc9ff')
    }
    if (props.effect === 'guard' && partnerArmor > 0 && partner) {
      impactFlashAt(partner.x, partner.y, 0x72e8ff)
      floatingLabelAt(partner.x, partner.y, '+' + partnerArmor + ' БРОНИ', '#bdf7ff')
    }
  }
  if (props.effect === 'spell' && source) { fireball(source, target, onImpact); return }
  if (props.effect === 'attack') { swordSlashAt(target.x, target.y, onImpact); return }
  if (props.effect === 'guard') { guardAt(target.x, target.y, props.damage, onImpact); return }
  if (props.effect === 'hit') swordSlashAt(target.x, target.y, onImpact, 0xffa06e)
}
watch(() => props.pulse, trigger, { flush: 'post' })
</script>

<template><div ref="canvasHost" class="battle-fx" aria-hidden="true" /></template>
