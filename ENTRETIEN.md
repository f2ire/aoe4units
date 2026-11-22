# ENTRETIEN — Défendre aoe4units.com
### Poste : Dév Python Junior — Applications Data & Composants UI (Lyon)

> Objectif : pouvoir parler **30 min** du projet sans hésiter, et traduire chaque
> brique React/TS en équivalent **Python / Plotly Dash**.

---

## 0. LES CHIFFRES (à connaître par cœur)

| Quoi | Valeur |
|---|---|
| Lignes TS/TSX écrites (hors composants shadcn générés) | ~25 700 |
| Moteur de combat `lib/combat.ts` | 3 205 lignes, **0 dépendance React** |
| Page principale `Sandbox.tsx` | 2 483 lignes |
| Hook métier `useUnitSlot.ts` | 1 250 lignes |
| Données source (JSON aoe4world) | 5,4 Mo (unités + technos + capacités) |
| Pages statiques pré-générées (SEO) | ~670 |
| Commits / durée | 120 commits, nov. 2025 → aujourd'hui |
| Hooks React utilisés | 46 `useState`, 27 `useEffect`, 17 `useMemo`, 16 `useCallback` |
| Cibles de déploiement | site web + pages SEO statiques + **extension Twitch** |

**Le pitch 45 s :**
> « C'est un simulateur de combat pour Age of Empires IV. Tu choisis deux unités,
> leur civilisation, leur âge, leurs technologies et capacités, et l'app te dit qui
> gagne, en combien de temps, avec combien de PV restants — et combien d'unités il
> faudrait au perdant pour renverser le combat. Techniquement c'est un moteur de
> simulation pur en TypeScript, alimenté par 5 Mo de données de jeu que je
> normalise et corrige via une couche de patches, et une UI React qui n'est qu'une
> vue sur ce moteur. Le même moteur alimente le site, ~670 pages statiques
> générées pour le SEO, et une extension Twitch. »

---

## 1. ARCHITECTURE — le schéma à dessiner au tableau

```
   SOURCE (externe)              NORMALISATION              MOTEUR              VUES
 ┌────────────────────┐       ┌──────────────────┐    ┌──────────────┐   ┌──────────────┐
 │ aoe4world/data     │       │ unified-units.ts │    │              │   │ Sandbox (/)  │
 │  all-unified.json  │──┐    │ unified-tech.ts  │    │  combat.ts   │──▶│ 2 slots vs   │
 │  ...abilities.json │  │    │ unified-abil.ts  │    │              │   ├──────────────┤
 │  ...technos.json   │  │    └────────▲─────────┘    │ - dégâts     │   │ /units/:civ  │
 └────────────────────┘  │             │              │ - TTK        │──▶│ /:id  (SSG)  │
          │              │    ┌────────┴─────────┐    │ - kiting     │   ├──────────────┤
          │              └───▶│  data/patches/   │    │ - N vs M     │   │ Extension    │
   scripts/update-data.mjs    │ units/abilities/ │    │ - Monte-Carlo│──▶│ Twitch       │
   (fetch + diff par id       │ technologies.ts  │    └──────────────┘   └──────────────┘
    + alerte si un id             = corrections               ▲
    patché disparaît)             déclaratives                │
                              └──────────────────┘   hooks/useUnitSlot.ts
                                                     (état + dérivations)
```

**La phrase qui vend l'archi :**
> « Le moteur ne connaît pas React, et l'UI ne connaît pas les règles du jeu.
> Entre les deux, un hook qui transforme l'état utilisateur en entrée du moteur.
> C'est ce découpage qui m'a permis de brancher trois interfaces sur le même code
> sans le dupliquer. »

### Le flux d'un calcul, de bout en bout
```
 état UI (unité, civ, âge, Set<technos>, Set<capacités>, compteurs)
        │  useUnitSlot  ── chaîne de useMemo ──▶ modifiedStats  (stats finales)
        ▼
 buildModifiedVariation(source, stats)  ── objet « unité réelle » ──▶
        ▼
 computeVersus(unitA, unitB, …)   → VersusResult { winner, hpRemaining, metrics }
        ▼
 <UnitCard/> × 2   (stats + barres de comparaison + détail du calcul)
```

---

## 2. MINI-COURS REACT — 10 concepts, chacun ancré dans TON code

