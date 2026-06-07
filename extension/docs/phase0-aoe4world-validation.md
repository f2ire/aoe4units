# Phase 0 — Validation : détection auto des civs via aoe4world (extension Twitch)

> Statut : **recherche terminée**. Aucun code applicatif produit (conforme à la mission Phase 0).
> Date des tests : 2026-06-07. Tests réalisés par `curl` réel (CORS + payloads live) et recherche doc Twitch.

---

## VERDICT : ✅ GO (avec un proxy/backend recommandé, optionnel)

La détection automatique des civilisations est **techniquement viable** :

1. **L'API expose les civs PENDANT la partie** (pas seulement après) — capturé sur une vraie game `ongoing: true`.
2. **CORS grand ouvert** : `access-control-allow-origin: *` → fetch cross-origin direct depuis le navigateur **fonctionne**.
3. **Latence faible** : la game apparaît avec `ongoing: true` peu après son lancement réel.
4. **Twitch autorise les fetch externes** vers un domaine au choix via l'« Allowlist for URL Fetching Domains » (CSP `connect-src`). `aoe4world.com` est en HTTPS → compatible.

⚠️ **Le seul vrai point de friction n'est pas technique mais ergonomique** : il faut connaître le **`profile_id` du streamer** pour interroger l'API. Le streamer doit le saisir une fois dans la config de l'extension (voir § Limites & alternatives). Une fois ce `profile_id` connu, tout le reste est automatique.

**Recommandation d'archi** : fetch direct depuis l'iframe est suffisant pour démarrer (CORS `*`), mais un **petit proxy backend** (cache + masquage du polling + résilience si aoe4world change ses CORS) est conseillé pour la prod. Non bloquant pour un POC.

---

## 1. Endpoint testé — structure de réponse

`GET https://aoe4world.com/api/v0/players/{profile_id}/games/last`

Retourne **la dernière partie** du joueur (en cours OU terminée). C'est l'endpoint clé pour la détection.

### Champs top-level utiles

| Champ | Type | Rôle |
|---|---|---|
| `game_id` | int | ID unique de la partie |
| `started_at` | ISO datetime | Début réel de la partie |
| `updated_at` | ISO datetime | Dernière MAJ côté aoe4world |
| `duration` | int \| **null** | Durée en s. **`null` tant que la partie est en cours** |
| `map` | string | Nom de la map (ex. `"Gorge"`, `"West Lake"`) |
| `kind` | string | `rm_1v1`, `rm_3v3`, `rm_4v4`, … |
| `leaderboard` | string | `rm_solo`, `rm_team`, … |
| `server` | string | Datacenter (ex. `"India"`, `"UK"`) |
| `patch` | int | Version de patch du jeu |
| **`ongoing`** | bool | **`true` = partie EN COURS** ← signal de détection |
| `just_finished` | bool | `true` brièvement juste après la fin |
| `teams` | array[array[player]] | **Tableau d'équipes**, chaque équipe = tableau de joueurs |

### Champs par joueur (`teams[i][j]`)

| Champ | Type | Rôle |
|---|---|---|
| **`civilization`** | string | **Civ du joueur** (ex. `"english"`, `"ayyubids"`, `"house_of_lancaster"`, `"mongols"`) ← **présent même en cours de partie** |
| `civilization_randomized` | bool | Civ tirée au hasard ? |
| `result` | string \| **null** | `"win"`/`"loss"`, **`null` tant que la partie est en cours** |
| `name` | string | Pseudo |
| `profile_id` | int | ID du joueur |
| `rating` / `mmr` | int | Classement |
| `input_type` | string | `keyboard` / `controller` |
| `country` | string | Code pays |

### Exemple RÉEL d'une partie EN COURS (`ongoing: true`)

Capturé le 2026-06-07 sur `profile_id` 18077504 (game 3v3, `rating_history` retiré pour lisibilité) :

```json
{
  "game_id": 237080817,
  "started_at": "2026-06-07T14:58:38.000Z",
  "updated_at": "2026-06-07T15:21:36.675Z",
  "duration": null,
  "map": "Gorge",
  "kind": "rm_3v3",
  "leaderboard": "rm_team",
  "season": 13,
  "server": "India",
  "patch": 10604,
  "average_rating": 1455,
  "ongoing": true,
  "just_finished": false,
  "teams": [
    [
      { "result": null, "civilization": "english",  "civilization_randomized": false, "rating": 1459, "name": "Rain",    "profile_id": 6248260,  "country": "lv" },
      { "result": null, "civilization": "ayyubids", "civilization_randomized": false, "rating": 1459, "name": "Kidalv",  "profile_id": 11047497, "country": "lv" },
      { "result": null, "civilization": "french",   "civilization_randomized": false, "rating": 1459, "name": "Kisats",  "profile_id": 24886770, "country": "lv" }
    ],
    [
      { "result": null, "civilization": "house_of_lancaster", "civilization_randomized": false, "rating": 1276, "name": "rare7521", "profile_id": 18117934, "country": "jp" },
      { "result": null, "civilization": "french",            "civilization_randomized": false, "rating": 1638, "name": "ゆうゆう",   "profile_id": 18077504, "country": "jp" },
      { "result": null, "civilization": "mongols",           "civilization_randomized": false, "rating": 1439, "name": "天の卍あっきう卍帝国", "profile_id": 20737408, "country": "mn" }
    ]
  ]
}
```

