/**
 * PetriCanvas.tsx
 * ───────────────
 * Canevas SVG pour l'édition et la SIMULATION interactive d'un Réseau de
 * Petri (RDP). Miroir volontaire de GraphCanvas.tsx (module Dantzig) pour
 * les interactions génériques (déplacer, zoomer/panner, menu contextuel,
 * édition de poids en ligne) — adapté aux spécificités d'un RDP :
 *
 * • Places = cercles, avec leurs jetons dessinés à l'intérieur (points
 *   jusqu'à 4, sinon un nombre — convention classique du cours).
 * • Transitions = barres rectangulaires. Couleur pilotée par le store :
 *     - franchissable (verte, halo)               → cliquer la franchit
 *     - en CONFLIT avec une autre (ambre, pulse)   → cliquer résout le conflit
 *     - vient d'être franchie à l'étape courante   → surbrillance bleue brève
 *     - non franchissable                          → grise, non cliquable
 * • Arcs : place→transition ou transition→place uniquement (jamais
 *   place↔place / transition↔transition), tête de flèche en forme de
 *   "dart" (voir ArrowMarker plus bas), badge de poids éditable en ligne si
 *   poids ≠ 1 (comme les poids d'arêtes de GraphCanvas). Les têtes de
 *   flèche ont une taille FIXE en unités canevas (indépendante du
 *   stroke-width de l'arc) et leur pointe touche exactement le bord du
 *   nœud, sans jamais le chevaucher ni laisser un espace.
 * • Mode `addArcMode` : cliquer une place puis une transition (ou l'inverse)
 *   pour tracer un nouvel arc, avec prévisualisation en pointillés —
 *   exactement le même flux que addEdgeMode côté Dantzig.
 * • Double-clic sur le fond du canevas : ajoute une nouvelle place (Alt
 *   enfoncé : une transition) à la position du curseur.
 * • Édition du marquage initial : au marquage initial (étape 0), cliquer le
 *   badge de jetons d'une place permet de saisir son nombre de jetons de
 *   départ.
 * • `fitView` (bouton "Ajuster", ou appelé automatiquement au premier
 *   rendu) réserve une marge asymétrique : plus large en bas et à gauche,
 *   pour que le graphe reste entièrement visible sous le dock flottant, le
 *   badge de statistiques et surtout la barre de contrôle de lecture qui
 *   flotte en bas du canevas — aucun nœud ne doit se retrouver caché
 *   dessous.
 *
 * Contrat avec le store (usePetriStore) : voir store/petriStore.ts.
 */

import {
  useState, useRef, useCallback, useEffect, useMemo, memo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { usePetriStore } from "../../store/petriStore";
import type { PetriArc, PetriPlace } from "../../types/petri";
import { Trash2 } from "lucide-react";

// ─── Constantes ─────────────────────────────────────────────────────────
const PLACE_RADIUS = 30;
const TRANS_W = 14;
const TRANS_H = 52;

const CURVE_FACTOR = 0.15;
const MAX_CURVE = 40;
const BIDIRECTIONAL_OFFSET = 14;

const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.02;

// Taille de la tête de flèche, en unités canevas (userSpaceOnUse : ne
// dépend pas du stroke-width de l'arc, donc reste identique que l'arc soit
// inactif, survolé ou en surbrillance — seule sa couleur change). Portée
// à 10 (au lieu de 9) pour accompagner la nouvelle forme "dart", un peu
// plus élancée qu'un triangle plein et donc visuellement un peu plus
// discrète à taille égale.
const ARROW_SIZE = 10;

// Marge réservée autour du graphe pour "Ajuster la vue" / l'auto-cadrage
// initial. Volontairement asymétrique : le dock flottant est en haut à
// gauche, le badge de statistiques et la barre de lecture flottent en bas
// — donc marge basse et gauche plus généreuse pour ne jamais les recouvrir.
const VIEW_PADDING = { top: 70, right: 70, bottom: 170, left: 150 };

interface XY { x: number; y: number }

// ─── Géométrie (identique en esprit à GraphCanvas) ──────────────────────
function vec(from: XY, to: XY) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
  return len > 0 ? { dx, dy, len, nx: dx / len, ny: dy / len } : { dx: 0, dy: 0, len: 0, nx: 0, ny: 0 };
}
function curvature(len: number) { return Math.min(MAX_CURVE, len * CURVE_FACTOR); }

/** Rayon effectif d'un nœud selon son type, pour rogner les tracés à son bord. */
function nodeRadius(kind: "place" | "transition") { return kind === "place" ? PLACE_RADIUS : TRANS_H / 2; }

/**
 * Intersection d'une demi-droite (origine `o`, direction unitaire `d`) avec un
 * disque de centre `c` et de rayon `r`. Renvoie la plus petite distance
 * positive, ou null si la demi-droite ne coupe pas le disque.
 */
function rayCircleEntry(o: XY, d: XY, c: XY, r: number): number | null {
  const ox = o.x - c.x, oy = o.y - c.y;
  const b = ox * d.x + oy * d.y;
  const q = ox * ox + oy * oy - r * r;
  const disc = b * b - q;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const s1 = -b - sq, s2 = -b + sq;
  if (s1 > 0.01) return s1;
  if (s2 > 0.01) return s2;
  return null;
}

/**
 * Intersection d'une demi-droite (origine `o`, direction unitaire `d`) avec un
 * rectangle axis-aligné centré en `c` (demi-largeur `hw`, demi-hauteur `hh`) —
 * méthode des "slabs". Renvoie la plus petite distance positive d'entrée, ou
 * null si la demi-droite ne coupe pas le rectangle.
 */
