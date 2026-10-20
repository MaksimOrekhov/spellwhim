import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { withGame } from '../../deadmines-sector-one-v1-review/scripts/harness.mjs'
import { definitions, splits } from './config.mjs'
import { simulation, modules } from './simulation.mjs'
const root = new URL('../', import.meta.url)
const protectedPaths = ['src/game/battle.ts', 'src/game/types.ts', 'src/game/cardUpgrades.ts', 'src/game/economy.ts', 'src/game/deck.ts', 'src/game/damage.ts', 'src/game/statuses.ts', 'src/game/artifacts.ts', 'src/game/balance.ts', 'src/game/balancePlanner.ts', 'src/game/campaign.ts', 'src/game/dungeonGenerator.ts', 'src/game/dungeonRooms.ts', 'src/game/roomRules.ts', 'src/game/runSave.ts', 'src/game/encountersV09.ts', 'src/game/encountersV10.ts', 'src/game/fixtures/status-foundation-baseline.json']
if (execFileSync('git', ['diff', '1afabb357dc8b541bfe7bb04b1d4ae6d2b5c0c0f', '--', ...protectedPaths], { encoding: 'utf8' })) throw Error('Protected gameplay/control file changed')
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const hashes = Object.fromEntries(await Promise.all(protectedPaths.map(async p => [p, sha(await readFile(p))])))
await withGame(modules, async m => {
  if (JSON.stringify(m.sectorContent.sectorEncounters) !== JSON.stringify(definitions('V2'))) throw Error('Game does not match selected V2')
  const sim = simulation(m)
  let checked = 0
  for (const split of ['main', 'holdout']) {
    const name = split === 'main' ? 'main-classic-V0-V1-V2-300' : 'holdout-classic-V0-V1-V2-V3-300'
    const lines = gunzipSync(await readFile(new URL('results/' + name + '.jsonl.gz', root))).toString().trim().split('\n')
    for (const line of lines) {
      const row = JSON.parse(line)
      if (row.seed >= splits[split].start + 3) continue
      sim.apply(row.variant)
      if (row.kind === 'battle') {
        const e = m.sectorContent.sectorEncounters.find(e => e.id === row.encounter)
        const actual = sim.fight(sim.battle(e, row.seed), row.strategy)
        for (const key of ['result', 'endW', 'endM', 'turns', 'plays', 'manaSpent', 'armorAbsorbed', 'phase2Actions']) if (actual[key] !== row[key]) throw Error('Battle replay mismatch: ' + key)
      } else {
        const actual = sim.route(row.seed, { policy: row.policy, strategy: row.strategy })
        for (const key of ['result', 'endW', 'endM', 'turns', 'preBossW', 'preBossM']) if (actual[key] !== row[key]) throw Error('Route replay mismatch: ' + key)
      }
      checked++
    }
  }
  sim.apply('V2')
  const passState = m.campaign.createCampaignBattle({ encounter: m.sectorContent.rhahkZor, deck: ['parry'], seed: 42 })
  const parryPreview = m.battle.previewCard(passState, m.types.cardDefinition('parry'))
  const aggressivePassFixture = { damage: parryPreview.damage, armor: parryPreview.armor, mana: passState.mana, aggressivePasses: !m.balance.chooseCard(passState, 'aggressive', 'public'), balancedPlays: !!m.balance.chooseCard(passState, 'balanced', 'public') }
  if (!aggressivePassFixture.aggressivePasses || !aggressivePassFixture.balancedPlays || parryPreview.damage !== 3) throw Error('Aggressive diagnostic fixture changed')
  const versions = { rules: m.runSave.RULES_VERSION, legacyCatalog: m.runSave.CATALOG_VERSION, sectorCatalog: m.runSave.SECTOR_CATALOG_VERSION, roomRules: m.runSave.ROOM_RULES_VERSION, generator: m.dungeonGenerator.CARVED_GENERATOR_VERSION }
  await writeFile(new URL('results/verification.json', root), JSON.stringify({ selectedDefinitionsMatch: true, replayedRows: checked, protectedSourceHashes: hashes, runtime: process.version, aggressivePassFixture, versions }, null, 2) + '\n')
  console.log('Audit passed', checked, versions)
})
