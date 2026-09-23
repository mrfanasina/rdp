// constants/petriConstants.ts
// ─────────────────────────────────────────────────────────────────────────
// Réseaux prédéfinis (presets) de l'application.
//
// SUJET PRINCIPAL : « Centre de tri de colis avec contrôle qualité »
//   — RdP coloré (couleur = nombre d'essais e ∈ {0..K}, K = 3) et temporisé
//   (docs/projet_rdp_centre_tri.md). Le simulateur manipule un RdP ordinaire :
//   le réseau ci-dessous garde la STRUCTURE du cours (P1..P6, T1..T6) et
//   matérialise la couleur e par un compteur P7 + un arc inhibiteur (§1 ci-
//   dessous). Deux places supplémentaires (P7, P8) sont des conventions de
//   simulation clairement documentées, le reste est exactement le sujet.
//
// ANCIENS SUJETS (conservés, chargeables via le sélecteur) :
//   • « Gestion d'une station de recharge pour véhicules électriques » —
//     RdP coloré (Rapide/Standard) et temporisé, N points partagés.
//   • « Gestion des transactions chez un agent Mobile Money » — RdP coloré/
//     temporisé avec arcs inhibiteurs (docs/sujet_rdp_mobile_money.md, v4).
//   • « Carrefour à feux tricolores » — l'exemple historique de l'application.
// ─────────────────────────────────────────────────────────────────────────

import type { PetriPlace, PetriTransition, PetriArc, Marking, PetriNetPreset } from "../types/petri";

/**
 * Forme d'un preset : exactement ce que `loadNet` attend, plus un titre
 * et un sous-titre pour la page de présentation / le sélecteur.
 */
export interface PetriNetPresetData {
  slug: PetriNetPreset;
  title: string;
  subtitle: string;
  statement: string;
  places: PetriPlace[];
  transitions: PetriTransition[];
  arcs: PetriArc[];
  initialMarking: Marking;
}

// ═════════════════════════════════════════════════════════════════════════
// 1bis. SUJET AJOUTÉ — Station de recharge pour véhicules électriques
// ═════════════════════════════════════════════════════════════════════════
//
// Structure IDENTIQUE au schéma du sujet (docs/projet_rdp_station_recharge.md) :
// 5 places (P1..P5) et 4 transitions (T1..T4) — la couleur du jeton
// (Rapide / Standard) ne change QUE le délai de T3 dans le sujet : pas de
// dépliage nécessaire, la structure ordinaire suffit.
//
// ≡ correspondance avec le sujet :
//   P1  PointsLibres        — N points de charge (N = 6 au marquage initial)
//   P2  VehiculesEnAttente  — file avant branchement (couleur Rapide/Standard)
//   P3  EnCharge            — véhicules en cours de charge (≤ N par l'invariant)
//   P4  Departs             — journal des charges terminées
//   P5  Abandons            — journal des départs par timeout
//
//   T1  ArriveeVehicule     (temporisée : délai moyen entre deux arrivées)
//   T2  DebutCharge         (immédiate : P2 + P1 → P3)
//   T3  FinCharge           (temporisée : 20 min Rapide / 2 h Standard)
//   T4  AbandonAttente      (temporisée : délai max ≈ 15 min ; P2 → P5)
//
// COMPÉTITION DU SUJET : T2 (immédiate) et T4 (temporisée) sont en
//   compétition sur un même jeton de P2 — si un point se libère avant
//   l'expiration du délai, T2 prend le pas sur T4. En simulation, ce
//   conflit se rejoue au clic (ou au hasard en mode Play).
//
// CONVENTION DE SIMULATION : P6 StockArrivees (2 véhicules au départ) —
//   T1 est une transition SOURCE dans le sujet (toujours franchissable ⇒
//   simulation infinie). Avec un stock fini, T1 se désactive quand P6 est
//   vide : tout véhicule finit dans P4 ou P5 et la simulation atteint un
//   blocage final — les propriétés §7 (bornage, invariant, absence de
//   blocage) se démontrent en jouant.
//
// LAYOUT : flux principal en ligne (T1 → P2 → T2 → P3 → T3 → P4), P1 au
//  -dessus de P3 (ressource), T4 → P5 en dessous, stock P6 au-dessus de T1.
// ═════════════════════════════════════════════════════════════════════════

const STATION_RECHARGE_PLACES: PetriPlace[] = [
  {
    id: "sr_stock", label: "P6", x: 90, y: 110,
    description: "StockArrivees (convention de simulation) — véhicules pas encore arrivés ; T1 les consomme un par un : quand P6 est vide, plus aucune arrivée et la simulation peut se TERMINER",
  },
  {
    id: "sr_attente", label: "P2", x: 260, y: 300,
    description: "VehiculesEnAttente — véhicules en attente d'un point de charge (colorés : Rapide / Standard) ; T2 et T4 sont en COMPÉTITION sur ces jetons",
  },
  {
    id: "sr_encharge", label: "P3", x: 560, y: 300,
    description: "EnCharge — véhicules en cours de charge (colorés : Rapide ≈ 20 min, Standard ≈ 2 h) ; bornée par N via l'invariant P1 + P3 = N",
  },
  {
    id: "sr_departs", label: "P4", x: 880, y: 300,
    description: "Departs — journal des charges terminées, véhicule rendu à la circulation (journal, non bornée : assumé)",
  },
  {
    id: "sr_points", label: "P1", x: 560, y: 140, capacity: 6,
    description: "PointsLibres — points de charge disponibles (N = 6) ; invariant de capacité : PointsLibres + EnCharge = N en permanence",
  },
  {
    id: "sr_abandons", label: "P5", x: 700, y: 470,
    description: "Abandons — journal des véhicules ayant quitté la file sans charger : délai d'attente maximal dépassé (journal, non bornée : assumé)",
  },
];

const STATION_RECHARGE_TRANSITIONS: PetriTransition[] = [
  {
    id: "sr_t_arrivee", label: "T1", x: 90, y: 300,
    description: "ArriveeVehicule — nouveau véhicule en file, coloré selon son type (temporisée : délai moyen entre deux arrivées) ; consomme un véhicule du stock P6 (convention de simulation)",
  },
  {
    id: "sr_t_debut", label: "T2", x: 410, y: 300,
    description: "DebutCharge — un point se libère, le véhicule se branche : consomme 1 jeton de P1 et un véhicule de P2 (immédiate ; en compétition avec T4 sur la file)",
  },
  {
    id: "sr_t_fin", label: "T3", x: 720, y: 300,
    description: "FinCharge — charge terminée : libère 1 point dans P1 et journalise le départ (temporisée : durée dépend de la couleur — Rapide ≈ 20 min, Standard ≈ 2 h)",
  },
  {
    id: "sr_t_abandon", label: "T4", x: 480, y: 470,
    description: "AbandonAttente — délai d'attente maximal dépassé : le véhicule quitte la file sans charger (temporisée ≈ 15 min ; en compétition avec T2)",
  },
];

