# Sujet de projet — Réseaux de Pétri
## Gestion des transactions chez un agent Mobile Money
### Version 4 — recadrée sur la logique et le formalisme exacts du cours

---

## 0. Changelog

**Version 4 :**
10. Vérification faite dans le cours : **aucun outil externe n'est
    mentionné**, et le cours enseigne une méthode entièrement manuelle
    (matrice d'incidence, graphe de marquage à la main, arcs inhibiteurs
    tels que définis dans le cours). Section 9 réécrite en conséquence —
    plus de dépendance à TINA/CPN Tools.
11. T1 simplifiée : suppression de la loi exponentielle (non enseignée
    dans le cours) au profit d'un simple délai moyen nommé, dans le
    style de l'unique exercice temporisé du cours (location de voitures).
12. Section couleurs (§2) recadrée sur la présentation du cours : le RdP
    coloré y est enseigné comme un repliement de sous-réseaux identiques
    avec marquage en vecteur par couleur, pas comme une garde logique
    abstraite.

**Version 2-3 (passes précédentes) :**
1. Suppression de T4 (doublon avec T6/T7/T8/T9). La confirmation avant
   timeout est désormais représentée implicitement par le tir immédiat
   de T6/T7/T8/T9 en compétition avec T5 (temporisée).
2. T1 (arrivée client) reclassée en transition **temporisée/stochastique**
   (délai inter-arrivées), plus immédiate.