function rayRectEntry(o: XY, d: XY, c: XY, hw: number, hh: number): number | null {
  let best = Infinity;
  if (d.x !== 0) {
    for (const edge of [c.x - hw, c.x + hw]) {
      const s = (edge - o.x) / d.x;
      if (s > 0.01) {
        const y = o.y + s * d.y;
        if (y >= c.y - hh && y <= c.y + hh) best = Math.min(best, s);
      }
    }
  }
  if (d.y !== 0) {
    for (const edge of [c.y - hh, c.y + hh]) {
      const s = (edge - o.y) / d.y;
      if (s > 0.01) {
        const x = o.x + s * d.x;
        if (x >= c.x - hw && x <= c.x + hw) best = Math.min(best, s);
      }
    }
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * Point exact où l'arc touche le bord du nœud `center` (place = disque,
 * transition = rectangle), le long de la droite (contrôle → centre) — c'est la
 * tangente de la Bézier à son extrémité, donc l'arc arrive toujours "collé" au
 * nœud, quelle que soit sa courbure. Repli : rognage le long de la ligne
 * centre → centre (comportement historique) si la géométrie est dégénérée.
 */
function shapeEntry(ctrl: XY, center: XY, kind: "place" | "transition", fallbackDir: XY): XY {
  const dx = center.x - ctrl.x, dy = center.y - ctrl.y;
  const dl = Math.hypot(dx, dy);
  const dir = dl > 0.01 ? { x: dx / dl, y: dy / dl } : fallbackDir;
  const s = kind === "place"
    ? rayCircleEntry(ctrl, dir, center, PLACE_RADIUS)
    : rayRectEntry(ctrl, dir, center, TRANS_W / 2, TRANS_H / 2);
  if (s === null) {
    return { x: center.x - fallbackDir.x * nodeRadius(kind), y: center.y - fallbackDir.y * nodeRadius(kind) };
  }
  return { x: ctrl.x + dir.x * s, y: ctrl.y + dir.y * s };
}

function buildEdgePath(from: XY, to: XY, fromKind: "place" | "transition", toKind: "place" | "transition", lateralOffset = 0): string {
  const { len, nx, ny } = vec(from, to);
  if (len < 2) return "";
  const totalOffset = curvature(len) + lateralOffset;
  const mx = (from.x + to.x) / 2 - ny * totalOffset, my = (from.y + to.y) / 2 + nx * totalOffset;
  // Rogne chaque extrémité à l'intersection de la tangente (contrôle ↔ centre)
  // avec la forme RÉELLE du nœud : disque pour une place, rectangle 14×52 pour
  // une transition. Avant, le rognage utilisait un rayon circulaire même pour
  // les transitions → un arc entrant par le petit côté s'arrêtait ~19 px avant
  // le rectangle (26 − 7), d'où des flèches "détachées" des transitions.
  const p1 = shapeEntry({ x: mx, y: my }, from, fromKind, { x: -nx, y: -ny });
  const p2 = shapeEntry({ x: mx, y: my }, to, toKind, { x: nx, y: ny });
  return `M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`;
}
function bezierMid(from: XY, to: XY, lateralOffset = 0): XY {
  const { len, ny, nx } = vec(from, to);
  if (len === 0) return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const totalOffset = curvature(len) + lateralOffset;
  return { x: (from.x + to.x) / 2 - ny * totalOffset, y: (from.y + to.y) / 2 + nx * totalOffset };
}
function isValidTokenInput(raw: string): boolean {
  if (raw.trim() === "") return false;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}

// ─── Sous-composants ──────────────────────────────────────────────────────
/**
 * Tête de flèche.
 *
 * Forme "dart" (triangle à dos concave, comme une pointe de fléchette) au
 * lieu d'un simple triangle plein : le dos de la pointe est tiré vers
 * l'avant (voir le 4ᵉ point du path), ce qui donne un rendu plus élancé et
 * plus lisible qu'un triangle classique, en particulier sur les arcs
 * courbes où plusieurs flèches peuvent se retrouver proches les unes des
 * autres. Un léger contour de même couleur que le remplissage
 * (`stroke`/`strokeLinejoin="round"`) adoucit les angles et évite l'effet
 * "crénelé" que peut donner un triangle anguleux à petite échelle.
 *
 * `markerUnits="userSpaceOnUse"` + une taille fixe (ARROW_SIZE) rend la
 * flèche indépendante du stroke-width de l'arc — avant ce correctif, une
 * flèche active (stroke-width 2.6) était ~60% plus grosse qu'une flèche
 * inactive (1.6), ce qui donnait un rendu incohérent.
 *
 * `refX`/`refY` sont alignés exactement sur la pointe du dart (11, 6 dans
 * le viewBox 0 0 12 12) : la flèche touche le bord du nœud pile à
 * l'endroit où `buildEdgePath` arrête le tracé, sans jamais le chevaucher
 * ni laisser de trou.
 */
const ArrowMarker = memo(({ id, fill }: { id: string; fill: string }) => (
  <marker
    id={id}
    viewBox="0 0 12 12"
    markerWidth={ARROW_SIZE}
    markerHeight={ARROW_SIZE}
    refX={11}
    refY={6}
    orient="auto"
    markerUnits="userSpaceOnUse"
  >
    <path
      d="M1.4,1 L11,6 L1.4,11 L3.8,6 Z"
      fill={fill}
      stroke={fill}
      strokeWidth={0.5}
      strokeLinejoin="round"
    />
  </marker>
));

interface CtxMenu { x: number; y: number; label: string; onDelete: () => void; onClose: () => void }
const ContextMenu = memo(({ x, y, label, onDelete, onClose }: CtxMenu) => (
  <foreignObject x={x} y={y} width={164} height={60} style={{ overflow: "visible" }}>
    <div
      style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.13)", padding: "4px 0", minWidth: 156, userSelect: "none" }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{ padding: "4px 12px 5px", fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid #f1f5f9" }}>{label}</div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", padding: "7px 12px", cursor: "pointer", fontSize: 13, color: "#ef4444", fontWeight: 500, textAlign: "left" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <Trash2 size={15} /> Supprimer
      </button>
    </div>
  </foreignObject>
));

