# MEASUREMENTS — In-game values (theory vs practice)

Traceability file for measurement experiments.
Format: raw data value / theoretical applied value / in-game measured value.
Eff. % = (base / practice - 1) × 100 → real attack speed bonus.

---

## FORMAT

```
[TECH/ABILITY] — [CIV] —
Measurement condition: (age, no parasite buff, method)

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
unit-name      | x.xxx | x.xxx   | x.xxx    | +xx.x%  |
```

---

## [TECH] Spirit Way — Chinese — 2026/04/14

**Description:** +20% attack speed on dynasty units

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
fire-lancer    | 1.625 | 1.354   | 1.310    | +24.0%  | 
zhuge-nu       | 1.750 | 1.458   | 1.580    | +10.8%  |
grenadier      | 1.625 | 1.354   | 1.380    | +17.8%  |

**Conclusion:** No uniform model. Hard-coded per unit in `patches/abilities.ts`.

---

## [TECH] Zeal — Delhi — 2026/04/14

**Description:** +50% attack speed

Unit                           | Base  | Theory  | Practice | Eff. %  |
-------------------------------|-------|---------|----------|---------|
spearman                       | 1.875 | 1.250   | 1.250    | +50.0%  | 
man-at-arms                    | 1.375 | 0.917   | 1.000    | +37.5%  | 
archer                         | 1.625 | 1.083   | 1.250    | +30.0%  | 
crossbowman                    | 2.125 | 1.417   | 1.530    | +38.9%  | 
handcannoneer                  | 2.125 | 1.417   | 1.580    | +34.5%  |
tower-elephant                 | 2.875 | 1.917   | 2.000    | +43.8%  | 
sultans-elite-tower-elephant   | 2.875 | 1.917   | 2.000    | +43.8%  | 
lancer                         | 1.500 | 1.000   | 1.080    | +38.9%  | 
war-elephant                   | 2.875 | 1.917   | 2.000    | +43.8%  | 
ghazi-raider                   | 2.000 | 1.333   | 1.280    | +56.3%  | 

**Average effective bonus:** +39.4% AS (≠ +50% announced). 
**Conclusion:** No uniform model found. Hard-coded per unit in `patches/technologies.ts`.

---

## [TECH] Tower of Victory — Delhi — 2026/04/14

**Description:** +20% attack speed

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
spearman       | 1.875 | 1.563   | 1.620    | +15.7%  |
man-at-arms    | 1.375 | 1.146   | 1.120    | +22.8%  |
archer         | 1.625 | 1.354   | 1.370    | +18.6%  |
crossbowman    | 2.125 | 1.771   | 1.830    | +16.1%  |
handcannoneer  | 2.125 | 1.771   | 1.790    | +18.7%  |

**Average effective bonus:** +18.4% AS (≠ +20% announced).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/techologies.ts`.

---

## [TECH] Tower of Victory + Zeal — Delhi — 2026/04/14

**Description:** +50% + 20% attack speed

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
spearman       | 1.875 | 1.042   | 1.040    | +80.3%  |
man-at-arms    | 1.375 | 0.764   | 0.750    | +83.3%  |
archer         | 1.625 | 0.903   | 1.040    | +56.3%  |
crossbowman    | 2.125 | 1.181   | 1.330    | +59.8%  |
handcannoneer  | 2.125 | 1.181   | 1.310    | +62.2%  |

**Average effective bonus:** +68.4% AS (theory: +80% combined).
**Conclusion:**
<!-- TEMPLATE FOR NEXT EXPERIMENT

## [TYPE] Name — Civ — Date

**Description:**

Unit | Base | Theory | Practice | Eff. % |
-----|------|--------|----------|--------|

**Conclusion:**

-->
