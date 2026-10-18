// Captures the screenshots for docs/ux-ui-redesign-research.md: the prototype states and the current game, plus
// side-by-side comparisons. Not part of the build; puppeteer-core is NOT a project dependency. Run (dev server on :5173):
//   npm i --no-save puppeteer-core   (or point PUPPETEER_DIR at any folder that has node_modules/puppeteer-core)
//   node scripts/ux-redesign-shots.mjs            # everything
//   node scripts/ux-redesign-shots.mjs proto      # prototype states only
//   node scripts/ux-redesign-shots.mjs current    # current game only (plays a real battle through the UI)
//   node scripts/ux-redesign-shots.mjs compare    # side-by-side composites (needs both sets)
// Env: BASE_URL (default http://127.0.0.1:5173), CHROME_PATH, OUT_DIR (default docs/screenshots/ux-redesign).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const require = createRequire(process.env.PUPPETEER_DIR ? path.resolve(process.env.PUPPETEER_DIR) + '/' : import.meta.url)
const puppeteer = require('puppeteer-core')
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const out = path.resolve(process.env.OUT_DIR ?? 'docs/screenshots/ux-redesign')
const chrome = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p))
const mode = process.argv[2] ?? 'all'
const sleep = ms => new Promise(r => setTimeout(r, ms))
fs.mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox'] })
const jpg = { type: 'jpeg', quality: 84 }

async function open(w, h, url, scale = 1) {
  const page = await browser.newPage()
  page.on('pageerror', e => console.log('pageerror', e.message))
  await page.setViewport({ width: w, height: h, deviceScaleFactor: scale })
  await page.goto(url, { waitUntil: 'networkidle0' })
  await sleep(1500)
  return page
}
async function shot(page, name, clip) { await page.screenshot({ path: `${out}/${name}.jpg`, ...jpg, ...(clip ? { clip } : {}) }); console.log('shot', name) }

async function proto() {
  const q = query => `${base}/ux-prototype.html?ui=0&${query}`
  const states = [
    ['proto-1920-normal', 'normal', 1920, 1080, 's=normal'],
    ['proto-1920-synergy', 'synergy', 1920, 1080, 's=synergy'],
    ['proto-1920-synergy-hover', 'synergy hover', 1920, 1080, 's=synergy&hover=0'],
    ['proto-1920-ten', 'ten', 1920, 1080, 's=ten'],
    ['proto-1920-ten-hover', 'ten hover', 1920, 1080, 's=ten&hover=4'],
    ['proto-1920-swarm', 'swarm', 1920, 1080, 's=swarm'],
    ['proto-1920-reward', 'reward', 1920, 1080, 'screen=reward'],
    ['proto-1920-reward-elite', 'reward elite', 1920, 1080, 'screen=reward&elite=1'],
    ['proto-1920-map', 'map', 1920, 1080, 'screen=map'],
    ['proto-1920-rest', 'rest', 1920, 1080, 'screen=rest'],
    ['proto-1920-victory', 'victory', 1920, 1080, 's=synergy&screen=victory'],
    ['proto-1920-defeat', 'defeat', 1920, 1080, 's=swarm&screen=defeat'],
    ['proto-1280-normal', 'normal 720', 1280, 720, 's=normal'],
    ['proto-1280-synergy', 'synergy 720', 1280, 720, 's=synergy&hover=0'],
    ['proto-1280-ten', 'ten 720', 1280, 720, 's=ten&hover=3'],
    ['proto-1280-reward', 'reward 720', 1280, 720, 'screen=reward'],
    ['proto-1280-reward-elite', 'reward elite 720', 1280, 720, 'screen=reward&elite=1'],
    ['proto-1280-map', 'map 720', 1280, 720, 'screen=map'],
    ['proto-1280-rest', 'rest 720', 1280, 720, 'screen=rest'],
  ]
  for (const [name, , w, h, query] of states) { const page = await open(w, h, q(query)); await shot(page, name); await page.close() }
  // card close-ups at 2× (the hand without hover, and one zoomed card with its scroll)
  let page = await open(1920, 1080, q('s=synergy'), 2)
  await shot(page, 'proto-cards-hand-2x', { x: 190, y: 780, width: 1500, height: 300 })
  await page.close()
  page = await open(1920, 1080, q('s=synergy&hover=0'), 2)
  await shot(page, 'proto-card-zoom-2x', { x: 190, y: 620, width: 620, height: 460 })
  await page.close()
  // motion frames
  page = await open(1920, 1080, q('s=synergy'))
  await page.keyboard.press('1'); await sleep(260); await shot(page, 'proto-1920-play-flight')
  await sleep(380); await shot(page, 'proto-1920-play-impact')
  await sleep(1000)
  // quick play: press 1 and 2 back to back — the second play is queued, labels stay stable while the hand re-flows
  await page.keyboard.press('1'); await sleep(120); await page.keyboard.press('2'); await sleep(150); await shot(page, 'proto-1920-quick-queue'); await sleep(1700)
  await page.keyboard.press('Enter'); await sleep(620); await shot(page, 'proto-1920-enemy-turn')
  await page.close()
}

