// constants/petriConstants.ts
// ─────────────────────────────────────────────────────────────────────────
// Réseau de Petri par défaut : un carrefour à feux tricolores à deux axes
// (Nord-Sud / Est-Ouest) partageant une ressource unique "carrefour libre".
//
// Labellisation alignée sur le cours (P1…P7 / T1…T6, comme l'exemple de
// l'imprimante partagée par deux processus vu en classe) : le nom affiché
// sur le schéma reste court (P1, T1…) et le sens de chaque place/transition
// est donné par son champ `description`, exactement comme dans les slides
// ("P1 : Processus P1 en repos", "T1 : demander l'impression"…). Cette
// description alimente à la fois la légende affichée sous le canevas et
// l'infobulle au survol d'un nœud, et elle est incluse telle quelle dans le
// JSON exporté/importé.
//
// C'est l'exemple canonique du cours pour illustrer :
//  • le cycle Rouge → Vert → Orange → Rouge de chaque feu ;
//  • l'exclusion mutuelle : un seul axe peut être vert à la fois, forcée
//    par la place `Ressource` (1 jeton, consommé au démarrage d'un axe,
//    rendu à son arrêt) ;
//  • le CONFLIT structurel : au marquage initial, T1 (NS) et T4 (EO) sont
//    TOUTES LES DEUX franchissables (chaque axe est au rouge, la ressource
//    est disponible) — mais franchir l'une désactive l'autre. C'est
//    exactement la notion de conflit vue en cours.
// ─────────────────────────────────────────────────────────────────────────

import type { PetriPlace, PetriTransition, PetriArc, Marking } from "../types/petri";

/**
 * PETRI_STATEMENT (« énoncé »)
 * ─────────────────────────────
 * Texte pédagogique décrivant le problème que modélise le réseau par
 * défaut. Il est stocké comme n'importe quelle autre donnée du réseau
 * (voir `statement` dans store/petriStore.ts) : il voyage dans le JSON
 * exporté/importé au même titre que les places, transitions, arcs et le
 * marquage initial (voir la section "Format JSON" du README), et il est
 * affiché tout en haut du panneau Légende, avant le détail P1…/T1…, pour
 * qu'on sache toujours QUEL problème on est en train de modéliser ou de
 * simuler — utile en particulier quand on importe le réseau de quelqu'un
 * d'autre.
 */
export const PETRI_STATEMENT =
  `Énoncé — Carrefour à feux tricolores

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

// Triangle Nord-Sud (haut du canevas) et triangle Est-Ouest (bas), reliés
// par la place P4 (ressource) au centre — mêmes positions qu'avant, seuls
// le label affiché et la description pédagogique changent.
export const INITIAL_PLACES: PetriPlace[] = [
  // ── Axe Nord-Sud ──
  { id: "p_ns_rouge",  label: "P1", x: 230, y: 150, description: "Axe Nord-Sud au rouge (à l'arrêt)" },
  { id: "p_ns_vert",   label: "P2", x: 400, y: 60,  description: "Axe Nord-Sud au vert (actif)" },
  { id: "p_ns_orange", label: "P3", x: 570, y: 150, description: "Axe Nord-Sud à l'orange (fin de cycle)" },

  // ── Ressource partagée (exclusion mutuelle) ──
  { id: "p_ressource", label: "P4", x: 400, y: 300, capacity: 1, description: "Carrefour libre — ressource partagée (1 jeton)" },

  // ── Axe Est-Ouest ──
  { id: "p_eo_rouge",  label: "P5", x: 230, y: 450, description: "Axe Est-Ouest au rouge (à l'arrêt)" },
  { id: "p_eo_vert",   label: "P6", x: 400, y: 540, description: "Axe Est-Ouest au vert (actif)" },
  { id: "p_eo_orange", label: "P7", x: 570, y: 450, description: "Axe Est-Ouest à l'orange (fin de cycle)" },
];

export const INITIAL_TRANSITIONS: PetriTransition[] = [
  // ── Axe Nord-Sud ──
  { id: "t_ns_demarrer", label: "T1", x: 300, y: 95,  description: "NS démarre : prend la ressource, passe au vert" },
  { id: "t_ns_orange",   label: "T2", x: 500, y: 95,  description: "NS passe à l'orange" },
  { id: "t_ns_arreter",  label: "T3", x: 400, y: 195, description: "NS s'arrête : repasse au rouge, rend la ressource" },

  // ── Axe Est-Ouest ──
  { id: "t_eo_demarrer", label: "T4", x: 300, y: 505, description: "EO démarre : prend la ressource, passe au vert" },
  { id: "t_eo_orange",   label: "T5", x: 500, y: 505, description: "EO passe à l'orange" },
  { id: "t_eo_arreter",  label: "T6", x: 400, y: 405, description: "EO s'arrête : repasse au rouge, rend la ressource" },
];

export const INITIAL_ARCS: PetriArc[] = [
  // ── Cycle Nord-Sud ──
  { id: "a1",  from: "p_ns_rouge",   to: "t_ns_demarrer", weight: 1 },
  { id: "a2",  from: "p_ressource",  to: "t_ns_demarrer", weight: 1 },
  { id: "a3",  from: "t_ns_demarrer",to: "p_ns_vert",      weight: 1 },
  { id: "a4",  from: "p_ns_vert",    to: "t_ns_orange",    weight: 1 },
  { id: "a5",  from: "t_ns_orange",  to: "p_ns_orange",    weight: 1 },
  { id: "a6",  from: "p_ns_orange",  to: "t_ns_arreter",   weight: 1 },
  { id: "a7",  from: "t_ns_arreter", to: "p_ns_rouge",     weight: 1 },
  { id: "a8",  from: "t_ns_arreter", to: "p_ressource",    weight: 1 },

  // ── Cycle Est-Ouest ──
  { id: "a9",  from: "p_eo_rouge",   to: "t_eo_demarrer", weight: 1 },
  { id: "a10", from: "p_ressource",  to: "t_eo_demarrer", weight: 1 },
  { id: "a11", from: "t_eo_demarrer",to: "p_eo_vert",      weight: 1 },
  { id: "a12", from: "p_eo_vert",    to: "t_eo_orange",    weight: 1 },
  { id: "a13", from: "t_eo_orange",  to: "p_eo_orange",    weight: 1 },
  { id: "a14", from: "p_eo_orange",  to: "t_eo_arreter",   weight: 1 },
  { id: "a15", from: "t_eo_arreter", to: "p_eo_rouge",     weight: 1 },
  { id: "a16", from: "t_eo_arreter", to: "p_ressource",    weight: 1 },
];

export const INITIAL_MARKING: Marking = {
  p_ns_rouge: 1,
  p_ns_vert: 0,
  p_ns_orange: 0,
  p_ressource: 1,
  p_eo_rouge: 1,
  p_eo_vert: 0,
  p_eo_orange: 0,
};
