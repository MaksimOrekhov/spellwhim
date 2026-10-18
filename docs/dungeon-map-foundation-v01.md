# Dungeon Map Foundation v0.1

## Scope

The playable campaign is now a deterministic route through the existing encounter package. A run has six choice layers with three nodes each, followed by one guaranteed final encounter. The first layer offers three normal fights; later layers introduce rests and elites. This is a foundation for route choices, not a new event, shop, artifact, narrative, or encounter-content system.

The design research document is retained at [roguelike-adventure-design-research.md](roguelike-adventure-design-research.md). Its broader proposal includes an eight-layer structure and additional systems. This implementation follows the requested six-layer scope and leaves those optional systems out.

## Route and node rules

- Edges only move forward. Each node connects to adjacent columns in the next layer; every node ultimately reaches the final node.
- The fixed node schedule is: three normal fights; one rest and two fights; one elite and two fights; one rest and two fights; one elite and two fights; one rest and two fights; then the final.
- Normal and elite encounters reuse the current campaign enemy package. Their maximum health is scaled in generated node data; the final node retains the package's final encounter and health.
- A normal victory offers one card selected from three deterministic reward options. An elite victory offers one from five. The deck persists through the run.
- At a rest, choose one injured hero to heal by up to 6 HP, capped at that hero's maximum. If both heroes are full, continue without healing.
- Current HP carries forward between fights; temporary armor is cleared. A defeat ends the run, and defeating the final encounter completes it.
- The map displays the run seed and offers a new-run action. Run state and map generation are reproducible from the same seed.

## Determinism and route inspection

`createDungeonRun(seed)` derives independent seeds for initial hero state, map generation, each node's battle, and each node's reward. This keeps route generation and reward ordering repeatable without consuming battle RNG. `dungeonEncounter` produces an encounter copy for a selected node and does not alter shared encounter definitions.

The route inspector enumerates legal paths and compares a low-risk profile (no elite, preferring rests then lower enemy HP) with an elite-heavy profile. This is a structural route comparison, not a combat-win-rate simulation or recommendation that one route is always optimal.

Run the inspector with:

```bash
npm run dungeon:routes -- 42
```

The displayed seed can be copied into the core API or CLI to reproduce a route. There is not yet a seed-entry control in the UI.

## Implementation boundaries

- Pure route generation and run transitions live in `src/game/campaign.ts`.
- The screen and route choices live in `src/components/CampaignMap.vue`; rest healing is presented by `src/components/RestSite.vue`.
- Battles still use the shared battle engine and selected economy. The experimental economy flags and Balance Lab's legacy linear campaign helpers remain available.
- The map uses the currently configured encounter package, which is still the prototype package rather than new Deadmines-specific encounters.
- Run persistence across app restarts, route events, shops, artifacts, and additional reward types are outside v0.1.

## Validation

`src/game/campaign.test.ts` checks repeatability, seed variation, map invariants over 1,000 seeds, route choices, state carry-over, reward-seed independence, rest healing, defeat/victory, and run reset. The UI was inspected in the browser at 1280×720 and 1920×1080, and a first-layer route selection was followed into combat.

The headless route inspector provides deterministic route profiles for an explicit seed. Standard rule, scenario, smoke, and production-build checks are run as part of the branch validation.
