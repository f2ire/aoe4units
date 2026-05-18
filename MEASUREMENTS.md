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
## [TECH] Roller Shutter Triggers — Base game — 2026/05/17

**Description:** 30% attack speed

Unit             | Base  | Theory | Practice | Eff. %  |
-----------------|-------|--------|----------|---------|
Springald        | 3.125 | 2.404  | 2.49     | +25.5%  |

**Average effective bonus:** +25.5% AS (≠ +30% announced).
**Conclusion:** Hard-coded per unit in `patches/technologies.ts`.


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

## Tower of Victory — 2026/05/17

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
spearman       | 1.875 | 1.563   | 1.56     | +20.2%  |
man-at-arms    | 1.375 | 1.146   | 1.12     | +22.8%  |
archer         | 1.625 | 1.354   | 1.31     | +24.0%  |
crossbowman    | 2.125 | 1.771   | 1.69     | +25.7%  |
handcannoneer  | 2.125 | 1.771   | 1.69     | +25.7%  |

**Average effective bonus:** +23.7% AS (≠ +20% announced).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/technologies.ts`.

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

## Tower of Victory + Zeal — 2026/05/17

Unit           | Base  | Theory  | Practice | Eff. %  |
---------------|-------|---------|----------|---------|
spearman       | 1.875 | 1.563   | 1.00     | +87.5%  |
man-at-arms    | 1.375 | 1.146   | 0.75     | +83.3%  |
archer         | 1.625 | 1.354   | 1.00     | +62.5%  |
crossbowman    | 2.125 | 1.771   | 1.24     | +71.4%  |
handcannoneer  | 2.125 | 1.771   | 1.24     | +71.4%  |

**Average effective bonus:** +75.2% AS (theory: +80% combined).
**Conclusion:** Proche des mesures Delhi 04/14 (+68.4%). Écart de ~4.8 pp avec la théorie. No uniform model. Hard-coded in `patches/abilities.ts`.



## [TECH] Network of Castle — English — 2026/04/18

**Description:** +20% attack speed

Unit             | Base   | Theory | Practice | Eff. %  |
-----------------|--------|--------|----------|---------|
spearman         | 1.875  | 1.563  | 1.620    | +15.7%  |
man-at-arms      | 1.375  | 1.146  | 1.120    | +22.8%  |
Wynguard Footman | 1.625  | 1.354  | 1.330    | +22.2%  |
crossbowman      | 2.125  | 1.771  | 1.830    | +16.1%  |
handcannoneer    | 2.125  | 1.771  | 1.790    | +18.7%  |
longbowman       | 1.625  | 1.354  | 1.370    | +18.6%  |
Wynguard Ranger  | 1.625  | 1.354  | 1.370    | +18.6%  |
Horseman         | 1.750  | 1.458  | 1.560    | +12.2%  |
King             | 2.375  | 1.979  | 1.950    | +21.8%  |
Lancer           | 1.500  | 1.250  | 1.230    | +22.0%  |
Trebuchet        | 11.375 | 9.479  | 9.530    | +19.3%  |
Mangonel         | 6.875  | 5.729  | 5.830    | +17.9%  |
Springald        | 3.125  | 2.604  | 2.640    | +18.4%  |
Bombard          | 5.375  | 4.479  | 4.570    | +17.6%  |
Ribauldequin     | 5.250  | 4.375  | 4.570    | +14.9%  |
Villager         | 3.380  | 2.817  | 2.910    | +16.1%  |

**Average effective bonus:** +18.3% AS (vs. +20% announced); +18.9% excluding siege/villagers.
**Conclusion:** Average gap of ~1.7 pp, with a 12–23% spread. There is no uniform model; unit-specific corrections are required

## [TECH] Network of Citadels — English — 2026/04/18

**Description:** +30% attack speed

Unit             | Base   | Theory | Practice | Eff. %  |
-----------------|--------|--------|----------|---------|
spearman         | 1.875  | 1.442  | 1.580    | +18.7%  |
man-at-arms      | 1.375  | 1.058  | 1.120    | +22.8%  |
Wynguard Footman | 1.625  | 1.250  | 1.320    | +23.1%  |
crossbowman      | 2.125  | 1.635  | 1.720    | +23.5%  |
handcannoneer    | 2.125  | 1.635  | 1.710    | +24.3%  |
longbowman       | 1.625  | 1.250  | 1.330    | +22.2%  |
Wynguard Ranger  | 1.625  | 1.250  | 1.330    | +22.2%  |
Horseman         | 1.750  | 1.346  | 1.490    | +17.4%  |
King             | 2.375  | 1.827  | 1.890    | +25.7%  |
Lancer           | 1.500  | 1.154  | 1.170    | +28.2%  |
Trebuchet        | 11.375 | 8.750  | 8.860    | +28.4%  |
Mangonel         | 6.875  | 5.288  | 5.330    | +29.0%  |
Springald        | 3.125  | 2.404  | 2.510    | +24.5%  |
Bombard          | 5.375  | 4.135  | 4.280    | +25.6%  |
Ribauldequin     | 5.250  | 4.038  | 4.250    | +23.5%  |
Villager         | 3.380  | 2.600  | 2.790    | +21.1%  |

**Average effective bonus:** +23.8% Attack Speed (vs. +30% announced); +22.8% excluding siege/villagers.
**Conclusion:** Average gap of ~6.2 percentage points, with a spread of 17–29%. There is no uniform model; unit-specific corrections are required.

## [TECH] Valorous Inspiration — JD — 2026/04/24

**Description:** +35% attack speed

Unit               | Base    | Theory | Practice | Eff. %  |
-------------------|---------|--------|----------|---------|
spearman           | 1.875   | 1.389  | 1.310    | +43.1%  |
man-at-arms        | 1.375   | 1.019  | 1.000    | +37.5%  |
Jeanne's Champion  | 1.375   | 1.019  | 1.000    | +37.5%  |
archer             | 1.625   | 1.204  | 1.310    | +24.0%  |
handcannoneer      | 2.125   | 1.574  | 1.690    | +25.7%  |
arbalétrier        | 2.125   | 1.574  | 1.670    | +27.2%  |
Horseman           | 1.750   | 1.296  | 1.210    | +44.6%  |
Royal Knight       | 1.500   | 1.111  | 1.150    | +30.4%  |
Jeanne's Rider     | 1.750   | 1.296  | 1.210    | +44.6%  |
Trebuchet          | 11.375  | 8.426  | 8.660    | +31.3%  |
Mangonel           | 6.875   | 5.093  | 5.210    | +32.0%  |
Springald          | 3.125   | 2.315  | 2.320    | +34.7%  |
Canon              | 5.375   | 3.981  | 4.100    | +31.1%  |
Royal Culverin     | 3.625   | 2.685  | 2.790    | +29.9%  |
Ribauldequin       | 5.250   | 3.889  | 4.160    | +26.2%  |


## [TECH] Khan attack speed arrow — MG — 2026/05/14

**Description:** 50% attack speed

Unit               | Base    | Theory | Practice | Eff. %  |
-------------------|---------|--------|----------|---------|
spearman           | 1.875   | 1.389  | 1.310    | +43.1%  |
man-at-arms        | 1.375   | 1.019  | 1.000    | +37.5%  |
Jeanne's Champion  | 1.375   | 1.019  | 1.000    | +37.5%  |
archer             | 1.625   | 1.204  | 1.310    | +24.0%  |
handcannoneer      | 2.125   | 1.574  | 1.690    | +25.7%  |
arbalétrier        | 2.125   | 1.574  | 1.670    | +27.2%  |
Horseman           | 1.750   | 1.296  | 1.210    | +44.6%  |
Royal Knight       | 1.500   | 1.111  | 1.150    | +30.4%  |
Jeanne's Rider     | 1.750   | 1.296  | 1.210    | +44.6%  |
Trebuchet          | 11.375  | 8.426  | 8.660    | +31.3%  |
Mangonel           | 6.875   | 5.093  | 5.210    | +32.0%  |
Springald          | 3.125   | 2.315  | 2.320    | +34.7%  |
Canon              | 5.375   | 3.981  | 4.100    | +31.1%  |
Royal Culverin     | 3.625   | 2.685  | 2.790    | +29.9%  |
Ribauldequin       | 5.250   | 3.889  | 4.160    | +26.2%  |



**Average effective bonus:** +33.2% AS (≠ +50% announced).
**Conclusion:** Average gap of ~16.8 pp, with a spread of 23–37%. Mangudai is the most penalized (+23.2%). No uniform model; unit-specific corrections are required in `patches/`.

## [TECH] Mehter Attack Drums — Ot — 2026/05/14

**Description:** 15% attack speed

Unit               | Base    | Theory | Practice | Eff. %  |
-------------------|---------|--------|----------|---------|
spearman           | 1.875   | 1.630  | 1.650    | +13.6%  |
man-at-arms        | 1.375   | 1.196  | 1.120    | +22.8%  |
archer             | 1.625   | 1.413  | 1.400    | +16.1%  |
crossbow           | 2.125   | 1.848  | 1.900    | +11.8%  |
akinji             | 2.625   | 2.283  | 2.270    | +15.6%  |
janissary          | 1.500   | 1.304  | 1.350    | +11.1%  |
lancer             | 1.500   | 1.304  | 1.260    | +19.0%  |
siphahi            | 1.750   | 1.522  | 1.600    | +9.4%   |
trebuchet          | 11.375  | 9.891  | 9.890    | +15.0%  |
great-bombard      | 7.000   | 6.087  | 6.150    | +13.8%  |
springald          | 3.125   | 2.717  | 2.720    | +14.9%  |
mangonel           | 6.875   | 5.978  | 5.980    | +15.0%  |
ribauldequin       | 5.250   | 4.565  | 4.700    | +11.7%  |
carrack            | 5.615   | 4.883  | 4.970    | +13.0%  |
hulk               | 1.500   | 1.304  | 1.280    | +17.2%  |
grand-galley       | 4.000   | 3.478  | 3.610    | +10.8%  |
 

**Average effective bonus:** +14.4% AS (≠ +15% announced). Spread: +9.4% (siphahi) to +22.8% (man-at-arms).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/abilities.ts`.

