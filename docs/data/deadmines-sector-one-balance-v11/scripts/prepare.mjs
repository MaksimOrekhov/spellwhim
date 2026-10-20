import { mkdir, writeFile } from 'node:fs/promises'
import { withGame } from '../../deadmines-sector-one-v1-review/scripts/harness.mjs'
const root = new URL('../', import.meta.url)
await mkdir(new URL('config/', root), { recursive: true })
await mkdir(new URL('fixtures/', root), { recursive: true })
await withGame(['sectorContent', 'runSave', 'campaign', 'economy'], async m => {
  if (m.runSave.SECTOR_CATALOG_VERSION !== 'b29a110') throw Error('Freeze fixtures only on untouched 1afabb3; never replace historical V0 fixtures from v1.1.')
  await writeFile(new URL('config/v0.json', root), JSON.stringify(m.sectorContent.sectorEncounters, null, 2) + '\n')
  const legacy = m.campaign.createDungeonRun(42, undefined, undefined, undefined, 'balance-legacy-fixture')
  await writeFile(new URL('fixtures/legacy-v10.json', root), m.runSave.encodeSnapshot(legacy, m.economy.gameEconomy, 1))
  const run = m.campaign.createSectorRun(42, undefined, undefined, undefined, 'balance-v0-fixture')
  const entry = m.campaign.enterDungeonNode(run, m.campaign.availableDungeonNodes(run)[0].id)
  await writeFile(new URL('fixtures/sector-v0-battle.json', root), m.runSave.encodeSnapshot(entry, m.economy.gameEconomy, 1))
  await writeFile(new URL('config/versions-v0.json', root), JSON.stringify({ baseCommit: '1afabb357dc8b541bfe7bb04b1d4ae6d2b5c0c0f', claudeCommit: '0431cf9', rulesVersion: m.runSave.RULES_VERSION, legacyCatalog: m.runSave.CATALOG_VERSION, sectorCatalog: m.runSave.SECTOR_CATALOG_VERSION, roomRules: m.runSave.ROOM_RULES_VERSION }, null, 2) + '\n')
})
