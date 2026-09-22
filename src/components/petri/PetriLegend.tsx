/**
 * PetriLegend.tsx
 * ───────────────
 * Reproduit le bloc de légende qu'on trouve sous (ou à côté) de chaque
 * schéma du cours : l'ÉNONCÉ du problème modélisé, puis une liste
 * "P1 : ..." / "T1 : ..." qui explicite ce que représente chaque place et
 * chaque transition.
 *
 * L'énoncé (`statement`) est une donnée du réseau comme une autre : il est
 * lu/écrit dans le store et voyage dans le JSON exporté/importé. Il est
 * éditable directement ici (textarea repliable).
 */

import { useState } from "react";
import { usePetriStore } from "../../store/petriStore";

interface PetriLegendProps {
  isDarkMode: boolean;
  /** Énoncé du projet modélisé (champ `statement` du JSON exporté/importé). */
  statement: string;
  /** Édition de l'énoncé depuis le panneau Légende. */
  onStatementChange: (statement: string) => void;
}

export default function PetriLegend({ isDarkMode, statement, onStatementChange }: PetriLegendProps) {
  const { places, transitions } = usePetriStore();
  const [editingStatement, setEditingStatement] = useState(false);

  const describedPlaces = places.filter((p) => p.description);
  const describedTransitions = transitions.filter((t) => t.description);

  const head = () =>
    `text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`;

  return (
    <div className="p-4 space-y-5 text-[11px] leading-relaxed">
      {/* ── Énoncé du projet ──────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className={head()}>Énoncé du projet</h3>
          <button
            onClick={() => setEditingStatement((v) => !v)}
            className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors ${
              isDarkMode ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-500"
            }`}
            title="Modifier l'énoncé (il voyage avec le réseau à l'export)"
          >
            {editingStatement ? "Fermer" : "✎ Modifier"}
          </button>
        </div>

        {editingStatement ? (
          <textarea
            value={statement}
            onChange={(e) => onStatementChange(e.target.value)}
            rows={14}
            spellCheck={false}
            className={`w-full p-2.5 rounded-lg border text-[11px] font-mono resize-y outline-none leading-relaxed ${
              isDarkMode ? "bg-slate-950/60 border-white/10 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          />
        ) : statement.trim() ? (
          <pre
            className={`whitespace-pre-wrap font-sans rounded-lg p-2.5 border ${
              isDarkMode ? "bg-white/[0.03] border-white/5 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
            }`}
          >
            {statement}
          </pre>
        ) : (
          <p className={isDarkMode ? "text-slate-500 italic" : "text-slate-400 italic"}>
            Pas d'énoncé renseigné — cliquez « Modifier » pour l'écrire (il sera inclus dans le JSON exporté).
          </p>
        )}
      </div>

      {/* ── Places ────────────────────────────────────────────────────── */}
      {describedPlaces.length > 0 && (
        <div>
          <h3 className={head()}>Places</h3>
          <dl className="space-y-1.5">
            {describedPlaces.map((p) => (
              <div key={p.id} className="flex gap-1.5">
                <dt className={`font-mono font-bold flex-shrink-0 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {p.label} :
                </dt>
                <dd className={isDarkMode ? "text-slate-400" : "text-slate-600"}>{p.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* ── Transitions ───────────────────────────────────────────────── */}
      {describedTransitions.length > 0 && (
        <div>
          <h3 className={head()}>Transitions</h3>
          <dl className="space-y-1.5">
            {describedTransitions.map((t) => (
              <div key={t.id} className="flex gap-1.5">
                <dt className={`font-mono font-bold flex-shrink-0 ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
                  {t.label} :
                </dt>
                <dd className={isDarkMode ? "text-slate-400" : "text-slate-600"}>{t.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {describedPlaces.length === 0 && describedTransitions.length === 0 && (
        <p className={isDarkMode ? "text-slate-500" : "text-slate-400"}>
          Aucune description renseignée. Ajoutez un champ <code className="px-1 rounded bg-slate-500/20">description</code> à
          une place ou une transition (formulaire d'ajout, ou éditeur JSON) pour qu'elle apparaisse ici — comme la légende
          "P1 : ..." sous les schémas du cours.
        </p>
      )}
    </div>
  );
}
