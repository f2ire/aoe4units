# BATTLES — In-game N vs M fight outcomes

Reference data for the multi-unit models (`aggregated` / `focusFire` / `focusFireBatchesMC`).
One section per matchup. Fights are stochastic → **5 runs minimum**, always fill the win rate.

## SETUP RULES

- Flat open terrain, no buildings, no walls, no trees.
- Same age both sides, no upgrades unless listed under `A:` / `B:`.
- No parasite buffs (no aura units, no landmark effects nearby).
- Both sides start idle, facing each other, at the stated distance.
- `Control` = how the fight is started. Keep it identical across all runs of a section:
  - `attack-move` → A-click, no micro
  - `focus` → both sides right-click the same target, retarget on death
  - `kite` → ranged side manually kites, melee chases
- Stop the clock when the last unit of the losing side dies.
- `Units left` / `HP left` = winner's side only. `HP left` = total across survivors.

---

## FORMAT

```
## [MATCHUP] <unit A> vs <unit B> — <civA> vs <civB> — YYYY/MM/DD
Age: | Distance: tiles | Control: | Patch:
A: N× <unit> (techs/abilities: -)
B: M× <unit> (techs/abilities: -)

Run | Winner | Units left | HP left | Duration |
----|--------|------------|---------|----------|
1   |        |            |         |          |

**A win rate:** x/5
**Median:** units / HP / s
**App:** <model> → <what the site predicts>
**Conclusion:**
```

---

## [MATCHUP] horseman vs spearman — hre vs hre — 2026/__/__

Age: IV | Distance: 5 tiles | Control: attack-move | Patch:
A: 5× horseman (techs/abilities: -)
B: 5× spearman (techs/abilities: -)

Run | Winner | Units left | HP left | Duration |
----|--------|------------|---------|----------|
1   |        |            |         |          |
2   |        |            |         |          |
3   |        |            |         |          |
4   |        |            |         |          |
5   |        |            |         |          |

**A win rate:** /5
**Median:** units / HP / s
**App:**
**Conclusion:**

---

## [MATCHUP] archer vs man-at-arms — eng vs eng — 2026/__/__

Age: IV | Distance: 10 tiles | Control: attack-move | Patch:
A: 5× archer (techs/abilities: -)
B: 5× man-at-arms (techs/abilities: -)

Run | Winner | Units left | HP left | Duration |
----|--------|------------|---------|----------|
1   |        |            |         |          |
2   |        |            |         |          |
3   |        |            |         |          |
4   |        |            |         |          |
5   |        |            |         |          |

**A win rate:** /5
**Median:** units / HP / s
**App:**
**Conclusion:**

---

## [MATCHUP] <unit A> vs <unit B> — <civA> vs <civB> — YYYY/MM/DD

Age: | Distance: tiles | Control: | Patch:
A: N× <unit> (techs/abilities: -)
B: M× <unit> (techs/abilities: -)

Run | Winner | Units left | HP left | Duration |
----|--------|------------|---------|----------|
1   |        |            |         |          |
2   |        |            |         |          |
3   |        |            |         |          |
4   |        |            |         |          |
5   |        |            |         |          |

**A win rate:** /5
**Median:** units / HP / s
**App:**
**Conclusion:**