> Règle d'or : **jamais de définition seule**. Toujours
> `définition (1 phrase) → où je m'en sers → le piège que j'ai rencontré`.

### 2.1 Composant = fonction (props) → JSX
Un composant est une **fonction de ses props** qui décrit ce qu'il faut afficher.
React appelle la fonction, compare le résultat au DOM existant et n'applique que
la différence (réconciliation / Virtual DOM).

- Chez moi : `<UnitCard unit=… stats=… metrics=… />` est le composant réutilisable
  central. Le **même** composant sert en mode comparatif, en mode combat, sur la
  page SEO d'une unité, et dans l'image partageable.
- **À dire :** « Ma règle de réutilisabilité : le composant ne va **pas** chercher
  ses données, on les lui passe. `UnitCard` ne sait pas d'où viennent les stats —
  c'est ce qui lui permet de servir dans 4 contextes différents. »

### 2.2 État brut vs état dérivé — LE concept à maîtriser
```
 ┌── ÉTAT BRUT (useState) ──────────┐   ┌── ÉTAT DÉRIVÉ (calculé au rendu) ──┐
 │ unit, civ, age                   │   │ filteredUnits                      │
 │ activeTechnologies: Set<string>  │──▶│ categorizedUnits                   │
 │ activeAbilities: Set<string>     │   │ techs / abilities disponibles      │
 │ abilityCounters: Map<string,num> │   │ effectiveVariation                 │
 └──────────────────────────────────┘   │ modifiedStats  ← résultat final    │
                                        └────────────────────────────────────┘
      1 seule source de vérité                JAMAIS stocké dans un useState
```
**À dire :** « L'erreur de débutant, c'est de mettre les stats calculées dans un
`useState` et de les resynchroniser dans un `useEffect`. Résultat : deux sources
de vérité qui divergent. Chez moi, tout ce qui est déductible est **dérivé au
rendu**, memoïsé si le calcul est cher. Je n'ai d'état que pour ce que
l'utilisateur choisit. »

### 2.3 Custom hook = réutiliser de la LOGIQUE (pas de l'UI)
`useUnitSlot(civ)` encapsule tout le comportement d'un « emplacement d'unité ».
```
 Sandbox  ─┬─ const slot1 = useUnitSlot(civ1)      ← 2 instances indépendantes
           └─ const slot2 = useUnitSlot(civ2)         du MÊME hook
 UnitDetail ── useUnitSlot(unitInit, civInit)       ← même logique, autre UI
 Extension  ── useUnitSlot(…)                       ← même logique, autre UI
```
**À dire :** « L'annonce parle de composants réutilisables. En React il y a deux
axes de réutilisation : le composant réutilise l'**apparence**, le hook réutilise
le **comportement**. Ma page a deux emplacements strictement symétriques : au lieu
de dupliquer 1 200 lignes ou de tout paramétrer par des props, j'appelle le même
hook deux fois. Chaque appel a son propre état, isolé. »

### 2.4 `useMemo` / `useCallback` — pourquoi, et quand NE PAS le faire
À chaque changement d'état, React ré-exécute **tout le corps** de la fonction.
`useMemo(fn, deps)` conserve le résultat tant que `deps` ne change pas.

- Chez moi : `modifiedStats` parcourt une centaine de technologies et applique
  leurs effets en 3 passes → memoïsé sur `[unit, civ, age, techs, abilities]`.