const STATION_RECHARGE_ARCS: PetriArc[] = [
  // T1 : stock fini → file d'attente
  { id: "sr_a01", from: "sr_stock", to: "sr_t_arrivee", weight: 1 },
  { id: "sr_a02", from: "sr_t_arrivee", to: "sr_attente", weight: 1 },

  // T2 : P2 + P1 → P3 (branchement sur un point libre)
  { id: "sr_a03", from: "sr_attente", to: "sr_t_debut", weight: 1 },
  { id: "sr_a04", from: "sr_points", to: "sr_t_debut", weight: 1 },
  { id: "sr_a05", from: "sr_t_debut", to: "sr_encharge", weight: 1 },

  // T3 : P3 → P1 + P4 (charge finie, point rendu)
  { id: "sr_a06", from: "sr_encharge", to: "sr_t_fin", weight: 1 },
  { id: "sr_a07", from: "sr_t_fin", to: "sr_points", weight: 1 },
  { id: "sr_a08", from: "sr_t_fin", to: "sr_departs", weight: 1 },

  // T4 : P2 → P5 (abandon par timeout)
  { id: "sr_a09", from: "sr_attente", to: "sr_t_abandon", weight: 1 },
  { id: "sr_a10", from: "sr_t_abandon", to: "sr_abandons", weight: 1 },
];

// Marquage initial du sujet (§5) : N = 6 points libres, tout le reste à 0
// (+ convention de simulation : 2 véhicules dans le stock P6).
const STATION_RECHARGE_MARKING: Marking = {
  sr_points: 6,
  sr_stock: 2,
  sr_attente: 0,
  sr_encharge: 0,
  sr_departs: 0,
  sr_abandons: 0,
};

const STATION_RECHARGE_STATEMENT = `Énoncé — Gestion d'une station de recharge pour véhicules électriques

Une station de recharge dispose de N points de charge IDENTIQUES
(N = 6 au marquage initial). Les véhicules arrivent, attendent si tous
les points sont occupés, se branchent dès qu'un point se libère, puis
repartent une fois chargés. Deux types de véhicules sont distingués :
  • Recharge RAPIDE : durée de charge courte (≈ 20 min) ;
  • Recharge STANDARD : durée de charge longue (≈ 2 h).
Si l'attente d'un véhicule dépasse un certain délai (≈ 15 min), il quitte
la file sans être chargé (abandon).

Objectif du modèle : représenter ce système par un réseau de Pétri COLORÉ
(couleur = type de véhicule) et TEMPORISÉ (T1 : délai moyen entre
arrivées ; T3 : durée de charge dépendant de la couleur ; T4 : délai
d'abandon), avec une ressource partagée (les points de charge), et
démontrer son bon fonctionnement : bornage, absence de blocage, invariant
de capacité.

STRUCTURE : le réseau simulé ici garde exactement les places P1..P5 et
transitions T1..T4 du sujet — la couleur ne change que le délai de T3,
aucun dépliage n'est nécessaire. T2 (immédiate) et T4 (temporisée) sont
en COMPÉTITION sur un même jeton de P2 : si un point se libère avant
l'expiration du délai d'attente, T2 prend le pas sur T4.

CONVENTION DE SIMULATION : P6 StockArrivees = 2 véhicules. T1 est une
transition source dans le sujet (elle resterait toujours franchissable
et la simulation ne finirait jamais) : avec un stock fini, T1 se
désactive quand P6 est vide et la simulation atteint un blocage final où
tout véhicule est dans P4 ou P5.

Propriétés à démontrer : EnCharge ≤ N et 0 ≤ PointsLibres ≤ N ;
invariant PointsLibres + EnCharge = N (T2 et T3 déplacent le jeton,
T1/T4 n'y touchent pas) ; absence de blocage (un véhicule en attente est
toujours soit servi via T3, soit abandonne via T4) ; absence de famine
(à discuter : FIFO simple, pas de priorité entre couleurs).`;

// ═════════════════════════════════════════════════════════════════════════
// 2. SUJET PRINCIPAL — Centre de tri de colis avec contrôle qualité
// ═════════════════════════════════════════════════════════════════════════
//
// Structure IDENTIQUE au schéma du sujet : 6 places (P1..P6) et 6
// transitions (T1..T6), une seule de chaque — pas de dépliage.
//
// ≡ correspondance avec le sujet :
//   P1  ColisEnAttente    — file avant la machine
//   P2  MachineLibre      — ressource unique (capacité 1)
//   P3  EnTri             — colis en cours de tri (capacité 1)
//   P4  Controle          — colis trié, en attente du verdict qualité (cap. 1)
//   P5  Expedie           — journal des colis conformes
//   P6  Rejete            — journal des colis rejetés après K échecs
//
//   T1  ArriveeColis      (temporisée : délai moyen entre deux arrivées)
//   T2  DebutTri          (immédiate : P1 + P2 → P3)
//   T3  FinTri            (temporisée : durée fixe ≈ 5 s ; P3 → P4 + P2)
//   T4  ControleConforme  (immédiate : P4 → P5)
//   T5  RetriNecessaire   (immédiate : P4 → P1, garde e < K)
//   T6  RejetDefinitif    (immédiate : P4 → P6, garde e = K)
//
// COULEUR e (nombre d'essais) EN RdP ORDINAIRE — deux conventions de
// simulation, documentées dans l'énoncé affiché dans la légende :
//   • P7 TentativesRestantes (K = 3 jetons au départ) : e = K − jetons(P7).
//     La garde « e < K » de T5 devient un arc direct P7 → T5 (tirer T5
//     CONSOMME un crédit : e croît strictement, exactement la récurrence
//     du sujet) ; la garde « e = K » de T6 devient un ARC INHIBITEUR
//     P7 → T6 (T6 ne peut tirer que lorsque P7 est VIDE — définition
//     exacte du cours : « arc terminé par un cercle, franchissable si la
//     place correspondante n'est pas marquée »).
//   • P8 StockArrivees (2 colis au départ) : T1 est une transition SOURCE
//     dans le sujet (toujours franchissable ⇒ simulation infinie). Pour
//     pouvoir DEMONTRER la terminaison en simulation, T1 consomme un colis
//     d'un stock fini : quand P8 est vide, plus aucune arrivée, et tout
//     colis finit dans P5 ou P6 — la simulation atteint un blocage final
//     qui EST la propriété à démontrer.
//
// CONFLIT DU SUJET : T4, T5 et T6 sont en conflit sur le jeton de P4 —
//   le résultat du contrôle qualité départage T4 (conforme) de T5/T6
//   (non conforme), et la valeur de e départage T5 (e < K) de T6 (e = K).
//   En simulation interactive, ce conflit se rejoue au clic.
//
// LAYOUT : flux principal en ligne (T1 → P1 → T2 → P3 → T3 → P4 → T4 → P5),
//   la machine P2 sous P3, la boucle de reprise T5 + compteur P7 en dessous,
//   le rejet T6 → P6 en bas, le stock P8 au-dessus de T1.
// ═════════════════════════════════════════════════════════════════════════