## [TECH] Fortitude — Ot — 2026/05/18

**Description:** 40% attack speed

Unit               | Base    | Theory | Practice | Eff. %  |
-------------------|---------|--------|----------|---------|
siphahi            | 1.750   | 1.250  | 1.18     | +48.3%  |

**Average effective bonus:** +48.3% AS (≠ +40% announced).


## [TECH] Daimyo Aura — Sen — 2026/05/15

**Description:** 20% Attack speed (10% age 2/ 15% age 3) 

Unit                    | Base  | Theory | Practice | Eff. %  |
------------------------|-------|--------|----------|---------|
spearman                | 1.875 | 1.563  | 1.62     | +15.7%  |
kanabo-samurai          | 1.375 | 1.146  | 1.12     | +22.8%  |
naginata-samurai        | 1.375 | 1.146  | 1.12     | +22.8%  |
ozutsu                  | 4.750 | 3.958  | 4.03     | +17.9%  |
yumi-ashigaru           | 1.625 | 1.354  | 1.37     | +18.6%  |
tanegashima-ashigaru    | 2.500 | 2.083  | 2.10     | +19.0%  |
mounted-samurai         | 1.500 | 1.250  | 1.23     | +22.0%  |
yari-cavalry            | 1.750 | 1.458  | 1.56     | +12.2%  |
ikko-ikki-monk          | 1.375 | 1.146  | 1.12     | +22.8%  |


