// Reproducible card screenshots through headless Edge/Chrome (no extra dependencies) from the dev lab card-preview.html.
// npm run dev, then: node scripts/card-shots.mjs <out-dir> <prefix> [--base http://localhost:5173] [--sizes 1920x1080,1280x720,900x600] [--only hand7,reward] [--em 14]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const args = process.argv.slice(2)
const out = resolve(args[0] ?? 'docs/screenshots/card-polish-v3')
const prefix = args[1] && !args[1].startsWith('--') ? args[1] : 'shot'
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const base = option('--base', 'http://localhost:5173')
const sizes = option('--sizes', '1920x1080,1280x720,900x600').split(',')
const only = option('--only', '')?.split(',').filter(Boolean)

/** name → lab query. `hover=N` opens the zoomed card of slot N; `mana=N` sets mana (cards that cost more are locked). */
const shots = {
  hand7: 'view=hand&hand=7',
  'hand7-hover-mid': 'view=hand&hand=7&hover=4',
  'hand7-hover-first': 'view=hand&hand=7&hover=1',
  'hand7-hover-last': 'view=hand&hand=7&hover=7',
  'hand7-synergy': 'view=hand&hand=7&bonus=1&hover=2',
  'hand7-lowmana': 'view=hand&hand=7&mana=1',
  hand10: 'view=hand&hand=10',
  'hand10-hover-mid': 'view=hand&hand=10&hover=5',
  'hand10-hover-last': 'view=hand&hand=10&hover=10',
  reward: 'view=reward',
  'reward-elite': 'view=reward&elite=1',
  states: 'view=states&em=12',
  sheet: 'view=sheet&em=12&tiles=1',
  deck: 'view=deck',
  'ops-upgrade': 'view=ops&mode=upgrade&sel=3',
  'ops-replace': 'view=ops&mode=replace&sel=3',
  'ops-remove': 'view=ops&mode=remove&sel=4',
}

// --shot name=query adds or replaces one shot (e.g. --shot zoom=view=states&em=24 --only zoom).
args.forEach((arg, i) => { if (arg === '--shot') { const [name, ...rest] = args[i + 1].split('='); shots[name] = rest.join('=') } })

const browsers = [
  // Chrome first: headless Edge intermittently exits without writing the screenshot of pages with a WebGL canvas.
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const browser = browsers.find(path => existsSync(path))
if (!browser) throw new Error('No Chrome or Edge found')
mkdirSync(out, { recursive: true })
for (const [name, query] of Object.entries(shots)) {
  if (only.length && !only.includes(name)) continue
  for (const size of sizes) {
    const file = `${out}/${prefix}-${name}-${size.split('x')[0]}.png`
    // The sheet is taller than the screen: give it room instead of cropping.
    rmSync(file, { force: true }) // Edge may silently keep a stale file
    const [w, h] = size.split('x').map(Number)
    const height = name === 'sheet' || name === 'states' ? Math.round(h * 2.3) : h
    // Headless Edge now and then exits without writing the file; retry instead of reporting a shot that does not exist.
    for (let attempt = 0; attempt < 4 && !existsSync(file); attempt++) {
      try { execFileSync(browser, [`--user-data-dir=${join(tmpdir(), 'spellwhim-card-shots')}`, '--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${height}`, '--virtual-time-budget=8000', `--screenshot=${file}`, `${base}/card-preview.html?${query}&still=1`], { stdio: 'ignore' }) } catch { /* retried below */ }
    }
    if (!existsSync(file)) throw new Error('No screenshot written: ' + file)
    console.log('wrote', file)
  }
}