const CENTRE_TRI_PLACES: PetriPlace[] = [
  {
    id: "p_stock", label: "P8", x: 90, y: 130,
    description: "StockArrivees (convention de simulation) — colis pas encore arrivés ; T1 les consomme un par un : quand P8 est vide, plus aucune arrivée et la simulation peut se TERMINER (propriété §7.3)",
  },
  {
    id: "p_attente", label: "P1", x: 240, y: 300,
    description: "ColisEnAttente — file d'attente avant passage en machine (colorée : la couleur d'un colis est son nombre d'essais e)",
  },
  {
    id: "p_entri", label: "P3", x: 490, y: 300, capacity: 1,
    description: "EnTri — colis en cours de traitement par la machine (capacité 1 : un seul colis à la fois)",
  },
  {
    id: "p_controle", label: "P4", x: 730, y: 300, capacity: 1,
    description: "Controle — colis trié, en attente de vérification qualité ; T4/T5/T6 sont en CONFLIT sur ce jeton",
  },
  {
    id: "p_expedie", label: "P5", x: 990, y: 300,
    description: "Expedie — journal des colis correctement triés et expédiés (place de journal, non bornée : assumé)",
  },
  {
    id: "p_machine", label: "P2", x: 490, y: 470, capacity: 1,
    description: "MachineLibre — disponibilité de l'unique machine de tri (1 jeton ; invariant MachineLibre + EnTri = 1)",
  },
  {
    id: "p_tentatives", label: "P7", x: 560, y: 600,
    description: "TentativesRestantes (compteur, K = 3) — matérialise la couleur e en RdP ordinaire : e = K − jetons(P7) ; T5 consomme un crédit (e < K), T6 exige P7 VIDE (e = K)",
  },
  {
    id: "p_rejete", label: "P6", x: 800, y: 730,
    description: "Rejete — journal des colis non conformes après K = 3 échecs, retirés du circuit automatique pour traitement manuel (journal, non bornée : assumé)",
  },
];

const CENTRE_TRI_TRANSITIONS: PetriTransition[] = [
  {
    id: "t_arrivee", label: "T1", x: 90, y: 300,
    description: "ArriveeColis — nouveau colis en file avec e = 0 (temporisée : délai moyen entre deux arrivées) ; consomme un colis du stock P8 (convention de simulation, voir P8)",
  },
  {
    id: "t_debut", label: "T2", x: 370, y: 300,
    description: "DebutTri — la machine prend un colis de P1 (MachineLibre requis) ; immédiate",
  },
  {
    id: "t_fin", label: "T3", x: 610, y: 300,
    description: "FinTri — fin du passage en machine, dépose le colis dans P4 et LIBÈRE P2 (temporisée : durée fixe ≈ 5 s)",
  },
  {
    id: "t_conforme", label: "T4", x: 860, y: 300,
    description: "ControleConforme — résultat du contrôle : conforme, le colis est expédié (immédiate ; en conflit avec T5 et T6 sur P4)",
  },
  {
    id: "t_retri", label: "T5", x: 730, y: 470,
    description: "RetriNecessaire — contrôle non conforme ET e < K : le colis retourne en P1 et CONSOMME un crédit de P7 (e croît strictement) ; immédiate, en conflit avec T4",
  },
  {
    id: "t_rejet", label: "T6", x: 560, y: 730,
    description: "RejetDefinitif — contrôle non conforme ET e = K : arc inhibiteur depuis P7 (T6 ne peut tirer que lorsque P7 est VIDE, plus aucun crédit) ; immédiate, en conflit avec T4",
  },
];

const CENTRE_TRI_ARCS: PetriArc[] = [
  // T1 : stock fini → file d'attente (e = 0)
  { id: "ct_a01", from: "p_stock", to: "t_arrivee", weight: 1 },
  { id: "ct_a02", from: "t_arrivee", to: "p_attente", weight: 1 },

  // T2 : P1 + P2 → P3 (début du tri)
  { id: "ct_a03", from: "p_attente", to: "t_debut", weight: 1 },
  { id: "ct_a04", from: "p_machine", to: "t_debut", weight: 1 },
  { id: "ct_a05", from: "t_debut", to: "p_entri", weight: 1 },

  // T3 : P3 → P4 + P2 (fin du tri, machine rendue)
  { id: "ct_a06", from: "p_entri", to: "t_fin", weight: 1 },
  { id: "ct_a07", from: "t_fin", to: "p_controle", weight: 1 },
  { id: "ct_a08", from: "t_fin", to: "p_machine", weight: 1 },

  // T4 : verdict conforme → expédition
  { id: "ct_a09", from: "p_controle", to: "t_conforme", weight: 1 },
  { id: "ct_a10", from: "t_conforme", to: "p_expedie", weight: 1 },

  // T5 : verdict non conforme, e < K → retri (consomme un crédit du compteur)
  { id: "ct_a11", from: "p_controle", to: "t_retri", weight: 1 },
  { id: "ct_a12", from: "p_tentatives", to: "t_retri", weight: 1 },
  { id: "ct_a13", from: "t_retri", to: "p_attente", weight: 1 },

  // T6 : verdict non conforme, e = K → rejet définitif
  //     (arc inhibiteur : P7 doit être VIDE — tous les crédits épuisés)
  { id: "ct_a14", from: "p_controle", to: "t_rejet", weight: 1 },
  { id: "ct_a15", from: "p_tentatives", to: "t_rejet", weight: 1, inhibitor: true },
  { id: "ct_a16", from: "t_rejet", to: "p_rejete", weight: 1 },
];