interface WeightPopupProps {
  x: number; y: number; value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>; label: string;
  /** Present = mode arc : affiche une case à cocher "inhibiteur". */
  inhibitor?: boolean;
  onToggleInhibitor?: () => void;
}
const InlineNumberEditor = memo(({ x, y, value, onChange, onConfirm, onCancel, inputRef, label, inhibitor, onToggleInhibitor }: WeightPopupProps) => {
  const invalid = !isValidTokenInput(value);
  return (
    <foreignObject x={x - 44} y={y - 17} width={inhibitor !== undefined ? 150 : 68} height={34} style={{ overflow: "visible" }}>
      <div onPointerDown={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            ref={inputRef}
            type="number" min={0} step={1} value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onConfirm}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); if (!invalid) onConfirm(); }
              if (e.key === "Escape") { e.preventDefault(); onCancel(); }
            }}
            aria-label={label}
            aria-invalid={invalid}
            style={{
              width: 60, textAlign: "center", fontSize: 12, fontWeight: 700,
              border: `1.5px solid ${invalid ? "#f87171" : "#7c3aed"}`, borderRadius: 8, padding: "2px 4px",
              fontFamily: "ui-monospace, monospace", color: invalid ? "#b91c1c" : "#5b21b6",
              background: invalid ? "#fef2f2" : "#faf5ff", outline: "none",
            }}
          />
          {onToggleInhibitor && (
            <button
              onClick={(e) => { e.preventDefault(); onToggleInhibitor(); }}
              title="Arc inhibiteur (test de zéro : la place doit être VIDE, rien n'est consommé)"
              style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700,
                padding: "3px 7px", borderRadius: 7, cursor: "pointer", whiteSpace: "nowrap",
                border: inhibitor ? "1.5px solid #d946ef" : "1px solid #e2e8f0",
                background: inhibitor ? "#fdf4ff" : "#f8fafc", color: inhibitor ? "#a21caf" : "#64748b",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", border: "1.7px solid currentColor", display: "inline-block" }} />
              Inhibiteur
            </button>
          )}
        </div>
      </div>
    </foreignObject>
  );
});

// ─── Composant principal ───────────────────────────────────────────────────
interface PetriCanvasProps { addArcMode?: boolean; onArcModeCancel?: () => void }

