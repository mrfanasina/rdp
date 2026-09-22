# Modélisation par Réseau de Pétri
## Gestion des transactions chez un agent Mobile Money

---

## 1. Contexte et problématique

Un agent Mobile Money (type MVola, Orange Money, Airtel Money) reçoit des
clients pour effectuer trois types d'opérations : **dépôt**, **retrait**,
**transfert**. Pour fonctionner, l'agent gère deux ressources distinctes :

- **La caisse (cash)** : billets physiques disponibles.
- **Le solde électronique (e-value)** : crédit mobile disponible sur son
  compte agent.

Chaque type d'opération impacte ces deux ressources de manière opposée :

| Opération | Effet sur la caisse | Effet sur le solde électronique |
|---|---|---|
| **Dépôt** (le client donne du cash) | Augmente | Diminue (transféré au client) |
| **Retrait** (le client reçoit du cash) | Diminue | Augmente (reçu du client) |
| **Transfert** (client vers un autre client) | Aucun effet | Aucun effet direct (commission possible) |

Chaque ressource est gérée en deux paliers, pour permettre une alerte
**préventive** : un palier `Normale`, consommé en priorité, et un palier
`Réserve`, consommé seulement quand le palier normal est épuisé — moment
où une alerte est déclenchée pour lancer le réapprovisionnement, sans
attendre la rupture totale.

Un client ne peut être servi que si l'agent est disponible (un seul
guichet, traitement séquentiel). Chaque transaction passe par une étape
de **confirmation** (code PIN reçu par SMS), avec un **délai limite**
au-delà duquel elle est automatiquement annulée.

**Objectif du modèle** : représenter ce système par un réseau de Pétri
coloré et temporisé, puis démontrer sa capacité à fonctionner sans
blocage durable.

---

## 2. Types de jetons (couleurs)

- **Type d'opération** : `{Depot, Retrait, Transfert}`
- **Ressource** : `{Cash, Electronique}`
- Un jeton dans une place de ressource représente une unité standard de
  valeur (ex. 50 000 Ar par jeton).
- Un jeton client dans `ClientsEnAttente` porte la couleur correspondant
  à son type de demande.

---

## 3. Places

| Nom | Signification | Type de jeton | Capacité |
|---|---|---|---|
| **P1 — ClientsEnAttente** | Clients en attente d'être pris en charge | Coloré (Depot / Retrait / Transfert) | Non plafonnée |
| **P2 — AgentLibre** | Disponibilité du guichet | Neutre | 1 |
| **P3a — CaisseCashNormale** | Cash disponible, palier normal | Neutre | Non plafonnée |
| **P3b — CaisseCashReserve** | Cash disponible, palier de réserve | Neutre | Non plafonnée |
| **P4a — SoldeElectroniqueNormal** | e-value disponible, palier normal | Neutre | Non plafonnée |
| **P4b — SoldeElectroniqueReserve** | e-value disponible, palier de réserve | Neutre | Non plafonnée |
| **P5 — TransactionEnCours** | Transaction prise en charge, en traitement | Coloré | 1 |
| **P6 — EnAttenteConfirmation** | Transaction en attente de confirmation PIN | Coloré | 1 |
| **P7 — TransactionValidee** | Historique des transactions réussies | Coloré | Non bornée (journal) |
| **P8 — TransactionEchouee** | Historique des transactions annulées | Coloré | Non bornée (journal) |
| **P9 — AlerteRessourceBasse** | Signal préventif : palier Normale épuisé | Coloré (Cash / Electronique) | 1 par ressource |
| **P10 — ReapprovisionnementEnCours** | Réapprovisionnement en cours, en parallèle du service client | Coloré (Cash / Electronique) | 1 par ressource |

---

## 4. Transitions

### Flux client

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T1 — ArriveeClient** | — | `ClientsEnAttente` (+1, coloré) | Délai moyen entre deux arrivées | Temporisée |
| **T2 — DebutService** | `ClientsEnAttente` (1) + `AgentLibre` (1) | `TransactionEnCours` (1, même couleur) | Agent disponible | Immédiate |
| **T3 — EnvoiDemandeConfirmation** | `TransactionEnCours` (1) | `EnAttenteConfirmation` (1) | — | Immédiate |
| **T5 — TimeoutConfirmation** | `EnAttenteConfirmation` (1) | `TransactionEchouee` (1) + `AgentLibre` (1) | Délai de confirmation dépassé | Temporisée |
| **T8 — ValiderTransfert** | `EnAttenteConfirmation` (Transfert) | `TransactionValidee` + `AgentLibre` (1) | Confirmation reçue avant timeout | Immédiate, en compétition avec T5 |

La confirmation reçue avant timeout est représentée par le fait que
T6/T7/T8/T9c/T9d tirent avant que T5 ne se déclenche (compétition entre
transitions immédiates et transition temporisée).

### Validation dépôt (consomme e-value, produit du cash)

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T6a — ValiderDepot_Normal** | `EnAttenteConfirmation` (Depot) + `SoldeElectroniqueNormal` (1) | `CaisseCashNormale` (+1) + `TransactionValidee` + `AgentLibre` (1) | `SoldeElectroniqueNormal ≥ 1` | Immédiate |
| **T6b — ValiderDepot_Reserve** | `EnAttenteConfirmation` (Depot) + `SoldeElectroniqueReserve` (1) | `CaisseCashNormale` (+1) + `TransactionValidee` + `AgentLibre` (1) | Arc inhibiteur : `SoldeElectroniqueNormal = 0` | Immédiate |
| **T9d — RessourceInsuffisante_Electronique** | `EnAttenteConfirmation` (Depot) | `TransactionEchouee` (1) + `AgentLibre` (1) | Arcs inhibiteurs : `SoldeElectroniqueNormal = 0` et `SoldeElectroniqueReserve = 0` | Immédiate |