**Average effective bonus:** +19.3% AS (≠ +20% announced). Spread: +12.2% (yari-cavalry) to +22.8% (kanabo/naginata/ikko-ikki-monk).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/technologies.ts`.

## [TECH] Sword Hunt Statue — Sen — 2026/05/15

**Description:** 35% Attack speed  (20% Damyo + 15% Sword Hunt Statue passive)

Unit                    | Base  | Theory | Practice | Eff. %  |
------------------------|-------|--------|----------|---------|
spearman                | 1.875 | 1.389  | 1.30     | +44.2%  |
kanabo-samurai          | 1.375 | 1.019  | 1.00     | +37.5%  |
naginata-samurai        | 1.375 | 1.019  | 1.00     | +37.5%  |
ozutsu                  | 4.750 | 3.519  | 3.71     | +28.0%  |
yumi-ashigaru           | 1.625 | 1.204  | 1.30     | +25.0%  |
tanegashima-ashigaru    | 2.500 | 1.852  | 1.95     | +28.2%  |
mounted-samurai         | 1.500 | 1.111  | 1.15     | +30.4%  |
yari-cavalry            | 1.750 | 1.296  | 1.21     | +44.6%  |
ikko-ikki-monk          | 1.375 | 1.019  | 1.00     | +37.5%  |


**Average effective bonus:** +34.8% AS (≠ +35% announced). Spread: +25.0% (yumi-ashigaru) to +44.6% (yari-cavalry).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/technologies.ts`.

## [TECH] Tower of victory — tug — 2026/05/17

**Description:** 20% attack speed

Unit                  | Base  | Theory | Practice | Eff. %  |
----------------------|-------|--------|----------|---------|
war-elephant          | 2.875 | 2.396  | 2.25     | +27.8%  |
war-elephant-spearman | 1.375 | 1.146  | 1.12     | +22.8%  |
raider-elephant       | 2.375 | 1.979  | 1.85     | +28.4%  |
healer-elephant       | 3     | 2.500  | 2.37     | +26.6%  |
ballista-elephant     | 3.120 | 2.600  | 2.52     | +23.8%  |

**Average effective bonus:** +25.9% AS (≠ +20% announced). Spread: +22.8% (war-elephant-spearman) to +28.4% (raider-elephant).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/abilities.ts`.

## [TECH] Dali horses — zx — 2026/05/15

**Description:** 20% attack speed

Unit             | Base  | Theory | Practice | Eff. %  |
-----------------|-------|--------|----------|---------|
lancer           | 1.500 | 1.250  | 1.280    | +17.2%  |
imperial-guard   | 1.625 | 1.354  | 1.380    | +17.8%  |
horseman         | 1.750 | 1.458  | 1.470    | +19.0%  |
yuan-raider      | 1.625 | 1.354  | 1.380    | +17.8%  |

**Average effective bonus:** +17.9% AS (≠ +20% announced).
**Conclusion:** No uniform model. Hard-coded per unit in `patches/technologies.ts`.

<!-- TEMPLATE FOR NEXT EXPERIMENT

**Description:** +50% + 20% attack speed

## [TYPE] Name — Civ — Date

**Description:**

Unit | Base | Theory | Practice | Eff. % |
-----|------|--------|----------|--------|

**Conclusion:**

-->