- **Le piège que j'ai vécu (excellente anecdote perf) :**
```
  Calcul « combien d'unités faut-il au perdant pour gagner ? »
      = boucle jusqu'à 100  ×  simulation Monte-Carlo 200 itérations
      = jusqu'à 20 000 simulations de combat
  Dans l'extension Twitch, le panneau se déplace à la souris.
      → re-render à CHAQUE mouvement de pointeur pendant le drag
      → 20 000 simulations par pixel parcouru.  L'overlay se figeait.

  Correctif : tout le calcul dans UN useMemo dont les dépendances sont
  UNIQUEMENT les entrées de combat (unités, stats, compteurs, modèle) —
  surtout PAS la position ni l'échelle du panneau.
```
- **À dire aussi (l'honnêteté rapporte) :** « Sur le site, ce calcul est encore
  dans le corps du rendu, non memoïsé. Ça passe parce que les modèles
  déterministes sont rapides, mais c'est ma prochaine dette : le mémoïser, et
  remplacer la recherche linéaire par une **recherche binaire** — le résultat est
  monotone en nombre d'unités, donc 7 itérations au lieu de 100. »
- **Ne pas memoïser par réflexe :** `useMemo` a un coût (comparaison des
  dépendances + mémoire). Je le mets là où j'ai mesuré, pas partout.

### 2.5 `useEffect` = synchroniser avec le monde extérieur
Un effet sert à parler à ce qui n'est **pas** React : DOM natif, écouteurs,
timers, réseau, `localStorage`. Il **ne sert pas** à calculer un état dérivé.

Exemple réel — s'abonner au viewport visuel, avec nettoyage :
```tsx
useEffect(() => {
  if (!open) return;                       // garde : rien à faire si fermé
  const vv = window.visualViewport;
  const update = () => setViewport({
    height: vv.height,
    keyboardOpen: window.innerHeight - vv.height > 120,
  });
  update();
  vv?.addEventListener("resize", update);
  return () => vv?.removeEventListener("resize", update);   // ← cleanup
}, [open]);                                                  // ← dépendances
```
**Les 3 questions qu'on te posera dessus :**
1. *À quoi sert le tableau de dépendances ?* → il dit quand ré-exécuter l'effet.
   Vide = une seule fois au montage. Absent = à chaque rendu.
2. *À quoi sert la fonction retournée ?* → nettoyage : elle s'exécute au démontage
   **et avant chaque ré-exécution**. Sans elle : fuite d'écouteurs.
3. *Pourquoi ça s'exécute deux fois en dev ?* → `StrictMode` monte/démonte
   volontairement le composant pour révéler les effets mal nettoyés.

**Anecdote « effets en cascade » (montre la maturité) :**
> « La restauration d'un lien de partage se fait en **3 phases**, pas en un effet.
> Parce que choisir une unité efface les technos actives, et qu'un autre effet
> force l'âge maximum. Donc : phase 1 j'écris unité + civ ; phase 2, une fois
> l'unité en place, j'écris l'âge partagé ; phase 3, une fois l'âge en place,
> j'écris technos et capacités. C'est fragile, et ça m'a appris que chaîner des
> effets pour se synchroniser **avec soi-même** est le signe qu'il faudrait un
> `useReducer` ou une machine à états. »

### 2.6 Les `key` — pas seulement pour les listes
Une `key` identifie un élément entre deux rendus. Même `key` → React **réutilise**
l'instance et son état. `key` différente → il **démonte et remonte** (état remis à
zéro).

- Chez moi : la page d'unité est `<UnitDetailView key={civ + "/" + id} />`. Sans
  ça, naviguer d'une civilisation à l'autre pour la même unité gardait l'état du
  hook précédent. Le changement de `key` force le remontage.
- **À dire :** « La `key` est un outil de contrôle du cycle de vie, pas juste un
  warning à faire taire. Corollaire : ne jamais utiliser l'index du tableau comme
  `key` sur une liste réordonnable — l'état suit la position, pas l'élément. »

### 2.7 Où définir un composant : au niveau module, JAMAIS dans le rendu
```
 ❌  function Sandbox() {
       function Picker() { … }         // recréée à chaque rendu
       return <Picker/>                // → type différent → remontage complet
     }                                 // → l'input perd le focus à chaque frappe

 ✅  function Picker() { … }           // niveau module, identité stable
     function Sandbox() { return <Picker/> }
```
Chez moi `UnitPicker`, `CivPicker`, `CountStepper`, `PresetButton` sont tous au
niveau module. **C'est la cause classique du « mon champ de recherche perd le
focus à chaque lettre ».**

