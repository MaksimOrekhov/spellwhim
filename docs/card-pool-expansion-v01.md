# Card Pool Expansion v0.1 — review results

## Scope and art direction

The eight new abilities are reward-only; the 18-card starting deck is unchanged. Ability illustrations follow **class/mechanic-driven action on an adventure-neutral background**. Enemy portraits, events, bosses, and scene art remain tied to their encounter locations. The eight generated ability images are review drafts and are intentionally not mapped in `src/ui/cardArt.ts`; the card UI shows its art-pending fallback until individual art approval.

The two initial neutral ability samples were shown individually at full size before the remaining six were generated. All eight are now available in [the ability review sheet](../art-exploration/card-pool-art-v01/ability-art-review.jpg), and each source image is separately available in `art-exploration/card-pool-art-v01/`.

For encounter portraits, the Goblin Powder Runner and Defias Lookout are the accepted **style references**. The nine draft portraits are keyed by stable encounter ID in this review branch to inspect real circular medallions. The Cutpurse, Deckhand, and Veteran were revised after review to separate their silhouettes, props, and facial identities; prior draft files are retained with `-previous` suffixes. Exact portraits beyond the two style references remain review drafts.

## Eight-card pool

| Card | Class / cost | Effect |
|---|---|---|
| Удар из стойки (`stance-strike`) | Warrior / 1 | 3 damage, 2 armor to partner; +2 damage while Warrior has armor |
| Зажать рану (`wound-clamp`) | Warrior / 1 | Trigger Bleeding immediately (health damage, then −1 strength); gain 3 armor |
| Перехват удара (`covering-counter`) | Warrior / 2 | Gain 7 armor; deal 3 damage if enemy is currently attacking |
| Сокрушительный замах (`crushing-swing`) | Warrior / 3 | Deal 9 damage and apply Vulnerability |
| Арканная метка (`arcane-mark`) | Mage / 1 | Apply Vulnerability and draw 1 |
| Ледяное эхо (`ice-echo`) | Mage / 1 | Deal 2 damage and draw 1 |
| Синяя печать (`frost-seal`) | Mage / 1 | Trigger Bleeding immediately and apply Vulnerability |
| Кровавый резонанс (`blood-resonance`) | Mage / 2 | Deal 3 damage, then deal +1 per Bleeding strength and remove Bleeding; draw 1 |

## Paired campaign comparison

`comparison.json` contains paired campaign runs on the same V10 map seeds. The comparison uses economy B, seeds 42–141, 3 route policies × 4 strategies × 100 seeds per pool. The only pool difference is whether the eight expansion IDs can appear in reward offers. There are 1,200 runs in each pool; all 1,200 map signatures matched.

| Pool | Wins / runs | Win rate | Average turns per campaign |
|---|---:|---:|---:|
| Existing reward pool | 680 / 1,200 | 56.67% | 20.56 |
| Expanded reward pool | 676 / 1,200 | 56.33% | 20.46 |

The aggregate change is −0.34 percentage points, with four fewer wins and 0.10 fewer turns per campaign. Results vary by route and bot: for example, the risky balanced bot shifts −7 points while the risky defensive bot shifts +8 points. This is simulation evidence for the existing scripted agents, not a human win-rate estimate or a statistically conclusive balance verdict.

### Offer, selection, and play frequency

Counts below aggregate the four existing reward-picking and combat strategies over the 1,200 expanded-pool campaigns. “Offer events” counts reward events where that card appeared; “selected” counts scripted reward picks; plays can exceed selections when a card enters a deck more than once or is played in multiple battles. The picker uses deterministic strategy ranks, not observed player choices.

| Card | Offer events | Selected | Selection / offer | Plays | Plays / selection |
|---|---:|---:|---:|---:|---:|
| Удар из стойки | 835 | 124 | 14.9% | 256 | 2.06 |
| Зажать рану | 765 | 50 | 6.5% | 104 | 2.08 |
| Перехват удара | 851 | 127 | 14.9% | 368 | 2.90 |
| Сокрушительный замах | 769 | 341 | 44.3% | 621 | 1.82 |
| Арканная метка | 870 | 98 | 11.3% | 148 | 1.51 |
| Ледяное эхо | 740 | 323 | 43.6% | 540 | 1.67 |
| Синяя печать | 779 | 0 | 0% | 0 | 0 |
| Кровавый резонанс | 830 | 150 | 18.1% | 244 | 1.63 |

