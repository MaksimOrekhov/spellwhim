// Verifies the offline audio catalogue, playback exclusivity, ratings persistence, and a native-size screenshot.
// Start Vite first: node scripts/audio-library-check.mjs --base http://127.0.0.1:5180 --record-metadata
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const base = option('--base', 'http://localhost:5173')
const out = resolve(option('--out', 'docs/screenshots/audio-library'))
const recordMetadata = args.includes('--record-metadata')
const audit = spawnSync(process.execPath, ['scripts/audio-candidate-catalog.mjs'], { encoding: 'utf8' })
if (audit.status !== 0) throw Error(audit.stderr || audit.stdout)
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw Error('Chrome not found')
mkdirSync(out, { recursive: true })
const port = 9660 + Math.floor(Math.random() * 60)
const sleep = ms => new Promise(done => setTimeout(done, ms))
const profile = join(tmpdir(), `spellwhim-audio-library-${Date.now()}`)
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--window-size=2560,1440', '--disable-gpu', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' })
let socket
const failures = [], results = []
try {
  let target
  for (let i = 0; i < 60 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(item => item.type === 'page') } catch {} }
  if (!target) throw Error('Chrome DevTools did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise(done => socket.addEventListener('open', done))
  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') failures.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '))
  })
  const send = (method, params = {}) => new Promise(resolve => { const id = nextId++; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })) })
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (response.result?.exceptionDetails) throw Error(JSON.stringify({ text: response.result.exceptionDetails.text, exception: response.result.exceptionDetails.exception?.description, line: response.result.exceptionDetails.lineNumber }))
    return response.result?.result?.value
  }
  const check = (name, value, detail) => { if (!value) throw Error(`${name}: ${JSON.stringify(detail)}`); results.push({ name, detail }); console.log('PASS', name, detail ?? '') }
  const waitFor = async expression => { for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error(`Timed out: ${expression}`) }
  const click = async selector => {
    const point = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return null; element.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = element.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 } })()`)
    if (!point) throw Error(`Missing element: ${selector}`)
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point })
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point })
  }
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${base}/audio-preview.html` })
  await waitFor('!!window.__audioLibrary && document.querySelectorAll(".music-card").length === 11')
  check('music/SFX inventory', await evaluate('({music: document.querySelectorAll(".music-card").length, sfx: window.__audioLibrary.assets.filter(x => x.kind === "sfx").length})'))
  const ids = await evaluate('window.__audioLibrary.assets.map(x => x.id)')
  check('all catalog IDs unique', ids.length === new Set(ids).size, ids.length)
  const sourceAudit = await evaluate('window.__audioLibrary.assets.every(x => x.sourcePage.startsWith("https://") && x.license.startsWith("CC0-1.0") && x.redistributablePublicGitHub)')
  check('every item has public CC0 source and redistribution record', sourceAudit)
  const measurements = args.includes('--skip-decode') ? {} : await evaluate('window.__audioLibrary.analyzeAll()')
  const measured = Object.values(measurements)
  if (!args.includes('--skip-decode')) check('all local audio files fetch and decode', measured.length === ids.length && measured.every(value => value.durationSeconds > 0 && Number.isFinite(value.rmsDbfs) && Number.isFinite(value.peakDbfs)), { decoded: measured.length, count: ids.length })
  if (recordMetadata) {
    const catalogPath = resolve('docs/audio/candidates.json')
    const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
    for (const asset of catalog.assets) Object.assign(asset, measurements[asset.id])
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
    results.push({ name: 'recorded decoded durations and levels', detail: `Updated ${measured.length} records` })
    // Vite notices the JSON catalogue update; wait for one clean page before continuing input checks.
    await send('Page.reload')
    await waitFor('!!window.__audioLibrary && document.querySelectorAll(".music-card").length === 11')
    await sleep(500)
  }
  await click('.music-card .play-button')
  await waitFor('window.__audioLibrary.player().id !== null')
  await sleep(1200)
  const first = await evaluate('window.__audioLibrary.player()')
  if (first.paused || first.currentTime < .1) throw Error(`Music did not start: ${JSON.stringify({ player: first, message: await evaluate('document.querySelector(".player-error")?.textContent') })}`)
  check('browser plays selected music', first.duration > 1 && first.volume > 0)
  await click('.music-card:nth-of-type(2) .play-button')
  await waitFor('window.__audioLibrary.player().id === window.__audioLibrary.assets.filter(x => x.kind === "music")[1].id && window.__audioLibrary.player().paused === false')
  check('starting another track replaces the previous player', (await evaluate('window.__audioLibrary.player()')).id)
  await click('[role="tab"][aria-selected="false"]')
  await waitFor('document.querySelectorAll(".sfx-card").length === 32')
  await click('.sfx-card .play-button')
  await waitFor('window.__audioLibrary.player().id.startsWith("sfx-") && window.__audioLibrary.player().paused === false')
  check('SFX plays through the same exclusive player', (await evaluate('window.__audioLibrary.player()')).id)
  await click('[role="tab"][aria-selected="false"]')
  await waitFor('document.querySelectorAll(".music-card").length === 11')
  await evaluate('(() => { const el = document.querySelector(".music-card .rating-control select"); el.value = "like"; el.dispatchEvent(new Event("change", { bubbles: true })) })()')
  check('rating persists in localStorage', await evaluate('Object.values(JSON.parse(localStorage.getItem("spellwhim.audio-library.ratings.v1") || "{}")).includes("like")'))
  await send('Page.reload')
  await waitFor('!!window.__audioLibrary && document.querySelectorAll(".music-card").length === 11')
  await sleep(500)
  check('rating restores after reload', await evaluate('window.__audioLibrary.ratings()[window.__audioLibrary.assets.find(x => x.kind === "music").id] === "like"'))
  check('reload stops previous sound', await evaluate('window.__audioLibrary.player().paused'))
  await evaluate('localStorage.removeItem("spellwhim.audio-library.ratings.v1")')
  await send('Page.reload')
  await waitFor('!!window.__audioLibrary && document.querySelectorAll(".music-card").length === 11')
  await sleep(300)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
  writeFileSync(join(out, 'library-2560.png'), Buffer.from(screenshot.result.data, 'base64'))
  check('2560×1440 library screenshot saved', join(out, 'library-2560.png'))
  await click('.player-dock .stop-button')
  await sleep(150)
  check('browser console clean', failures.length === 0, failures)
  const metadataStored = await evaluate('window.__audioLibrary.assets.every(asset => asset.durationSeconds > 0 && Number.isFinite(asset.rmsDbfs) && Number.isFinite(asset.peakDbfs))')
  writeFileSync(join(out, 'checks.json'), JSON.stringify({ viewport: '2560x1440', musicCount: 11, sfxCount: 32, decodedCount: measured.length || ids.length, metadataStored, results, failures }, null, 2) + '\n')
  console.log(`PASS audio library check (${results.length} assertions)`)
} catch (error) {
  console.error(error)
  if (failures.length) console.error('Browser errors:', failures)
  process.exitCode = 1
} finally {
  try { socket?.close() } catch {}
  proc.kill()
}
