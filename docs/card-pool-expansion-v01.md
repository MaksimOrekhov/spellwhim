# Card Pool Expansion v0.1 — review results

## Scope and art direction

The eight new abilities are reward-only; the 18-card starting deck is unchanged. Ability illustrations follow **class/mechanic-driven action on an adventure-neutral background**. Enemy portraits, events, bosses, and scene art remain tied to their encounter locations. The eight generated ability images are review drafts and are intentionally not mapped in `src/ui/cardArt.ts`; the card UI shows its art-pending fallback until individual art approval.

The two initial neutral ability samples were shown individually at full size before the remaining six were generated. All eight are now available in [the ability review sheet](../art-exploration/card-pool-art-v01/ability-art-review.jpg), and each source image is separately available in `art-exploration/card-pool-art-v01/`.

For encounter portraits, the Goblin Powder Runner and Defias Lookout are the accepted **style references only**. All nine current Codex portraits are review drafts keyed by stable encounter ID for UI testing; none is approved as a final production image. The final selection will be made separately after comparing candidates from Codex and Crimson Oath. The Cutpurse, Deckhand, and Veteran were revised after review to separate their silhouettes, props, and facial identities; prior draft files are retained with `-previous` suffixes.

## Eight-card pool

| Card | Class / cost | Effect |
|---|---|---|
| Удар из стойки (`stance-strike`) | Warrior / 1 | 3 damage, 2 armor to partner; +2 damage while Warrior has armor |
| Зажать рану (`wound-clamp`) | Warrior / 1 | Trigger Bleeding immediately (health damage, then −1 strength); gain 3 armor |
| Перехват удара (`covering-counter`) | Warrior / 2 | Gain 7 armor; deal 3 damage if enemy is currently attacking |
| Сокрушительный замах (`crushing-swing`) | Warrior / 3 | Deal 9 damage and apply Vulnerability |
| Арканная метка (`arcane-mark`) | Mage / 1 | Apply Vulnerability and draw 1 |
| Ледяное эхо (`ice-echo`) | Mage / 1 | Deal 2 damage, apply Bleeding 1, and draw 1 |
| Синяя печать (`frost-seal`) | Mage / 1 | Trigger Bleeding immediately and apply Vulnerability |
| Кровавый резонанс (`blood-resonance`) | Mage / 2 | Deal 3 damage, then deal +1 per Bleeding strength and remove Bleeding; draw 1 |

## Paired campaign comparison

`comparison.json` contains paired campaign runs on the same V10 map seeds. The comparison uses economy B, seeds 42–141, 3 route policies × 4 strategies × 100 seeds per pool. The only pool difference is whether the eight expansion IDs can appear in reward offers. There are 1,200 runs in each pool; all 1,200 map signatures matched.

| Pool | Wins / runs | Win rate | Average turns per campaign |
|---|---:|---:|---:|
| Existing reward pool | 680 / 1,200 | 56.67% | 20.56 |
| Expanded reward pool | 678 / 1,200 | 56.50% | 20.43 |

The aggregate change is −0.17 percentage points, with two fewer wins and 0.13 fewer turns per campaign. Results vary by route and bot: the 100-seed risky balanced run shifts −7 points while the risky defensive run shifts +8 points. This is simulation evidence for the existing scripted agents, not a human win-rate estimate or a statistically conclusive balance verdict.

### Offer, selection, and play frequency

Counts below aggregate the four existing reward-picking and combat strategies over the 1,200 expanded-pool campaigns. “Offer events” counts reward events where that card appeared; “selected” counts scripted reward picks; plays can exceed selections when a card enters a deck more than once or is played in multiple battles. The picker uses deterministic strategy ranks, not observed player choices.

| Card | Offer events | Selected | Selection / offer | Plays | Plays / selection |
|---|---:|---:|---:|---:|---:|
| Удар из стойки | 835 | 124 | 14.9% | 255 | 2.06 |
| Зажать рану | 766 | 50 | 6.5% | 106 | 2.12 |
| Перехват удара | 849 | 127 | 15.0% | 367 | 2.89 |
| Сокрушительный замах | 771 | 343 | 44.5% | 620 | 1.81 |
| Арканная метка | 868 | 98 | 11.3% | 146 | 1.49 |
| Ледяное эхо | 742 | 326 | 43.9% | 592 | 1.82 |
| Синяя печать | 779 | 0 | 0% | 0 | 0 |
| Кровавый резонанс | 829 | 150 | 18.1% | 243 | 1.62 |

The zero picks for Синяя печать are a limitation of the deterministic reward-choice model, not evidence that the card is weak: its fixed rank is 4 for every strategy, so cards assigned higher ranks win the scripted comparison whenever offered alongside it. This ranking does not evaluate the card's status-specific utility, and no balance change is made from the zero-pick result.

### Mana-curve review: Сокрушительный замах