3. Suppression des capacités individuelles fixes sur `CaisseCash` et
   `SoldeElectronique` : seule la somme totale est un invariant (et
   uniquement à travers T6/T7 ; T11 l'augmente délibérément).
4. et 5. Chaque ressource est désormais scindée en deux paliers
   (`Normale` / `Réserve`), avec des **arcs inhibiteurs** pour tester la
   présence/absence de jetons (test structurel, contrairement à une garde
   `< 1` non réalisable). L'alerte se déclenche à l'épuisement du palier
   `Normale`, pendant que la `Réserve` est encore disponible → réellement
   préventif.
6. Reformulation de la propriété de bornage : distinction explicite entre
   places de fonctionnement (bornées par construction) et places de
   journal (non bornées, assumé — cohérent avec le tableau des places).

**Version 3 (2ᵉ passe) :**
7. **Correctif structurel majeur** : T9a/T9b n'avaient aucune entrée
   consommée, donc rien ne bornait structurellement le nombre de fois où
   elles pouvaient se retirer tant que `Normale = 0` restait vrai — la
   mention « capacité 1 » sur `AlerteRessourceBasse` n'était affirmée
   nulle part par un arc. Ajout d'un second arc inhibiteur sur T9a/T9b
   lui-même (`AlerteRessourceBasse(couleur) = 0`), exactement le même
   principe que la garde `< 1` déjà corrigée ailleurs, réapparue ici sous
   une autre forme. Cela borne aussi en cascade `ReapprovisionnementEnCours`
   (T10 ne peut consommer qu'un jeton d'`AlerteRessourceBasse` à la fois).
8. **Alerte redondante pendant un réapprovisionnement en cours** : ajout
   d'un troisième arc inhibiteur sur T9a/T9b (`ReapprovisionnementEnCours
   (couleur) = 0`), pour éviter qu'une alerte reparte si `Normale` retombe
   à 0 alors qu'un réapprovisionnement de cette même ressource est déjà en
   cours (comportement « level-triggered » résiduel signalé en revue).
9. **Distinction analyse qualitative / quantitative** : précision que le
   graphe de marquage de la section 7 se construit sur le **squelette non
   temporisé** du modèle (comme en TINA, en temps discret/intervalles) ;
   la loi exponentielle de T1 ne sert qu'à la simulation de performance,
   jamais à l'analyse qualitative (bornage, vivacité, deadlock).

---

## 1. Contexte et énoncé du problème

Un agent Mobile Money (type MVola, Orange Money, Airtel Money) reçoit des
clients pour effectuer trois types d'opérations : **dépôt**, **retrait**,
**transfert**. Pour fonctionner, l'agent gère deux ressources distinctes :

- **La caisse (cash)** : billets physiques disponibles.
- **Le solde électronique (e-value)** : crédit mobile disponible sur son
  compte agent.

Chaque type d'opération impacte ces deux ressources de manière opposée :

| Opération | Effet sur la caisse (cash) | Effet sur le solde électronique |
|---|---|---|
| **Dépôt** (le client donne du cash) | Caisse **augmente** | Solde électronique **diminue** (transféré au client) |
| **Retrait** (le client reçoit du cash) | Caisse **diminue** | Solde électronique **augmente** (reçu du client) |
| **Transfert** (client vers un autre client) | Aucun effet | Aucun effet direct (commission possible) |

Chaque ressource est gérée en deux paliers pour permettre une alerte
**préventive** : un palier `Normale` consommé en priorité, et un palier
`Réserve` consommé seulement quand le palier normal est épuisé — moment
où une alerte est déclenchée pour lancer le réapprovisionnement, sans
attendre la rupture totale.

Un client ne peut être servi que si l'agent est disponible (un seul
guichet, traitement séquentiel). Chaque transaction passe par une étape
de **confirmation** (code PIN reçu par SMS), avec un **délai limite**
au-delà duquel elle est automatiquement annulée (timeout).

**Objectif du modèle** : représenter ce système par un RdP coloré et
temporisé (avec arcs inhibiteurs), puis analyser sa capacité à fonctionner
sans blocage durable.

---

## 2. Types de jetons (couleurs)

- **Couleur "Type d'opération"** : `{Depot, Retrait, Transfert}`
- **Couleur "Ressource"** : `{Cash, Electronique}`
- Un jeton dans une place de ressource représente une **unité standard de
  valeur** (ex. 50 000 Ar par jeton).
- Un jeton client dans `ClientsEnAttente` porte la couleur "Type
  d'opération" correspondant à sa demande.

> **Cadrage sur le style du cours** : le cours présente le RdP coloré
> comme le **repliement de sous-réseaux structurellement identiques**
> (un sous-réseau par couleur, ex. machine produisant la pièce `a` et
> machine produisant la pièce `b`, fusionnées en un seul squelette), avec
> un marquage donné sous forme de **vecteur/matrice par couleur** plutôt
> que par une garde logique abstraite. On applique la même lecture ici :
> `TransactionEnCours`, `EnAttenteConfirmation`, `TransactionValidee` et
> `TransactionEchouee` peuvent se lire comme le repliement de trois
> sous-réseaux (un pour Depot, un pour Retrait, un pour Transfert), et
> leur marquage se note comme un vecteur à 3 colonnes, sur le modèle du
> tableau `<a><b>` donné en exemple dans le cours :
>
> | Place | Depot | Retrait | Transfert |
> |---|---|---|---|
> | TransactionEnCours | 0 | 0 | 0 |
> | EnAttenteConfirmation | 0 | 0 | 0 |
>
> (marquage initial : toutes les colonnes à 0, comme pour les autres
> places de fonctionnement).

---

## 3. Places

| Nom | Signification | Type de jeton | Capacité |
|---|---|---|---|
| **P1 — ClientsEnAttente** | Clients qui attendent d'être pris en charge | Coloré (Depot / Retrait / Transfert) | Non bornée (place de fonctionnement, mais non plafonnée structurellement — voir §7) |
| **P2 — AgentLibre** | Disponibilité du guichet | Neutre | 1 (structurel) |
| **P3a — CaisseCashNormale** | Cash disponible, palier normal | Neutre | Non plafonnée structurellement |
| **P3b — CaisseCashReserve** | Cash disponible, palier de réserve | Neutre | Non plafonnée structurellement |
| **P4a — SoldeElectroniqueNormal** | e-value disponible, palier normal | Neutre | Non plafonnée structurellement |
| **P4b — SoldeElectroniqueReserve** | e-value disponible, palier de réserve | Neutre | Non plafonnée structurellement |
| **P5 — TransactionEnCours** | Transaction prise en charge, en traitement | Coloré | 1 (structurel, un seul agent) |
| **P6 — EnAttenteConfirmation** | Transaction en attente de confirmation PIN | Coloré | 1 (structurel) |
| **P7 — TransactionValidee** | Historique des transactions réussies | Coloré | Non bornée (place de journal, assumé) |
| **P8 — TransactionEchouee** | Historique des transactions annulées | Coloré | Non bornée (place de journal, assumé) |
| **P9 — AlerteRessourceBasse** | Signal préventif : palier `Normale` épuisé pour une ressource | Coloré (Cash / Electronique) | 1 par ressource (structurel) |
| **P10 — ReapprovisionnementEnCours** | Réapprovisionnement en cours, en parallèle du service client | Coloré (Cash / Electronique) | 1 par ressource (structurel) |

---

## 4. Transitions

### Flux client (guichet)

| Nom | Entrées | Sorties | Condition / garde | Type |
|---|---|---|---|---|
| **T1 — ArriveeClient** | — | `ClientsEnAttente` (+1, coloré) | Délai moyen entre deux arrivées, noté `t_arrivee` (ex. 45 s) — dans le style de l'exercice « location de voitures » du cours (temps moyen entre deux demandes), sans loi de distribution formalisée | **Temporisée** |
| **T2 — DebutService** | `ClientsEnAttente` (1) + `AgentLibre` (1) | `TransactionEnCours` (1, même couleur) | Agent disponible | Immédiate |
| **T3 — EnvoiDemandeConfirmation** | `TransactionEnCours` (1) | `EnAttenteConfirmation` (1) | — | Immédiate, démarre le délai de T5 |
| **T5 — TimeoutConfirmation** | `EnAttenteConfirmation` (1) | `TransactionEchouee` (1) + `AgentLibre` (1) | Délai `d_confirm` (ex. 30 s) dépassé sans confirmation | **Temporisée** |
| **T8 — ValiderTransfert** | `EnAttenteConfirmation` (couleur=Transfert) | `TransactionValidee` + `AgentLibre` (1) | Confirmation reçue avant timeout | Immédiate, en compétition avec T5 |

> La confirmation reçue avant timeout n'est plus une transition séparée
> (ex-T4) : elle est représentée par le fait que T6/T7/T8/T9c/T9d tirent
> avant que T5 n'ait le temps de se déclencher (sémantique de compétition
> immédiate vs temporisée, standard en RdP temporisé).

### Validation dépôt (consomme e-value, produit du cash)

| Nom | Entrées | Sorties | Condition / garde | Type |
|---|---|---|---|---|
| **T6a — ValiderDepot_Normal** | `EnAttenteConfirmation` (Depot) + `SoldeElectroniqueNormal` (1) | `CaisseCashNormale` (+1) + `TransactionValidee` + `AgentLibre` (1) | `SoldeElectroniqueNormal ≥ 1` (arc direct) | Immédiate |
| **T6b — ValiderDepot_Reserve** | `EnAttenteConfirmation` (Depot) + `SoldeElectroniqueReserve` (1) | `CaisseCashNormale` (+1) + `TransactionValidee` + `AgentLibre` (1) | Arc inhibiteur : `SoldeElectroniqueNormal = 0` | Immédiate |
| **T9d — RessourceInsuffisante_Electronique** | `EnAttenteConfirmation` (Depot) | `TransactionEchouee` (1) + `AgentLibre` (1) | Arcs inhibiteurs : `SoldeElectroniqueNormal = 0` **et** `SoldeElectroniqueReserve = 0` | Immédiate |

### Validation retrait (consomme cash, produit de l'e-value)

| Nom | Entrées | Sorties | Condition / garde | Type |
|---|---|---|---|---|
| **T7a — ValiderRetrait_Normal** | `EnAttenteConfirmation` (Retrait) + `CaisseCashNormale` (1) | `SoldeElectroniqueNormal` (+1) + `TransactionValidee` + `AgentLibre` (1) | `CaisseCashNormale ≥ 1` (arc direct) | Immédiate |
| **T7b — ValiderRetrait_Reserve** | `EnAttenteConfirmation` (Retrait) + `CaisseCashReserve` (1) | `SoldeElectroniqueNormal` (+1) + `TransactionValidee` + `AgentLibre` (1) | Arc inhibiteur : `CaisseCashNormale = 0` | Immédiate |
| **T9c — RessourceInsuffisante_Cash** | `EnAttenteConfirmation` (Retrait) | `TransactionEchouee` (1) + `AgentLibre` (1) | Arcs inhibiteurs : `CaisseCashNormale = 0` **et** `CaisseCashReserve = 0` | Immédiate |

### Alerte préventive et réapprovisionnement (monitoring, indépendant du flux client)

| Nom | Entrées | Sorties | Condition / garde | Type |
|---|---|---|---|---|
| **T9a — SeuilBasCash** | — | `AlerteRessourceBasse` (Cash) | Arcs inhibiteurs : `CaisseCashNormale = 0` **et** `AlerteRessourceBasse(Cash) = 0` **et** `ReapprovisionnementEnCours(Cash) = 0` | Immédiate |
| **T9b — SeuilBasElectronique** | — | `AlerteRessourceBasse` (Electronique) | Arcs inhibiteurs : `SoldeElectroniqueNormal = 0` **et** `AlerteRessourceBasse(Electronique) = 0` **et** `ReapprovisionnementEnCours(Electronique) = 0` | Immédiate |
| **T10 — DeclencherReappro** | `AlerteRessourceBasse` (1) | `ReapprovisionnementEnCours` (1, même couleur) | — | Immédiate |
| **T11 — FinReappro** | `ReapprovisionnementEnCours` (1) | `CaisseCashNormale` (+K) ou `SoldeElectroniqueNormal` (+K) selon couleur | Délai `d_reappro` | **Temporisée** |

> `T9a`/`T9b` sont des transitions de **monitoring pur** : elles ne
> touchent ni `AgentLibre` ni `EnAttenteConfirmation`, elles surveillent
> seulement le niveau du palier `Normale` en continu, indépendamment de
> ce que fait le guichet à ce moment-là. C'est ce qui rend l'alerte
> réellement préventive : elle se déclenche dès que `Normale` est vide,
> pendant que `Réserve` permet encore de servir des clients.
>
> Les trois arcs inhibiteurs de T9a/T9b sont désormais tous nécessaires :
> le premier (`Normale = 0`) détecte le seuil bas ; le deuxième
> (`AlerteRessourceBasse = 0`) empêche la transition de se retirer en
> boucle tant que l'alerte n'a pas été consommée par T10 — sans lui,
> rien ne bornait structurellement `AlerteRessourceBasse`, et donc en
> cascade `ReapprovisionnementEnCours` ; le troisième
> (`ReapprovisionnementEnCours = 0`) empêche une alerte redondante si
> `Normale` retombe à 0 pendant qu'un réapprovisionnement de la même
> ressource est déjà en cours (cas : réappro qui remplit `Normale`, puis
> un nouveau retrait la vide à nouveau avant la fin du réappro).
> Même avec ces trois gardes, T9a/T9b restent des tests de niveau
> (« Normale est vide *en ce moment* »), pas des événements de
> transition d'état — limite classique des RdP non temporisés pour ce
> type d'alerte, mais suffisante ici puisque le comportement recherché
> (une seule alerte active à la fois par ressource, non redondante avec
> un réappro en cours) est bien garanti par construction.

---

## 5. Marquage initial

- `AgentLibre` = 1
- `CaisseCashNormale` = 15, `CaisseCashReserve` = 5 (total cash = 20)
- `SoldeElectroniqueNormal` = 15, `SoldeElectroniqueReserve` = 5 (total e-value = 20)
- Toutes les autres places = 0

---

## 6. Temporisations proposées

| Transition | Délai | Justification |
|---|---|---|
| T1 — ArriveeClient | Délai moyen `t_arrivee` ≈ 45 s | Modélise un flux de clients espacés dans le temps, pas une arrivée instantanée en masse |
| T5 — TimeoutConfirmation | 30 s | Délai standard de saisie d'un code PIN reçu par SMS |
| T11 — FinReappro | Cash : long (déplacement physique) ; Electronique : quasi immédiat (API) | Le réapprovisionnement cash nécessite un trajet, contrairement au rechargement électronique |

> **Note de cadrage** : le cours ne comporte pas de section théorique sur
> le RdP temporisé — un seul exercice (« location de voitures ») y
> recourt, avec des durées moyennes simples (t1, t2, d0…), sans notation
> formelle de délai ni loi de distribution. Les délais ci-dessus suivent
> donc volontairement ce même style simple (une durée moyenne nommée),
> plutôt que d'introduire un formalisme stochastique que le cours
> n'enseigne pas.
>
> Pour l'**analyse formelle** (bornage, vivacité, deadlock — section 7),
> on utilise le graphe de marquage tel qu'enseigné (construit à la main
> à partir de la matrice d'incidence `W = Post - Pre` et des séquences de
> franchissement `Mk = Mi + W·Sᵀ`) : T1, T5 et T11 y sont traitées comme
> des transitions ordinaires (le graphe ne dépend pas de la durée exacte,
> seulement de l'ordre de franchissement possible). Les délais moyens
> ci-dessus ne servent qu'à discuter qualitativement le comportement du
> système dans le rapport (ex. « le timeout de 30 s est-il cohérent avec
> le délai moyen d'arrivée de 45 s ? »), pas à un calcul stochastique.

---

## 7. Propriétés à analyser

1. **Absence de blocage (deadlock)** : le système peut-il atteindre un état
   où `CaisseCashNormale = CaisseCashReserve = 0` **et**
   `SoldeElectroniqueNormal = SoldeElectroniqueReserve = 0`
   simultanément, avec des clients en attente et aucun réapprovisionnement
   en cours ? Dans quelles conditions T9a/T9b/T10/T11 permettent-elles
   de l'éviter ?
2. **Bornage** — à traiter en deux temps distincts :
   - *Places de fonctionnement* (`AgentLibre`, `TransactionEnCours`,
     `EnAttenteConfirmation`, `AlerteRessourceBasse`,
     `ReapprovisionnementEnCours`) : bornées **par construction**
     (capacité 1, à vérifier formellement sur le graphe de marquage).
   - *Places de journal* (`TransactionValidee`, `TransactionEchouee`) :
     intentionnellement **non bornées** en régime permanent (tant que T1
     peut se redéclencher indéfiniment). Pour les borner formellement, il
     faudrait ajouter une borne globale sur le nombre total d'arrivées
     (ex. compteur décrémenté à chaque tir de T1, épuisé après N
     arrivées) — extension facultative, pas une propriété du modèle
     ouvert tel que décrit ici.
3. **Invariant de place** :
   `CaisseCashNormale + CaisseCashReserve + SoldeElectroniqueNormal +
   SoldeElectroniqueReserve` reste **constant** à travers T6a/T6b/T7a/T7b
   (ce sont des transferts internes de valeur), et n'**augmente** qu'à
   travers T11 (réapprovisionnement = injection de valeur externe). Cet
   invariant remplace celui de la version 1, qui était en contradiction
   avec des bornes individuelles fixes.
4. **Vivacité** : l'agent (`AgentLibre`) revient-il toujours, à terme,
   à un état où il peut accepter un nouveau client, quel que soit le
   scénario de consommation des paliers Normale/Réserve ?
5. **Graphe de marquage réduit** : construire le graphe d'accessibilité
   **à la main**, comme enseigné dans le cours — matrice d'incidence
   `W = Post - Pre`, puis séquences de franchissement `Mk = Mi + W·Sᵀ` —
   sur un cas volontairement petit, par exemple
   `CaisseCashNormale=1, CaisseCashReserve=1, SoldeElectroniqueNormal=1,
   SoldeElectroniqueReserve=1`, avec 2 clients en attente. Ce marquage
   réduit permet de voir concrètement le passage du palier Normale au
   palier Réserve, puis le déclenchement de l'alerte et de
   RessourceInsuffisante, sur un nombre de places/transitions limité
   (exclure T1/T11 du sous-réseau réduit si besoin, en fixant leurs
   franchissements comme des événements externes du scénario plutôt que
   des transitions du graphe).

---

## 8. Pistes d'extension (facultatif)

- Plusieurs agents pouvant se transférer du float entre eux.
- Priorité colorée entre types de transactions si la ressource est basse.
- File d'attente FIFO stricte modélisée par des places numérotées plutôt
  qu'une place unique non ordonnée.
- Borne globale sur T1 (nombre total d'arrivées) si l'on veut une analyse
  de bornage complète incluant les places de journal (voir §7.2).

---

## 9. Méthode de résolution — pas d'outil externe requis

Vérification faite : le cours **ne mentionne aucun logiciel** (ni TINA,
ni CPN Tools, ni autre) et enseigne une méthode entièrement manuelle,
directement applicable à ce modèle :

- **Arcs inhibiteurs** : le cours en donne la définition exacte utilisée
  ici (« arc terminé par un cercle, franchissable si la place
  correspondante n'est pas marquée — test à zéro ») avec un exemple
  travaillé (« service client », portes d'entrée/sortie avec capacité).
  Aucun contournement (garde ML, place complémentaire) n'est donc
  nécessaire : T6b/T7b/T9a/T9b/T9c/T9d se dessinent directement avec ce
  symbole, tel quel.
- **Analyse formelle** : matrice d'incidence `W = Post - Pre`, puis
  construction du graphe de marquage à la main via `Mk = Mi + W·Sᵀ`,
  exactement la méthode donnée en exemple dans le cours (section
  « Graphe de marquage »).
- **Bornage** : définition du k-bornage du cours (« Pi est k-bornée pour
  M0 s'il existe k tel que pour tout marquage accessible, m(Pi) ≤ k »),
  à appliquer directement aux places de fonctionnement (section 7.2).
- **RdP coloré** : présenté dans le cours comme repliement de
  sous-réseaux identiques avec marquage en vecteur par couleur (voir
  §2) — pas de garde logique abstraite à définir.
- **RdP temporisé** : le cours n'a pas de section théorique dédiée (un
  seul exercice, avec des durées moyennes simples) — les délais de ce
  modèle restent donc volontairement à ce niveau de simplicité (voir
  note en §6), sans notation formelle supplémentaire à apprendre.

Un outil de simulation (TINA, par exemple, qui suit un formalisme très
proche de celui du cours) reste utilisable en **bonus facultatif** pour
visualiser ou vérifier le modèle une fois construit à la main, mais
n'est pas requis pour traiter le sujet tel que formulé ici.
