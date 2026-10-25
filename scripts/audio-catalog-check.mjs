import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = process.cwd()
const catalog = JSON.parse(readFileSync(resolve(root, 'docs/audio/candidates.json'), 'utf8'))
const musicIds = ['music-town-theme', 'music-cave-theme', 'music-battle-theme', 'music-bossfight', 'music-victory-fanfare-short']
const sfxIds = [
  'sfx-rpg-draw-knife', 'sfx-rpg-knife-slice-a', 'sfx-rpg-knife-slice-b', 'sfx-rpg-metal-click', 'sfx-rpg-metal-latch',
  'sfx-rpg-door-open', 'sfx-rpg-book-flip', 'sfx-rpg-coin-handling', 'sfx-fantasy-sword-clash-a', 'sfx-fantasy-sword-clash-b',
  'sfx-fantasy-hammer-hit-a', 'sfx-fantasy-hammer-hit-b', 'sfx-fantasy-book-page', 'sfx-fantasy-coins', 'sfx-fantasy-floor-creak',
  'sfx-fantasy-lock-turn', 'sfx-fantasy-whoosh-a', 'sfx-fantasy-whoosh-b',
]
const expected = new Set([...musicIds, ...sfxIds])
if (catalog.assets.length !== expected.size || new Set(catalog.assets.map(item => item.id)).size !== expected.size) throw new Error('Catalog must contain exactly 23 unique approved IDs')
for (const id of expected) if (!catalog.assets.some(item => item.id === id)) throw new Error(`Approved asset missing from catalog: ${id}`)
for (const asset of catalog.assets) {
  if (!expected.has(asset.id)) throw new Error(`Unapproved catalog asset: ${asset.id}`)
  if (asset.license !== 'CC0-1.0' && !asset.license.startsWith('CC0-1.0 ')) throw new Error(`${asset.id}: unsupported license`)
  if (!asset.redistributablePublicGitHub || !asset.sourcePage.startsWith('https://') || !asset.licenseUrl) throw new Error(`${asset.id}: source or redistribution evidence missing`)
  const fullPath = resolve(root, asset.localPath)
  if (!fullPath.startsWith(resolve(root, 'src/audio/assets') + '\\')) throw new Error(`${asset.id}: unexpected path ${asset.localPath}`)
  const bytes = readFileSync(fullPath)
  if (bytes.length !== asset.fileSizeBytes) throw new Error(`${asset.id}: byte count mismatch`)
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256Original) throw new Error(`${asset.id}: SHA-256 mismatch`)
  if (!['mp3', 'ogg', 'wav'].includes(asset.format)) throw new Error(`${asset.id}: unsupported format`)
  if (!(asset.durationSeconds > 0)) throw new Error(`${asset.id}: duration was not recorded`)
}
const actualFiles = ['music', 'sfx'].flatMap(folder => readdirSync(join(root, 'src/audio/assets', folder), { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => `src/audio/assets/${folder}/${entry.name}`)).sort()
const catalogFiles = catalog.assets.map(asset => asset.localPath).sort()
if (JSON.stringify(actualFiles) !== JSON.stringify(catalogFiles)) throw new Error(`Audio files and catalog differ. actual=${actualFiles.length}, catalog=${catalogFiles.length}`)
const excludedNames = ['ui-', 'metal-pot', 'rpg-wood-creak', 'fantasy-knife-unsheathe', 'fantasy-paralyzer-discharge', 'rpg-book-open']
if (actualFiles.some(path => excludedNames.some(name => path.includes(name)))) throw new Error('An excluded candidate was found in the integrated asset folders')
const totalBytes = catalog.assets.reduce((sum, item) => sum + item.fileSizeBytes, 0)
if (catalog.sources.some(source => source.id === 'kenney-interface-sounds')) throw new Error('Rejected Kenney Interface source must not be cataloged')
for (const path of ['docs/audio/licenses/LICENSE-Kenney-RPG.txt', 'docs/audio/licenses/README-Tinysized.txt']) statSync(resolve(root, path))
console.log(`PASS ${musicIds.length} music + ${sfxIds.length} SFX; files, hashes, durations, source/license records; ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)`)