// Marquage initial : P8 = 2 colis à traiter, machine libre, K = 3 crédits
// de reprise ; tout le reste à 0 (§5 du sujet + conventions P7/P8).
const CENTRE_TRI_MARKING: Marking = {
  p_stock: 2,
  p_machine: 1,
  p_tentatives: 3,
  p_attente: 0,
  p_entri: 0,
  p_controle: 0,
  p_expedie: 0,
  p_rejete: 0,
};

const CENTRE_TRI_STATEMENT = `Énoncé — Centre de tri de colis avec contrôle qualité

Un centre de tri postal dispose d'UNE SEULE machine de tri automatique.
Les colis arrivent, passent par la machine, puis un contrôle qualité
vérifie si le tri a été effectué correctement :
  • tri CONFORME → le colis est expédié (P5) ;
  • tri NON CONFORME → le colis retourne dans la file pour être retrié,
    mais seulement jusqu'à un nombre maximal de tentatives K (= 3).
    Au-delà, il est retiré du circuit automatique et rejeté (P6) pour
    traitement manuel.

Objectif du modèle : représenter ce système par un réseau de Pétri COLORÉ
(la couleur d'un jeton colis est son nombre d'essais e ∈ {0..K}) et
TEMPORISÉ (T1 : délai moyen entre arrivées ; T3 : durée fixe de passage
en machine ≈ 5 s), avec une boucle de reprise bornée par le compteur
d'essais, et démontrer que tout colis termine forcément par une
EXPÉDITION ou un REJET — jamais de bouclage infini.

STRUCTURE : le réseau simulé ici garde exactement les places P1..P6 et
transitions T1..T6 du sujet. T4, T5 et T6 sont en CONFLIT sur le jeton
de P4 : le résultat du contrôle départage T4 (conforme) de T5/T6 (non
conforme), et la valeur de e départage T5 (e < K) de T6 (e = K).

CONVENTIONS DE SIMULATION (RdP ordinaire, la couleur e étant dépliée) :
  • P7 TentativesRestantes = K jetons au départ, donc e = K − jetons(P7).
    La garde « e < K » de T5 est l'arc direct P7 → T5 : tirer T5 consomme
    un crédit, donc e croît strictement à chaque reprise (récurrence du
    sujet). La garde « e = K » de T6 est l'ARC INHIBITEUR P7 → T6 (⊙) :
    T6 ne peut tirer que lorsque P7 est vide — définition exacte du cours
    (« arc terminé par un cercle, franchissable si la place n'est pas
    marquée »).
  • P8 StockArrivees = 2 colis : T1 est une transition source dans le
    sujet (elle resterait toujours franchissable et la simulation ne
    finirait jamais). Avec un stock fini, T1 se désactive quand P8 est
    vide et la simulation atteint un blocage final où tout colis est
    dans P5 ou P6 — c'est exactement la propriété de terminaison §7.3.

Propriétés à démontrer : invariant MachineLibre + EnTri = 1 ; bornage de
EnTri et Controle à 1 ; terminaison garantie par récurrence sur e (e
croît strictement à chaque T5, e ≤ K ⇒ T6 au plus tard après K échecs) ;
vivacité de T2 (la machine revient-elle toujours à l'état libre ?).`;

// ═════════════════════════════════════════════════════════════════════════
// 3. ANCIEN SUJET — Agent Mobile Money (Version 4 du sujet, conservé)
// ═════════════════════════════════════════════════════════════════════════
//
// Le sujet décrit un modèle COLORÉ (couleurs Opération = {Depot, Retrait,
// Transfert} et Ressource = {Cash, Electronique}). Le simulateur manipule
// un RdP ordinaire : on déplie donc les couleurs en transitions séparées,
// exactement comme le ferait CPN Tools au moment de la vérification
// d'accessibilité. Le nom affiché reste celui du sujet (T6a/T6b/T7a/T7b…)
// pour que le canevas, la légende et le rapport se correspondent.
//
// ≡ correspondance avec le sujet :
//   P1  ClientsEnAttente            (colorée Depot/Retrait/Transfert)
//   P2  AgentLibre                  (capacité 1)
//   P3a/P3b  CaisseCash{Normale,Réserve}
//   P4a/P4b  SoldeElectronique{Normale,Réserve}
//   P5  TransactionEnCours          (capacité 1)
//   P6  EnAttenteConfirmation       (capacité 1)
//   P7  TransactionValidee          (journal)
//   P8  TransactionEchouee          (journal)
//   P9  AlerteRessourceBasse        (colorée Cash/Electronique → dépliée en
//                                    P9c/P9e : 1 jeton max par ressource)
//   P10 ReapprovisionnementEnCours  (colorée → dépliée en P10c/P10e, via
//                                    T10a/T10b : 1 jeton max par ressource)
//
//   T1  ArriveeClient            (temporisée : délai moyen t_arrivee ≈ 45 s,
//                                style « location de voitures » du cours)
//   T2  DebutService
//   T3  EnvoiDemandeConfirmation (démarre le délai de T5)
//   T5  TimeoutConfirmation      (temporisée : 30 s)
//   T6a/T6b  ValiderDepot_{Normal,Réserve}   (Dépôt : e-value → cash)
//   T7a/T7b  ValiderRetrait_{Normal,Réserve} (Retrait : cash → e-value)
//   T8  ValiderTransfert
//   T9a/T9b  SeuilBas{Cash,Electronique}     (monitoring, 3 inhibiteurs)
//   T9c/T9d  RessourceInsuffisante_{Cash,Electronique}
//   T10 DeclencherReappro           (colorée → dépliée en T10a/T10b)
//   T11a/T11b FinReappro_{Cash,Electronique} (temporisée : d_reappro)
//
// ARCS INHIBITEURS : les gardes « = 0 » du sujet (paliers, alertes,
//   ressources insuffisantes) sont modélisés par des arcs inhibiteurs
//   (`inhibitor: true`, dessinés avec un cercle côté place) — définition
//   exacte du cours (« arc terminé par un cercle, franchissable si la place
//   correspondante n'est pas marquée ») : aucun contournement requis (§9 v4).
//
// CONFIRMATION AVANT TIMEOUT : le sujet (changelog v2, point 1) supprime
//   T4 : la confirmation n'est plus une transition dédiée, mais le fait
//   que T6/T7/T8 tirent avant T5 (compétition immédiate vs temporisée).
//   En simulation interactive, T5 reste franchissable en même temps que
//   T6a/T6b/T7a/T7b/T8 — au marquage où les deux sont possibles, c'est
//   un conflit : tirer T6…T8 = « confirmation reçue avant timeout », tirer
//   T5 = « timeout ». La sémantique de compétition du sujet est donc bien
//   rejouable à la main ou via Play (résolution aléatoire des conflits).
// ═════════════════════════════════════════════════════════════════════════

