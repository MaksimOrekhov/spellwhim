// Smoke test of the real game (App.vue, default B2 Long) in headless Chrome over the DevTools protocol, with full-resolution screenshots.
// npm run dev, then: node scripts/app-smoke.mjs [out-dir] [--base http://localhost:5173] [--sizes 1920x1080,1280x720,900x600] [--audio]
// New run → first battle (several cards played with the mouse and the keyboard, turns ended until the battle is won) → reward → deck viewer.
// Fails on any console error, uncaught exception or failed request.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'docs/screenshots/card-polish-v3/game')
const base = option('--base', 'http://localhost:5173')
const sizes = option('--sizes', '1920x1080,1280x720,900x600').split(',')
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!chrome) throw new Error('Chrome not found')
mkdirSync(out, { recursive: true })
const sleep = ms => new Promise(done => setTimeout(done, ms))

const port = 9730 + Math.floor(Math.random() * 100)
const profile = join(tmpdir(), 'spellwhim-app-smoke-' + Date.now())
const proc = spawn(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--headless=new', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' })
let socket
try {
let target
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200)
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(item => item.type === 'page') } catch { /* not up yet */ }
}
if (!target) throw new Error('Chrome DevTools did not start')
socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(done => socket.addEventListener('open', done))
let nextId = 1
const waiting = new Map()
const problems = []
socket.addEventListener('message', event => {
  const message = JSON.parse(event.data)
  if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); return }
  if (message.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text))
  if (message.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(message.params.type)) problems.push('console.' + message.params.type + ': ' + message.params.args.map(arg => arg.value ?? arg.description).join(' '))
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error' && !/favicon.ico/.test(message.params.entry.url ?? '')) problems.push('log: ' + message.params.entry.text + ' ' + (message.params.entry.url ?? ''))
})
const send = (method, params = {}) => new Promise(done => { const id = nextId++; waiting.set(id, done); socket.send(JSON.stringify({ id, method, params })) })
const evaluate = async expression => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.result?.value
const waitFor = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await sleep(100) } throw Error('Timed out: ' + expression) }
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')

async function shot(name, size) {
  const { result } = await send('Page.captureScreenshot', { format: 'png' })
  const file = `${out}/${name}-${size.split('x')[0]}.png`
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  console.log('wrote', file)
}
const clickText = text => evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && !b.disabled); if (!el) return false; el.click(); return true })()`)
const key = value => evaluate(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(value)}, bubbles: true })), true`)
const unlockAudio = async () => {
  const p = await evaluate(`(() => { const r = document.querySelector('.audio-toggle').getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 } })()`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...p })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...p })
  await sleep(300)
  await clickText('Закрыть')
}
const state = () => evaluate(`JSON.stringify({ hand: document.querySelectorAll('.hand-card').length, playable: document.querySelectorAll('.hand-card:not([aria-disabled="true"])').length, reward: !!document.querySelector('.reward-screen'), map: !!document.querySelector('.map-screen, [aria-label*="штрек" i]') && !document.querySelector('.battle-dock'), dialog: [...document.querySelectorAll('dialog[open] button')].map(b => b.textContent.trim()), title: document.querySelector('h1,h2')?.textContent ?? '' })`).then(JSON.parse)