### Validation retrait (consomme cash, produit de l'e-value)

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T7a — ValiderRetrait_Normal** | `EnAttenteConfirmation` (Retrait) + `CaisseCashNormale` (1) | `SoldeElectroniqueNormal` (+1) + `TransactionValidee` + `AgentLibre` (1) | `CaisseCashNormale ≥ 1` | Immédiate |
| **T7b — ValiderRetrait_Reserve** | `EnAttenteConfirmation` (Retrait) + `CaisseCashReserve` (1) | `SoldeElectroniqueNormal` (+1) + `TransactionValidee` + `AgentLibre` (1) | Arc inhibiteur : `CaisseCashNormale = 0` | Immédiate |
| **T9c — RessourceInsuffisante_Cash** | `EnAttenteConfirmation` (Retrait) | `TransactionEchouee` (1) + `AgentLibre` (1) | Arcs inhibiteurs : `CaisseCashNormale = 0` et `CaisseCashReserve = 0` | Immédiate |

### Alerte préventive et réapprovisionnement

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T9a — SeuilBasCash** | — | `AlerteRessourceBasse` (Cash) | Arcs inhibiteurs : `CaisseCashNormale = 0` et `AlerteRessourceBasse(Cash) = 0` et `ReapprovisionnementEnCours(Cash) = 0` | Immédiate |
| **T9b — SeuilBasElectronique** | — | `AlerteRessourceBasse` (Electronique) | Arcs inhibiteurs : `SoldeElectroniqueNormal = 0` et `AlerteRessourceBasse(Electronique) = 0` et `ReapprovisionnementEnCours(Electronique) = 0` | Immédiate |
| **T10 — DeclencherReappro** | `AlerteRessourceBasse` (1) | `ReapprovisionnementEnCours` (1, même couleur) | — | Immédiate |
| **T11 — FinReappro** | `ReapprovisionnementEnCours` (1) | `CaisseCashNormale` (+K) ou `SoldeElectroniqueNormal` (+K) selon couleur | Délai de réapprovisionnement | Temporisée |

T9a/T9b sont des transitions de monitoring pur : indépendantes du flux
client, elles surveillent en continu le niveau du palier Normale. Le
premier arc inhibiteur détecte le seuil bas ; le deuxième empêche
l'alerte de se redéclencher tant qu'elle n'a pas été traitée par T10 ; le
troisième évite une alerte redondante si Normale retombe à 0 pendant
qu'un réapprovisionnement de la même ressource est déjà en cours.

---

## 5. Marquage initial

- `AgentLibre` = 1
- `CaisseCashNormale` = 15, `CaisseCashReserve` = 5
- `SoldeElectroniqueNormal` = 15, `SoldeElectroniqueReserve` = 5
- Toutes les autres places = 0

---

## 6. Délais

| Transition | Délai | Justification |
|---|---|---|
| T1 — ArriveeClient | ≈ 45 s (moyenne) | Flux de clients espacés dans le temps |
| T5 — TimeoutConfirmation | 30 s | Délai standard de saisie d'un code PIN reçu par SMS |
| T11 — FinReappro | Cash : long (déplacement physique) ; Electronique : quasi immédiat (API) | Le réapprovisionnement cash nécessite un trajet, contrairement au rechargement électronique |

---

## 7. Propriétés à démontrer

1. **Absence de blocage** : le système peut-il atteindre un état où
   `CaisseCashNormale = CaisseCashReserve = 0` **et**
   `SoldeElectroniqueNormal = SoldeElectroniqueReserve = 0`
   simultanément, avec des clients en attente et aucun
   réapprovisionnement en cours ? Dans quelles conditions T9a/T9b/T10/T11
   permettent-elles de l'éviter ?
2. **Bornage** — à distinguer selon le rôle de chaque place :
   - Places de fonctionnement (`AgentLibre`, `TransactionEnCours`,
     `EnAttenteConfirmation`, `AlerteRessourceBasse`,
     `ReapprovisionnementEnCours`) : bornées par construction (capacité
     1), à vérifier formellement sur le graphe de marquage.
   - Places de journal (`TransactionValidee`, `TransactionEchouee`) :
     non bornées en régime permanent, sauf à ajouter une borne globale
     sur le nombre total d'arrivées (extension facultative).
3. **Invariant de place** : `CaisseCashNormale + CaisseCashReserve +
   SoldeElectroniqueNormal + SoldeElectroniqueReserve` reste constant à
   travers T6a/T6b/T7a/T7b (transferts internes de valeur), et
   n'augmente qu'à travers T11 (injection de valeur externe).
4. **Vivacité** : l'agent revient-il toujours, à terme, à un état où il
   peut accepter un nouveau client ?
5. **Graphe de marquage réduit** : construire le graphe d'accessibilité
   (matrice d'incidence, séquences de franchissement) sur un cas réduit,
   par exemple `CaisseCashNormale=1, CaisseCashReserve=1,
   SoldeElectroniqueNormal=1, SoldeElectroniqueReserve=1`, avec 2 clients
   en attente — pour illustrer concrètement le passage du palier Normale
   au palier Réserve, puis le déclenchement de l'alerte et de
   RessourceInsuffisante.

---

## 8. Extensions possibles

- Plusieurs agents pouvant se transférer du float entre eux.
- Priorité colorée entre types de transactions si la ressource est basse.
- File d'attente FIFO stricte modélisée par des places numérotées plutôt
  qu'une place unique non ordonnée.
- Borne globale sur T1 pour une analyse de bornage complète incluant les
  places de journal.
