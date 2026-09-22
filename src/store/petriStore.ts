// store/petriStore.ts
// ─────────────────────────────────────────────────────────────────────────
// Store Zustand pour le module RDP (Réseau de Petri).
//
// Différence de fond avec store/graphStore.ts (Dantzig) : Dantzig est un
// ALGORITHME déterministe calculé une fois côté service, puis rejoué étape
// par étape. Un RDP est une SIMULATION interactive — à chaque marquage,
// zéro, une, ou plusieurs transitions peuvent être franchissables, et un
// conflit (plusieurs franchissables, s'excluant mutuellement) doit être
// résolu par un choix (utilisateur ou politique automatique). L'historique
// n'est donc pas précalculé : il grandit au fur et à mesure des
// franchissements, et `currentStepIndex` peut naviguer dedans exactement
// comme dans GraphControls (Précédent/Suivant/Début/Fin/Play).
//
// Le "principe de contrôle" (Reset / Début / Précédent / Play-Pause /
// Suivant / Fin / dots d'étape / vitesse / Arranger / Ajuster / Zoom) est
// délibérément identique à GraphControls + graphStore, pour que l'UX reste
// cohérente entre les deux modules.
// ─────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  PetriPlace, PetriTransition, PetriArc, Marking, FiringStep, IncidenceMatrices, PetriNetPreset,
} from "../types/petri";
import {
  getPresetBySlug,
} from "../constants/petriConstants";

const ARRANGE_MARGIN_X = 90;
const ARRANGE_MARGIN_Y = 70;
const ARRANGE_MAX_SCALE = 1.2;

interface PetriStore {
  // ── Structure du réseau ──────────────────────────────────────────────
  places: PetriPlace[];
  transitions: PetriTransition[];
  arcs: PetriArc[];
  initialMarking: Marking;

  /**
   * Preset actuellement chargé ("mobile-money" par défaut, "carrefour"
   * historique conservé en démo). Piloté par PresentationPage et le
   * sélecteur de PetriPage.
   */
  activePreset: PetriNetPreset;
  loadPreset: (preset: PetriNetPreset) => void;

  /**
   * Énoncé / explication du projet en cours de modélisation (texte libre).
   * Voyage dans le JSON exporté/importé comme le reste du réseau (voir
   * `metadata.statement` dans PetriPage.handleExportJSON /
   * processNetFile), et s'affiche tout en haut du panneau Légende — avant
   * le détail P1…/T1… — pour qu'on sache toujours quel problème on est en
   * train de modéliser, y compris après avoir importé le réseau de
   * quelqu'un d'autre.
   */
  statement: string;
  setStatement: (statement: string) => void;

  setPlaces: (p: PetriPlace[]) => void;
  setTransitions: (t: PetriTransition[]) => void;
  setArcs: (a: PetriArc[]) => void;
  /** Remplace le réseau en bloc (import JSON, éditeur, preset) : reset de la simulation. */
  loadNet: (net: {
    places: PetriPlace[];
    transitions: PetriTransition[];
    arcs: PetriArc[];
    initialMarking?: Marking;
    statement?: string;
  }) => void;

  addPlace: (p: PetriPlace) => void;
  addTransition: (t: PetriTransition) => void;
  /** Retourne false (et ne fait rien) si l'arc violerait le bipartisme place↔transition. */
  addArc: (a: PetriArc) => boolean;
  removePlace: (id: string) => void;
  removeTransition: (id: string) => void;
  removeArc: (id: string) => void;
  moveNode: (id: string, x: number, y: number) => void;
  updateArcWeight: (id: string, weight: number) => void;
  /** Édite poids et/ou nature (direct ↔ inhibiteur) d'un arc existant. */
  updateArc: (id: string, patch: { weight?: number; inhibitor?: boolean }) => void;
  /** Édite le marquage INITIAL d'une place (seulement pertinent à l'étape 0). */
  setInitialTokens: (placeId: string, tokens: number) => void;
  /** Remplace le marquage initial en bloc (utilisé par l'import JSON de PetriPage). */
  setInitialMarking: (marking: Marking) => void;

  canvasWidth: number;
  canvasHeight: number;
  setCanvasSize: (w: number, h: number) => void;

  // ── Simulation / historique ──────────────────────────────────────────
  history: FiringStep[];
  currentStepIndex: number;
  /** Ensemble de transitions en conflit à la frontière, en attente d'un choix utilisateur. `null` = pas de conflit bloquant. */
  pendingConflict: string[] | null;
  isComputed: boolean; // au moins un franchissement a eu lieu (parité avec Dantzig)