const MOBILE_MONEY_PLACES: PetriPlace[] = [
  // ── Flux client (ligne du haut, gauche → droite) ────────────────────
  {
    id: "p_clients", label: "P1", x: 250, y: 80,
    description: "ClientsEnAttente — clients qui attendent d'être pris en charge (colorés : Depot / Retrait / Transfert)",
  },
  {
    id: "p_tx_en_cours", label: "P5", x: 540, y: 80, capacity: 1,
    description: "TransactionEnCours — transaction prise en charge, en traitement (1 max : un seul agent)",
  },
  {
    id: "p_attente_conf", label: "P6", x: 830, y: 80, capacity: 1,
    description: "EnAttenteConfirmation — transaction en attente du code PIN reçu par SMS (délai limite 30 s)",
  },
  {
    id: "p_validees", label: "P7", x: 1105, y: 60,
    description: "TransactionValidee — historique des transactions réussies (place de journal, non bornée : assumé)",
  },

  // ── Agent (centre) & journaux ───────────────────────────────────────
  {
    id: "p_agent", label: "P2", x: 585, y: 205, capacity: 1,
    description: "AgentLibre — disponibilité du guichet (1 jeton : un seul guichet, traitement séquentiel)",
  },
  {
    id: "p_echouees", label: "P8", x: 1160, y: 260,
    description: "TransactionEchouee — historique des transactions annulées (timeout ou ressource insuffisante) — journal, non bornée : assumé",
  },

  // ── Ressources en deux paliers ──────────────────────────────────────
  {
    id: "p_el_normale", label: "P4a", x: 660, y: 405,
    description: "SoldeElectroniqueNormal — e-value disponible, palier normal (consommé en priorité)",
  },
  {
    id: "p_cash_normale", label: "P3a", x: 590, y: 635,
    description: "CaisseCashNormale — billets disponibles, palier normal (consommé en priorité)",
  },
  {
    id: "p_cash_reserve", label: "P3b", x: 250, y: 800,
    description: "CaisseCashReserve — palier de réserve, consommé seulement quand le palier normal est épuisé (via T7b, garde Normale = 0)",
  },
  {
    id: "p_el_reserve", label: "P4b", x: 880, y: 830,
    description: "SoldeElectroniqueReserve — palier de réserve de l'e-value (via T6b, garde Normale = 0)",
  },

  // ── Monitoring / réapprovisionnement ────────────────────────────────
  // P9/P10 sont colorées (Cash / Electronique) : le dépliage crée une
  // place par ressource, conformément au sujet (« 1 par ressource ») —
  // une alerte cash et une alerte e-value peuvent coexister.
  {
    id: "p_alerte_cash", label: "P9c", x: 620, y: 1090,
    description: "AlerteRessourceBasse(Cash) — signal préventif : palier Normale du cash épuisé (dépliage de P9 colorée, 1 jeton max)",
  },
  {
    id: "p_alerte_el", label: "P9e", x: 1060, y: 1100,
    description: "AlerteRessourceBasse(Electronique) — signal préventif : palier Normale de l'e-value épuisé (dépliage de P9 colorée, 1 jeton max)",
  },
  {
    id: "p_reappro_cash", label: "P10c", x: 760, y: 830,
    description: "ReapprovisionnementEnCours(Cash) — réappro cash en parallèle du service client (dépliage de P10 colorée, 1 jeton max)",
  },
  {
    id: "p_reappro_el", label: "P10e", x: 1080, y: 840,
    description: "ReapprovisionnementEnCours(Electronique) — réappro e-value en parallèle du service client (dépliage de P10 colorée, 1 jeton max)",
  },
];

const MOBILE_MONEY_TRANSITIONS: PetriTransition[] = [
  // ── Flux client (ligne du haut) ─────────────────────────────────────
  {
    id: "t_arrivee", label: "T1", x: 110, y: 80,
    description: "ArriveeClient — nouveau client (temporisée : délai moyen t_arrivee ≈ 45 s entre deux arrivées)",
  },
  {
    id: "t_debut_service", label: "T2", x: 395, y: 80,
    description: "DebutService — l'agent prend en charge le client en tête de file (AgentLibre requis)",
  },
  {
    id: "t_envoi_conf", label: "T3", x: 680, y: 80,
    description: "EnvoiDemandeConfirmation — envoi du PIN par SMS, démarre le délai de T5 (30 s)",
  },
  {
    id: "t_valider_transfert", label: "T8", x: 965, y: 115,
    description: "ValiderTransfert — transfert confirmé avant timeout (aucune ressource consommée, commission éventuelle) ; en compétition avec T5",
  },
  {
    id: "t_timeout", label: "T5", x: 1135, y: 365,
    description: "TimeoutConfirmation — délai d_confirm (30 s) dépassé sans confirmation : transaction annulée, agent libéré",
  },

  // ── Validation retrait (cash → e-value), branche gauche ────────────
  {
    id: "t_retrait_normal", label: "T7a", x: 435, y: 465,
    description: "ValiderRetrait_Normal — retrait validé avec le palier normal de cash : cash −1, e-value +1",
  },
  {
    id: "t_retrait_reserve", label: "T7b", x: 435, y: 695,
    description: "ValiderRetrait_Reserve — retrait validé sur la réserve de cash (arc inhibiteur : CaisseCashNormale = 0)",
  },
  {
    id: "t_insuffisant_cash", label: "T9c", x: 195, y: 665,
    description: "RessourceInsuffisante_Cash — retrait échoué : paliers normal ET réserve de cash vides (2 arcs inhibiteurs)",
  },

  // ── Validation dépôt (e-value → cash), branche droite ──────────────
  {
    id: "t_depot_normal", label: "T6a", x: 885, y: 495,
    description: "ValiderDepot_Normal — dépôt validé avec le palier normal d'e-value : e-value −1, cash +1",
  },
  {
    id: "t_depot_reserve", label: "T6b", x: 860, y: 720,
    description: "ValiderDepot_Reserve — dépôt validé sur la réserve d'e-value (arc inhibiteur : SoldeElectroniqueNormal = 0)",
  },
  {
    id: "t_insuffisant_el", label: "T9d", x: 1140, y: 455,
    description: "RessourceInsuffisante_Electronique — dépôt échoué : paliers normal ET réserve d'e-value vides (2 arcs inhibiteurs)",
  },

  // ── Alerte préventive (monitoring pur, bas du schéma) ──────────────
  {
    id: "t_seuil_cash", label: "T9a", x: 480, y: 1000,
    description: "SeuilBasCash — alerte préventive : CaisseCashNormale = 0, aucune alerte cash active, aucun réappro cash en cours (3 arcs inhibiteurs)",
  },
  {
    id: "t_seuil_el", label: "T9b", x: 970, y: 1105,
    description: "SeuilBasElectronique — alerte préventive : SoldeElectroniqueNormal = 0, aucune alerte e-value active, aucun réappro e-value en cours (3 arcs inhibiteurs)",
  },

  // ── Réapprovisionnement ─────────────────────────────────────────────
  // T10 est colorée dans le sujet : dépliée en T10a (cash) / T10b (e-value).
  {
    id: "t_declencher_reappro_cash", label: "T10a", x: 750, y: 960,
    description: "DeclencherReappro(Cash) — l'alerte cash devient un réappro cash en cours (dépliage de T10 colorée)",
  },
  {
    id: "t_declencher_reappro_el", label: "T10b", x: 1200, y: 975,
    description: "DeclencherReappro(Electronique) — l'alerte e-value devient un réappro e-value en cours (dépliage de T10 colorée)",
  },
  {
    id: "t_fin_reappro_cash", label: "T11a", x: 700, y: 710,
    description: "FinReappro(Cash) — injection de K jetons dans CaisseCashNormale (temporisée : d_reappro, déplacement physique)",
  },
  {
    id: "t_fin_reappro_el", label: "T11b", x: 1040, y: 715,
    description: "FinReappro(Electronique) — injection de K jetons dans SoldeElectroniqueNormal (temporisée : quasi immédiat, API)",
  },
];

