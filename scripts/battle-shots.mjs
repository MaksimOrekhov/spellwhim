// Screenshots of the battle scene lab (card-preview.html) through headless Edge/Chrome — no extra dependencies.
// npm run dev, then: node scripts/battle-shots.mjs <prefix> [--base http://localhost:5173] [--scenes normal,both] [--sizes 1280x720,1920x1080]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const prefix = args[0] && !args[0].startsWith('--') ? args[0] : 'shot'
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] }
const base = option('--base', 'http://localhost:5173')
const scenes = option('--scenes', 'normal,both,lethal,prepared,absorbed,phase2,artifacts').split(',')
const sizes = option('--sizes', '1280x720,1920x1080').split(',')
const hand = option('--hand', '10')
const out = resolve(option('--out', 'docs/screenshots/combat-overhaul-v02'))
const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
]
const browser = browsers.find(path => existsSync(path))
if (!browser) throw new Error('No Edge or Chrome found')
mkdirSync(out, { recursive: true })
for (const scene of scenes) {
  for (const size of sizes) {
    const file = `${out}/${prefix}-${scene}-${size.split('x')[0]}.png`
    const extra = option('--query', '')
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${size.replace('x', ',')}`, '--virtual-time-budget=6000', `--screenshot=${file}`, `${base}/card-preview.html?scene=${scene}&hand=${hand}${extra ? '&' + extra : ''}`], { stdio: 'ignore' })
    console.log('wrote', file)
  }
}
