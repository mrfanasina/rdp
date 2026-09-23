# Modélisation par Réseau de Pétri
## Centre de tri de colis avec contrôle qualité

---

## 1. Contexte et problématique

Un centre de tri postal dispose d'**une seule machine de tri
automatique**. Les colis arrivent, passent par la machine, puis un
contrôle qualité vérifie si le tri a été effectué correctement.

- Si le tri est **conforme**, le colis est expédié.
- Si le tri est **non conforme**, le colis retourne dans la file pour
  être retrié — mais seulement jusqu'à un nombre maximal de tentatives
  `K`. Au-delà, il est retiré du circuit automatique et rejeté pour
  traitement manuel.

**Objectif du modèle** : représenter ce système par un réseau de Pétri
coloré et temporisé, avec une boucle de reprise bornée par un compteur
d'essais, et démontrer que tout colis termine forcément par une
expédition ou un rejet (jamais de bouclage infini).

---

## 2. Types de jetons (couleurs)

- **Nombre d'essais déjà effectués** : entier `e ∈ {0, 1, ..., K}`
  (ex. K = 3).

Un jeton colis porte cette couleur dès son arrivée (`e = 0`) et elle est
incrémentée à chaque passage échoué dans la boucle de reprise.

---

## 3. Places

| Nom | Signification | Type de jeton | Capacité |
|---|---|---|---|
| **P1 — ColisEnAttente** | File d'attente avant passage en machine | Coloré (essai `e`) | Non plafonnée |
| **P2 — MachineLibre** | Disponibilité de la machine de tri | Neutre | 1 |
| **P3 — EnTri** | Colis en cours de traitement par la machine | Coloré (essai `e`) | 1 |
| **P4 — Controle** | Colis trié, en attente de vérification qualité | Coloré (essai `e`) | 1 |
| **P5 — Expedie** | Journal des colis correctement triés et expédiés | Coloré | Non bornée (journal) |
| **P6 — Rejete** | Journal des colis rejetés après `K` échecs | Coloré | Non bornée (journal) |

---

## 4. Transitions

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T1 — ArriveeColis** | — | `ColisEnAttente` (+1, `e = 0`) | Délai moyen entre deux arrivées | Temporisée |
| **T2 — DebutTri** | `ColisEnAttente` (1) + `MachineLibre` (1) | `EnTri` (1, même `e`) | `MachineLibre ≥ 1` | Immédiate |
| **T3 — FinTri** | `EnTri` (1) | `Controle` (1, même `e`) + `MachineLibre` (+1) | Durée de passage en machine écoulée | Temporisée |
| **T4 — ControleConforme** | `Controle` (1) | `Expedie` (1) | Résultat du contrôle : conforme | Immédiate |
| **T5 — RetriNecessaire** | `Controle` (1, essai `e`) | `ColisEnAttente` (1, essai `e+1`) | Résultat du contrôle : non conforme **et** `e < K` | Immédiate |
| **T6 — RejetDefinitif** | `Controle` (1, essai `e`) | `Rejete` (1) | Résultat du contrôle : non conforme **et** `e = K` | Immédiate |

T4, T5 et T6 sont en conflit sur le même jeton dans `Controle` : le
résultat du contrôle qualité (conforme ou non) détermine laquelle des
trois peut effectivement franchir, et pour T5/T6 la valeur de `e`
départage laquelle des deux s'applique.

---

## 5. Marquage initial

- `MachineLibre` = 1
- Toutes les autres places = 0

---

## 6. Délais

| Transition | Délai | Justification |
|---|---|---|
| T1 — ArriveeColis | Délai moyen entre deux arrivées | Flux de colis espacés dans le temps |
| T3 — FinTri | Durée fixe de passage en machine (ex. 5 s) | Temps de traitement mécanique |

---

## 6bis. Conventions de simulation (RdP ordinaire, dans l'application)

Le simulateur manipule un RdP **ordinaire** : la couleur `e` est donc
matérialisée par deux conventions, sans changer la structure du sujet
(P1..P6 / T1..T6 restent inchangés) :

- **P7 — TentativesRestantes** (compteur, `K` jetons au départ) :
  `e = K − jetons(P7)`. La garde « e < K » de T5 devient l'arc direct
  `P7 → T5` (tirer T5 **consomme** un crédit : `e` croît strictement) ;
  la garde « e = K » de T6 devient un **arc inhibiteur** `P7 → T6`
  (T6 ne peut tirer que lorsque P7 est **vide**).
- **P8 — StockArrivees** (2 colis au départ) : T1 est une transition
  **source** dans le sujet (toujours franchissable ⇒ simulation sans
  fin). Avec un stock fini, T1 se désactive quand P8 est vide et la
  simulation atteint un blocage final où tout colis est dans P5 ou P6 —
  c'est la démonstration de la propriété 3 ci-dessous.

---

## 7. Propriétés à démontrer

1. **Invariant de place** : `MachineLibre + EnTri = 1` en permanence. T2
   déplace un jeton de `MachineLibre` vers `EnTri`, T3 fait l'inverse ;
   aucune autre transition ne touche ces deux places.
2. **Bornage** : `EnTri` et `Controle` sont bornées à 1 par construction
   — conséquence directe de l'invariant ci-dessus, puisqu'un seul colis
   à la fois peut se trouver dans le pipeline machine + contrôle.
3. **Terminaison garantie (absence de bouclage infini)** : tout colis
   entré dans le système finit par atteindre `Expedie` ou `Rejete` en un
   nombre fini d'étapes. Démonstration par récurrence sur `e` : à chaque
   passage par T5, `e` augmente strictement ; comme `e` est borné par
   `K`, T6 devient obligatoire au plus tard après `K` échecs successifs
   — aucune boucle infinie n'est possible.
4. **Vivacité** : `DebutTri` (T2) est-elle toujours réactivable, c'est-à-
   dire la machine revient-elle systématiquement à l'état libre après
   chaque cycle, quel que soit le nombre de colis en attente ?
5. **Graphe de marquage réduit** : construire le graphe d'accessibilité
   (matrice d'incidence, séquences de franchissement) sur un cas réduit,
   par exemple `K = 1` (une seule reprise autorisée) avec 2 colis en
   attente, pour illustrer concrètement le cycle complet incluant un
   rejet définitif.

---

## 8. Extensions possibles

- Plusieurs machines de tri en parallèle (capacité de `MachineLibre` >
  1), avec répartition des colis entre elles.
- Priorité de passage pour les colis ayant déjà subi plusieurs échecs
  (éviter qu'ils restent trop longtemps en file derrière des arrivées
  plus récentes).
- Distinction de plusieurs types de non-conformité (couleur
  supplémentaire), avec des taux de reprise différents selon le type.
