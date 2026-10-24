# Dungeon Map Foundation v0.1

> **Историческая справка (аудит v1, 24.10.2026).** Документ написан до решения X04 и описывает тогдашние правила, числа и интерфейс; они могут не совпадать с игрой. Действующие правила — B2 Long: [default-b2-long-v1.md](design/default-b2-long-v1.md). Прежние модели остаются контролем Balance Lab и эталонов.

## Scope

The playable campaign is now a deterministic route through the existing encounter package. A run has six choice layers with three nodes each, followed by one guaranteed final encounter. The first layer offers three normal fights; later layers introduce rests and elites. This is a foundation for route choices, not a new event, shop, artifact, narrative, or encounter-content system.

The design research document is retained at [roguelike-adventure-design-research.md](roguelike-adventure-design-research.md). Its broader proposal includes an eight-layer structure and additional systems. This implementation follows the requested six-layer scope and leaves those optional systems out.

## Route and node rules

- Edges only move forward. Each node connects to adjacent columns in the next layer; every node ultimately reaches the final node.
- The fixed node schedule is: three normal fights; one rest and two fights; one elite and two fights; one rest and two fights; one elite and two fights; one rest and two fights; then the final.
- Since Encounter Diversity v0.9, normal and elite encounters use the Deadmines roster in `src/game/encountersV09.ts`, selected from layer pools; elites have their own behavior. The final node still retains the selected economy package's final encounter and health.
- A normal victory offers one card selected from three deterministic reward options. An elite victory offers one from five. The deck persists through the run.
- At a rest, choose one injured hero to heal by up to 6 HP, capped at that hero's maximum. If both heroes are full, continue without healing.
- Current HP carries forward between fights; temporary armor is cleared. A defeat ends the run, and defeating the final encounter completes it.
- The map displays the run seed and offers a new-run action. Run state and map generation are reproducible from the same seed.
- Unvisited nodes show only their category and route state; their deterministic encounter data stays in the run map and is resolved unchanged when entered. The map does not reveal enemy names, health, behavior, or exact reward counts. The battle screen reveals the selected enemy normally; the post-battle reward screen may name the opponent.
- Node-category icons use Lucide Vue (`Swords`, `Crown`, `Flame`, `Skull`). A future `?` event category is only a design direction until real event mechanics exist.

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
- The v0.9 normal/elite catalog is Deadmines-themed; the final boss is still the prototype economy encounter pending a separate boss-design iteration.
- New UI icons use the locally installed open-source Lucide Vue package. The dependency version declares ISC; its distributed license notice also includes the Feather-derived icon list and the associated MIT notice. The map's chosen icons are `Swords`, `Crown`, `Flame`, and `Skull`. The complete notice is retained at `LICENSES/LUCIDE.txt`; no external CDN is used.
- Run persistence across app restarts, route events, shops, artifacts, and additional reward types are outside v0.1.

## Validation

`src/game/campaign.test.ts` checks repeatability, seed variation, map invariants over 1,000 seeds, route choices, state carry-over, reward-seed independence, rest healing, defeat/victory, and run reset. The UI was inspected in the browser at 1280×720 and 1920×1080, and a first-layer route selection was followed into combat.

The headless route inspector provides deterministic route profiles for an explicit seed. Standard rule, scenario, smoke, and production-build checks are run as part of the branch validation.
