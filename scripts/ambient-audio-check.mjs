// Real Web Audio/resource checks in disposable headless Chrome, plus four compact native-size review images.
// npm run dev, then node scripts/ambient-audio-check.mjs [--base http://localhost:5173] [--out docs/screenshots/ambient-v1]
// This checks Audio API activity, never claims subjective listening or hardware GPU performance.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
const args = process.argv.slice(2)
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1] }
const base = option('--base', 'http://localhost:5173'), out = resolve(option('--out', 'docs/screenshots/ambient-v1'))
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw Error('Chrome not found')
mkdirSync(out, { recursive: true })
const port = 9650 + Math.floor(Math.random() * 50), sleep = ms => new Promise(done => setTimeout(done, ms))
// A native-size window + software CSS compositing avoids incomplete offscreen tiles in Windows headless captures.
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${join(tmpdir(), 'spellwhim-audio-' + Date.now())}`, '--headless=new', '--window-size=2560,1440', '--disable-gpu', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' })
let socket
const results = [], problems = []
try {
  let target
  for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page') } catch {} }
  if (!target) throw Error('Chrome DevTools did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(done => socket.addEventListener('open', done))
  let nextId = 1
  const waiting = new Map()
  socket.addEventListener('message', event => {
    const m = JSON.parse(event.data)
    if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return }
    if (m.method === 'Runtime.exceptionThrown') problems.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(m.params.args.map(a => a.value ?? a.description).join(' '))
  })
  const send = (method, params = {}) => new Promise(done => { const id = nextId++; waiting.set(id, done); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (r.result?.exceptionDetails) throw Error(r.result.exceptionDetails.text + ': ' + expression)
    return r.result?.result?.value
  }
  const check = (name, value, detail) => { if (!value) throw Error(name + ': ' + JSON.stringify(detail)); results.push({ name, detail }); console.log('PASS', name, detail ?? '') }
  const waitFor = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + expression) }
  const click = async selector => {
    const p = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 } })()`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p })
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Performance.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: base + '/card-preview.html?view=vfx&panel=0' })
  await waitFor('!!window.__audio && !!window.__fx && !!window.__vfxLab')
  check('no audio context before input', (await evaluate('window.__audio.stats().contexts')) === 0)
  await click('.audio-toggle')
  await waitFor('window.__audio.stats().unlocked')
  check('trusted input unlocks one context', (await evaluate('window.__audio.stats().contexts')) === 1)
  await click('.audio-close')
  await evaluate('window.__audio.update({effects:.45,ambience:.2})')
  await tabReload()
  check('volume persists on reload', await evaluate('window.__audio.settings().effects === .45 && window.__audio.settings().ambience === .2'))
  check('reload stays silent before input', await evaluate('window.__audio.stats().contexts === 0'))
  await click('.audio-toggle'); await click('.audio-close'); await waitFor('window.__audio.stats().unlocked')

  for (const [scene, profile] of [['enemy-all', 'mine'], ['enemy-exposes', 'crystal'], ['boss-hit', 'forge'], ['boss-all', 'forge-fury']]) {
    await evaluate(`window.__vfxLab.play(${JSON.stringify(scene)})`)
    await waitFor(`document.querySelector('[data-ambient]').dataset.ambient === ${JSON.stringify(profile)}`)
    await waitFor('!window.__vfxLab.busy() && !window.__fx().ticking')
    await sleep(800)
    const stats = await evaluate('window.__audio.stats()')
    check(profile + ' profile and bounded sources', stats.profile === profile && stats.ambientSources <= 1 && stats.ambientTimers === 1 && stats.contexts === 1, stats)
    const count = await evaluate('document.querySelectorAll(".ambient .mote").length')
    check(profile + ' particle cap', count <= 26 && count > 0, count)
    // Capture the initial quiet arena, after all hand transitions, rather than the last frame of an enemy turn.
    await evaluate(`window.__vfxLab.reset(${JSON.stringify(scene)})`)
    await waitFor('document.fonts.status === "loaded" && !document.querySelector(".deal-enter-active,.deal-leave-active")')
    await sleep(500)
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 })
    writeFileSync(join(out, profile + '-2560.jpg'), Buffer.from(shot.result.data, 'base64'))
  }

  const before = await evaluate('window.__audio.stats().played')
  for (const scene of ['fireball', 'frostbolt', 'shield-bash', 'enemy-block', 'arcane-insight']) {
    await evaluate(`window.__vfxLab.play(${JSON.stringify(scene)})`)
    await waitFor('!window.__vfxLab.busy() && !window.__fx().ticking')
  }
  check('sequential combat plays actual AudioBufferSources', (await evaluate('window.__audio.stats().played')) > before + 5)
  await evaluate('window.__vfxLab.play("fireball")'); await sleep(180)
  await evaluate('window.__audio.update({muted:true})')
  check('mute stops sources immediately', await evaluate('window.__audio.stats().sources === 0 && window.__audio.stats().ambientTimers === 0'))
  await tabReload()
  check('mute persists on reload', await evaluate('window.__audio.settings().muted && window.__audio.stats().contexts === 0'))
  await evaluate('window.__audio.update({muted:false})'); await click('.audio-toggle'); await click('.audio-close')
  await waitFor('window.__audio.stats().unlocked')

  // A synthetic document lifecycle event exercises the production listener without changing OS/app state.
  await evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))')
  check('hidden listener pauses particles, sound and timers', await evaluate('window.__audio.stats().sources === 0 && window.__audio.stats().ambientTimers === 0 && document.querySelector("[data-ambient]").dataset.ambientPaused === "true"'))
  await evaluate('delete document.hidden;document.dispatchEvent(new Event("visibilitychange"))')
  check('visible listener resumes one timer', await evaluate('window.__audio.stats().ambientTimers === 1'))
  await evaluate('window.__vfxLab.setMotion("reduced")')
  await waitFor('document.querySelectorAll(".ambient .mote").length === 0')
  const played = await evaluate('window.__audio.stats().played')
  await evaluate('window.__vfxLab.play("fireball")'); await waitFor('!window.__vfxLab.busy() && !window.__fx().ticking')
  check('reduced motion removes particles but preserves sound', (await evaluate('window.__audio.stats().played')) > played)
  await evaluate('window.__vfxLab.setMotion("full")')

  // Sample idle main-thread work, comparing the same scene with/without ambient animations; software GPU work is not measured.
  const metric = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]))
  const perf = {}
  for (const mode of ['full', 'reduced']) {
    await evaluate(`window.__vfxLab.setMotion(${JSON.stringify(mode)})`); await sleep(500)
    const a = await metric(); await sleep(3000); const b = await metric()
    perf[mode] = { taskMs: Math.round((b.TaskDuration - a.TaskDuration) * 1000), scriptMs: Math.round((b.ScriptDuration - a.ScriptDuration) * 1000) }
  }
  results.push({ name: 'idle main-thread work over 3 seconds (SwiftShader)', detail: perf }); console.log('PERF', perf)
  await evaluate('window.__audio.update({muted:true})')
  await send('Page.navigate', { url: base + '/card-preview.html?view=sheet' })
  await waitFor('!document.querySelector("[data-battle-scene]")')
  check('no ambient DOM outside battle', await evaluate('document.querySelectorAll(".ambient").length === 0'))

  // Unavailable Web Audio: real lab still completes an action through its normal animation path.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.AudioContext=undefined' })
  await send('Page.navigate', { url: base + '/card-preview.html?view=vfx&panel=0' })
  await waitFor('!!window.__audio && !!window.__vfxLab')
  await evaluate('window.__audio.update({muted:false})'); await click('.audio-toggle'); await click('.audio-close')
  await evaluate('window.__vfxLab.play("fireball")'); await waitFor('!window.__vfxLab.busy() && !window.__fx?.()?.ticking')
  check('unavailable AudioContext preserves combat', await evaluate('window.__audio.stats().unavailable && window.__audio.stats().contexts === 0'))
  check('no console errors', problems.length === 0, problems)
  async function tabReload() { await send('Page.reload'); await sleep(500); await waitFor('!!window.__audio && !!window.__vfxLab && !!window.__fx') }
  writeFileSync(join(out, 'checks.json'), JSON.stringify({ viewport: '2560x1440', renderer: 'Chrome headless / SwiftShader', results }, null, 2))
} finally { socket?.close(); proc.kill() }