// ── Arcs ────────────────────────────────────────────────────────────────
// Convention : P → T = pré-condition, T → P = effet. `inhibitor: true`
// = test de zéro (la place doit être VIDE ; rien n'est consommé au tir).
const MOBILE_MONEY_ARCS: PetriArc[] = [
  // T1 : arrivée → clients
  { id: "mm_a01", from: "t_arrivee", to: "p_clients", weight: 1 },

  // T2 : clients + agent → tx en cours
  { id: "mm_a02", from: "p_clients", to: "t_debut_service", weight: 1 },
  { id: "mm_a03", from: "p_agent", to: "t_debut_service", weight: 1 },
  { id: "mm_a04", from: "t_debut_service", to: "p_tx_en_cours", weight: 1 },

  // T3 : tx en cours → attente confirmation
  { id: "mm_a05", from: "p_tx_en_cours", to: "t_envoi_conf", weight: 1 },
  { id: "mm_a06", from: "t_envoi_conf", to: "p_attente_conf", weight: 1 },

  // T5 (timeout) : attente conf → échouées + agent libéré
  { id: "mm_a07", from: "p_attente_conf", to: "t_timeout", weight: 1 },
  { id: "mm_a08", from: "t_timeout", to: "p_echouees", weight: 1 },
  { id: "mm_a09", from: "t_timeout", to: "p_agent", weight: 1 },

  // T8 (transfert confirmé) : attente conf → validées + agent libéré
  { id: "mm_a10", from: "p_attente_conf", to: "t_valider_transfert", weight: 1 },
  { id: "mm_a11", from: "t_valider_transfert", to: "p_validees", weight: 1 },
  { id: "mm_a12", from: "t_valider_transfert", to: "p_agent", weight: 1 },

  // ── Dépôt (T6a/T6b/T9d) : consomme e-value, produit cash ──
  { id: "mm_a13", from: "p_attente_conf", to: "t_depot_normal", weight: 1 },
  { id: "mm_a14", from: "p_el_normale", to: "t_depot_normal", weight: 1 },
  { id: "mm_a15", from: "t_depot_normal", to: "p_cash_normale", weight: 1 },
  { id: "mm_a16", from: "t_depot_normal", to: "p_validees", weight: 1 },
  { id: "mm_a17", from: "t_depot_normal", to: "p_agent", weight: 1 },

  { id: "mm_a18", from: "p_attente_conf", to: "t_depot_reserve", weight: 1 },
  { id: "mm_a19", from: "p_el_reserve", to: "t_depot_reserve", weight: 1 },
  { id: "mm_a20", from: "t_depot_reserve", to: "p_cash_normale", weight: 1 },
  { id: "mm_a21", from: "t_depot_reserve", to: "p_validees", weight: 1 },
  { id: "mm_a22", from: "t_depot_reserve", to: "p_agent", weight: 1 },
  { id: "mm_a23", from: "p_el_normale", to: "t_depot_reserve", weight: 1, inhibitor: true },

  { id: "mm_a24", from: "p_attente_conf", to: "t_insuffisant_el", weight: 1 },
  { id: "mm_a25", from: "p_el_normale", to: "t_insuffisant_el", weight: 1, inhibitor: true },
  { id: "mm_a26", from: "p_el_reserve", to: "t_insuffisant_el", weight: 1, inhibitor: true },
  { id: "mm_a27", from: "t_insuffisant_el", to: "p_echouees", weight: 1 },
  { id: "mm_a28", from: "t_insuffisant_el", to: "p_agent", weight: 1 },

  // ── Retrait (T7a/T7b/T9c) : consomme cash, produit e-value ──
  { id: "mm_a29", from: "p_attente_conf", to: "t_retrait_normal", weight: 1 },
  { id: "mm_a30", from: "p_cash_normale", to: "t_retrait_normal", weight: 1 },
  { id: "mm_a31", from: "t_retrait_normal", to: "p_el_normale", weight: 1 },
  { id: "mm_a32", from: "t_retrait_normal", to: "p_validees", weight: 1 },
  { id: "mm_a33", from: "t_retrait_normal", to: "p_agent", weight: 1 },

  { id: "mm_a34", from: "p_attente_conf", to: "t_retrait_reserve", weight: 1 },
  { id: "mm_a35", from: "p_cash_reserve", to: "t_retrait_reserve", weight: 1 },
  { id: "mm_a36", from: "t_retrait_reserve", to: "p_el_normale", weight: 1 },
  { id: "mm_a37", from: "t_retrait_reserve", to: "p_validees", weight: 1 },
  { id: "mm_a38", from: "t_retrait_reserve", to: "p_agent", weight: 1 },
  { id: "mm_a39", from: "p_cash_normale", to: "t_retrait_reserve", weight: 1, inhibitor: true },

  { id: "mm_a40", from: "p_attente_conf", to: "t_insuffisant_cash", weight: 1 },
  { id: "mm_a41", from: "p_cash_normale", to: "t_insuffisant_cash", weight: 1, inhibitor: true },
  { id: "mm_a42", from: "p_cash_reserve", to: "t_insuffisant_cash", weight: 1, inhibitor: true },
  { id: "mm_a43", from: "t_insuffisant_cash", to: "p_echouees", weight: 1 },
  { id: "mm_a44", from: "t_insuffisant_cash", to: "p_agent", weight: 1 },

  // ── Alerte préventive (monitoring pur) ──
  // T9a (seuil bas cash) : 3 inhibiteurs = Normale vide + pas d'alerte
  // cash active + pas de réappro cash en cours (changelog v3, points 7-8).
  { id: "mm_a45", from: "p_cash_normale", to: "t_seuil_cash", weight: 1, inhibitor: true },
  { id: "mm_a46", from: "p_alerte_cash", to: "t_seuil_cash", weight: 1, inhibitor: true },
  { id: "mm_a47", from: "p_reappro_cash", to: "t_seuil_cash", weight: 1, inhibitor: true },
  { id: "mm_a48", from: "t_seuil_cash", to: "p_alerte_cash", weight: 1 },

  // T9b (seuil bas e-value) : mêmes 3 inhibiteurs pour l'e-value
  { id: "mm_a49", from: "p_el_normale", to: "t_seuil_el", weight: 1, inhibitor: true },
  { id: "mm_a50", from: "p_alerte_el", to: "t_seuil_el", weight: 1, inhibitor: true },
  { id: "mm_a51", from: "p_reappro_el", to: "t_seuil_el", weight: 1, inhibitor: true },
  { id: "mm_a52", from: "t_seuil_el", to: "p_alerte_el", weight: 1 },

  // T10a/T10b : alerte → réappro en cours (même couleur de ressource)
  { id: "mm_a53", from: "p_alerte_cash", to: "t_declencher_reappro_cash", weight: 1 },
  { id: "mm_a54", from: "t_declencher_reappro_cash", to: "p_reappro_cash", weight: 1 },
  { id: "mm_a53b", from: "p_alerte_el", to: "t_declencher_reappro_el", weight: 1 },
  { id: "mm_a54b", from: "t_declencher_reappro_el", to: "p_reappro_el", weight: 1 },

  // T11a/T11b : fin de réappro → refill du palier Normale (K = 5 jetons)
  { id: "mm_a55", from: "p_reappro_cash", to: "t_fin_reappro_cash", weight: 1 },
  { id: "mm_a56", from: "t_fin_reappro_cash", to: "p_cash_normale", weight: 5 },
  { id: "mm_a57", from: "p_reappro_el", to: "t_fin_reappro_el", weight: 1 },
  { id: "mm_a58", from: "t_fin_reappro_el", to: "p_el_normale", weight: 5 },
];

