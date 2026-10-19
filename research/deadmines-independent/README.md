# Independent Deadmines research

Research-only scripts and data for [the Russian design report](../../docs/research/deadmines-progression-independent-2026-10-19.md). No module here is imported by the game. No game definitions, historical fixtures, bot weights, UI, or assets are modified.

Base revision: `a64b434a08a09ded10dfacbe7fa01e088954e83d`.

From the repository root, using its existing dependencies:

```powershell
node research/deadmines-independent/run.mjs --runs 300 --planner-runs 40 --maps 1000
node research/deadmines-independent/run.mjs --runs 300 --planner-runs 0 --maps 1000 --seed-base 73100 --output docs/data/deadmines-independent-2026-10-19/holdout
```

The first run uses seeds 42100–42399 (planner 42100–42139); the holdout uses 73100–73399 without planner. Each range also supplies 1,000 seeds for map generation, including seeds beyond the combat sample. Re-running overwrites only the chosen research output directory's named data files. Results on a different game revision are a new experiment, not a reproduction of this baseline.

The script performs four separate experiments:

1. **Canonical engine fights.** Seven explicitly recorded deck/hand configurations, nine current roster v1.0 opponents, economy B, full health and no artifacts. Classic strategies retain their public-information defaults and unchanged weights. Planner uses its existing limits and information discipline. Limits: 32 player turns and 24 plays per turn. Composition and deck size are changed together; these are candidate starts, not a pure causal estimate of size.
2. **Actual seven-node dungeon runs.** Four starts, two classic strategies, three public route policies. Healing targets the lowest health ratio. Artifacts are chosen before cards until two slots are filled, then the documented fixed card ranking applies. No hypothetical skip, upgrade, extra room, rare card, or healing rule is inserted. `run-samples.csv` preserves one raw row per run; `runs.json` contains aggregates. Mean numbers of fights/elites include runs that ended early.
3. **Topology-only proposed maps.** Three sectors of seven visited rooms. Existing maps are enumerated through the game; proposed maps use an isolated generator and validation. No proposed combat/reward balance is simulated. Random-neighbor routes are not human decisions and are not uniform over all complete paths. Map statistics distinguish geometric paths from type sequences.
4. **Exact probability and sensitivity models.** Hypergeometric opening hands, independent reward visibility, a binomial illustrative deck-growth model, paired current-run outcomes, and synthetic attrition. Attrition assigns an entire fight's sampled HP loss to one hero and contains no battle rules. Its survival percentages must never be presented as game win rates. Both main and holdout contain 8 ×100,000 synthetic samples, excluded from engine-fight totals.

The retained experiments contain 115,920 isolated fights and 14,400 current dungeon runs (81,710 additional engine fights). Technical reruns during script preparation are not counted again. Per-encounter isolated traces are not saved; seeds, deck lists, version, strategy and aggregate results are saved. Planner's smaller sample is explicit. Wilson intervals in run aggregates concern fixed policies over seeds, not human performance. `reshuffles` is a diagnostic proxy based on a growing draw pile and may miss a shuffle consumed in one draw.

Output files, under `docs/data/deadmines-independent-2026-10-19/` and `holdout/`:

- `metadata.json`: revision, runtime, sample counts.
- `battles.json`: configurations, deck lists, methods, all encounter/strategy aggregates.
- `runs.json`: route aggregates and conditional Wilson intervals.
- `run-samples.csv`: raw run outcomes, progression and per-hero health.
- `maps.json`: structural statistics and the first three example maps.
- `math.json`: opening/dilution/reward formulas and illustrative reward alternatives.
- `sensitivity.json`: paired outcomes, illustrative deck growth, synthetic health model.

Only the Markdown report recommends a design. The numerical models do not implement or establish the balance of that design.