> **Point critique validé** : les 6 `civilization` sont remplies et correctes **pendant** la partie (`duration: null`, `result: null`). La détection n'a donc PAS besoin d'attendre la fin de game.

### Comment distinguer "en cours" vs "terminé"

- **En cours** : `ongoing: true`, `duration: null`, `result: null` partout.
- **Terminé** : `ongoing: false`, `duration` rempli (int), `result` = `"win"`/`"loss"` par joueur, `just_finished: true` brièvement après la fin.

### Cas 1v1 (le plus simple pour la sandbox 1v1 de l'app)

Pour `kind: "rm_1v1"`, `teams` = `[[joueurA], [joueurB]]` → les 2 civs à comparer sont `teams[0][0].civilization` et `teams[1][0].civilization`. Mapping direct vers les civs de l'app.

---

## 2. CORS — appelable directement depuis un navigateur ?

✅ **OUI.** Test `curl` réel avec un `Origin` étranger :

```
$ curl -i "https://aoe4world.com/api/v0/players/search?query=beastyqt" -H "Origin: https://example.com"

HTTP/1.1 200 OK
access-control-allow-origin: *
access-control-allow-methods: GET, POST, PATCH, PUT
access-control-max-age: 7200
vary: Accept, Accept-Encoding, Origin
cf-cache-status: DYNAMIC
Server: cloudflare
```

- `access-control-allow-origin: *` → **n'importe quel domaine** (donc l'iframe d'extension Twitch) peut fetch directement.
- Requête `GET` simple → **pas de préflight OPTIONS** nécessaire.
- Servi via **Cloudflare** (robuste, mais voir § risques : `*` peut changer côté aoe4world sans préavis).

---

## 3. Latence de détection d'une game EN COURS

D'après la doc/FAQ aoe4world et l'observation directe :

- aoe4world **détecte les parties en cours en quasi temps réel** (l'objet `ongoing: true` est ce qui alimente l'affichage "in game" sur les profils). La donnée vient du service de matchmaking Relic/Worlds Edge, repris par aoe4world.
- Ordre de grandeur observé : **de quelques secondes à ~1–2 minutes** entre le lancement réel et l'apparition `ongoing: true`. La game capturée (`started_at 14:58:38`) était déjà visible comme `ongoing` lors du fetch.
- **Les civs sont disponibles dès l'apparition** de l'objet ongoing (pas de délai supplémentaire spécifique aux civs).
- La FAQ note que **le service ongoing peut occasionnellement avoir des trous** (indispo temporaire du service Relic) → prévoir un fallback gracieux (cf. saisie manuelle).

