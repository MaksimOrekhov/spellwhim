# GDD v2.0 research

Research-only scripts supporting [the GDD](../../docs/design/spellwhim-gdd-v2.md) and [method audit](../../docs/research/gdd-v2-method-audit.md). No game imports this directory; game source, historical reports and fixtures are unchanged.

Base game revision: `a64b434a08a09ded10dfacbe7fa01e088954e83d`.

Inputs are immutable Git objects, not merged working trees:

- Claude: `4900ff34337052c9a94c3c2ac423b27637d5397d`, full report and `docs/data/dungeon-campaign-research-v01/`.
- Codex: `b16c65192a20eb7055f5eb62d8c8a4d386fb9e7d`, full report, method and `docs/data/deadmines-independent-2026-10-19/` (main and holdout).

Run from repository root with existing dependencies:

```powershell
node research/gdd-v2/audit.mjs
node research/gdd-v2/shuffle-bias.mjs
node research/gdd-v2/controlled-start.mjs
```

`audit.mjs` inventories and parses the original files, then executes the original Claude power/rec11 bodies with output redirected into new `docs/data/gdd-v2/claude-recheck/{sort,fisher-yates}/` folders. Only the Fisher–Yates versions change the random shuffle expression. Original files are not edited, even temporarily. Source scripts are imported as in-memory modules; their relative output URL is redirected to the chosen new directory. The original common loader is used with `SPELLWHIM_ROOT` set to the working repository. Current Node version is recorded. Reproducing only the rec11 subset is intentional; the entire 168-row long-run matrix is not rerun.

`shuffle-bias.mjs` measures marginal inclusion from a fixed20-element ordered pool:50,000 independent seeded trials per algorithm. This diagnostic does not simulate cards or combat and does not prove a win-rate correction.

`controlled-start.mjs` crosses two14-card templates, three sizes and two opening hands, with literal current18 controls. The N16/N18 additions are identical in both templates; size effects still mean this specific dilution intervention. Each of two independent128-seed ranges also has16 planner samples per cell/enemy. All fights call canonical rules; no upgraded/gold definitions are inserted. Actual route runs retain the old seven-node campaign, public route choices, fixed artifact-first reward policy and no skip (not implemented yet). Original control weights are untouched.

Outputs include aggregate isolated-battle metrics, all raw current-run samples as CSV, source hashes, old/FY replay files and the distribution diagnostic. Isolated metrics count the winning turn's available/spent mana; historical `manaLeftPerTurn` does not. Results represent scripted policies, not human performance or final GDD balance.

Retained counts:68,544 new factorial isolated battles;9,216 current campaign runs containing52,403 further battles;9,000 isolated power-curve replay battles;12,800 linear stand-in rec11 model runs;100,000 total shuffle-distribution trials. No counts from repeated technical launches are added again. Proposed upgrades, gold, healing A/B/C, bosses and18-row topology are documented for future experiments rather than implemented here.

Re-running overwrites only these new research output files. A different game revision/runtime is a new experiment unless compatibility is verified; `metadata.revision` records the execution checkout. For source consistency review, compare the tracked game tree against the stated baseline, not just the branch name.
