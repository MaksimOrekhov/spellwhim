// Geometry check of the battle screen (Battle UI v2) in headless Chrome over the DevTools protocol: no screenshots, only numbers.
// npm run dev, then: node scripts/battle-layout-check.mjs [--base http://localhost:5173] [--sizes 1920x1080,1280x720,900x600,2560x1440]
// For every size, scene and hand size it hovers the first, a middle and the last card and checks that
//  - the zoomed card and its notes scroll stay inside the window,
//  - neither covers a critical readout (anything marked [data-critical]: health plates, the intent banner, status trays),
//  - every critical readout is whole inside the window and above the hand,
//  - each Pixi anchor ([data-fx-anchor]) lies inside the window and the canvas has the size of the scene (so DOM and canvas coordinates agree).
// Fails (exit 1) on any violation, console error or uncaught exception.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const base = option('--base', 'http://localhost:5173')
const sizes = option('--sizes', '1920x1080,1280x720,900x600,2560x1440').split(',')
const scenes = option('--scenes', 'normal,everything,both,lethal,b-boss2,b-interrupt,b-crowded,b-elite').split(',')
const hands = option('--hands', '7,10').split(',')
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!chrome) throw new Error('Chrome or Edge not found')
const sleep = ms => new Promise(done => setTimeout(done, ms))

const port = 9334
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'spellwhim-layout-' + Date.now())}`, '--headless=new', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(item => item.type === 'page') } catch { /* not up yet */ }
}
if (!target) throw new Error('DevTools did not start')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(done => socket.addEventListener('open', done))
let nextId = 1
const waiting = new Map()
const problems = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); return }
  if (message.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text))
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) problems.push('console.' + message.params.type + ': ' + message.params.args.map(arg => arg.value ?? arg.description).join(' '))
})
const send = (method, params = {}) => new Promise(done => { const id = nextId++; waiting.set(id, done); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result?.value
await send('Runtime.enable'); await send('Page.enable')

/** Runs in the page: the rectangles that matter, in viewport coordinates. */
const probe = `(() => {
  const box = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
  const area = b => (b.right - b.left) * (b.bottom - b.top)
  const active = [...document.querySelectorAll('.slot.is-active .cf')].map(box).sort((a, b) => area(b) - area(a))[0] ?? null
  const notes = document.querySelector('.card-notes-pop')
  const canvas = document.querySelector('.battle-fx canvas')
  const scene = document.querySelector('[data-battle-scene]')
  return JSON.stringify({
    width: innerWidth, height: innerHeight,
    card: active, notes: notes ? { ...box(notes), scrollOverflow: notes.scrollHeight - notes.clientHeight } : null,
    critical: [...document.querySelectorAll('[data-battle-scene] [data-critical]')].map(element => ({ ...box(element), name: element.className.toString().split(' ')[0] })),
    dockTop: document.querySelector('.battle-dock')?.getBoundingClientRect().top ?? null,
    anchors: [...document.querySelectorAll('[data-fx-anchor]')].map(element => ({ id: element.dataset.fxAnchor, ...box(element) })),
    canvas: canvas ? box(canvas) : null, scene: scene ? box(scene) : null,
  })
})()`

const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
let checks = 0
for (const size of sizes) {
  const [w, h] = size.split('x').map(Number)
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  for (const scene of scenes) {
    for (const hand of hands) {
      await send('Page.navigate', { url: `${base}/card-preview.html?scene=${scene}&hand=${hand}&still=1` })
      await sleep(1800)
      const count = await evaluate(`document.querySelectorAll('.slot').length`)
      const picks = [...new Set([0, Math.floor((count - 1) / 2), count - 1])]
      for (const index of [-1, ...picks]) {
        await evaluate(`document.querySelectorAll('.slot').forEach(slot => slot.dispatchEvent(new MouseEvent('mouseleave')))`)
        if (index >= 0) await evaluate(`document.querySelectorAll('.slot')[${index}].dispatchEvent(new MouseEvent('mouseenter'))`)
        await sleep(index >= 0 ? 450 : 150)
        const s = JSON.parse(await evaluate(probe))
        const where = `${size} · ${scene} · hand ${hand} · ${index < 0 ? 'no hover' : 'card ' + (index + 1)}`
        checks += 1
        for (const item of s.critical) {
          if (item.left < -1 || item.right > s.width + 1 || item.top < -1) problems.push(`${where}: readout "${item.name}" leaves the window`)
          if (s.dockTop !== null && item.bottom > s.dockTop + 1) problems.push(`${where}: readout "${item.name}" reaches into the hand (${Math.round(item.bottom)} > ${Math.round(s.dockTop)})`)
          if (s.card && overlaps(s.card, item)) problems.push(`${where}: the zoomed card covers "${item.name}"`)
          if (s.notes && overlaps(s.notes, item)) problems.push(`${where}: the notes scroll covers "${item.name}"`)
        }
        for (const [label, rect] of [['zoomed card', s.card], ['notes scroll', s.notes]]) {
          if (rect && (rect.left < -1 || rect.right > s.width + 1 || rect.top < -1 || rect.bottom > s.height + 1)) problems.push(`${where}: the ${label} leaves the window`)
        }
        if (s.notes && s.notes.scrollOverflow > 1) problems.push(`${where}: the notes scroll is cut (${s.notes.scrollOverflow}px of text do not fit)`)
        for (const anchor of s.anchors) {
          const cx = (anchor.left + anchor.right) / 2, cy = (anchor.top + anchor.bottom) / 2
          if (cx < 0 || cx > s.width || cy < 0 || cy > (s.dockTop ?? s.height)) problems.push(`${where}: Pixi anchor "${anchor.id}" centre is outside the stage`)
        }
        if (s.canvas && s.scene && (Math.abs(s.canvas.left - s.scene.left) > 1 || Math.abs(s.canvas.right - s.scene.right) > 1 || Math.abs(s.canvas.top - s.scene.top) > 1 || Math.abs(s.canvas.bottom - s.scene.bottom) > 1)) problems.push(`${where}: the Pixi canvas does not cover the scene exactly`)
      }
    }
  }
}
socket.close(); proc.kill()
console.log(`${checks} layout checks over ${sizes.length} sizes, ${scenes.length} scenes, hands ${hands.join('/')}`)
if (problems.length) { console.error('PROBLEMS (' + [...new Set(problems)].length + '):\n' + [...new Set(problems)].join('\n')); process.exit(1) }
console.log('layout check passed')
