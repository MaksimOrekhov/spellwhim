// Records the real battle effects (the VFX lab, card-preview.html?view=vfx) to a WebM through headless Chrome: no ffmpeg, no extra dependencies.
// npm run dev, then: node scripts/vfx-record.mjs <out-file.webm> --fx sword-strike,fireball,... [--base http://localhost:5173] [--size 1280x720] [--motion reduced] [--gap 350]
// The page is driven through the lab's own `window.__vfxLab.play(id)`; frames come from Page.startScreencast with their own timestamps and are replayed
// in real time into a canvas that MediaRecorder encodes, so the file has the true pace of the effects. Fails on any console error.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const outFile = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'vfx.webm')
const base = option('--base', 'http://localhost:5173')
const ids = option('--fx', 'sword-strike').split(',')
const [width, height] = option('--size', '1280x720').split('x').map(Number)
const motion = option('--motion', 'full')
const gap = Number(option('--gap', 350))
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw new Error('Chrome not found')
mkdirSync(dirname(outFile), { recursive: true })
const sleep = ms => new Promise(done => setTimeout(done, ms))

const port = 9400 + Math.floor(Math.random() * 90)
const profile = join(tmpdir(), 'spellwhim-vfx-record-' + Date.now())
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' })
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
const frames = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); return }
  if (message.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text))
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) problems.push('console.' + message.params.type + ': ' + message.params.args.map(arg => arg.value ?? arg.description).join(' '))
  if (message.method === 'Page.screencastFrame') {
    frames.push({ ts: message.params.metadata.timestamp, data: message.params.data })
    send('Page.screencastFrameAck', { sessionId: message.params.sessionId })
  }
})
const send = (method, params = {}) => new Promise(done => { const id = nextId++; waiting.set(id, done); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async (expression, awaitPromise = true) => (await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })).result.result?.value
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/card-preview.html?view=vfx&panel=0` })
for (let i = 0; i < 60 && !(await evaluate('!!window.__vfxLab')); i++) await sleep(250)
await sleep(1200)
await evaluate(`window.__vfxLab.setMotion(${JSON.stringify(motion)})`)

await send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: width, maxHeight: height, everyNthFrame: 1 })
await sleep(300)
for (const id of ids) {
  await evaluate(`window.__vfxLab.play(${JSON.stringify(id)})`)
  for (let i = 0; i < 40 && !(await evaluate('window.__vfxLab.busy()')); i++) await sleep(25)
  for (let i = 0; i < 200 && (await evaluate('window.__vfxLab.busy()')); i++) await sleep(40)
  await sleep(gap)
  console.log('recorded', id)
}
await sleep(300)
await send('Page.stopScreencast')
if (frames.length < 2) throw new Error('No frames were captured')
console.log('frames', frames.length, 'duration', (frames.at(-1).ts - frames[0].ts).toFixed(1) + 's')

// Encode in a second page, served by this process so the frames stay out of the protocol messages.
const html = `<!doctype html><meta charset=utf-8><canvas id=c width=${width} height=${height}></canvas><script>
window.encode = async () => {
  const meta = await (await fetch('/frames.json')).json()
  const canvas = document.getElementById('c'); const ctx = canvas.getContext('2d')
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 4000000 })
  const chunks = []; recorder.ondataavailable = e => e.data.size && chunks.push(e.data)
  const bitmaps = []
  for (let i = 0; i < meta.length; i++) bitmaps.push(await createImageBitmap(await (await fetch('/frame/' + i)).blob()))
  const done = new Promise(r => recorder.onstop = r)
  ctx.drawImage(bitmaps[0], 0, 0); recorder.start(250)
  const start = performance.now()
  for (let i = 0; i < bitmaps.length; i++) {
    const wait = (meta[i] - meta[0]) * 1000 - (performance.now() - start)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    ctx.drawImage(bitmaps[i], 0, 0)
  }
  await new Promise(r => setTimeout(r, 400)); recorder.stop(); await done
  const blob = new Blob(chunks, { type: 'video/webm' })
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''; for (let i = 0; i < buffer.length; i += 0x8000) binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000))
  return btoa(binary)
}
</script>`
const server = createServer((request, response) => {
  if (request.url === '/') { response.setHeader('content-type', 'text/html'); response.end(html); return }
  if (request.url === '/frames.json') { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(frames.map(frame => frame.ts))); return }
  const match = request.url?.match(/^\/frame\/(\d+)$/)
  if (match) { response.setHeader('content-type', 'image/jpeg'); response.end(Buffer.from(frames[Number(match[1])].data, 'base64')); return }
  response.statusCode = 404; response.end()
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
await send('Emulation.clearDeviceMetricsOverride')
await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
await sleep(800)
const encoded = await evaluate('window.encode()')
writeFileSync(outFile, Buffer.from(encoded, 'base64'))
console.log('wrote', outFile, (encoded.length * 0.75 / 1048576).toFixed(2) + ' MB')
if (problems.length) console.log('PROBLEMS\n' + problems.join('\n'))
server.close(); socket.close(); proc.kill()
process.exit(problems.length ? 1 : 0)
