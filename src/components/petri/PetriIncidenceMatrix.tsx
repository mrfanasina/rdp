/**
 * PetriIncidenceMatrix.tsx
 * ────────────────────────
 * Affiche la définition algébrique du réseau telle que vue en cours :
 *   Pre[place, transition]  = poids de l'arc place → transition (consommé)
 *   Post[place, transition] = poids de l'arc transition → place (produit)
 *   W = Post − Pre                (matrice d'incidence)
 *
 * Les données viennent de `getIncidenceMatrices()`, déjà calculé dans
 * petriStore.ts — ce composant ne fait que les mettre en forme. Les labels
 * de lignes/colonnes utilisent le `label` court (P1, T1…) pour matcher
 * l'écriture du cours ; le nom complet reste consultable via PetriLegend.
 */

import { usePetriStore } from "../../store/petriStore";

interface MatrixTableProps {
  title: string;
  placeLabels: string[];
  transitionLabels: string[];
  data: number[][];
  isDarkMode: boolean;
}

function MatrixTable({ title, placeLabels, transitionLabels, data, isDarkMode }: MatrixTableProps) {
  const headCls = isDarkMode
    ? "border-white/10 text-slate-300 bg-slate-800/40"
    : "border-slate-200 text-slate-700 bg-slate-100";
  const cellCls = isDarkMode ? "border-white/10 text-slate-200" : "border-slate-200 text-slate-800";

  return (
    <div>
      <h4 className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        {title}
      </h4>
      <table className="border-collapse text-[11px] font-mono">
        <thead>
          <tr>
            <th className={`w-9 h-6 border ${headCls}`} />
            {transitionLabels.map((t, j) => (
              <th key={j} className={`w-9 h-6 border font-bold ${headCls}`}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {placeLabels.map((p, i) => (
            <tr key={i}>
              <th className={`w-9 h-6 border font-bold ${headCls}`}>{p}</th>
              {data[i].map((v, j) => (
                <td key={j} className={`w-9 h-6 border text-center ${cellCls} ${v !== 0 ? "font-bold" : "opacity-50"}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PetriIncidenceMatrixProps {
  isDarkMode: boolean;
}

export default function PetriIncidenceMatrix({ isDarkMode }: PetriIncidenceMatrixProps) {
  const { places, transitions, getIncidenceMatrices } = usePetriStore();
  const { placeIds, transitionIds, pre, post, w } = getIncidenceMatrices();

  if (placeIds.length === 0 || transitionIds.length === 0) {
    return (
      <div className={`p-4 text-[11px] ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
        Le réseau est vide : rien à représenter matriciellement.
      </div>
    );
  }

  const placeLabel = (id: string) => places.find((p) => p.id === id)?.label ?? id;
  const transLabel = (id: string) => transitions.find((t) => t.id === id)?.label ?? id;
  const placeLabels = placeIds.map(placeLabel);
  const transitionLabels = transitionIds.map(transLabel);

  return (
    <div className="p-4 space-y-5 overflow-x-auto">
      <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
        <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>Pre</strong>[Pi, Tj] = poids de l'arc entrant
        de Tj depuis Pi · <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>Post</strong>[Pi, Tj] = poids
        de l'arc sortant de Tj vers Pi · <strong className={isDarkMode ? "text-slate-200" : "text-slate-800"}>W = Post − Pre</strong>
        {" "}est la matrice d'incidence : Franchir Tj revient à ajouter la colonne j de W au marquage.
      </p>
      <MatrixTable title="Pre" placeLabels={placeLabels} transitionLabels={transitionLabels} data={pre} isDarkMode={isDarkMode} />
      <MatrixTable title="Post" placeLabels={placeLabels} transitionLabels={transitionLabels} data={post} isDarkMode={isDarkMode} />
      <MatrixTable title="W = Post − Pre" placeLabels={placeLabels} transitionLabels={transitionLabels} data={w} isDarkMode={isDarkMode} />
    </div>
  );
}