The standard economy is 3→4→5 mana. On a 3-mana turn, Crushing Swing deals 9 now and leaves Vulnerability for the next damage card, for up to 12 across the setup and one follow-up; the status persists if the follow-up comes on a later turn. The same 3 mana can produce 14 immediate damage from Fireball (8, Mage / 2) plus Sword Strike (6, Warrior / 1), or 14 damage plus 3 armor from Shield Bash (5, Vulnerability, 3 armor / 2) followed by Sword Strike (6 plus the Vulnerability bonus / 1). Both alternatives use two cards; the Shield Bash line also spends Vulnerability during that turn, while Swing can carry its setup forward.

At 4 mana, Crushing Swing plus Sword Strike deals 18 across two cards. At 5, Crushing Swing plus Fireball deals 20 across two cards. The card gives up some peak damage and defensive utility to put 9 damage and a delayed +3 setup on one card, which can preserve a follow-up for a later turn. In the paired reward run it was selected 343 times and played 620 times; that scripted rank is not a player preference measure. The efficiency check and its 3→4→5 line are covered by a profile test. I leave its cost and effect unchanged for now: the result does not show a broken setup line, and buffing its raw damage would erase the intended card-compression tradeoff without human play evidence.

## Purpose-built synergy decks

`synergy-lab.json` contains six fixed 18-card archetypes × all nine V10 encounters × 100 seeds × four bot strategies: 3,600 battles per archetype. Decks replace cards deliberately to exercise Vulnerability plus draw, Vulnerability plus the Weakpoint Lens artifact, Bleeding tick/burst, Warrior armor and counterattack, and that armor package with Double Pulley. The control is the untouched starting deck.

| Archetype | Wins / 3,600 | Win rate | Average turns per battle |
|---|---:|---:|---:|
| Starting-deck control | 3,588 | 99.67% | 4.61 |
| Vulnerability + draw | 3,597 | 99.92% | 3.89 |
| Vulnerability + Weakpoint Lens | 3,585 | 99.58% | 3.82 |
| Bleeding tick/burst + Ice Echo | 3,544 | 98.44% | 4.66 |
| Armor + counterattack | 3,382 | 93.94% | 6.17 |
| Armor + counterattack + Double Pulley | 3,399 | 94.42% | 6.17 |

All four strategies trigger the intended card effects in the themed decks. In the Bleeding deck, Ice Echo was played 6,829 times across 3,600 battles; every play drew one card and applied Bleeding 1. Its 98.44% win rate stays below the 99.67% starting-deck control, so this purpose-built list does not show an excessive Bleeding combination. The armor decks' longer fights and the other archetype results are a balance screen, not final human playtesting.

## Browser visual verification

Captured from the built app in headless Chromium using the real Vite review entry and `file://` loading (the local HTTP loopback route was unavailable in this environment). All tested pages completed without JavaScript errors and reported no document overflow at either requested viewport.

| View | 1280×720 | 1920×1080 |
|---|---|---|
| Eight-card hand | [screenshot](data/card-pool-art-v01/ui-hand-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-hand-1920x1080.png) |
| Compact ten-card hand | [screenshot](data/card-pool-art-v01/ui-compact-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-compact-1920x1080.png) |
| Reward cards | [screenshot](data/card-pool-art-v01/ui-reward-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-reward-1920x1080.png) |
| Elite reward cards (5; longest Bleeding notes) | [screenshot](data/card-pool-art-v01/ui-reward-elite-1280x720.png) | [screenshot](data/card-pool-art-v01/ui-reward-elite-1920x1080.png) |
| Card hover detail | [screenshot](data/card-pool-art-v01/ui-hover-1280x720.png) | — |
| Defias Lookout encounter portrait | [screenshot](data/card-pool-art-v01/enemy-lookout-1280x720.png) | [screenshot](data/card-pool-art-v01/enemy-lookout-1920x1080.png) |
| Cutpurse portrait | [screenshot](data/card-pool-art-v01/enemy-cutpurse-1280x720.png) | — |
| Deckhand portrait | — | [screenshot](data/card-pool-art-v01/enemy-deckhand-1920x1080.png) |
| Elite in phase II | [screenshot](data/card-pool-art-v01/enemy-elite-1280x720.png) | — |
| Boss in phase II | — | [screenshot](data/card-pool-art-v01/enemy-boss-1920x1080.png) |
| Common reward choices | [screenshot](data/card-pool-art-v01/ui-reward-common-1280x720.png) | — |

The hand, compact hand, common reward, five-card elite reward, and enemy portrait states were checked at both requested viewport sizes. For elite rewards, a compact heading and content width that respects the screen padding remove both axes of internal scrolling at 1280×720 and 1920×1080. DOM metrics confirm the reward screen's scroll size equals its client size in both viewports; all five notes fit without note-level clipping. Ice Echo keeps damage and draw as its two face chips, with Bleeding shown as a separate action line; the complete effect remains in its full-size note. At 1280×720 note text remains 13.75px; at 1920×1080 it is 18.86px. The new ability drafts are not rendered on card faces by design; their full-size files and contact sheet are the art review surface.

## Reproduction

```powershell
npm run card-pool:compare -- 100 42
npm run card-pool:synergy -- 100 42
npm test
npm run build
```

Raw metrics: [`comparison.json`](data/card-pool-art-v01/comparison.json) and [`synergy-lab.json`](data/card-pool-art-v01/synergy-lab.json).