### 2.8 Composants contrôlés + l'histoire du bug mobile (LA meilleure anecdote)
```
 SYMPTÔME    Sur téléphone, dès que je tapais dans la recherche du sélecteur
             d'unité, le clavier se fermait et la liste disparaissait.

 DIAGNOSTIC  1. Radix <Select> ferme son contenu sur l'événement window.resize.
             2. Le clavier virtuel Android/iOS déclenche window.resize en s'ouvrant.
             3. Et <Select> reprend le focus à chaque re-render → vole le focus
                du champ de recherche que j'y avais embarqué.

 CORRECTIF   Remplacer <Select> par <Popover> (aucun des deux comportements),
             puis suivre window.visualViewport : le viewport de MISE EN PAGE ne
             rétrécit PAS quand le clavier s'ouvre, donc le placement automatique
             de Radix mettait le menu sous le clavier.
             → clavier ouvert :  side="top",  avoidCollisions={false},
               maxHeight = min(hauteur dispo Radix, visualViewport.height − 16px)

 TRACE       Un commentaire de 5 lignes au-dessus du composant explique pourquoi
             ce n'est PAS un <Select>, pour que personne (moi inclus) ne
             « corrige » ça dans 6 mois.
```
**Ce que ça prouve :** débogage sur une plateforme que je n'avais pas sous la
main, lecture du comportement d'une lib tierce, et **documentation de la
décision** — exactement « réaliser la documentation des composants ».

### 2.9 Rendu conditionnel & composition
- `{condition && <X/>}`, ternaire, et `{(() => { … })()}` quand il y a de la
  logique — **mon anti-pattern assumé** : le bloc de calcul du combat est une
  IIFE dans le JSX. À dire spontanément : « je sais que c'est à extraire dans un
  hook `useVersus`, c'est dans ma liste. »
- Composition > configuration : shadcn/ui fournit des primitives non stylées
  (Radix) que je compose, plutôt qu'un composant à 40 props booléennes.

### 2.10 Rendu statique (SSG) + hydratation
```
 npm run build  →  vite-react-ssg
   ├─ getStaticPaths()  →  ~670 URLs   /units/<civ>/<unité>
   ├─ rend chaque page en HTML au build (donc indexable par Google et les IA)
   └─ au chargement, React « hydrate » ce HTML → la page devient interactive

 Problème : le Sandbox utilise window, le presse-papiers, visualViewport…
            → aucun de ces objets n'existe pendant le build Node.
 Solution : <ClientOnly>{() => <Sandbox/>}</ClientOnly>
            + méta par page via <Head> (jamais dans index.html, sinon doublons)
```
**À dire :** « Ça m'a fait comprendre concrètement la différence entre rendu
serveur et rendu client, et la notion d'hydratation : le HTML statique doit
correspondre au premier rendu client, sinon erreur d'hydratation. »

---

## 3. MINI-COURS TYPESCRIPT — ancré

| Concept | Où, chez moi |
|---|---|
| `interface` de domaine | `CombatEntity`, `VersusMetrics`, `VersusResult` — le contrat entre l'UI et le moteur |
| **Type union littéral** | `winner: "draw" \| "attacker" \| "defender"`, commenté « jamais un id d'unité ». Le compilateur interdit la faute |
| `Record<K,V>` / `Map` / `Set` | `Record<string, AoE4Unit[]>` pour les catégories ; `Set<string>` pour les technos actives (appartenance en O(1), sémantique « ensemble ») |
| **Interface = stratégie** | `interface MultiUnitModel { resolve(…) }` avec **5 implémentations** interchangeables |
| Typage d'un objet global | `window.goatcounter` déclaré dans `vite-env.d.ts` |
| Types utilitaires | `DeepPartial<T>` pour les patches : un patch ne décrit que les champs qu'il corrige |

**Le pattern « stratégie » sans classes — à raconter :**
```
 interface MultiUnitModel { resolve(A, B, metricsA, metricsB, mults) → Résultat }

   aggregatedDPSModel ──┐
   focusFireModel ──────┤
   focusFireAsymmetric ─┼──▶ un seul point d'appel : model.resolve(…)
   batchesMC ───────────┤     (le sélecteur de modèle dans l'UI ne fait
   batchesMCAsymmetric ─┘      que choisir l'objet à passer)
```
> « J'avais quatre façons de simuler un combat à N contre M, avec des résultats
> différents. Plutôt qu'un `if` géant, j'ai défini une interface et cinq objets
> qui l'implémentent. Ajouter un modèle = ajouter un fichier, zéro modification
> ailleurs. C'est du polymorphisme, sans classe ni héritage. »
> *(En Python : exactement un `Protocol` de `typing`, ou une ABC.)*

