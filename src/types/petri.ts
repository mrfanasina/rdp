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
 * Un arc orienté reliant une place à une transition, ou une transition à
 * une place (jamais place↔place ni transition↔transition — invariant
 * vérifié à la création, voir `addArc` dans le store).
 */
export interface PetriArc {
  id: string;
  from: string;
  to: string;
  /** Poids (nombre de jetons consommés/produits à chaque franchissement). */
  weight: number;
  /**
   * Arc inhibiteur (test de zéro) : au lieu d'exiger au moins `weight`
   * jetons, l'arc exige ZÉRO jeton dans la place source pour que la
   * transition soit franchissable, et n'en consomme aucun au tir.
   * Dessiné avec une extrémité cercle côté place (convention classique).
   * Indispensable pour le modèle Mobile Money (paliers Normale/Réserve,
   * alertes T9a/T9b, échecs T9c/T9d…).
   */
  inhibitor?: boolean;
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
  /**
   * Nombre de jetons EXIGÉS (test, sans consommation) pour franchir t,
   * séparé de `pre` car un arc inhibiteur ne consomme rien : une case
   * Pre[p][t] positive signifie un arc direct (consommation), tandis que
   * `required[p][t] > 0` signifie "t exige p = 0" (inhibiteur).
   */
  required?: number[][];
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

/**
 * Types de réseaux prédéfinis (presets) chargeables depuis l'UI — voir
 * constants/petriConstants.ts et mobileMoneyConstants.ts.
 */
export type PetriNetPreset = "centre-tri" | "station-recharge" | "mobile-money" | "carrefour";
