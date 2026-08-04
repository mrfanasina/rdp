/**
 * PetriLegend.tsx
 * ───────────────
 * Reproduit le bloc de légende qu'on trouve sous (ou à côté) de chaque
 * schéma du cours : une liste "P1 : ..." / "T1 : ..." qui explicite ce que
 * représente chaque place et chaque transition. Lit directement le champ
 * `description` de chaque place/transition dans le store — donc toute
 * place/transition ajoutée à la main sans description n'apparaît
 * simplement pas ici (rien à casser, rien à synchroniser).
 */

import { usePetriStore } from "../../store/petriStore";

interface PetriLegendProps {
  isDarkMode: boolean;
}

export default function PetriLegend({ isDarkMode }: PetriLegendProps) {
  const { places, transitions } = usePetriStore();

  const describedPlaces = places.filter((p) => p.description);
  const describedTransitions = transitions.filter((t) => t.description);

  if (describedPlaces.length === 0 && describedTransitions.length === 0) {
    return (
      <div className={`p-4 text-[11px] leading-relaxed ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        Aucune description renseignée. Ajoutez un champ <code className="px-1 rounded bg-slate-500/20">description</code> à
        une place ou une transition (formulaire d'ajout, ou éditeur JSON) pour qu'elle apparaisse ici — comme la légende
        "P1 : ..." sous les schémas du cours.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 text-[11px] leading-relaxed">
      {describedPlaces.length > 0 && (
        <div>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Places
          </h3>
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

      {describedTransitions.length > 0 && (
        <div>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
            Transitions
          </h3>
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
    </div>
  );
}