const MOBILE_MONEY_MARKING: Marking = {
  p_agent: 1,
  p_cash_normale: 15, p_cash_reserve: 5,
  p_el_normale: 15, p_el_reserve: 5,
  p_clients: 0, p_tx_en_cours: 0, p_attente_conf: 0,
  p_validees: 0, p_echouees: 0,
  p_alerte_cash: 0, p_alerte_el: 0, p_reappro_cash: 0, p_reappro_el: 0,
};

const MOBILE_MONEY_STATEMENT = `Énoncé — Gestion des transactions chez un agent Mobile Money (v4)

Un agent Mobile Money (type MVola, Orange Money, Airtel Money) reçoit des
clients pour trois types d'opérations : dépôt, retrait, transfert. Il gère
deux ressources : la caisse (cash, billets physiques) et le solde
électronique (e-value). Chaque opération impacte les deux ressources de
manière opposée : un dépôt transforme de l'e-value en cash, un retrait
transforme du cash en e-value, un transfert ne touche ni l'un ni l'autre.

Chaque ressource est gérée en deux paliers — Normale et Réserve — pour
permettre une alerte PRÉVENTIVE : le palier Normale est consommé en
priorité ; quand il s'épuise, une alerte (T9a/T9b) se déclenche et lance
un réapprovisionnement (T10/T11) pendant que la Réserve permet encore de
servir des clients. Un client ne peut être servi que si l'agent est
disponible (un seul guichet) ; chaque transaction attend une confirmation
PIN par SMS avec un délai limite (T5 = 30 s) : tirer T6/T7/T8 avant T5
signifie « confirmation reçue à temps », tirer T5 signifie « timeout ».

Modèle : RdP coloré et temporisé avec arcs inhibiteurs, dans le formalisme
exact du cours (arcs inhibiteurs = « arc terminé par un cercle, test à
zéro » ; analyse par matrice d'incidence W = Post − Pre et graphe de
marquage Mk = Mi + W·Sᵀ construits à la main ; délais moyens simples pour
les transitions temporisées T1/T5/T11, sans loi de distribution). Le
réseau simulé ici est la version DÉPLIÉE par couleurs : une transition
concrète par opération × palier (T6a/T6b, T7a/T7b…), une alerte/réappro
par ressource (T9a/T9b, T10a/T10b, T11a/T11b). Objectif de l'analyse :
prouver l'absence de blocage durable (deadlock) grâce au monitoring
préventif.`;

// ═════════════════════════════════════════════════════════════════════════
// 4. SUJET DE DÉMO — Carrefour à feux tricolores (inchangé, conservé)
// ═════════════════════════════════════════════════════════════════════════

const CARREFOUR_STATEMENT = `Énoncé — Carrefour à feux tricolores

On modélise un carrefour routier simple à deux axes perpendiculaires,
Nord-Sud et Est-Ouest, contrôlé par deux feux tricolores. Chaque axe suit
indépendamment le cycle Rouge → Vert → Orange → Rouge.

Contrainte de sécurité : les deux axes ne doivent jamais être verts en
même temps. Cette exclusion mutuelle est modélisée par une place
"ressource" unique (le carrefour lui-même) : un axe doit posséder le
jeton "carrefour libre" pour pouvoir passer au vert, et le restitue
lorsqu'il repasse au rouge.

Au marquage initial, les deux axes sont au rouge et le carrefour est
libre : les deux transitions de démarrage (T1 côté Nord-Sud, T4 côté
Est-Ouest) sont donc simultanément franchissables. C'est un exemple de
CONFLIT : franchir l'une désactive immédiatement l'autre, puisqu'elle
consomme le seul jeton disponible dans la ressource partagée.`;