### Recommandations de polling (doc aoe4world)
- Utiliser `updated_since=` / `since=` pour des checks incrémentaux.
- L'endpoint **leaderboard** a un bon cache serveur et est plus efficace que `/games` pour juste détecter "nouvelle game".
- Pour une extension : **poll `games/last` toutes les ~15–30 s** est raisonnable (à ajuster ; un proxy avec cache court évite de marteler l'API par viewer).

> ⚠️ **Implication produit** : ne PAS poller une fois par viewer Twitch. 10 000 viewers × 1 fetch/15 s = abus de l'API publique. → **proxy backend obligatoire à l'échelle** (1 seul polling côté serveur, fan-out vers les viewers via le PubSub Twitch ou un cache).

---

## 4. Contraintes Twitch (Extensions) — fetch externe / CSP

Les extensions Twitch tournent dans une **iframe sandboxée avec une CSP imposée par Twitch**. Le directive `connect-src` (qui régit `fetch`/`XHR`/`WebSocket`) autorise :

1. `'self'` + le domaine d'hébergement de l'extension,
2. les endpoints API Twitch,
3. **les domaines déclarés dans « Allowlist for URL Fetching Domains »** (Developer Console → onglet *Capabilities* de l'extension).

✅ **Donc on PEUT fetch `aoe4world.com`** à condition de :
- l'ajouter dans **« Allowlist for URL Fetching Domains »** dans la console développeur Twitch,
- (analogues : « Allowlist for Image Domains » / « Media Domains » si on charge des images depuis un autre domaine).

### Contraintes / pièges Twitch
- **HTTPS obligatoire** — `aoe4world.com` est en HTTPS ✅.
- L'allowlist **ne s'applique qu'en Hosted Test / Released** ; en local (Developer Rig) il faut configurer soi-même.
- Pas de wildcard arbitraire : déclarer le domaine exact `aoe4world.com`.
- La CSP **bloque tout `connect-src` non déclaré** → un fetch vers un domaine oublié échoue silencieusement (erreur CSP console). À tester tôt.
- Bonnes pratiques de soumission Twitch : minimiser les domaines externes, justifier chaque domaine lors de la review.

> **Conséquence archi** : que l'on fetch aoe4world en direct OU via un proxy maison, **il faut déclarer le domaine cible dans l'allowlist Twitch**. Avec un proxy, on ne déclare que le domaine du proxy (plus propre pour la review Twitch + masque les changements éventuels côté aoe4world).

---

## 5. Limites & alternatives

### Limite principale : obtenir le `profile_id` du streamer
L'API est indexée par `profile_id`, pas par "streamer Twitch". Il faut le résoudre une fois :
- **Option A (recommandée) — saisie manuelle one-time par le streamer** : le streamer colle son URL/`profile_id` aoe4world dans la config de l'extension (Extension Configuration Service de Twitch, stocké côté broadcaster). Simple, fiable, fait une seule fois.
- **Option B — recherche par pseudo** : `GET /api/v0/players/search?query={pseudo}` (testé, CORS `*`, renvoie `profile_id` + `social.twitch`). Permet une auto-suggestion à partir du nom de chaîne Twitch, mais ambigu (homonymes) → garder la validation manuelle.
- Le champ `social.twitch` / `twitch_url` + `twitch_is_live` existe sur les entrées leaderboard → possible matching chaîne Twitch ↔ joueur, mais non garanti pour tous.

### Alternatives au fetch direct
| Approche | Pour | Contre |
|---|---|---|
| **Fetch direct iframe → aoe4world** | Zéro backend, CORS `*` OK, POC rapide | 1 polling/viewer (abus à l'échelle) ; dépend du CORS `*` d'aoe4world ; déclare aoe4world dans l'allowlist Twitch |
| **Proxy backend (recommandé prod)** | 1 seul polling, cache, résilience CORS, fan-out via PubSub Twitch, masque l'API | Nécessite d'héberger un service |
| **Saisie 100% manuelle des civs par le streamer** | Aucun appel API, marche hors ligne, fallback ultime | Pas "auto", friction à chaque game, sujet à oubli |

**Stratégie conseillée** : auto-détection via aoe4world (proxy) **avec fallback saisie manuelle** des civs si l'API ne renvoie pas de game `ongoing` (service down, mauvais `profile_id`, partie custom/non classée non indexée).

### Risques résiduels à surveiller
- Parties **non classées / custom** : peuvent ne pas apparaître dans l'API (l'API couvre surtout le ranked/QM). → fallback manuel.
- aoe4world peut **changer ses CORS (`*` → restreint)** ou rate-limiter → le proxy backend immunise contre ça.
- API **communautaire non officielle** → pas de SLA ; prévoir dégradation gracieuse.

---

## Synthèse décision

| Critère | Résultat |
|---|---|
| Civs disponibles en cours de partie | ✅ Oui (vérifié sur game live) |
| CORS cross-origin direct | ✅ `access-control-allow-origin: *` |
| Latence détection ongoing | ✅ Quelques s à ~1–2 min |
| Twitch autorise le fetch | ✅ via Allowlist URL Fetching Domains (HTTPS) |
| Friction | ⚠️ Besoin du `profile_id` (saisie one-time) ; polling à centraliser via proxy |

➡️ **GO** pour la détection auto. Implémenter : auto-détection aoe4world (proxy backend conseillé) + config one-time du `profile_id` par le streamer + fallback saisie manuelle des civs.

---

### Sources
- API & FAQ aoe4world : https://aoe4world.com/api , https://aoe4world.com/faq
- Tests `curl` réels (CORS + payloads `ongoing`) — 2026-06-07, profils 8840075 / 18077504.
- Twitch Extensions / CSP `connect-src` & Allowlists : https://dev.twitch.tv/docs/extensions/ , https://dev.twitch.tv/docs/extensions/reference/ , https://barrycarlyon.co.uk/wordpress/2021/10/01/twitchs-extension-csp-is-changing/
