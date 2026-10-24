// Resource and frame check of the battle effects in headless Chrome: plays scenes of the VFX lab one after another and reports, per scene,
// the most particles/actors alive at once, the script time of a frame of effects (the GPU work is not measured), the browser's frame times, and what is left
// on the canvas when the effect is over (it must be nothing, with the ticker stopped).
// npm run dev, then: node scripts/vfx-check.mjs [--base http://localhost:5173] [--fx a,b | all] [--size 1280x720] [--motion reduced] [--rapid]
// --rapid also plays several scenes back to back without waiting (a fast sequence of cards) and checks that nothing is left behind.
// Exits 1 on a console error, a leftover effect or a missing ticker stop. A headless software renderer draws a frame in tens of milliseconds, so the canvas clock
// (capped at 50 ms a frame) runs slower than real time there: the check waits for the ticker to stop instead of assuming the effect is over.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const base = option('--base', 'http://localhost:5173')
const [width, height] = option('--size', '1280x720').split('x').map(Number)
const motion = option('--motion', 'full')
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw new Error('Chrome not found')
const sleep = ms => new Promise(done => setTimeout(done, ms))

const port = 9500 + Math.floor(Math.random() * 90)
const profile = join(tmpdir(), 'spellwhim-vfx-check-' + Date.now())
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', 'about:blank'], { stdio: 'ignore' })
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(item => item.type === 'page') } catch { /* not up yet */ }
}
if (!target) throw new Error('Chrome DevTools did not start')
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
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/card-preview.html?view=vfx&panel=0` })
for (let i = 0; i < 60 && !(await evaluate('!!window.__vfxLab')); i++) await sleep(250)
await sleep(1000)
await evaluate(`window.__vfxLab.setMotion(${JSON.stringify(motion)})`)
const ids = option('--fx', 'all') === 'all' ? await evaluate('window.__vfxLab.ids') : option('--fx').split(',')

// A sampler inside the page: frame deltas and the peak of what is alive.
await evaluate(`(() => {
  window.__sample = { frames: [], peak: { actors: 0, particles: 0, labels: 0, children: 0 }, last: performance.now(), on: true }
  const tick = now => { const s = window.__sample; if (!s.on) return; s.frames.push(now - s.last); s.last = now
    const fx = window.__fx && window.__fx(); if (fx) for (const k of Object.keys(s.peak)) s.peak[k] = Math.max(s.peak[k], fx[k])
    requestAnimationFrame(tick) }
  requestAnimationFrame(tick)
})()`)
const reset = () => evaluate('(() => { const s = window.__sample; s.frames.length = 0; s.peak = { actors: 0, particles: 0, labels: 0, children: 0 }; return true })()')
/** Waits until the canvas has finished the effect by itself: no ticker, nothing alive. Remembers the script cost of the frames that were drawn. */
const settle = async () => {
  await evaluate('window.__script = window.__fx().frameMs')
  for (let i = 0; i < 400; i++) {
    const fx = JSON.parse(await evaluate('JSON.stringify(window.__fx())'))
    if (!fx.ticking) return
    await evaluate('window.__script = window.__fx().frameMs.avg ? window.__fx().frameMs : window.__script')
    await sleep(60)
  }
}
const waitIdle = async () => {
  for (let i = 0; i < 40 && !(await evaluate('window.__vfxLab.busy()')); i++) await sleep(25)
  for (let i = 0; i < 200 && (await evaluate('window.__vfxLab.busy()')); i++) await sleep(40)
}

let failed = false
console.log('scene'.padEnd(22), 'script ms avg/max', 'peak particles', 'peak labels', 'browser frames avg ms', 'left')
for (const id of ids) {
  await reset()
  await evaluate(`window.__vfxLab.play(${JSON.stringify(id)})`)
  await waitIdle()
  await settle()
  const result = JSON.parse(await evaluate('JSON.stringify({ frames: window.__sample.frames, peak: window.__sample.peak, fx: window.__fx(), script: window.__script })'))
  const frames = result.frames.filter(delta => delta < 1000).sort((a, b) => a - b)
  const avg = frames.reduce((sum, delta) => sum + delta, 0) / Math.max(1, frames.length)
  const left = result.fx.actors + result.fx.particles + result.fx.timers + result.fx.labels
  const leftover = left > 0 || result.fx.ticking
  if (leftover) failed = true
  console.log(id.padEnd(22), `${result.script.avg.toFixed(2)} / ${result.script.max.toFixed(2)}`.padStart(17), String(result.peak.particles).padStart(14), String(result.peak.labels).padStart(11), avg.toFixed(0).padStart(21), leftover ? 'LEFTOVER ' + JSON.stringify(result.fx) : 'nothing, ticker stopped')
}

if (args.includes('--rapid')) {
  // Cards in quick succession: each new play replaces the one before it at once.
  const burst = ['sword-strike', 'fireball', 'frostbolt', 'thunderbolt', 'shield-bash', 'bastion', 'ice-ward', 'enemy-all', 'boss-heavy', 'arcane-insight']
  for (const id of burst) { evaluate(`window.__vfxLab.play(${JSON.stringify(id)})`); await sleep(140) }
  await waitIdle()
  await settle()
  const fx = JSON.parse(await evaluate('JSON.stringify(window.__fx())'))
  const clean = fx.actors + fx.particles + fx.timers + fx.labels === 0 && !fx.ticking
  if (!clean) failed = true
  console.log('rapid sequence of', burst.length, 'plays:', clean ? 'nothing left, ticker stopped' : 'LEFTOVER ' + JSON.stringify(fx))
}
await evaluate('window.__sample.on = false')
if (problems.length) { failed = true; console.log('PROBLEMS\n' + problems.join('\n')) }
socket.close(); proc.kill()
process.exit(failed ? 1 : 0)
