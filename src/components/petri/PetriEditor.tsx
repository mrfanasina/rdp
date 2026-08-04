// components/petri/PetriEditor.tsx
// ─────────────────────────────────────────────────────────────────────────
// Volet gauche : édition textuelle du réseau (places / transitions / arcs /
// marquage initial) sous forme JSON, avec application différée (bouton
// "Appliquer"). Miroir de GraphEditor.tsx côté Dantzig.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { usePetriStore } from "../../store/petriStore";

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

interface Props { isDarkMode: boolean }

export default function PetriEditor({ isDarkMode }: Props) {
  const { places, transitions, arcs, initialMarking, setPlaces, setTransitions, setArcs, setInitialMarking } = usePetriStore();
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Resynchronise le texte affiché quand la structure change ailleurs
  // (canevas, import JSON…), mais jamais pendant que l'utilisateur tape
  // (sinon le curseur saute) — d'où la dépendance volontairement large mais
  // le `JSON.stringify` de comparaison implicite via `useEffect` seul.
  useEffect(() => {
    setText(JSON.stringify({ places, transitions, arcs, initialMarking }, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = () => {
    try {
      const data = JSON.parse(text);
      if (!Array.isArray(data.places) || !Array.isArray(data.transitions) || !Array.isArray(data.arcs)) {
        throw new Error("Structure attendue : { places: [], transitions: [], arcs: [], initialMarking: {} }");
      }
      setPlaces(data.places);
      setTransitions(data.transitions);
      setArcs(data.arcs);
      if (data.initialMarking) setInitialMarking(data.initialMarking);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "JSON invalide");
    }
  };

  const refresh = () => {
    setText(JSON.stringify({ places, transitions, arcs, initialMarking }, null, 2));
    setParseError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className={cx("p-3 border-b flex items-center justify-between", isDarkMode ? "border-white/5" : "border-slate-200")}>
        <h3 className={cx("text-[10px] font-bold uppercase tracking-widest", isDarkMode ? "text-slate-500" : "text-slate-400")}>
          Éditeur JSON du réseau
        </h3>
        <button
          onClick={refresh}
          title="Resynchroniser depuis le canevas"
          className={cx("text-[10px] px-2 py-1 rounded-md font-medium", isDarkMode ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500")}
        >
          ↻ Rafraîchir
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className={cx(
          "flex-1 p-3 text-[11px] font-mono resize-none outline-none leading-relaxed",
          isDarkMode ? "bg-slate-950/60 text-slate-300" : "bg-slate-50 text-slate-700"
        )}
      />

      {parseError && (
        <div className="px-3 py-2 text-[11px] text-red-400 bg-red-500/10 border-t border-red-500/20">{parseError}</div>
      )}

      <div className={cx("p-3 border-t", isDarkMode ? "border-white/5" : "border-slate-200")}>
        <button onClick={apply} className="w-full py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors">
          Appliquer (recalcule la simulation)
        </button>
      </div>
    </div>
  );
}
