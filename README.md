# Réseau de Petri — Simulateur interactif (module RDP)

Un éditeur + simulateur de **Réseau de Petri** (RDP) en React/TypeScript,
avec canevas SVG, historique de franchissement navigable, résolution de
conflits, import/export JSON, et une matrice d'incidence (Pré / Post / W)
calculée automatiquement.

L'exemple fourni par défaut modélise un **carrefour à feux tricolores** à
deux axes (Nord-Sud / Est-Ouest) — voir [Énoncé du projet](#énoncé-du-projet)
ci-dessous, qui voyage désormais avec le réseau lui-même (champ `statement`
du JSON, § [Format JSON](#format-json)).

---

## Sommaire

- [Aperçu du projet](#aperçu-du-projet)
- [Énoncé du projet](#énoncé-du-projet)
- [Architecture](#architecture)
- [Modèle de données](#modèle-de-données)
- [Format JSON (import / export)](#format-json)
- [Simulation : marquage, franchissement, conflits](#simulation)
- [Interactions du canevas](#interactions-du-canevas)
- [Raccourcis clavier](#raccourcis-clavier)
- [Ce qui a changé récemment](#ce-qui-a-changé-récemment)

---

## Aperçu du projet

Un **Réseau de Petri** (RDP) est un modèle graphique et mathématique de
systèmes à événements discrets, composé de deux types de nœuds :

- des **places** (cercles) qui représentent des états ou des ressources et
  contiennent des **jetons** (marquage) ;
- des **transitions** (barres) qui représentent des événements et qui
  peuvent se **franchir** (« tirer ») lorsque toutes leurs places d'entrée
  contiennent assez de jetons.

Contrairement à un algorithme déterministe (comme le simplexe de Dantzig
dans le module voisin de cette application, calculé une fois puis rejoué),
un RDP est **simulé de façon interactive** : à chaque marquage, zéro, une
ou plusieurs transitions peuvent être franchissables. Quand plusieurs le
sont et s'excluent mutuellement, on parle de **conflit** — l'utilisateur
(ou une politique automatique en mode Lecture) doit choisir laquelle
franchir.

Fonctionnalités principales :

- Édition visuelle : glisser les nœuds, tracer des arcs (mode dédié),
  éditer les poids d'arcs et le marquage initial directement sur le
  canevas, ajouter/supprimer places et transitions.
- Simulation : franchissement au clic, résolution de conflit, historique
  navigable (précédent/suivant/début/fin), lecture automatique.
- Légende pédagogique : description de chaque place/transition (« P1 :
  ... », « T1 : ... »), précédée de l'énoncé du projet modélisé.
- Matrice d'incidence : Pré, Post et W = Post − Pré, calculées
  automatiquement à partir des arcs.
- Import / export au format JSON (voir plus bas), et glisser-déposer d'un
  fichier `.json` n'importe où sur la page.
- Éditeur JSON en ligne pour modifier places/transitions/arcs en texte.
- Réorganisation automatique du graphe (layout par rang + force-dirigé).

---

## Énoncé du projet

> **Carrefour à feux tricolores**
>
> On modélise un carrefour routier simple à deux axes perpendiculaires,
> Nord-Sud et Est-Ouest, contrôlé par deux feux tricolores. Chaque axe suit
> indépendamment le cycle **Rouge → Vert → Orange → Rouge**.
>
> **Contrainte de sécurité** : les deux axes ne doivent jamais être verts
> en même temps. Cette exclusion mutuelle est modélisée par une place
> « ressource » unique (le carrefour lui-même) : un axe doit posséder le
> jeton « carrefour libre » pour pouvoir passer au vert, et le restitue
> lorsqu'il repasse au rouge.
>
> Au marquage initial, les deux axes sont au rouge et le carrefour est
> libre : les deux transitions de démarrage (**T1** côté Nord-Sud, **T4**
> côté Est-Ouest) sont donc simultanément franchissables. C'est un exemple
> de **conflit** : franchir l'une désactive immédiatement l'autre, puisqu'elle
> consomme le seul jeton disponible dans la ressource partagée.

Ce texte n'est pas codé en dur dans l'interface : c'est une donnée du
réseau comme une autre (`statement`, voir plus bas), stockée dans le store
et affichée en tête du panneau **Légende**. Il est donc entièrement
personnalisable, et voyage avec le réseau à l'export/import — si vous
modélisez un autre problème (ex. exclusion mutuelle de deux processus
autour d'une imprimante partagée), il suffit de le réécrire dans la
Légende ou dans le champ `statement` du JSON.

---

## Architecture

```
components/petri/
  PetriCanvas.tsx          Canevas SVG : rendu, édition, simulation au clic
  PetriControls.tsx        Barre de lecture (précédent/suivant/play/vitesse…)
  PetriEditor.tsx          Éditeur JSON en ligne (places/transitions/arcs)
  PetriLegend.tsx          Légende pédagogique : énoncé + description P*/T*
  PetriIncidenceMatrix.tsx Matrice d'incidence Pré / Post / W
  PetriStepsPanel.tsx      Historique de franchissement (volet droit)
  AddPetriNodeForm.tsx     Formulaire modal d'ajout de place/transition

store/
  petriStore.ts            Store Zustand : structure du réseau, marquage,
                            historique de simulation, sélecteurs, layout

constants/
  petriConstants.ts        Réseau par défaut (carrefour à feux) + PETRI_STATEMENT

types/
  petri.ts                 Types partagés (PetriPlace, PetriTransition,
                            PetriArc, Marking, FiringStep, IncidenceMatrices…)

pages/
  PetriPage.tsx             Page complète : layout, dock, import/export,
                            volets latéraux, aide
```

Le module RDP est un miroir volontaire du module Dantzig (`GraphCanvas` /
`graphStore`) pour les interactions génériques du canevas (déplacer,
zoomer/panner, menu contextuel, édition en ligne), afin de garder une UX
cohérente entre les deux — mais la logique de simulation (marquage,
franchissement, conflits) est propre au RDP.

---

## Modèle de données

```ts
interface PetriPlace {
  id: string;
  label: string;          // affiché sur le nœud, ex. "P1"
  x: number;
  y: number;
  capacity?: number;      // optionnel, capacité max en jetons (ex. ressource = 1)
  description?: string;   // texte pédagogique affiché dans la Légende
}

interface PetriTransition {
  id: string;
  label: string;          // affiché sous le nœud, ex. "T1"
  x: number;
  y: number;
  description?: string;
}

interface PetriArc {
  id: string;
  from: string;            // id d'une place OU d'une transition
  to: string;               // le type opposé de `from` (bipartisme obligatoire)
  weight: number;           // poids/multiplicité (défaut : 1)
}

type Marking = Record<string /* placeId */, number /* jetons */>;

interface FiringStep {
  iteration: number;
  description: string;          // ex. « Franchissement de « T1 » »
  marking: Marking;              // marquage APRÈS ce pas
  enabledTransitions: string[];  // franchissables sous ce marquage
  firedTransition?: string;      // transition franchie pour arriver ici (absent à l'étape 0)
  wasConflict: boolean;          // vrai si plusieurs transitions étaient franchissables
}
```

Règle structurelle stricte, imposée par `addArc` dans le store : un arc
relie **toujours** une place à une transition ou une transition à une
place — jamais deux places ni deux transitions entre elles (bipartisme du
graphe, propriété fondamentale d'un RDP).

---

## Format JSON

C'est le format utilisé par **Importer** / **Exporter** (dock flottant du
canevas) et par le glisser-déposer d'un fichier `.json`.

```jsonc
{
  "metadata": {
    "version": "1.0",
    "timestamp": "2026-08-03T12:34:56.000Z",
    "kind": "rdp"
  },

  // Énoncé / explication du projet modélisé par ce réseau. Champ texte
  // libre, optionnel (les fichiers plus anciens sans ce champ restent
  // valides — il est simplement traité comme une chaîne vide à l'import).
  // Affiché en tête du panneau Légende, avant le détail des places et
  // transitions.
  "statement": "Énoncé — Carrefour à feux tricolores\n\nOn modélise...",

  "places": [
    {
      "id": "p_ns_rouge",
      "label": "P1",
      "x": 230,
      "y": 150,
      "description": "Axe Nord-Sud au rouge (à l'arrêt)"
    },
    {
      "id": "p_ressource",
      "label": "P4",
      "x": 400,
      "y": 300,
      "capacity": 1,
      "description": "Carrefour libre — ressource partagée (1 jeton)"
    }
    // ...
  ],

  "transitions": [
    {
      "id": "t_ns_demarrer",
      "label": "T1",
      "x": 300,
      "y": 95,
      "description": "NS démarre : prend la ressource, passe au vert"
    }
    // ...
  ],

  "arcs": [
    { "id": "a1", "from": "p_ns_rouge", "to": "t_ns_demarrer", "weight": 1 }
    // ...
  ],

  "initialMarking": {
    "p_ns_rouge": 1,
    "p_ns_vert": 0,
    "p_ns_orange": 0,
    "p_ressource": 1,
    "p_eo_rouge": 1,
    "p_eo_vert": 0,
    "p_eo_orange": 0
  }
}
```

### Notes sur le format

- **`places`, `transitions`, `arcs`** sont obligatoires (même vides,
  `[]`) — leur absence ou un mauvais type fait échouer l'import avec une
  alerte (« Fichier JSON invalide pour ce réseau de Petri »).
- **`initialMarking`** est optionnel à l'import (`{}` par défaut) ; toute
  place absente de cet objet est considérée comme ayant `0` jeton au
  départ.
- **`statement`** est optionnel à l'import ; absent, il est simplement
  vidé plutôt que de faire échouer le chargement (rétro-compatibilité avec
  les fichiers exportés avant son ajout).
- **`description`** (sur une place ou une transition) est optionnel ; s'il
  est présent, il alimente la Légende et l'infobulle au survol du nœud.
- **`capacity`** (sur une place) est optionnel et purement informatif dans
  la version actuelle (il n'est pas encore utilisé pour borner le nombre
  de jetons pendant la simulation).
- Le poids d'un arc (`weight`) doit être un entier ≥ 1. Un poids de `1`
  n'affiche pas de badge sur le canevas (convention visuelle : seuls les
  poids ≠ 1 sont annotés).
- Les `id` doivent être uniques au sein de leur catégorie et sont
  référencés tels quels par `arcs[].from` / `arcs[].to` et par les clés de
  `initialMarking`.

---

## Simulation

- **Marquage** : nombre de jetons dans chaque place à un instant donné.
- **Franchissabilité** : une transition est franchissable si chacune de
  ses places d'entrée (arcs `place → transition`) contient au moins autant
  de jetons que le poids de l'arc correspondant.
- **Franchissement** : consomme `weight` jetons dans chaque place d'entrée
  et en produit `weight` dans chaque place de sortie (arcs
  `transition → place`).
- **Conflit** : plusieurs transitions franchissables sous le même marquage
  qui s'excluent mutuellement une fois l'une d'elles tirée (ex. T1/T4 au
  marquage initial de l'exemple : les deux consomment le même jeton
  `p_ressource`). Affiché en ambre avec un halo pulsant sur le canevas ;
  cliquer l'une des transitions en conflit le résout.
- **Historique** : chaque franchissement ajoute une étape (`FiringStep`) ;
  on peut naviguer dedans (précédent/suivant/début/fin) sans perdre les
  étapes suivantes, tant qu'on ne franchit pas une nouvelle transition
  depuis une étape antérieure à la frontière (auquel cas... actuellement
  le store ignore silencieusement le clic si on n'est pas à la frontière —
  il faut d'abord revenir à la dernière étape).
- **Lecture automatique (Play)** : avance pas à pas ; en cas de conflit,
  choisit une transition au hasard parmi les franchissables pour ne
  jamais bloquer l'animation.

---

## Interactions du canevas

| Action | Comment |
|---|---|
| Franchir une transition | Cliquer une transition verte (franchissable) |
| Résoudre un conflit | Cliquer l'une des transitions ambre en conflit |
| Déplacer un nœud | Glisser-déposer |
| Tracer un arc | Mode arc (bouton dock ou <kbd>A</kbd>) → cliquer une place puis une transition (ou l'inverse) |
| Modifier un poids d'arc | Cliquer son badge, taper la valeur, <kbd>Entrée</kbd> |
| Éditer le marquage initial | À l'étape 0, cliquer les jetons d'une place |
| Ajouter un nœud | Double-clic sur le fond (place) ; <kbd>Alt</kbd> + double-clic (transition) ; ou bouton/<kbd>N</kbd> |
| Supprimer | Clic droit → Supprimer, ou sélection + <kbd>Suppr</kbd> |
| Zoom | Molette |
| Déplacer la vue | Clic molette, ou <kbd>Alt</kbd> + glisser |
| Ajuster la vue | Bouton « Ajuster » (marge asymétrique pour ne jamais masquer un nœud sous le dock, les stats ou la barre de lecture) |

---

## Raccourcis clavier

| Touche | Action |
|---|---|
| <kbd>N</kbd> | Ajouter une place / une transition |
| <kbd>A</kbd> | Basculer le mode arc |
| <kbd>L</kbd> | Afficher/masquer la Légende |
| <kbd>I</kbd> | Afficher/masquer la matrice d'incidence |
| <kbd>G</kbd> | Réorganiser le graphe automatiquement |
| <kbd>M</kbd> | Basculer le thème clair/sombre |
| <kbd>Espace</kbd> | Play / Pause |
| <kbd>Suppr</kbd> / <kbd>Backspace</kbd> | Supprimer la sélection |
| <kbd>Échap</kbd> | Annuler l'action en cours / fermer une modale |

---
## 👤 Auteur

**mrfanasina**

- GitHub : [@mrfanasina](https://github.com/mrfanasina)

---