async function current() {
  for (const [w, h, tag] of [[1920, 1080, '1920'], [1280, 720, '1280']]) {
    const page = await open(w, h, `${base}/`)
    await shot(page, `current-${tag}-map`)
    await page.click('.map-node.is-available'); await sleep(1300)
    await shot(page, `current-${tag}-battle`)
    const cards = await page.$$('.spell-card')
    if (cards[2]) { await cards[2].hover(); await sleep(500); await shot(page, `current-${tag}-battle-hover`) }
    await page.mouse.move(5, 5)
    await page.evaluate(() => [...document.querySelectorAll('.spell-card')].find(c => c.getAttribute('aria-disabled') !== 'true' && /Накладывает Уязвимость/.test(c.textContent))?.click())
    await sleep(1800); await shot(page, `current-${tag}-battle-vulnerable`)
    for (let turn = 0; turn < 14 && !(await page.$('.result-card')); turn++) {
      for (let i = 0; i < 10 && !(await page.$('.result-card')); i++) {
        const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('.spell-card')].find(c => c.getAttribute('aria-disabled') !== 'true'); b?.click(); return !!b })
        if (!ok) break
        await sleep(1500)
      }
      if (await page.$('.result-card')) break
      await page.evaluate(() => document.querySelector('.end-turn')?.click()); await sleep(2400)
    }
    await sleep(700); await shot(page, `current-${tag}-result`)
    await page.click('.result-card .game-button'); await sleep(900)
    await shot(page, `current-${tag}-reward`)
    await page.click('.reward-card'); await sleep(900)
    await shot(page, `current-${tag}-map-progress`)
    const rest = await page.$('.map-node--rest.is-available')
    if (rest) { await rest.click(); await sleep(900); await shot(page, `current-${tag}-rest`) }
    await page.close()
  }
}

async function compare() {
  const data = name => 'data:image/jpeg;base64,' + fs.readFileSync(`${out}/${name}.jpg`).toString('base64')
  async function pair(file, left, right, title, w = 1920) {
    const half = w / 2
    const html = `<body style="margin:0;background:#14100c;font:700 20px 'Segoe UI',sans-serif;color:#f0dfb4"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><figure style="margin:0"><figcaption style="padding:8px 14px;background:#3b2a1c">Сейчас</figcaption><img src="${data(left)}" style="width:100%;display:block"></figure><figure style="margin:0"><figcaption style="padding:8px 14px;background:#24507c">${title}</figcaption><img src="${data(right)}" style="width:100%;display:block"></figure></div></body>`
    const page = await browser.newPage()
    await page.setViewport({ width: w, height: Math.round(half * 9 / 16) + 42, deviceScaleFactor: 1 })
    await page.setContent(html)
    await sleep(300)
    await shot(page, file)
    await page.close()
  }
  await pair('compare-battle-1920', 'current-1920-battle', 'proto-1920-normal', 'Прототип «Сцена приключения»')
  await pair('compare-vulnerable-1920', 'current-1920-battle-vulnerable', 'proto-1920-synergy', 'Прототип: синергия и Уязвимость')
  await pair('compare-battle-1280', 'current-1280-battle', 'proto-1280-synergy', 'Прототип: 1280×720', 1920)
  await pair('compare-reward-1920', 'current-1920-reward', 'proto-1920-reward', 'Прототип: награда')
  await pair('compare-map-1920', 'current-1920-map', 'proto-1920-map', 'Прототип: чертёж шахты (схема)')
}

if (mode === 'all' || mode === 'proto') await proto()
if (mode === 'all' || mode === 'current') await current()
if (mode === 'all' || mode === 'compare') await compare()
await browser.close()
