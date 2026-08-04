// types/petri.ts
// ─────────────────────────────────────────────────────────────────────────
// Types du domaine "Réseau de Petri" (RDP).
// Miroir volontaire de types/graph.ts (projet Dantzig) : mêmes conventions
// de nommage (id/label/x/y), pour garder les deux modules cohérents.
// ─────────────────────────────────────────────────────────────────────────

export interface PetriPlace {
  id: string;
  label: string;
  x: number;
  y: number;
  capacity?: number;
  description?: string; // ← nouveau : texte affiché dans la légende + l'infobulle
}

export interface PetriTransition {
  id: string;
  label: string;
  x: number;
  y: number;
  description?: string; // ← nouveau
}

/**
 * Un arc oriented reliant une place à une transition, ou une transition à
 * une place (jamais place↔place ni transition↔transition — invariant
 * vérifié à la création, voir `addArc` dans le store).
 */
export interface PetriArc {
  id: string;
  from: string;
  to: string;
  /** Poids (nombre de jetons consommés/produits à chaque franchissement). */
  weight: number;
}

/** Marquage courant : nombre de jetons présents dans chaque place. */
export type Marking = Record<string, number>;

/**
 * Une étape de l'historique de simulation. L'étape 0 correspond toujours au
 * marquage initial (`firedTransition` undefined). Chaque étape suivante
 * correspond au marquage obtenu APRÈS le franchissement de
 * `firedTransition`.
 */
export interface FiringStep {
  iteration: number;
  description: string;
  marking: Marking;
  /** Transitions franchissables sous CE marquage (utile pour déboguer/afficher). */
  enabledTransitions: string[];
  /** Transition franchie pour ARRIVER à ce marquage (absente pour l'étape 0). */
  firedTransition?: string;
  /** Vrai si plusieurs transitions étaient en conflit structurel à ce marquage. */
  wasConflict?: boolean;
}

/** Matrices d'incidence classiques du cours : W = Post − Pre. */
export interface IncidenceMatrices {
  placeIds: string[];
  transitionIds: string[];
  pre: number[][];   // Pre[p][t]  : jetons consommés par t dans p
  post: number[][];  // Post[p][t] : jetons produits par t dans p
  w: number[][];     // W[p][t] = Post[p][t] - Pre[p][t]
}

export interface NodeColors {
  fill: string;
  stroke: string;
  text: string;
}

/** Utilitaire : une place a un id préfixé "p_" par convention (voir constants). */
export function isPlaceId(id: string): boolean {
  return id.startsWith("p_");
}
export function isTransitionId(id: string): boolean {
  return id.startsWith("t_");
}