const CARREFOUR_PLACES: PetriPlace[] = [
  { id: "p_ns_rouge",  label: "P1", x: 230, y: 150, description: "Axe Nord-Sud au rouge (à l'arrêt)" },
  { id: "p_ns_vert",   label: "P2", x: 400, y: 60,  description: "Axe Nord-Sud au vert (actif)" },
  { id: "p_ns_orange", label: "P3", x: 570, y: 150, description: "Axe Nord-Sud à l'orange (fin de cycle)" },
  { id: "p_ressource", label: "P4", x: 400, y: 300, capacity: 1, description: "Carrefour libre — ressource partagée (1 jeton)" },
  { id: "p_eo_rouge",  label: "P5", x: 230, y: 450, description: "Axe Est-Ouest au rouge (à l'arrêt)" },
  { id: "p_eo_vert",   label: "P6", x: 400, y: 540, description: "Axe Est-Ouest au vert (actif)" },
  { id: "p_eo_orange", label: "P7", x: 570, y: 450, description: "Axe Est-Ouest à l'orange (fin de cycle)" },
];

const CARREFOUR_TRANSITIONS: PetriTransition[] = [
  { id: "t_ns_demarrer", label: "T1", x: 300, y: 95,  description: "NS démarre : prend la ressource, passe au vert" },
  { id: "t_ns_orange",   label: "T2", x: 500, y: 95,  description: "NS passe à l'orange" },
  { id: "t_ns_arreter",  label: "T3", x: 400, y: 195, description: "NS s'arrête : repasse au rouge, rend la ressource" },
  { id: "t_eo_demarrer", label: "T4", x: 300, y: 505, description: "EO démarre : prend la ressource, passe au vert" },
  { id: "t_eo_orange",   label: "T5", x: 500, y: 505, description: "EO passe à l'orange" },
  { id: "t_eo_arreter",  label: "T6", x: 400, y: 405, description: "EO s'arrête : repasse au rouge, rend la ressource" },
];

const CARREFOUR_ARCS: PetriArc[] = [
  { id: "a1",  from: "p_ns_rouge",   to: "t_ns_demarrer", weight: 1 },
  { id: "a2",  from: "p_ressource",  to: "t_ns_demarrer", weight: 1 },
  { id: "a3",  from: "t_ns_demarrer", to: "p_ns_vert",    weight: 1 },
  { id: "a4",  from: "p_ns_vert",    to: "t_ns_orange",    weight: 1 },
  { id: "a5",  from: "t_ns_orange",  to: "p_ns_orange",    weight: 1 },
  { id: "a6",  from: "p_ns_orange",  to: "t_ns_arreter",   weight: 1 },
  { id: "a7",  from: "t_ns_arreter", to: "p_ns_rouge",     weight: 1 },
  { id: "a8",  from: "t_ns_arreter", to: "p_ressource",    weight: 1 },
  { id: "a9",  from: "p_eo_rouge",   to: "t_eo_demarrer", weight: 1 },
  { id: "a10", from: "p_ressource",  to: "t_eo_demarrer", weight: 1 },
  { id: "a11", from: "t_eo_demarrer", to: "p_eo_vert",    weight: 1 },
  { id: "a12", from: "p_eo_vert",    to: "t_eo_orange",    weight: 1 },
  { id: "a13", from: "p_eo_orange",  to: "t_eo_orange",    weight: 1 },
  { id: "a14", from: "p_eo_orange",  to: "t_eo_arreter",   weight: 1 },
  { id: "a15", from: "t_eo_arreter", to: "p_eo_rouge",     weight: 1 },
  { id: "a16", from: "t_eo_arreter", to: "p_ressource",    weight: 1 },
];

const CARREFOUR_MARKING: Marking = {
  p_ns_rouge: 1, p_ns_vert: 0, p_ns_orange: 0,
  p_ressource: 1,
  p_eo_rouge: 1, p_eo_vert: 0, p_eo_orange: 0,
};

// ═════════════════════════════════════════════════════════════════════════
// Registre final des presets (indexé par slug — utilisé par loadPreset)
// ═════════════════════════════════════════════════════════════════════════

export const PETRI_NETS: Record<PetriNetPreset, PetriNetPresetData> = {
  "station-recharge": {
    slug: "station-recharge",
    title: "Station de recharge VE",
    subtitle: "Points de charge partagés · rapide/standard · abandons",
    statement: STATION_RECHARGE_STATEMENT,
    places: STATION_RECHARGE_PLACES,
    transitions: STATION_RECHARGE_TRANSITIONS,
    arcs: STATION_RECHARGE_ARCS,
    initialMarking: STATION_RECHARGE_MARKING,
  },
  "centre-tri": {
    slug: "centre-tri",
    title: "Centre de tri de colis",
    subtitle: "Contrôle qualité · boucle de reprise bornée (K = 3)",
    statement: CENTRE_TRI_STATEMENT,
    places: CENTRE_TRI_PLACES,
    transitions: CENTRE_TRI_TRANSITIONS,
    arcs: CENTRE_TRI_ARCS,
    initialMarking: CENTRE_TRI_MARKING,
  },
  "mobile-money": {
    slug: "mobile-money",
    title: "Agent Mobile Money",
    subtitle: "Gestion des transactions : dépôt · retrait · transfert",
    statement: MOBILE_MONEY_STATEMENT,
    places: MOBILE_MONEY_PLACES,
    transitions: MOBILE_MONEY_TRANSITIONS,
    arcs: MOBILE_MONEY_ARCS,
    initialMarking: MOBILE_MONEY_MARKING,
  },
  carrefour: {
    slug: "carrefour",
    title: "Carrefour à feux tricolores",
    subtitle: "Exclusion mutuelle entre deux axes — exemple de démo",
    statement: CARREFOUR_STATEMENT,
    places: CARREFOUR_PLACES,
    transitions: CARREFOUR_TRANSITIONS,
    arcs: CARREFOUR_ARCS,
    initialMarking: CARREFOUR_MARKING,
  },
};

/** Raccourci : renvoie le preset correspondant au slug (ou undefined). */
export function getPresetBySlug(slug: PetriNetPreset): PetriNetPresetData | undefined {
  return PETRI_NETS[slug];
}