for (const size of sizes) {
  const observedMusic = new Set()
  const [w, h] = size.split('x').map(Number)
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: base + '/' })
  await evaluate('localStorage.clear()'); await send('Page.navigate', { url: base + '/' })
  await sleep(2500)
  if (args.includes('--audio')) {
    if (await evaluate('window.__audio?.stats().musicPlayers !== 0')) problems.push('music started before trusted input at ' + size)
    // A trusted pointer input supplies browser user activation (modifier keys do not).
    await unlockAudio()
    const unlockedAudio = await evaluate('window.__audio?.stats()')
    console.log('audio after trusted input', unlockedAudio, await evaluate('({ title: document.title, body: document.body.innerText.slice(0,240), audioButton: !!document.querySelector(".audio-toggle"), errors: window.__audio ? null : "audio debug hook missing" })'))
    if (!unlockedAudio?.unlocked) problems.push('audio did not unlock at ' + size)
    await waitFor('window.__audio?.stats().musicRequested === "music-town-theme" && window.__audio?.stats().musicPlaying')
    const menuMusic = await evaluate('window.__audio.stats()')
    if (menuMusic.musicPlayers !== 1) problems.push('menu should have exactly one music player: ' + JSON.stringify(menuMusic))
    observedMusic.add(menuMusic.musicRequested)
    const initialPosition = menuMusic.musicTime
    await evaluate('document.querySelector(".audio-toggle").click()')
    await evaluate(`(() => { const slider = document.querySelector('input[aria-label="Громкость музыки"]'); slider.value = '0.35'; slider.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
    await sleep(450)
    const adjusted = await evaluate('window.__audio.stats()')
    const savedSettings = await evaluate('JSON.parse(localStorage.getItem("spellwhim.audio.v1"))')
    if (adjusted.musicPlayers !== 1 || adjusted.musicRequested !== 'music-town-theme' || adjusted.musicTime <= initialPosition || savedSettings.music !== .35) problems.push('music slider must persist and adjust the same live stream: ' + JSON.stringify({ adjusted, savedSettings }))
    await clickText('Выключить звук')
    const muted = await evaluate('window.__audio.stats()')
    await sleep(300)
    const mutedLater = await evaluate('window.__audio.stats()')
    if (muted.musicGain !== 0 || muted.musicPlayers !== 1 || mutedLater.musicTime <= muted.musicTime) problems.push('mute should silence but retain the current stream position: ' + JSON.stringify({ muted, mutedLater }))
    await clickText('Включить звук')
    const unmuted = await evaluate('window.__audio.stats()')
    if (unmuted.musicPlayers !== 1 || unmuted.musicRequested !== 'music-town-theme' || unmuted.musicGain <= 0) problems.push('unmute should restore the same music stream: ' + JSON.stringify(unmuted))
    await evaluate('document.querySelector(".audio-close").click()')
  }
  console.log('loaded', size, await evaluate('document.title'), await evaluate('document.body.innerText.slice(0,80)'))
  if (!await clickText('Новый поход')) throw new Error('No "Новый поход" button')
  await sleep(600)
  if (args.includes('--audio')) {
    await waitFor('window.__audio?.stats().musicRequested === "music-cave-theme" && window.__audio?.stats().musicPlaying')
    const mapMusic = await evaluate('window.__audio.stats()')
    if (mapMusic.musicPlayers !== 1) problems.push('map should have exactly one music player: ' + JSON.stringify(mapMusic))
    observedMusic.add(mapMusic.musicRequested)
  }
  await shot('menu-or-map', size)
  // The first available room of the map.
  await evaluate(`[...document.querySelectorAll('button')].find(b => /Доступно/.test(b.getAttribute('aria-label') ?? ''))?.click()`)
  await sleep(1200)
  if (!await evaluate(`!!document.querySelector('.battle-dock')`)) { await evaluate(`[...document.querySelectorAll('button')].find(b => /Доступно/.test(b.getAttribute('aria-label') ?? ''))?.click()`); await sleep(1500) }
  if (!await evaluate(`!!document.querySelector('.battle-dock')`)) throw new Error('Battle did not start at ' + size)
  await sleep(800)
  if (args.includes('--audio')) {
    await waitFor('window.__audio?.stats().musicRequested === "music-battle-theme" && window.__audio?.stats().musicPlaying')
    const battleMusic = await evaluate('window.__audio.stats()')
    if (battleMusic.musicPlayers !== 1) problems.push('battle should have exactly one music player: ' + JSON.stringify(battleMusic))
    observedMusic.add(battleMusic.musicRequested)
  }
  await shot('battle-hand7', size)
  // Edge cards: hover opens the zoomed card and the notes.
  for (const [label, index] of [['first', 0], ['last', -1]]) {
    await evaluate(`(() => { const slots = [...document.querySelectorAll('.slot')]; const s = slots.at(${index}); s.dispatchEvent(new MouseEvent('mouseenter')); return true })()`)
    await sleep(500)
    const inside = await evaluate(`(() => { const r = [...document.querySelectorAll('.slot.is-active .cf'), document.querySelector('.card-notes-pop')].filter(Boolean).map(e => e.getBoundingClientRect()); return r.every(b => b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight) })()`)
    if (!inside) problems.push(`hover on the ${label} card leaves the screen at ${size}`)
    await shot('battle-hover-' + label, size)
    await evaluate(`document.querySelectorAll('.slot').forEach(s => s.dispatchEvent(new MouseEvent('mouseleave')))`)
  }
  const dockBottom = await evaluate(`Math.max(...[...document.querySelectorAll('.hand-card .cf, .hand-card .cf-seal')].map(e => e.getBoundingClientRect().bottom)) <= innerHeight`)
  if (!dockBottom) problems.push('hand is cut off at the bottom at ' + size)
  // Play: the first card with the keyboard, then with the mouse, answer the armor dialog when it appears, end the turn, repeat until the battle ends.
  let played = 0, turns = 0, shotAfter = false
  for (let step = 0; step < 400; step++) {
    const s = await state()
    if (args.includes('--audio')) {
      const music = await evaluate('window.__audio.stats()')
      if (music.musicRequested) observedMusic.add(music.musicRequested)
      if (music.musicPlayers > 1) problems.push('multiple concurrent music players: ' + JSON.stringify(music))
    }
    if (step < 60 || step % 20 === 0) console.log('step', step, played, turns, JSON.stringify(s))
    if (s.reward) break
    if (s.dialog.length) {
      const pick = s.dialog.find(text => /Воин|Вариан|Джайн|Маг/.test(text)) ?? s.dialog[0]
      await clickText(pick); await sleep(600); continue
    }
    if (!await evaluate(`!!document.querySelector('.battle-dock')`)) {
      // result modal / map: continue through whatever the battle ended with
      if (!(await clickText('Выбрать карту') || await clickText('Награда') || await clickText('Далее') || await clickText('Продолжить'))) await sleep(500)
      await sleep(500); continue
    }
    if (s.playable > 0 && s.hand > 0) {
      if (played === 0) await key('1'); else await evaluate(`document.querySelector('.hand-card:not([aria-disabled="true"])')?.click()`)
      played++; await sleep(900)
      if (played === 3 && !shotAfter) { await shot('battle-after-plays', size); shotAfter = true }
    } else {
      await key('Enter'); turns++; await sleep(4500)
    }
    const dialogText = await evaluate(`document.querySelector('dialog[open]')?.textContent?.slice(0, 80) ?? ''`)
    if (dialogText && !s.dialog.length) await sleep(300)
    if (await evaluate(`!!document.querySelector('.battle-result, [aria-label*="Результат"]')`)) { await clickText('награ') || await clickText('Продолжить') || await clickText('Выбрать'); await sleep(800) }
  }
  const final = await state()
  console.log(size, 'cards played', played, 'turns', turns, JSON.stringify(final))
  if (!final.reward) problems.push('no reward screen reached at ' + size)
  else {
    if (args.includes('--audio')) {
      const a = await evaluate('window.__audio.stats()')
      if (a.profile !== null || a.ambientSources !== 0 || a.ambientTimers !== 0 || a.contexts !== 1 || a.played === 0) problems.push('audio did not clean up on reward: ' + JSON.stringify(a))
      if (a.musicRequested !== 'music-victory-fanfare-short' || a.musicTrack !== 'music-victory-fanfare-short') problems.push('victory fanfare should play as the single active track after the win: ' + JSON.stringify(a))
      if (a.proceduralSoundIds.includes('victory')) problems.push('procedural victory cue played alongside the recorded fanfare: ' + JSON.stringify(a))
      observedMusic.add(a.musicRequested)
      if (a.musicPlayers > 1) problems.push('multiple concurrent music players at reward: ' + JSON.stringify(a))
      console.log('reward audio cleanup', a)
    }
    await shot('reward', size)
    await evaluate(`document.querySelector('.reward-option')?.click()`)
    await sleep(1200)
    if (await clickText('Посмотреть колоду')) { await sleep(600); await shot('deck-viewer', size); await clickText('Закрыть') }
    else problems.push('deck button not found after the reward at ' + size)
    if (args.includes('--audio')) {
      if (!await clickText('Главное меню')) problems.push('no menu button after reward')
      await waitFor('window.__audio?.stats().musicRequested === "music-town-theme"')
      await sleep(300)
      const quiet = await evaluate('window.__audio.stats()')
      if (quiet.profile !== null || quiet.ambientTimers || quiet.ambientSources) problems.push('ambient alive in menu: ' + JSON.stringify(quiet))
      if (!await clickText('Вернуться в поход')) problems.push('cannot return from menu')
      await sleep(300)
      // Routes can put services between fights. Follow public categories and leave service rooms without changing the deck.
      let nextFight = false
      for (let room = 0; room < 10 && !nextFight; room++) {
        const entered = await evaluate(`(() => { const available = [...document.querySelectorAll('button')].filter(b => /Доступно/.test(b.getAttribute('aria-label') ?? '')); const b = available.find(b => /бой|Босс/.test(b.getAttribute('aria-label') ?? '')) ?? available[0]; if (!b) return false; b.click(); return true })()`)
        if (!entered) break
        await waitFor('!!document.querySelector("[data-battle-scene],.room-screen,.rest-screen")')
        nextFight = await evaluate('!!document.querySelector("[data-battle-scene]")')
        if (nextFight) break
        const quietRoom = await evaluate('window.__audio.stats()')
        if (quietRoom.profile !== null || quietRoom.ambientTimers || quietRoom.ambientSources) problems.push('ambient alive in service room: ' + JSON.stringify(quietRoom))
        if (await evaluate('!!document.querySelector(".room-screen")')) {
          await evaluate('document.querySelector(".choice--leave")?.click()')
          await sleep(100)
          await clickText('Подтвердить')
        } else await evaluate('document.querySelector(".rest-hero:not(:disabled),.skip-rest")?.click()')
        await waitFor('!!document.querySelector(".campaign-screen")')
      }
      if (nextFight) {
        await sleep(1500)
        const a = await evaluate('window.__audio.stats()')
        if (!a.profile || a.ambientTimers !== 1 || a.ambientSources > 1 || a.contexts !== 1) problems.push('new battle audio profile invalid: ' + JSON.stringify(a))
        if (a.musicRequested !== 'music-battle-theme' || a.musicPlayers !== 1) problems.push('battle track did not resume as a single player: ' + JSON.stringify(a))
        console.log('menu return → new battle', a)
        // Reload a saved battle: resume from the menu and keep one fresh ambience.
        await evaluate('delete window.__audio')
        await send('Page.reload')
        await waitFor('!!window.__audio && !!document.querySelector(".main-menu")')
        await clickText('Продолжить поход')
        await waitFor('!!document.querySelector("[data-battle-scene]")')
        const reloadedSettings = await evaluate('window.__audio.settings()')
        if (reloadedSettings.music !== .35 || reloadedSettings.effects !== .65 || reloadedSettings.ambience !== .3) problems.push('saved audio settings did not survive a page reload: ' + JSON.stringify(reloadedSettings))
        await unlockAudio()
        await waitFor('window.__audio?.stats().unlocked && window.__audio?.stats().ambientTimers === 1')
        const restored = await evaluate('window.__audio.stats()')
        if (!restored.profile || restored.contexts !== 1 || restored.ambientTimers !== 1 || restored.ambientSources > 1) problems.push('restored battle audio invalid: ' + JSON.stringify(restored))
        if (restored.musicRequested !== 'music-battle-theme' || restored.musicPlayers !== 1) problems.push('saved battle did not restore its battle music: ' + JSON.stringify(restored))
        console.log('restored battle audio', restored)
      } else problems.push('no publicly available fight after reward at ' + size)
    }
  }
  if (args.includes('--audio')) console.log(size, 'observed music transitions:', [...observedMusic].join(' → '))
}
if (problems.length) throw Error('PROBLEMS:\n' + [...new Set(problems)].join('\n'))
console.log('smoke test passed: no console errors')
} finally { socket?.close(); proc.kill() }
