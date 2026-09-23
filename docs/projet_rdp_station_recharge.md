# Modélisation par Réseau de Pétri
## Gestion d'une station de recharge pour véhicules électriques

---

## 1. Contexte et problématique

Une station de recharge dispose de **N points de charge** identiques.
Les véhicules arrivent, attendent si tous les points sont occupés, se
branchent dès qu'un point se libère, puis repartent une fois chargés.

Deux types de véhicules sont distingués :

- **Recharge rapide** : durée de charge courte.
- **Recharge standard** : durée de charge longue.

Si l'attente d'un véhicule dépasse un certain délai, il quitte la file
sans être chargé (abandon).

**Objectif du modèle** : représenter ce système par un réseau de Pétri
coloré et temporisé, avec une ressource unique partagée (les points de
charge), et démontrer son bon fonctionnement (bornage, absence de
blocage, invariant de capacité).

---

## 2. Types de jetons (couleurs)

- **Type de véhicule** : `{Rapide, Standard}`

Un jeton porte cette couleur dès son arrivée (`VehiculesEnAttente`) et
la conserve jusqu'à son départ (`EnCharge`, puis `Departs`).

---

## 3. Places

| Nom | Signification | Type de jeton | Capacité |
|---|---|---|---|
| **P1 — PointsLibres** | Points de charge disponibles | Neutre | N |
| **P2 — VehiculesEnAttente** | Véhicules en attente d'un point de charge | Coloré (Rapide / Standard) | Non plafonnée |
| **P3 — EnCharge** | Véhicules en cours de charge | Coloré (Rapide / Standard) | N |
| **P4 — Departs** | Journal des charges terminées | Coloré | Non bornée (journal) |
| **P5 — Abandons** | Journal des véhicules ayant quitté la file par timeout | Coloré | Non bornée (journal) |

---

## 4. Transitions

| Nom | Entrées | Sorties | Condition | Type |
|---|---|---|---|---|
| **T1 — ArriveeVehicule** | — | `VehiculesEnAttente` (+1, coloré selon le type) | Délai moyen entre deux arrivées | Temporisée |
| **T2 — DebutCharge** | `VehiculesEnAttente` (1) + `PointsLibres` (1) | `EnCharge` (1, même couleur) | `PointsLibres ≥ 1` | Immédiate |
| **T3 — FinCharge** | `EnCharge` (1) | `PointsLibres` (+1) + `Departs` (1, même couleur) | Durée de charge écoulée (dépend de la couleur) | Temporisée |
| **T4 — AbandonAttente** | `VehiculesEnAttente` (1) | `Abandons` (1, même couleur) | Délai d'attente maximal dépassé | Temporisée |

T2 (immédiate) et T4 (temporisée) sont en compétition pour un même
jeton dans `VehiculesEnAttente` : si un point se libère avant
l'expiration du délai d'attente, T2 prend le pas sur T4.

---

## 5. Marquage initial

- `PointsLibres` = N (ex. N = 6)
- Toutes les autres places = 0

---

## 6. Délais

| Transition | Délai | Justification |
|---|---|---|
| T1 — ArriveeVehicule | Délai moyen entre deux arrivées | Flux de véhicules espacés dans le temps |
| T3 — FinCharge (Rapide) | Court (ex. 20 min) | Recharge rapide |
| T3 — FinCharge (Standard) | Long (ex. 2 h) | Recharge standard |
| T4 — AbandonAttente | Délai d'attente maximal toléré (ex. 15 min) | Un client n'attend pas indéfiniment |

---

## 7. Propriétés à démontrer

1. **Bornage** : `EnCharge` est bornée par construction (`EnCharge ≤ N`),
   conséquence directe de l'invariant ci-dessous. `PointsLibres` est
   également bornée (`0 ≤ PointsLibres ≤ N`).
2. **Invariant de place** : `PointsLibres + EnCharge = N` en permanence.
   T2 déplace un jeton de `PointsLibres` vers `EnCharge`, T3 fait
   l'inverse ; T1 et T4 ne touchent aucune des deux places. L'invariant
   n'est donc jamais rompu.
3. **Absence de blocage** : le système ne peut pas se retrouver bloqué —
   un véhicule en attente est toujours soit éventuellement servi (dès
   qu'un point se libère via T3), soit abandonne (T4). Aucune ressource
   ne peut rester indéfiniment indisponible.
4. **Absence de famine** : un véhicule Standard peut-il attendre
   indéfiniment si les véhicules Rapides arrivent en continu et
   monopolisent les points de charge ? À démontrer sur le modèle FIFO
   simple (pas de priorité entre couleurs) ; propriété à réexaminer si
   une règle de priorité est ajoutée (voir extensions).
5. **Graphe de marquage réduit** : construire le graphe d'accessibilité
   (matrice d'incidence, séquences de franchissement) sur un cas réduit,
   par exemple N = 2 avec 2 véhicules en attente (1 Rapide, 1 Standard),
   pour illustrer concrètement l'alternance PointsLibres/EnCharge et le
   déclenchement d'un abandon.

---

## 8. Extensions possibles

- Règle de priorité colorée (ex. les véhicules Rapides passent devant si
  la file dépasse un certain seuil) — à mettre en balance avec la
  propriété d'absence de famine (point 4).
- Plusieurs stations avec redirection d'un véhicule vers une autre
  station si la file locale est trop longue.
- Réservation à l'avance d'un point de charge (place supplémentaire
  `PointsReserves`, distincte de `PointsLibres`).