The zero picks for Синяя печать are a useful reward-rank signal, not evidence that the effect fails: it is played in the purpose-built Bleeding deck below. It merits human reward-choice review and/or a separate picker-rank adjustment before interpreting its demand.

## Purpose-built synergy decks

`synergy-lab.json` contains six fixed 18-card archetypes × all nine V10 encounters × 100 seeds × four bot strategies: 3,600 battles per archetype. Decks replace cards deliberately to exercise Vulnerability plus draw, Vulnerability plus the Weakpoint Lens artifact, Bleeding tick/burst, Warrior armor and counterattack, and that armor package with Double Pulley. The control is the untouched starting deck.

| Archetype | Wins / 3,600 | Win rate | Average turns per battle |
|---|---:|---:|---:|
| Starting-deck control | 3,588 | 99.67% | 4.61 |
| Vulnerability + draw | 3,598 | 99.94% | 4.14 |
| Vulnerability + Weakpoint Lens | 3,577 | 99.36% | 4.08 |
| Bleeding tick/burst | 3,510 | 97.50% | 5.23 |
| Armor + counterattack | 3,382 | 93.94% | 6.17 |
| Armor + counterattack + Double Pulley | 3,399 | 94.42% | 6.17 |

All four strategies trigger the intended card effects in the themed decks. The Bleeding deck's lower aggregate win rate and the armor decks' longer fights do not indicate an overpowering combination; the vulnerability packages stay close to the high-win-rate control. These are bot decks with fixed substitutions and seed sets, so they are a balance screen rather than final human playtesting.

## Browser visual verification

Captured from the built app in headless Chromium using the real Vite review entry and `file://` loading (the local HTTP loopback route was unavailable in this environment). All tested pages completed without JavaScript errors and reported no document overflow at either requested viewport.

| View | 1280×720 | 1920×1080 |
|---|---|---|
| Eight-card hand | [screenshot](data/card-pool-art-v01/ui-hand-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-hand-1920x1080.png) |
| Compact ten-card hand | [screenshot](data/card-pool-art-v01/ui-compact-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-compact-1920x1080.png) |
| Reward cards | [screenshot](data/card-pool-art-v01/ui-reward-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-reward-1920x1080.png) |
| Card hover detail | [screenshot](data/card-pool-art-v01/ui-hover-1280x720.png) | — |
| Defias Lookout encounter portrait | [screenshot](data/card-pool-art-v01/enemy-lookout-1280x720.png) | [screenshot](data/card-pool-art-v01/enemy-lookout-1920x1080.png) |
| Cutpurse portrait | [screenshot](data/card-pool-art-v01/enemy-cutpurse-1280x720.png) | — |
| Deckhand portrait | — | [screenshot](data/card-pool-art-v01/enemy-deckhand-1920x1080.png) |
| Elite in phase II | [screenshot](data/card-pool-art-v01/enemy-elite-1280x720.png) | — |
| Boss in phase II | — | [screenshot](data/card-pool-art-v01/enemy-boss-1920x1080.png) |
| Common reward choices | [screenshot](data/card-pool-art-v01/ui-reward-common-1280x720.png) | — |

The hand, compact hand, reward, and enemy portrait states were checked across the two viewport sizes. Five-card elite rewards with the longer Bleeding notes need a short vertical scroll at 720px; the reward screen scrolls internally and exposes the complete notes, verified in [the top view](data/card-pool-art-v01/ui-reward-1280x720.png) and [the bottom view](data/card-pool-art-v01/ui-reward-1280x720-bottom.png). The new ability drafts are not rendered on card faces by design; their full-size files and contact sheet are the art review surface.

## Reproduction

```powershell
npm run card-pool:compare -- 100 42
npm run card-pool:synergy -- 100 42
npm test
npm run build
```

Raw metrics: [`comparison.json`](data/card-pool-art-v01/comparison.json) and [`synergy-lab.json`](data/card-pool-art-v01/synergy-lab.json).
