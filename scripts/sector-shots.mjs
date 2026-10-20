// Screenshots of Sector I screens through headless Edge/Chrome driven over the DevTools protocol (no extra dependencies).
// npm run dev; node scripts/sector-visual-fixtures.mjs 7; node scripts/sector-shots.mjs <out-dir> [--only map,forge] [--sizes 1280x720,1920x1080]
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const out = resolve(args[0] && !args[0].startsWith('--') ? args[0] : 'docs/screenshots/sector-one-visual-polish-v1')
const base = option('--base', 'http://localhost:5173')
const sizes = option('--sizes', '1280x720,1920x1080').split(',')
const only = option('--only', '')?.split(',').filter(Boolean)
const port = 9333
const browser = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
if (!browser) throw new Error('No Edge or Chrome found')
mkdirSync(out, { recursive: true })

const click = text => `(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && !b.disabled); if (!el) throw new Error('no button ${text}'); el.click(); return true })()`
// name, fixture, steps (JS run after resume, each followed by a short wait), optional scroll-free full-page capture
const scenes = [
  { name: 'map', fixture: 'map-midway' },
  { name: 'map-start', fixture: 'map-fresh' },
  { name: 'forge', fixture: 'forge' },
  { name: 'forge-upgrade', fixture: 'forge', steps: [click('Улучшить карту')] },
  { name: 'forge-remove', fixture: 'forge', steps: [click('Удалить карту'), `document.querySelector('.deck-options .choice')?.click()`] },
  { name: 'treasure', fixture: 'treasure' },
  { name: 'treasure-artifact', fixture: 'treasure', steps: [click('Взять артефакт')] },
  { name: 'event-powder-store', fixture: 'event-powder-store' },
  { name: 'event-forgotten-forge', fixture: 'event-forgotten-forge' },
  { name: 'event-goblin-trade', fixture: 'event-goblin-trade' },
  { name: 'johnson', fixture: 'elite' },
  { name: 'rhahk-zor', fixture: 'final' },
  { name: 'complete', fixture: 'complete' },
]

const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${tmpdir()}/spellwhim-shots`, '--no-first-run', 'about:blank'], { stdio: 'ignore' })
const sleep = ms => new Promise(done => setTimeout(done, ms))
try {
  let targets
  for (let i = 0; i < 40 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json() } catch { await sleep(250) } }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise(done => ws.addEventListener('open', done))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); pending.get(message.id)?.(message); pending.delete(message.id) })
  const send = (method, params = {}) => new Promise((done, fail) => { const n = ++id; pending.set(n, m => m.error ? fail(new Error(method + ': ' + m.error.message)) : done(m.result)); ws.send(JSON.stringify({ id: n, method, params })) })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'evaluate failed')
    return result.result.value
  }
  await send('Page.enable')
  for (const size of sizes) {
    const [width, height] = size.split('x').map(Number)
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    for (const scene of scenes) {
      if (only?.length && !only.includes(scene.name)) continue
      try {
        // the game autosaves on unload, so seed the save from a same-origin page that does not run the game
        await send('Page.navigate', { url: base + '/tokens-preview.html' })
        await sleep(1200)
        const found = await evaluate(`fetch('/tmp-fixtures/${scene.fixture}.json').then(r => r.ok ? r.text() : null).then(t => { if (!t) return false; localStorage.removeItem('spellwhim.run.v1.backup'); localStorage.setItem('spellwhim.run.v1', t); return true })`)
        if (!found) { console.log('skip (no fixture)', scene.name); continue }
        await send('Page.navigate', { url: base + '/' })
        await sleep(1500)
        await evaluate("(() => { const b = [...document.querySelectorAll('button')].find(x => /Продолжить поход|Посмотреть итог/.test(x.textContent)); b.click() })()")
        await sleep(1200)
        for (const step of scene.steps ?? []) { await evaluate(step); await sleep(700) }
        await sleep(600)
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        const file = `${out}/${scene.name}-${width}.png`
        writeFileSync(file, Buffer.from(shot.data, 'base64'))
        console.log('wrote', file)
      } catch (error) { console.log('FAILED', scene.name, size, String(error.message).slice(0, 160)) }
    }
  }
  ws.close()
} finally {
  chrome.kill()
  await sleep(500)
  try { rmSync(`${tmpdir()}/spellwhim-shots`, { recursive: true, force: true }) } catch {}
}