**Faiblesses TS à assumer AVANT qu'on te les trouve :**
- `strictNullChecks: false`, `noImplicitAny: false`, **212 `any`** dans le code.
- La réponse : « Le projet est parti d'un starter généré avec un `tsconfig`
  permissif, et je ne l'ai pas resserré parce que le typage des données amont
  (5 Mo de JSON hétérogène) était mouvant. C'est de la dette assumée : ce que je
  ferais, c'est activer `strict` **fichier par fichier** en commençant par
  `lib/`, qui est du code pur sans dépendance — et un `zod` en frontière d'entrée
  des JSON réglerait la moitié des `any` d'un coup. »
  *(`zod` est déjà dans mes dépendances → je sais de quoi je parle.)*

---

## 4. LA DONNÉE — le cœur du poste

### 4.1 Le pipeline
```
 GitHub aoe4world/data (source de vérité communautaire)
   │  npm run update-data
   ▼
 scripts/update-data.mjs
   ├─ télécharge les 3 JSON
   ├─ diffe par `id` → liste les ajouts / suppressions
   ├─ alerte si un id référencé par un patch a disparu en amont
   └─ modes --dry-run / --force
   ▼
 src/data/patches/          ← MA couche de correction (déclarative)
   ├─ units.ts          corrections de stats + unités inventées
   ├─ technologies.ts   corrections d'effets
   └─ abilities.ts      règles de capacités
   ▼
 unified-*.ts  →  normalisation + API stable (getUnitVariation, getMaxAge…)
```

**La règle que je défends :**
> « Je ne modifie **jamais** le JSON téléchargé, et je ne mets **jamais** de cas
> particulier dans le moteur. Tout cas particulier va dans `patches/`, sous forme
> déclarative. Deux bénéfices : la mise à jour amont ne détruit jamais mon
> travail, et le moteur reste générique — il ne connaît aucun nom d'unité. »

C'est **exactement** un pipeline de données : source brute immuable → couche de
nettoyage/correction versionnée → couche normalisée → consommateurs.

### 4.2 Validation empirique — MA réponse à « et les tests ? »
Deux fichiers de traçabilité expérimentale, `MEASUREMENTS.md` et `BATTLES.md`,
avec un **protocole** :
```
 - terrain plat, aucun bâtiment, aucun buff parasite, même âge des deux côtés
 - 5 exécutions minimum (le combat est stochastique)
 - on relève : vainqueur, unités restantes, PV restants, durée
 - on compare la MÉDIANE mesurée à la prédiction du modèle
```
Résultat concret trouvé comme ça :
```
 Techno « Roller Shutter Triggers » — annoncée +30 % de vitesse d'attaque
   Springald : base 3.125 → théorie 2.404 → mesuré en jeu 2.49  =  +25,5 % réel
   Conclusion : la valeur affichée par le jeu est fausse
             → valeur codée par unité dans patches/technologies.ts
```
**À dire :**
> « Je n'ai pas de suite de tests automatisés, et c'est ma principale dette
> technique — je l'assume d'autant plus que le poste demande explicitement des
> tests. Ce que j'ai construit à la place, c'est une validation **contre la
> réalité** : un protocole de mesure documenté qui compare la prédiction du modèle
> au comportement réel du jeu. C'est ça qui a de la valeur métier ici, parce que
> mon risque n°1 n'est pas la régression de code, c'est que **le modèle soit faux**.
>
> Cela dit, je sais exactement par où je commencerais en poste : `combat.ts` est
> constitué de **fonctions pures sans dépendance React** — le candidat parfait
> pour Vitest. Je figerais les résultats d'une trentaine de matchups de référence
> en tests de non-régression, et je convertirais directement `BATTLES.md` en table
> de cas paramétrés. Ensuite seulement, Testing Library sur les deux ou trois
> composants critiques. La logique pure d'abord — c'est là que le rapport
> valeur/effort est le meilleur. »

*(Si on insiste — « pourquoi pas plus tôt ? » → « Projet solo : j'ai priorisé la
justesse du modèle sur la stabilité du code, parce que j'étais le seul à modifier
le code mais que des joueurs utilisaient les résultats. En équipe l'arbitrage
s'inverse : c'est le code des autres qui casse le mien. »)*

