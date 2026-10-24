// Stills of the battle effects lab (card-preview.html?view=vfx) in headless Chrome over the DevTools protocol.
// npm run dev, then: node scripts/vfx-shots.mjs <out-dir> [--base http://localhost:5173] [--fx sword-strike,fireball | all] [--times 60,150,250,400,600] [--size 1280x720] [--motion reduced]
// Every frame is a real run of the effect frozen at a moment of its own clock (&hold), so a still is reproducible. Fails on console errors.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'vfx-shots')
const base = option('--base', 'http://localhost:5173')
const times = option('--times', '60,150,250,400,600').split(',').map(Number)
const [width, height] = option('--size', '1280x720').split('x').map(Number)
const motion = option('--motion', 'full')
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw new Error('Chrome not found')
mkdirSync(out, { recursive: true })
const sleep = ms => new Promise(done => setTimeout(done, ms))

const port = 9340 + Math.floor(Math.random() * 50)
const profile = join(tmpdir(), 'spellwhim-vfx-shots-' + Date.now())
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
await sleep(800)
const ids = option('--fx', 'all') === 'all' ? await evaluate('window.__vfxLab.ids') : option('--fx').split(',')
await evaluate(`window.__vfxLab.setMotion(${JSON.stringify(motion)})`)
for (const id of ids) {
  for (const time of times) {
    await evaluate(`window.__vfxLab.setHold(${time})`)
    await evaluate(`window.__vfxLab.play(${JSON.stringify(id)})`)
    await sleep(200)
    // The canvas clock only runs as fast as the machine draws; wait until it has really reached the frame we froze at.
    // (When the effect has already ended the canvas stops its ticker and the clock rests: the frame is then simply empty.)
    for (let i = 0; i < 100; i++) {
      const stats = await evaluate('window.__fx ? JSON.stringify(window.__fx()) : "{}"')
      const { clock = 0, ticking = true } = JSON.parse(stats)
      if (clock >= time || (!ticking && i > 5)) break
      await sleep(60)
    }
    await sleep(120)
    const { result } = await send('Page.captureScreenshot', { format: 'png' })
    const file = `${out}/${id}__${String(time).padStart(4, '0')}.png`
    writeFileSync(file, Buffer.from(result.data, 'base64'))
  }
  console.log('shots', id)
}
if (problems.length) console.log('PROBLEMS\n' + problems.join('\n'))
socket.close(); proc.kill()
process.exit(problems.length ? 1 : 0)
