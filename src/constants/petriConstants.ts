// constants/petriConstants.ts
// ─────────────────────────────────────────────────────────────────────────
// Réseaux prédéfinis (presets) de l'application.
//
// SUJET PRINCIPAL : « Gestion des transactions chez un agent Mobile Money »
//   — modèle RdP coloré/temporisé (avec arcs inhibiteurs) décrit dans
//   docs/sujet_rdp_mobile_money.md (VERSION 4), déplié ici en RdP ordinaire
//   place/transition simulable (une transition par couleur de ressource,
//   paliers Normale/Réserve, alertes préventives, réapprovisionnements).
//
// LAYOUT : les positions sont calculées pour éviter TOUTE collision
//   arc↔nœud (vérifié géométriquement sur les courbes de Bézier réellement
//   tracées par PetriCanvas) : flux client en ligne du haut, agent au
//   centre, branches Retrait (gauche) et Dépôt (droite), paliers au
//   centre-bas, monitoring/alertes en bas.
//
// SUJET DE DÉMO (conservé) : « Carrefour à feux tricolores » — l'exemple
//   historique de l'application, toujours chargeable via le sélecteur ou
//   la page de présentation.
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
// 1. SUJET PRINCIPAL — Agent Mobile Money (Version 3 du sujet)
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
// 2. SUJET DE DÉMO — Carrefour à feux tricolores (inchangé, conservé)
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