### 4.3 Visualisation des données — mes choix, et pourquoi
| Choix | Pourquoi |
|---|---|
| Barre de taux de victoire (vert / gris / orange) | Sur un modèle Monte-Carlo, un vainqueur binaire ment. On montre la **distribution** |
| `médiane ± écart-type` plutôt qu'une moyenne | Distribution non gaussienne ; la médiane résiste aux combats aberrants |
| Chronologie du combat (chaque coup : instant, arme, PV cumulés) | L'utilisateur doit pouvoir **vérifier** le résultat, pas juste le croire |
| Bouton « Show Calculation » | Transparence du calcul = confiance dans l'outil |
| Code couleur de comparaison entre les deux cartes | Lecture immédiate de « qui est meilleur sur quelle stat » |

**À dire (c'est un argument dataviz, pas gaming) :**
> « Ma conviction, c'est qu'un outil d'aide à la décision qui ne montre que son
> résultat n'est pas utilisé : il est contesté. Donc j'affiche systématiquement
> l'incertitude et le chemin de calcul. C'est ce qui a le plus fait progresser
> l'adoption. »

---

## 5. LES 6 HISTOIRES À AVOIR EN POCHE

| # | Histoire | Ce que ça prouve |
|---|---|---|
| 1 | **Clavier mobile / Radix Select → Popover** (§2.8) | Débogage, lecture de lib tierce, doc de décision |
| 2 | **20 000 simulations par mouvement de souris → useMemo** (§2.4) | Compréhension du modèle de rendu React, perf |
| 3 | **Un moteur, trois interfaces** (site / SSG / extension Twitch, via l'alias `@/`) | Architecture, réutilisation, DRY |
| 4 | **Système de patches** (§4.1) | Séparation données/moteur, robustesse aux MAJ amont |
| 5 | **Validation empirique** (§4.2) | Rigueur, méthode expérimentale, honnêteté |
| 6 | **État partageable par URL** (ci-dessous) | Sens produit, retours utilisateurs, mesure |

**Histoire 6 — l'état dans l'URL :**
```
 Besoin utilisateur : « je veux envoyer ce matchup à un ami sur Discord »
 Solution : encodeShareState() sérialise TOUT l'état en query params LISIBLES
   /?vs=1&c1=fr&u1=knight&a1=4&t1=chivalry.bloomery&b1=ability-charge:3&n1=5&k=1
 Choix assumés :
   - ids lisibles (pas de blob base64) → si une techno est renommée en amont,
     elle est ignorée au chargement et le reste du lien fonctionne quand même
   - l'app n'écrit JAMAIS ces params dans la barre d'adresse
     → du coup, l'arrivée par un lien partagé devient mesurable
 Mesure : 3 événements distincts (lien ouvert / lien copié / image copiée),
          comptés une fois par chargement de page pour ne pas gonfler le chiffre
```
> « Là j'ai appris que la mesure fait partie de la fonctionnalité : "lien copié"
> mesure une **intention**, "lien ouvert" mesure une **portée réelle**. Ce ne sont
> pas les mêmes chiffres et il ne faut pas les confondre. »

---

## 6. LE PONT VERS PYTHON / PLOTLY DASH

### 6.1 Table de traduction (à sortir naturellement)
```
 React / TypeScript              →  Plotly Dash / Python
 ─────────────────────────────────────────────────────────────────────────
 useState                        →  dcc.Store  (état côté navigateur)
 props                           →  arguments de la fonction / Input du callback
 useEffect (Input → Output)      →  @callback(Output(…), Input(…))
 état dérivé au rendu            →  callback pur qui recalcule depuis ses Inputs
 useMemo                         →  @functools.cache / flask_caching.memoize
 composant réutilisable          →  fonction qui renvoie un html.Div / une classe
 key + remount                   →  pattern-matching callbacks (MATCH / ALL)
 état dans l'URL                 →  dcc.Location + parsing de la query string
 interface TypeScript            →  typing.Protocol / dataclass / Pydantic
```

### 6.2 LE point à placer absolument
> « Ce qui m'intéresse dans l'annonce, c'est que Dash et React ne sont pas deux
> mondes : **un composant Dash personnalisé s'écrit en React et se publie comme un
> paquet Python**. Quand vous dites "développer des composants réutilisables en
> Python" avec "React/TypeScript appréciés", je comprends que c'est exactement là
> que ça se joue — et c'est précisément le pont que je sais faire. »

*(Pose-la en **question** plutôt qu'en affirmation : « est-ce que vous écrivez des
composants Dash custom en React, ou React est-il sur une autre application ? »
Cette question à elle seule te classe.)*

### 6.3 « Ce projet, en Python, tu l'écrirais comment ? »
> « `combat.ts`, c'est un moteur de simulation pur : entrées typées, sortie typée,
> aucun effet de bord. En Python ce serait des `dataclass` pour `CombatEntity` et
> `VersusResult`, un `Protocol` pour l'interface `MultiUnitModel`, et surtout mes
> 200 itérations de Monte-Carlo **vectorisées avec numpy** au lieu d'une boucle —
> je simule 200 combats indépendants, c'est le cas d'école. Et le découpage que
> j'ai fait à la main entre moteur et UI, Dash me l'imposerait de toute façon :
> la logique en Python pur, l'UI en composants. »

### 6.4 Et l'expérience Python concrète ?
Sois **factuel et modeste**, ne surjoue pas :
- Scripts Python utilitaires dans ce repo (`scripts/check-zip-slashes.py` : lecture
  binaire d'une archive ZIP avec `struct` pour diagnostiquer des séparateurs de
  chemin Windows qui cassaient l'upload de l'extension Twitch — du vrai débogage
  bas niveau).
- Tes autres projets / cours Python → **prépare 1 exemple précis** : ce que tu as
  fait, avec quelles libs, quel résultat. *(à compléter par toi — le seul trou de
  cette fiche)*
- Formule : « Mon expérience la plus lourde est en TypeScript, mais ce que ce
  projet démontre — modélisation d'un domaine, séparation moteur/UI, pipeline de
  données, typage — se transpose directement. Le langage est ce qui s'apprend le
  plus vite. »
  → **ne dis que ce qui est vrai**, ils peuvent creuser.

---

## 7. LES QUESTIONS PIÈGES — réponses prêtes

**« Pourquoi ton `Sandbox.tsx` fait 2 500 lignes ? »**
> « Parce qu'il a grossi par accrétion et que je n'ai pas payé la dette. Il
> contient trois choses distinctes : l'orchestration des deux emplacements, le
> calcul du combat, et la mise en page. Le découpage évident, c'est un hook
> `useVersus` pour le calcul et un composant `VersusGrid` pour la grille — j'ai
> déjà extrait `buildVariation.ts` dans cet esprit. Ce que je ne fais pas, c'est
> découper pour découper : j'extrais quand il y a un deuxième appelant, ce qui a
> justement été le cas quand j'ai fait l'extension Twitch. »

**« Tu as des tests ? »** → §4.2. Ne te défends pas : propose un plan.

**« C'est un projet solo, tu sais travailler en équipe ? »**
> « Le repo est écrit comme s'il y avait une équipe : un `CLAUDE.md` et un
> `PROGRAMMER_GUIDE.md` de 800 lignes qui documentent les invariants et les
> pièges — par exemple "ces deux listes doivent rester synchronisées, sinon
> l'effet est ignoré silencieusement". Les commentaires expliquent le *pourquoi*,
> pas le *quoi*. J'ai des utilisateurs qui remontent des bugs et j'ai priorisé en
> fonction. Ce qui me manque et que je viens chercher, c'est la revue de code :
> personne ne m'a jamais dit "ça, ça ne va pas". »

**« Pourquoi React, et pas juste du HTML/JS ? »**
> « À cause de l'état dérivé. J'ai une dizaine d'entrées utilisateur et une
> centaine de valeurs affichées qui en dépendent. Sans React, j'écrirais à la main
> "quand la techno change, mets à jour ces 40 éléments" — c'est là que naissent
> les incohérences. React inverse le problème : je décris ce que doit être
> l'affichage en fonction de l'état, il calcule la différence. C'est exactement la
> promesse d'un callback Dash, d'ailleurs. »

**« Différence entre `useMemo`, `useCallback` et `React.memo` ? »**
> `useMemo` mémoïse une **valeur**, `useCallback` mémoïse une **fonction** (cas
> particulier de `useMemo`), `React.memo` empêche le **re-rendu d'un composant**
> si ses props n'ont pas changé (comparaison superficielle).
> **Le piège :** `React.memo` est inutile si tu lui passes un objet ou une
> fonction recréés à chaque rendu — d'où `useCallback`, qui sert surtout à ça.
> *(Honnête : je n'utilise pas `React.memo` ; mes composants coûteux sont peu
> nombreux et j'ai memoïsé les calculs plutôt que les rendus.)*

**« Comment tu débogues un problème de performance en React ? »**
> « Le Profiler des React DevTools : il me dit quel composant se re-rend et
> **pourquoi**. Ensuite je distingue "trop de rendus" (→ identité des props,
> memoïsation) de "un rendu trop cher" (→ `useMemo`, ou sortir le calcul du chemin
> de rendu). Sur l'extension Twitch, c'était les deux : re-rendus à chaque pixel
> du drag, et un calcul à 20 000 simulations. »

**« Comment tu recueilles le besoin utilisateur ? »**
> « Trois canaux : les retours directs des joueurs, l'analytics (j'instrumente les
> actions clés pour distinguer intention et usage réel), et ma propre pratique.
> Le bouton de partage est né d'un besoin exprimé ; la refonte du sélecteur, d'un
> bug qui n'existait que sur mobile — que je n'aurais jamais vu sans retour. »

**« Ta plus grosse erreur sur ce projet ? »**
> « Avoir dupliqué la logique de construction des stats à quatre endroits. Chaque
> nouvelle statistique doit être ajoutée aux quatre, et si j'en oublie un, l'effet
> disparaît **silencieusement** dans un des modes. Je l'ai d'abord documenté comme
> une check-list, puis j'ai commencé à extraire (`buildVariation.ts`). La leçon :
> la duplication ne fait pas mal quand on l'écrit, elle fait mal six mois plus
> tard. »

**« Que ferais-tu différemment si tu recommençais ? »**
> « Trois choses : `strict` dès le début ; des tests sur le moteur dès qu'il a eu
> un deuxième appelant ; et un `useReducer` pour l'état d'un emplacement plutôt
> qu'une dizaine de `useState` synchronisés par des effets. »

---

## 8. QUESTIONS À LEUR POSER (choisis-en 3)

1. Écrivez-vous des **composants Dash personnalisés en React**, ou React est-il
   sur une application séparée ?
2. À quoi ressemble votre pipeline de données en amont de Dash — pandas, une base,
   une API ? Quels volumes ?
3. Quelle est votre stratégie de tests aujourd'hui : pytest sur la logique, et
   côté UI ?
4. Comment se passe la revue de code ? *(montre que tu viens chercher ça)*
5. Qui sont les utilisateurs finaux de ces outils internes, et comment leurs
   retours remontent-ils jusqu'à vous ?
6. À quoi ressemblerait ma première contribution dans les 3 premiers mois ?

---

## 9. FICHE MÉMO — à relire 10 min avant

```
 PITCH        Simulateur de combat AoE4. Moteur pur TS (3 200 l.) + UI React.
              Un moteur → 3 interfaces (site, ~670 pages SSG, extension Twitch).
              5,4 Mo de données amont, nettoyées par une couche de patches.

 3 FORCES     1. Séparation moteur / données / UI   (= l'archi que Dash impose)
              2. Réutilisation : 1 hook pour 2 emplacements, 1 carte pour 4 usages
              3. Validation empirique documentée contre le jeu réel

 3 FAIBLESSES 1. Pas de tests auto → plan : Vitest sur combat.ts (fonctions pures)
   (assumées) 2. tsconfig permissif, 212 any → plan : strict fichier par fichier
              3. Sandbox.tsx trop gros → plan : extraire useVersus + VersusGrid

 SI JE BLOQUE  « Je ne sais pas — voilà comment je le vérifierais : … »
               (jamais d'invention : ils testent la réaction, pas le savoir)

 RÉFLEXE       Chaque réponse = 1 concept + 1 endroit dans mon code + 1 piège vécu.
```

**Le mot de la fin (si on te demande « pourquoi ce poste ») :**
> « Parce que j'ai passé un an à faire, seul, exactement ce que décrit l'annonce :
> transformer de la donnée brute en un outil que des gens utilisent pour décider.
> Ce qui me manque, ce n'est ni la motivation ni la capacité à livrer — c'est
> l'équipe : la revue de code, les conventions de tests, et des utilisateurs
> internes à qui parler directement. »