  totalSteps: () => number;
  atFrontier: () => boolean;

  /** Recalcule les transitions franchissables sous un marquage donné. */
  computeEnabled: (marking: Marking) => string[];
  /** Applique le franchissement d'une transition à un marquage (fonction pure). */
  applyFiring: (marking: Marking, transitionId: string) => Marking;

  /**
   * Franchit explicitement une transition (clic sur le canevas, ou
   * résolution d'un conflit). Ignoré si elle n'est pas franchissable ou si
   * on n'est pas à la frontière de l'historique.
   */
  fireTransition: (transitionId: string) => void;

  /**
   * Avance d'une étape :
   *  - si on n'est pas à la frontière → simple navigation (currentStepIndex++)
   *  - sinon, 0 franchissable → rien (blocage/fin de simulation)
   *  - sinon, 1 franchissable → franchie automatiquement
   *  - sinon, plusieurs → conflit posé dans `pendingConflict`, en attente d'un choix
   */
  /**
   * `autoResolve` : utilisé par le mode Lecture automatique (Play). En cas
   * de conflit, au lieu de bloquer en attendant un clic, choisit une
   * transition au hasard parmi les franchissables — pour que l'animation
   * ne reste jamais bloquée toute seule. En navigation manuelle
   * (`autoResolve` = false, valeur par défaut), un conflit pose bien
   * `pendingConflict` et attend un choix explicite sur le canevas.
   */
  goToNextStep: (autoResolve?: boolean) => void;
  goToPreviousStep: () => void;
  goToFirstStep: () => void;
  goToLastStep: () => void;
  setCurrentStepIndex: (i: number) => void;

  resetSimulation: () => void;

  // ── Sélecteurs pour le rendu ──────────────────────────────────────────
  getCurrentMarking: () => Marking;
  getCurrentStep: () => FiringStep | null;
  getTokenCount: (placeId: string) => number;
  isTransitionEnabled: (transitionId: string) => boolean;
  isTransitionPendingConflict: (transitionId: string) => boolean;
  isTransitionLastFired: (transitionId: string) => boolean;
  isArcActiveInLastFiring: (arc: PetriArc) => boolean;
  getIncidenceMatrices: () => IncidenceMatrices;

  error: string | null;
  clearError: () => void;

  arrangeGraph: () => void;
}

// Réseau chargé au démarrage : le sujet principal (Mobile Money).
const DEFAULT_PRESET = getPresetBySlug("mobile-money")!;