export default function PetriCanvas({ addArcMode = false }: PetriCanvasProps) {
  const {
    places, transitions, arcs, initialMarking,
    moveNode, addArc, addPlace, addTransition, removePlace, removeTransition, removeArc,
    updateArc, setInitialTokens, setCanvasSize,
    getTokenCount, isTransitionEnabled, isTransitionPendingConflict, isTransitionLastFired,
    isArcActiveInLastFiring, fireTransition, currentStepIndex,
  } = usePetriStore();

  const isInitialStep = currentStepIndex === 0;

  const [dragging, setDragging] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredArc, setHoveredArc] = useState<string | null>(null);
  const [arcSource, setArcSource] = useState<string | null>(null);
  const [, setArcHoverTarget] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<XY | null>(null);
  const [pendingArc, setPendingArc] = useState<{ fromId: string; toId: string; midX: number; midY: number; inhibitor: boolean } | null>(null);
  const [pendingWeight, setPendingWeight] = useState("1");

  const [editingArc, setEditingArc] = useState<string | null>(null);
  const [editingArcValue, setEditingArcValue] = useState("");
  const [editingArcInhibitor, setEditingArcInhibitor] = useState(false);
  const [editingPlace, setEditingPlace] = useState<string | null>(null);
  const [editingPlaceValue, setEditingPlaceValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; type: "place" | "transition" | "arc"; id: string } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<XY>({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef<XY>({ x: 0, y: 0 });
  const panOrigin = useRef<XY>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffset = useRef<XY>({ x: 0, y: 0 });
  const didDrag = useRef(false);
  // Garantit un seul auto-cadrage au tout premier rendu exploitable (voir
  // l'effet de mesure du canevas plus bas) — les cadrages suivants restent
  // manuels, déclenchés par le bouton "Ajuster" (petri-fit-view).
  const didAutoFit = useRef(false);

  // ── Maps normalisées ─────────────────────────────────────────────────
  const placeMap = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const transMap = useMemo(() => new Map(transitions.map((t) => [t.id, t])), [transitions]);
  const kindOf = useCallback((id: string): "place" | "transition" | null =>
    placeMap.has(id) ? "place" : transMap.has(id) ? "transition" : null, [placeMap, transMap]);
  const posOf = useCallback((id: string): XY | null => {
    const p = placeMap.get(id); if (p) return p;
    const t = transMap.get(id); if (t) return t;
    return null;
  }, [placeMap, transMap]);

  const bidirectionalSet = useMemo(() => {
    const keys = new Set(arcs.map((a) => `${a.from}->${a.to}`));
    const bidi = new Set<string>();
    arcs.forEach((a) => { if (keys.has(`${a.to}->${a.from}`)) { bidi.add(`${a.from}->${a.to}`); bidi.add(`${a.to}->${a.from}`); } });
    return bidi;
  }, [arcs]);

  const getLateral = useCallback((a: PetriArc) => bidirectionalSet.has(`${a.from}->${a.to}`) ? BIDIRECTIONAL_OFFSET : 0, [bidirectionalSet]);

  const getArcPath = useCallback((a: PetriArc): string => {
    const from = posOf(a.from), to = posOf(a.to), fk = kindOf(a.from), tk = kindOf(a.to);
    if (!from || !to || !fk || !tk) return "";
    return buildEdgePath(from, to, fk, tk, getLateral(a));
  }, [posOf, kindOf, getLateral]);

  const getArcMid = useCallback((a: PetriArc): XY => {
    const from = posOf(a.from), to = posOf(a.to);
    if (!from || !to) return { x: 0, y: 0 };
    return bezierMid(from, to, getLateral(a));
  }, [posOf, getLateral]);

  // ── Coordonnées écran → SVG ──────────────────────────────────────────
  const getSvgCoords = useCallback((clientX: number, clientY: number): XY => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  // Reset de l'état du mode arc quand on le quitte. Le reset est différé
  // d'un tick (rAF) : synchroniser ce state React dans le corps de l'effet
  // déclenche des rendus en cascade (règle react-hooks/set-state-in-effect).
  useEffect(() => {
    if (addArcMode) return;
    const raf = requestAnimationFrame(() => {
      setArcSource(null); setArcHoverTarget(null); setCursorPos(null); setPendingArc(null); setPendingWeight("1");
    });
    return () => cancelAnimationFrame(raf);
  }, [addArcMode]);

  useEffect(() => {
    if (pendingArc && weightInputRef.current) { const t = setTimeout(() => weightInputRef.current?.focus(), 50); return () => clearTimeout(t); }
  }, [pendingArc]);

  useEffect(() => { if (editingArc && editInputRef.current) editInputRef.current.select(); }, [editingArc]);
  useEffect(() => { if (editingPlace && editInputRef.current) editInputRef.current.select(); }, [editingPlace]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [ctxMenu]);

  // ── Zoom / pan ────────────────────────────────────────────────────────
  const applyZoom = useCallback((nextZoom: number, pivotX?: number, pivotY?: number) => {
    setZoom((prev) => {
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nextZoom));
      if (pivotX !== undefined && pivotY !== undefined && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        const px = pivotX - rect.left, py = pivotY - rect.top;
        setPan((p) => ({ x: px - (px - p.x) * (z / prev), y: py - (py - p.y) * (z / prev) }));
      }
      return z;
    });
  }, []);
  const zoomIn = useCallback(() => applyZoom(zoom * ZOOM_STEP), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(zoom / ZOOM_STEP), [applyZoom, zoom]);

  /**
   * Recadre la vue sur l'ensemble du graphe avec une marge ASYMÉTRIQUE
   * (VIEW_PADDING) : le dock flottant (haut-gauche), le badge de
   * statistiques (bas-gauche) et surtout la barre de contrôle de lecture
   * (bas-centre, ~position fixed par-dessus le canevas) ne doivent jamais
   * recouvrir un nœud du graphe une fois la vue ajustée.
   */
  const fitView = useCallback(() => {
    const allNodes = [...places, ...transitions];
    if (!svgRef.current || allNodes.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const xs = allNodes.map((n) => n.x), ys = allNodes.map((n) => n.y);
    const minX = Math.min(...xs) - VIEW_PADDING.left;
    const maxX = Math.max(...xs) + VIEW_PADDING.right;
    const minY = Math.min(...ys) - VIEW_PADDING.top;
    const maxY = Math.max(...ys) + VIEW_PADDING.bottom;
    const nextZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    setZoom(nextZoom);
    setPan({ x: rect.width / 2 - ((minX + maxX) / 2) * nextZoom, y: rect.height / 2 - ((minY + maxY) / 2) * nextZoom });
  }, [places, transitions]);

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    applyZoom(zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP), e.clientX, e.clientY);
  }, [applyZoom, zoom]);

  const onPointerDownSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button === 1 || (e.button === 0 && e.altKey && !addArcMode)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOrigin.current = { ...pan };
      (e.target as SVGSVGElement).setPointerCapture(e.pointerId);
    }
  }, [pan, addArcMode]);

  const onPointerMoveSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning.current) {
      setPan({ x: panOrigin.current.x + (e.clientX - panStart.current.x), y: panOrigin.current.y + (e.clientY - panStart.current.y) });
      return;
    }
    if (dragging) {
      didDrag.current = true;
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      moveNode(dragging, x - dragOffset.current.x, y - dragOffset.current.y);
      return;
    }
    if (addArcMode && arcSource && !pendingArc) setCursorPos(getSvgCoords(e.clientX, e.clientY));
  }, [dragging, addArcMode, arcSource, pendingArc, getSvgCoords, moveNode]);

  const onPointerUpSvg = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    if (isPanning.current) { isPanning.current = false; (e.target as SVGSVGElement).releasePointerCapture?.(e.pointerId); }
    setDragging(null);
  }, []);

  // ── Nœuds : drag / clic ──────────────────────────────────────────────
  const onPointerDownNode = useCallback((e: ReactPointerEvent<SVGGElement>, id: string) => {
    if (addArcMode) return;
    e.stopPropagation();
    setSelected(id);
    const node = posOf(id);
    if (!node) return;
    const { x, y } = getSvgCoords(e.clientX, e.clientY);
    dragOffset.current = { x: x - node.x, y: y - node.y };
    didDrag.current = false;
    setDragging(id);
  }, [addArcMode, posOf, getSvgCoords]);

  const onClickNode = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (didDrag.current) return;
    const kind = kindOf(id);

    if (addArcMode) {
      if (pendingArc) return;
      if (!arcSource) { setArcSource(id); return; }
      if (arcSource === id) return; // pas de boucle sur soi-même en RDP
      const srcKind = kindOf(arcSource);
      if (srcKind === kind) return; // même type des deux côtés : invalide (place↔place ou transition↔transition)
      const from = posOf(arcSource)!, to = posOf(id)!;
      const lat = bidirectionalSet.has(`${arcSource}->${id}`) ? BIDIRECTIONAL_OFFSET : 0;
      const mid = bezierMid(from, to, lat);
      setPendingArc({ fromId: arcSource, toId: id, midX: mid.x, midY: mid.y, inhibitor: false });
      setPendingWeight("1");
      setArcSource(null); setArcHoverTarget(null); setCursorPos(null);
      return;
    }

    // Hors mode édition d'arcs : cliquer une TRANSITION la franchit si elle
    // est franchissable (ou résout un conflit si elle en fait partie).
    if (kind === "transition") fireTransition(id);
  }, [addArcMode, pendingArc, arcSource, kindOf, posOf, bidirectionalSet, fireTransition]);

  const onContextMenuNode = useCallback((e: React.MouseEvent, id: string, type: "place" | "transition") => {
    if (addArcMode) return;
    e.preventDefault(); e.stopPropagation();
    const node = posOf(id); if (!node) return;
    setCtxMenu({ x: node.x + nodeRadius(type) + 6, y: node.y - 14, type, id });
  }, [addArcMode, posOf]);

  const onContextMenuArc = useCallback((e: React.MouseEvent, a: PetriArc) => {
    if (addArcMode) return;
    e.preventDefault(); e.stopPropagation();
    const mid = getArcMid(a);
    setCtxMenu({ x: mid.x + 8, y: mid.y - 8, type: "arc", id: a.id });
  }, [addArcMode, getArcMid]);

  // ── Confirmation / annulation d'un nouvel arc ────────────────────────
  const confirmArc = useCallback(() => {
    if (!pendingArc || !isValidTokenInput(pendingWeight) || parseFloat(pendingWeight) < 1) return;
    addArc({
      id: `arc_${Date.now()}`,
      from: pendingArc.fromId,
      to: pendingArc.toId,
      weight: parseFloat(pendingWeight),
      inhibitor: pendingArc.inhibitor,
    });
    setPendingArc(null); setPendingWeight("1");
  }, [pendingArc, pendingWeight, addArc]);
  const cancelPendingArc = useCallback(() => { setPendingArc(null); setArcSource(null); setPendingWeight("1"); }, []);

  // ── Édition en ligne : poids d'arc ───────────────────────────────────
  const startEditArc = useCallback((a: PetriArc) => {
    if (addArcMode) return;
    setEditingArc(a.id);
    setEditingArcValue(String(a.weight));
    setEditingArcInhibitor(!!a.inhibitor);
  }, [addArcMode]);
  const confirmEditArc = useCallback(() => {
    if (editingArc && isValidTokenInput(editingArcValue) && parseFloat(editingArcValue) >= 1) {
      const target = arcs.find((x) => x.id === editingArc);
      if (target) updateArc(editingArc, { weight: parseFloat(editingArcValue), inhibitor: editingArcInhibitor });
    }
    setEditingArc(null);
  }, [editingArc, editingArcValue, editingArcInhibitor, arcs, updateArc]);
  const cancelEditArc = useCallback(() => { setEditingArc(null); setEditingArcValue(""); }, []);

  // ── Édition en ligne : marquage initial d'une place ──────────────────
  const startEditPlace = useCallback((p: PetriPlace) => {
    if (addArcMode || !isInitialStep) return;
    setEditingPlace(p.id); setEditingPlaceValue(String(initialMarking[p.id] ?? 0));
  }, [addArcMode, isInitialStep, initialMarking]);
  const confirmEditPlace = useCallback(() => {
    if (editingPlace && isValidTokenInput(editingPlaceValue)) setInitialTokens(editingPlace, parseFloat(editingPlaceValue));
    setEditingPlace(null);
  }, [editingPlace, editingPlaceValue, setInitialTokens]);
  const cancelEditPlace = useCallback(() => { setEditingPlace(null); setEditingPlaceValue(""); }, []);

  // ── Clic fond de canevas ─────────────────────────────────────────────
  const onClickSvg = useCallback((e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    setSelected(null); setEditingArc(null); setEditingPlace(null); setCtxMenu(null);
    if (addArcMode) {
      if (pendingArc) cancelPendingArc();
      else { setArcSource(null); setArcHoverTarget(null); setCursorPos(null); }
    }
  }, [addArcMode, pendingArc, cancelPendingArc]);

  /** Double-clic sur le fond : ajoute une place (ou une transition avec Alt). */
  const onDoubleClickSvg = useCallback((e: React.MouseEvent) => {
    if (addArcMode || e.defaultPrevented) return;
    const { x, y } = getSvgCoords(e.clientX, e.clientY);
    if (e.altKey) {
      const id = `t_${Date.now()}`;
      addTransition({ id, label: `T${transitions.length + 1}`, x, y });
    } else {
      const id = `p_${Date.now()}`;
      addPlace({ id, label: `P${places.length + 1}`, x, y });
    }
  }, [addArcMode, getSvgCoords, addPlace, addTransition, places.length, transitions.length]);

  // ── Clavier ───────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pendingArc) cancelPendingArc();
        else if (editingArc) cancelEditArc();
        else if (editingPlace) cancelEditPlace();
        else setCtxMenu(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !editingArc && !editingPlace && !(e.target as HTMLElement).closest("input, textarea")) {
        if (placeMap.has(selected)) removePlace(selected); else if (transMap.has(selected)) removeTransition(selected);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingArc, editingArc, editingPlace, selected, cancelPendingArc, cancelEditArc, cancelEditPlace, placeMap, transMap, removePlace, removeTransition]);

  // ── Événements toolbar (émis via window, comme Dantzig) ──────────────
  useEffect(() => {
    const handlers: [string, () => void][] = [["petri-zoom-in", zoomIn], ["petri-zoom-out", zoomOut], ["petri-fit-view", fitView]];
    handlers.forEach(([ev, fn]) => window.addEventListener(ev, fn));
    return () => handlers.forEach(([ev, fn]) => window.removeEventListener(ev, fn));
  }, [zoomIn, zoomOut, fitView]);

  // Mesure le canevas (pour le store) ET déclenche l'auto-cadrage une seule
  // fois, dès que le conteneur a une taille exploitable — évite de dépendre
  // du timing du tout premier rendu (souvent 0×0 avant que le layout flex
  // ne se stabilise) en réutilisant le ResizeObserver déjà en place.
  useEffect(() => {
    if (!svgRef.current) return;
    const update = () => {
      const r = svgRef.current!.getBoundingClientRect();
      setCanvasSize(r.width, r.height);
      if (!didAutoFit.current && r.width > 0 && r.height > 0 && (places.length > 0 || transitions.length > 0)) {
        didAutoFit.current = true;
        fitView();
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [setCanvasSize, fitView, places.length, transitions.length]);

  // Recadre la vue quand la STRUCTURE change (changement de preset, import
  // JSON, ajout/suppression de nœuds) — sinon un nouveau réseau chargé dans
  // un canevas déjà monté resterait hors du viewport. fitView est appelé via
  // une ref pour ne pas dépendre de son identité (recréée à chaque drag).
  const structureSig = `${places.length}:${transitions.length}:${arcs.length}`;
  const fitViewRef = useRef(fitView);
  useEffect(() => { fitViewRef.current = fitView; });
  useEffect(() => {
    if (!didAutoFit.current) return;
    const t = setTimeout(() => fitViewRef.current(), 60);
    return () => clearTimeout(t);
  }, [structureSig]);

  const previewPath = useMemo(() => {
    if (!addArcMode || !arcSource || pendingArc || !cursorPos) return null;
    const from = posOf(arcSource), fk = kindOf(arcSource);
    if (!from || !fk) return null;
    return buildEdgePath(from, cursorPos, fk, "place", 0);
  }, [addArcMode, arcSource, pendingArc, cursorPos, posOf, kindOf]);

  // NB : `isPanning.current` n'est volontairement PAS lu pendant le rendu
  // (règle react-hooks/refs) : le curseur "grabbing" du pan est perdu, ce
  // qui est un cosmetic mineur face à la correction du pattern.
  const svgCursor = addArcMode ? (arcSource ? "crosshair" : "cell") : dragging ? "grabbing" : "default";

  // ── Rendu des jetons à l'intérieur d'une place ───────────────────────
  const renderTokens = (count: number) => {
    if (count === 0) return null;
    if (count <= 4) {
      const positions: XY[] =
        count === 1 ? [{ x: 0, y: 0 }] :
        count === 2 ? [{ x: -7, y: 0 }, { x: 7, y: 0 }] :
        count === 3 ? [{ x: 0, y: -7 }, { x: -7, y: 6 }, { x: 7, y: 6 }] :
        [{ x: -7, y: -7 }, { x: 7, y: -7 }, { x: -7, y: 7 }, { x: 7, y: 7 }];
      return <>{positions.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4.2} fill="#334155" />)}</>;
    }
    return (
      <text textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill="#334155" style={{ pointerEvents: "none" }}>
        {count}
      </text>
    );
  };

  return (
    <svg
      ref={svgRef} role="img" aria-label="Réseau de Petri interactif" className="w-full h-full select-none"
      style={{ cursor: svgCursor, outline: "none" }}
      onPointerDown={onPointerDownSvg} onPointerMove={onPointerMoveSvg} onPointerUp={onPointerUpSvg}
      onClick={onClickSvg} onDoubleClick={onDoubleClickSvg} onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <defs>
        <ArrowMarker id="parrow" fill="#94a3b8" />
        <ArrowMarker id="parrow-active" fill="#2563eb" />
        <ArrowMarker id="parrow-hover" fill="#475569" />
        <ArrowMarker id="parrow-preview" fill="#3b82f6" />
        <ArrowMarker id="parrow-pending" fill="#7c3aed" />
        <filter id="pnode-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.10" />
        </filter>
        <filter id="pglow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#16a34a" floodOpacity="0.55" />
        </filter>
        <filter id="pglow-amber" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.6" />
        </filter>
        <filter id="pglow-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#3b82f6" floodOpacity="0.5" />
        </filter>
      </defs>

      <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
        {/* ── ARCS ── */}        {arcs.map((a) => {
          const path = getArcPath(a);
          const active = isArcActiveInLastFiring(a);
          const isHov = hoveredArc === a.id;
          const isEditing = editingArc === a.id;
          const mid = getArcMid(a);
          // Un arc inhibiteur reste gris/rose pour rester bien distinct des
          // arcs directs (bleu = actif, gris = inactif).
          const INACTIVE_INHIB = "#e879f9";
          const color = a.inhibitor ? INACTIVE_INHIB : active ? "#2563eb" : isHov ? "#475569" : "#94a3b8";
          const marker = a.inhibitor ? undefined : active ? "url(#parrow-active)" : isHov ? "url(#parrow-hover)" : "url(#parrow)";
          const showBadge = a.weight !== 1 || isEditing;

          // Point d'ancrage du cercle inhibiteur : début du path (côté place)
          const from = posOf(a.from), to = posOf(a.to);
          const fk = kindOf(a.from), tk = kindOf(a.to);
          let inhPos: XY | null = null;
          if (a.inhibitor && from && to && fk && tk && fk === "place") {
            const v = vec(from, to);
            if (v.len > 0) {
              const startLen = nodeRadius("place") + 11;
              const midLen = v.len / 2;
              const t = Math.min(0.5, startLen / midLen);
              const qx = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ((from.x + to.x) / 2 - v.ny * (curvature(v.len) + getLateral(a))) + t * t * to.x;
              const qy = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * ((from.y + to.y) / 2 + v.nx * (curvature(v.len) + getLateral(a))) + t * t * to.y;
              inhPos = { x: qx, y: qy };
            }
          }

          return (
            <g key={a.id} onMouseEnter={() => setHoveredArc(a.id)} onMouseLeave={() => setHoveredArc(null)} onContextMenu={(e) => onContextMenuArc(e, a)}
              onDoubleClick={(e) => { e.stopPropagation(); if (!addArcMode) updateArc(a.id, { inhibitor: !a.inhibitor }); }}
              style={{ cursor: addArcMode ? "default" : "pointer" }}>
              <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
              <path
                d={path} fill="none" stroke={color} strokeWidth={active && !a.inhibitor ? 2 : isHov ? 1.8 : 1.4}
                strokeLinecap="round" markerEnd={marker}
                style={{ transition: "stroke 0.15s, stroke-width 0.15s", pointerEvents: "none" }}
              />
              {inhPos && (
                <circle cx={inhPos.x} cy={inhPos.y} r={5.5} fill="#ffffff" stroke={color} strokeWidth={1.6}
                  style={{ pointerEvents: "none", transition: "stroke 0.15s" }} />
              )}
              {showBadge && (isEditing ? (
                <InlineNumberEditor
                  x={mid.x} y={mid.y} value={editingArcValue} onChange={setEditingArcValue}
                  onConfirm={confirmEditArc} onCancel={cancelEditArc} inputRef={editInputRef} label="Poids de l'arc"
                  inhibitor={editingArcInhibitor} onToggleInhibitor={() => setEditingArcInhibitor((v) => !v)}
                />
              ) : (
                <g style={{ cursor: "text" }} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); startEditArc(a); }}>
                  <rect x={mid.x - 11} y={mid.y - 10} width={22} height={20} rx={6} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.8} />
                  <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="ui-monospace, monospace" fill={a.inhibitor ? "#a21caf" : "#64748b"} style={{ pointerEvents: "none" }}>
                    {a.inhibitor ? "0" : a.weight}
                  </text>
                </g>
              ))}
            </g>
          );
        })}

        {previewPath && (
          <path d={previewPath} fill="none" stroke="#3b82f6" strokeWidth={1.8} strokeDasharray="7 4" markerEnd="url(#parrow-preview)" opacity={0.7} style={{ pointerEvents: "none" }} />
        )}

        {pendingArc && (() => {
          const from = posOf(pendingArc.fromId), to = posOf(pendingArc.toId);
          const fk = kindOf(pendingArc.fromId), tk = kindOf(pendingArc.toId);
          if (!from || !to || !fk || !tk) return null;
          const path = buildEdgePath(from, to, fk, tk, BIDIRECTIONAL_OFFSET);
          return <path d={path} fill="none" stroke="#7c3aed" strokeWidth={2} strokeDasharray="7 3" markerEnd="url(#parrow-pending)" opacity={0.85} style={{ pointerEvents: "none" }} />;
        })()}

        {/* ── TRANSITIONS ── */}
        {transitions.map((t) => {
          const enabled = isTransitionEnabled(t.id);
          const conflict = isTransitionPendingConflict(t.id);
          const lastFired = isTransitionLastFired(t.id);
          const isArcSrc = addArcMode && arcSource === t.id;

          const fill = conflict ? "#f59e0b" : lastFired ? "#3b82f6" : enabled ? "#16a34a" : isArcSrc ? "#2563eb" : "#94a3b8";
          const filter = conflict ? "url(#pglow-amber)" : lastFired ? "url(#pglow-blue)" : enabled ? "url(#pglow-green)" : "url(#pnode-shadow)";
          const clickable = addArcMode || enabled || conflict;

          return (
            <g
              key={t.id}
              transform={`translate(${t.x},${t.y})`}
              role="button" aria-label={`Transition ${t.label}`} tabIndex={0}
              onPointerDown={(e) => onPointerDownNode(e, t.id)}
              onPointerEnter={() => addArcMode && arcSource && !pendingArc && setArcHoverTarget(t.id)}
              onPointerLeave={() => setArcHoverTarget(null)}
              onClick={(e) => onClickNode(e, t.id)}
              onContextMenu={(e) => onContextMenuNode(e, t.id, "transition")}
              filter={filter}
              style={{
                cursor: clickable ? "pointer" : "default",
                opacity: !addArcMode && !enabled && !conflict ? 0.55 : 1,
                transition: "opacity 0.15s",
                outline: "none",
              }}
            >
              {conflict && (
                <rect x={-TRANS_W / 2 - 6} y={-TRANS_H / 2 - 6} width={TRANS_W + 12} height={TRANS_H + 12} rx={6}
                  fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.5} strokeDasharray="4 3">
                  <animate attributeName="opacity" values="0.25;0.7;0.25" dur="1.1s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={-TRANS_W / 2} y={-TRANS_H / 2} width={TRANS_W} height={TRANS_H} rx={3} fill={fill} stroke="#0f172a10" strokeWidth={1} style={{ transition: "fill 0.15s" }} />
              <text x={0} y={TRANS_H / 2 + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" style={{ pointerEvents: "none" }}>
                {t.label}
              </text>
            </g>
          );
        })}

        {/* ── PLACES ── */}
        {places.map((p) => {
          const tokens = getTokenCount(p.id);
          const isSel = selected === p.id;
          const isArcSrc = addArcMode && arcSource === p.id;
          const isEditing = editingPlace === p.id;
          const editable = isInitialStep && !addArcMode;

          const stroke = isArcSrc ? "#3b82f6" : isSel ? "#3b82f6" : tokens > 0 ? "#94a3b8" : "#e2e8f0";
          const strokeWidth = isArcSrc ? 2.5 : isSel ? 2 : 1.5;
          const filter = isArcSrc ? "url(#pglow-blue)" : "url(#pnode-shadow)";

          return (
            <g
              key={p.id}
              transform={`translate(${p.x},${p.y})`}
              role="button" aria-label={`Place ${p.label}`} tabIndex={0}
              onPointerDown={(e) => onPointerDownNode(e, p.id)}
              onPointerEnter={() => addArcMode && arcSource && !pendingArc && setArcHoverTarget(p.id)}
              onPointerLeave={() => setArcHoverTarget(null)}
              onClick={(e) => onClickNode(e, p.id)}
              onContextMenu={(e) => onContextMenuNode(e, p.id, "place")}
              filter={filter}
              style={{ cursor: addArcMode ? "pointer" : dragging === p.id ? "grabbing" : "grab", outline: "none" }}
            >
              {isArcSrc && (
                <circle r={PLACE_RADIUS + 8} fill="none" stroke="#3b82f6" strokeWidth={1.5} opacity={0.35} strokeDasharray="5 3">
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="6s" repeatCount="indefinite" />
                </circle>
              )}
              {!addArcMode && isSel && dragging !== p.id && (
                <circle r={PLACE_RADIUS + 5} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.5} />
              )}

              <circle r={PLACE_RADIUS} fill="#ffffff" stroke={stroke} strokeWidth={strokeWidth} style={{ transition: "stroke 0.15s" }} />

              {isEditing ? (
                <InlineNumberEditor
                  x={0} y={0} value={editingPlaceValue} onChange={setEditingPlaceValue}
                  onConfirm={confirmEditPlace} onCancel={cancelEditPlace} inputRef={editInputRef} label={`Jetons initiaux de ${p.label}`}
                />
              ) : (
                <g
                  style={{ cursor: editable ? "text" : "default" }}
                  onPointerDown={(e) => editable && e.stopPropagation()}
                  onClick={(e) => { if (editable) { e.stopPropagation(); startEditPlace(p); } }}
                >
                  {renderTokens(tokens)}
                </g>
              )}

              <text x={0} y={PLACE_RADIUS + 16} textAnchor="middle" fontSize={11} fontWeight={600} fill="#475569" style={{ pointerEvents: "none" }}>
                {p.label}
              </text>
            </g>
          );
        })}

        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y}
            label={ctxMenu.type === "place" ? "Place" : ctxMenu.type === "transition" ? "Transition" : "Arc"}
            onDelete={() => {
              if (ctxMenu.type === "place") removePlace(ctxMenu.id);
              else if (ctxMenu.type === "transition") removeTransition(ctxMenu.id);
              else removeArc(ctxMenu.id);
            }}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </g>

      {pendingArc && (
        <foreignObject x={pendingArc.midX * zoom + pan.x - 82} y={pendingArc.midY * zoom + pan.y - 60} width={180} height={130} style={{ overflow: "visible" }}>
          <div
            style={{ background: "#fff", border: "1.5px solid #ddd6fe", borderRadius: 14, boxShadow: "0 6px 30px rgba(124,58,237,0.16), 0 1px 4px rgba(0,0,0,0.07)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, userSelect: "none" }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 10, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.08em" }}>Poids de l'arc</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                ref={weightInputRef} type="number" min={1} step={1} value={pendingWeight}
                onChange={(e) => setPendingWeight(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmArc(); } if (e.key === "Escape") cancelPendingArc(); }}
                aria-label="Poids de l'arc"
                style={{ width: 62, padding: "5px 8px", fontSize: 13, fontWeight: 600, border: "1px solid #ede9fe", borderRadius: 8, outline: "none", color: "#5b21b6", background: "#faf5ff", fontFamily: "ui-monospace, monospace" }}
              />
              <button onClick={confirmArc} style={{ flex: 1, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "5px 0" }}>OK</button>
              <button onClick={cancelPendingArc} style={{ width: 28, height: 28, background: "#f1f5f9", color: "#94a3b8", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer" }}>×</button>
            </div>
            <button
              onClick={() => setPendingArc({ ...pendingArc, inhibitor: !pendingArc.inhibitor })}
              title="Arc inhibiteur (test de zéro : la place doit être VIDE pour franchir la transition, rien n'est consommé)"
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600,
                padding: "5px 8px", borderRadius: 8, cursor: "pointer",
                border: pendingArc.inhibitor ? "1.5px solid #d946ef" : "1px solid #e2e8f0",
                background: pendingArc.inhibitor ? "#fdf4ff" : "#f8fafc",
                color: pendingArc.inhibitor ? "#a21caf" : "#64748b",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", border: "1.8px solid currentColor", display: "inline-block" }} />
              Arc inhibiteur (teste = 0)
            </button>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}