export const usePetriStore = create<PetriStore>((set, get) => ({
  places: DEFAULT_PRESET.places,
  transitions: DEFAULT_PRESET.transitions,
  arcs: DEFAULT_PRESET.arcs,
  initialMarking: { ...DEFAULT_PRESET.initialMarking },
  activePreset: "mobile-money",

  loadPreset: (preset) => {
    const p = getPresetBySlug(preset);
    if (!p) return;
    set({ activePreset: preset });
    get().loadNet(p);
  },

  loadNet: ({ places, transitions, arcs, initialMarking, statement }) => {
    // Normalise : toute place absente du marquage fourni démarre à 0.
    const marking: Marking = {};
    places.forEach((p) => { marking[p.id] = initialMarking?.[p.id] ?? 0; });
    set({
      places,
      transitions,
      arcs,
      initialMarking: marking,
      ...(statement !== undefined ? { statement } : {}),
    });
    get().resetSimulation();
  },

  statement: DEFAULT_PRESET.statement,
  setStatement: (statement) => set({ statement }),

  canvasWidth: 800,
  canvasHeight: 600,
  setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h }),

  setPlaces: (places) => set({ places }),
  setTransitions: (transitions) => set({ transitions }),
  setArcs: (arcs) => set({ arcs }),

  // ── Édition structurelle ──────────────────────────────────────────────
  // Toute modification de la structure ou du marquage initial invalide la
  // simulation en cours (l'historique n'a plus de sens) : on la réinitialise,
  // exactement comme `maybeRecompute` invalidait le résultat Dantzig.
  addPlace: (p) => {
    set((s) => ({ places: [...s.places, p], initialMarking: { ...s.initialMarking, [p.id]: 0 } }));
    get().resetSimulation();
  },

  addTransition: (t) => {
    set((s) => ({ transitions: [...s.transitions, t] }));
    get().resetSimulation();
  },

  addArc: (a) => {
    const { places, transitions } = get();
    const fromIsPlace = places.some((p) => p.id === a.from);
    const toIsPlace = places.some((p) => p.id === a.to);
    const fromIsTransition = transitions.some((t) => t.id === a.from);
    const toIsTransition = transitions.some((t) => t.id === a.to);
    const valid = (fromIsPlace && toIsTransition) || (fromIsTransition && toIsPlace);
    if (!valid) {
      set({ error: "Un arc doit relier une place à une transition (jamais deux places ou deux transitions entre elles)." });
      return false;
    }
    set((s) => ({ arcs: [...s.arcs, a] }));
    get().resetSimulation();
    return true;
  },

  removePlace: (id) => {
    set((s) => {
      const rest = { ...s.initialMarking };
      delete rest[id];
      return {
        places: s.places.filter((p) => p.id !== id),
        arcs: s.arcs.filter((a) => a.from !== id && a.to !== id),
        initialMarking: rest,
      };
    });
    get().resetSimulation();
  },

  removeTransition: (id) => {
    set((s) => ({
      transitions: s.transitions.filter((t) => t.id !== id),
      arcs: s.arcs.filter((a) => a.from !== id && a.to !== id),
    }));
    get().resetSimulation();
  },

  removeArc: (id) => {
    set((s) => ({ arcs: s.arcs.filter((a) => a.id !== id) }));
    get().resetSimulation();
  },

  // Déplacer un nœud est purement visuel : pas de reset de simulation.
  moveNode: (id, x, y) =>
    set((s) => ({
      places: s.places.map((p) => (p.id === id ? { ...p, x, y } : p)),
      transitions: s.transitions.map((t) => (t.id === id ? { ...t, x, y } : t)),
    })),

  updateArcWeight: (id, weight) => {
    set((s) => ({ arcs: s.arcs.map((a) => (a.id === id ? { ...a, weight } : a)) }));
    get().resetSimulation();
  },

  /** Édite poids et/ou nature (direct ↔ inhibiteur) d'un arc. */
  updateArc: (id, patch) => {
    set((s) => ({
      arcs: s.arcs.map((a) => (a.id === id ? { ...a, ...patch, weight: patch.weight ?? a.weight } : a)),
    }));
    get().resetSimulation();
  },

  setInitialTokens: (placeId, tokens) => {
    set((s) => ({ initialMarking: { ...s.initialMarking, [placeId]: Math.max(0, tokens) } }));
    get().resetSimulation();
  },

  setInitialMarking: (marking) => {
    set({ initialMarking: { ...marking } });
    get().resetSimulation();
  },

  // ── Simulation ─────────────────────────────────────────────────────────
  history: [{
    iteration: 0,
    description: "Marquage initial",
    marking: { ...DEFAULT_PRESET.initialMarking },
    enabledTransitions: [],
    wasConflict: false,
  }],
  currentStepIndex: 0,
  pendingConflict: null,
  isComputed: false,

  totalSteps: () => get().history.length,
  atFrontier: () => get().currentStepIndex === get().history.length - 1,

  computeEnabled: (marking) => {
    const { transitions, arcs } = get();
    return transitions
      .filter((t) => {
        const inputArcs = arcs.filter((a) => a.to === t.id);
        // Arcs directs : assez de jetons ? Arcs inhibiteurs : place VIDE ?
        return inputArcs.every((a) =>
          a.inhibitor
            ? (marking[a.from] ?? 0) === 0
            : (marking[a.from] ?? 0) >= a.weight
        );
      })
      .map((t) => t.id);
  },

  applyFiring: (marking, transitionId) => {
    const { arcs } = get();
    const next = { ...marking };
    arcs.forEach((a) => {
      if (a.inhibitor) return; // un arc inhibiteur ne consomme RIEN au tir
      if (a.to === transitionId) next[a.from] = (next[a.from] ?? 0) - a.weight;       // place → transition (consommé)
      if (a.from === transitionId) next[a.to] = (next[a.to] ?? 0) + a.weight;         // transition → place (produit)
    });
    return next;
  },

  fireTransition: (transitionId) => {
    const { history, currentStepIndex, transitions, computeEnabled, applyFiring } = get();
    if (currentStepIndex !== history.length - 1) return; // pas à la frontière
    const current = history[history.length - 1];
    const enabled = computeEnabled(current.marking);
    if (!enabled.includes(transitionId)) return; // pas franchissable

    const nextMarking = applyFiring(current.marking, transitionId);
    const label = transitions.find((t) => t.id === transitionId)?.label ?? transitionId;
    const nextStep: FiringStep = {
      iteration: history.length,
      description: `Franchissement de « ${label} »`,
      marking: nextMarking,
      enabledTransitions: get().computeEnabled(nextMarking),
      firedTransition: transitionId,
      wasConflict: enabled.length > 1,
    };
    set({
      history: [...history, nextStep],
      currentStepIndex: history.length,
      pendingConflict: null,
      isComputed: true,
    });
  },

  goToNextStep: (autoResolve = false) => {
    const { history, currentStepIndex } = get();
    if (currentStepIndex < history.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1, pendingConflict: null });
      return;
    }
    // À la frontière : il faut décider quoi franchir.
    const current = history[history.length - 1];
    const enabled = get().computeEnabled(current.marking);
    if (enabled.length === 0) {
      set({ pendingConflict: null }); // blocage / fin de simulation, rien à faire
    } else if (enabled.length === 1) {
      get().fireTransition(enabled[0]);
    } else if (autoResolve) {
      const pick = enabled[Math.floor(Math.random() * enabled.length)];
      get().fireTransition(pick);
    } else {
      set({ pendingConflict: enabled }); // conflit : attend un clic sur le canevas
    }
  },

  goToPreviousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) set({ currentStepIndex: currentStepIndex - 1, pendingConflict: null });
  },

  goToFirstStep: () => set({ currentStepIndex: 0, pendingConflict: null }),

  goToLastStep: () => {
    const { history } = get();
    set({ currentStepIndex: history.length - 1, pendingConflict: null });
  },

  setCurrentStepIndex: (i) => {
    const { history } = get();
    if (i >= 0 && i < history.length) set({ currentStepIndex: i, pendingConflict: null });
  },

  resetSimulation: () => {
    const { initialMarking } = get();
    set({
      history: [{
        iteration: 0,
        description: "Marquage initial",
        marking: { ...initialMarking },
        enabledTransitions: get().computeEnabled(initialMarking),
        wasConflict: false,
      }],
      currentStepIndex: 0,
      pendingConflict: null,
      isComputed: false,
      error: null,
    });
  },

  // ── Sélecteurs ─────────────────────────────────────────────────────────
  getCurrentStep: () => {
    const { history, currentStepIndex } = get();
    return history[currentStepIndex] ?? null;
  },

  getCurrentMarking: () => get().getCurrentStep()?.marking ?? {},

  getTokenCount: (placeId) => get().getCurrentMarking()[placeId] ?? 0,

  isTransitionEnabled: (transitionId) => {
    const { atFrontier, pendingConflict } = get();
    if (!atFrontier()) return false;
    if (pendingConflict) return pendingConflict.includes(transitionId);
    const marking = get().getCurrentMarking();
    return get().computeEnabled(marking).includes(transitionId);
  },

  isTransitionPendingConflict: (transitionId) => {
    const { pendingConflict } = get();
    return !!pendingConflict && pendingConflict.includes(transitionId);
  },

  isTransitionLastFired: (transitionId) => {
    const step = get().getCurrentStep();
    return step?.firedTransition === transitionId;
  },

  isArcActiveInLastFiring: (arc) => {
    const step = get().getCurrentStep();
    if (!step?.firedTransition) return false;
    return arc.from === step.firedTransition || arc.to === step.firedTransition;
  },

  getIncidenceMatrices: () => {
    const { places, transitions, arcs } = get();
    const placeIds = places.map((p) => p.id);
    const transitionIds = transitions.map((t) => t.id);
    // Pre/Post ne tiennent compte que des arcs DIRECTS : un arc inhibiteur
    // n'est ni une consommation (Pre) ni une production (Post) — c'est un
    // test de zéro, reporté séparément dans `required`.
    const pre = placeIds.map((pid) =>
      transitionIds.map((tid) =>
        arcs.find((a) => a.from === pid && a.to === tid && !a.inhibitor)?.weight ?? 0
      )
    );
    const post = placeIds.map((pid) =>
      transitionIds.map((tid) => arcs.find((a) => a.from === tid && a.to === pid)?.weight ?? 0)
    );
    const w = pre.map((row, i) => row.map((v, j) => post[i][j] - v));
    const required = placeIds.map((pid) =>
      transitionIds.map((tid) =>
        arcs.find((a) => a.from === pid && a.to === tid && a.inhibitor) ? 1 : 0
      )
    );
    return { placeIds, transitionIds, pre, post, w, required };
  },

  error: null,
  clearError: () => set({ error: null }),

  // ── Disposition automatique ───────────────────────────────────────────
  // Layout bipartite simplifié (rang = distance topologique depuis une
  // ancre, force-dirigé pour l'affinage), dans le même esprit que
  // `arrangeGraph` du module Dantzig mais sans la gestion complète des
  // composantes/arcs de retour — un RDP de TP reste petit (<40 nœuds).
  arrangeGraph: () => {
    const { places, transitions, arcs, canvasWidth, canvasHeight } = get();
    const allNodes = [
      ...places.map((p) => ({ id: p.id, kind: "place" as const })),
      ...transitions.map((t) => ({ id: t.id, kind: "transition" as const })),
    ];
    if (!allNodes.length) return;

    import("d3-force").then(({ forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY }) => {
      const adj: Record<string, string[]> = {};
      allNodes.forEach((n) => { adj[n.id] = []; });
      arcs.forEach((a) => { adj[a.from]?.push(a.to); adj[a.to]?.push(a.from); });

      // Rang = distance BFS depuis la première place (ancre), non orientée
      // (suffisant pour disposer un cycle lisiblement gauche→droite).
      const anchor = places[0]?.id ?? allNodes[0].id;
      const rank: Record<string, number> = {};
      allNodes.forEach((n) => { rank[n.id] = -1; });
      rank[anchor] = 0;
      const queue = [anchor];
      while (queue.length) {
        const cur = queue.shift()!;
        (adj[cur] ?? []).forEach((nb) => {
          if (rank[nb] === -1) { rank[nb] = rank[cur] + 1; queue.push(nb); }
        });
      }
      const maxRank = Math.max(1, ...Object.values(rank).filter((r) => r >= 0));
      allNodes.forEach((n) => { if (rank[n.id] === -1) rank[n.id] = maxRank; }); // nœuds isolés en fin

      const usableW = canvasWidth - ARRANGE_MARGIN_X * 2;
      const usableH = canvasHeight - ARRANGE_MARGIN_Y * 2;

      // Types minimaux pour d3-force (évite les `any` tout en restant souple
      // sur le couplage typé exact de la lib).
      type SimNode = { id: string; x: number; y: number };
      type SimLink = { source: string | SimNode; target: string | SimNode; dist: number };

      const simNodes: SimNode[] = allNodes.map((n) => ({
        id: n.id,
        x: ARRANGE_MARGIN_X + (rank[n.id] / maxRank) * usableW + (Math.random() - 0.5) * 30,
        y: canvasHeight / 2 + (Math.random() - 0.5) * usableH * 0.6,
      }));

      const simLinks: SimLink[] = arcs.map((a) => ({ source: a.from, target: a.to, dist: 90 + Math.random() * 30 }));

      const simulation = forceSimulation<SimNode>(simNodes)
        .force("link", forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance((l) => l.dist).strength(0.6))
        .force("charge", forceManyBody<SimNode>().strength(-420).distanceMax(500))
        .force("center", forceCenter<SimNode>(canvasWidth / 2, canvasHeight / 2).strength(0.03))
        .force("collide", forceCollide<SimNode>(38).strength(0.9).iterations(3))
        .force("x", forceX<SimNode>((d) => ARRANGE_MARGIN_X + (rank[d.id] / maxRank) * usableW).strength(0.28))
        .force("y", forceY<SimNode>(canvasHeight / 2).strength(0.06))
        .alphaDecay(0.025)
        .velocityDecay(0.4)
        .stop();

      const iterations = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
      for (let i = 0; i < iterations; i++) simulation.tick();

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      simNodes.forEach((p) => {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
      const graphW = maxX - minX || 1;
      const graphH = maxY - minY || 1;
      const scale = Math.min(usableW / graphW, usableH / graphH, ARRANGE_MAX_SCALE);
      const offX = (canvasWidth - graphW * scale) / 2 - minX * scale;
      const offY = (canvasHeight - graphH * scale) / 2 - minY * scale;

      const byId = new Map(simNodes.map((p) => [p.id, p]));
      set({
        places: places.map((p) => {
          const s = byId.get(p.id);
          return s ? { ...p, x: s.x * scale + offX, y: s.y * scale + offY } : p;
        }),
        transitions: transitions.map((t) => {
          const s = byId.get(t.id);
          return s ? { ...t, x: s.x * scale + offX, y: s.y * scale + offY } : t;
        }),
      });
    }).catch((err) => {
      console.error("arrangeGraph (RDP) a échoué :", err);
      set({ error: err instanceof Error ? `Échec de la disposition automatique : ${err.message}` : "Échec de la disposition automatique" });
    });
  },
}));
