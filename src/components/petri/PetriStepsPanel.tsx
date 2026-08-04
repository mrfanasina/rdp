// components/petri/PetriStepsPanel.tsx
// ─────────────────────────────────────────────────────────────────────────
// Panneau latéral droit : historique des franchissements + résolution des
// conflits. Miroir fonctionnel de StepsPanel.tsx (Dantzig), adapté au fait
// que l'historique d'un RDP grandit interactivement plutôt que d'être
// précalculé.
// ─────────────────────────────────────────────────────────────────────────

import { usePetriStore } from "../../store/petriStore";

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

interface Props { isDarkMode: boolean }

export default function PetriStepsPanel({ isDarkMode }: Props) {
  const {
    places, transitions, history, currentStepIndex, pendingConflict,
    setCurrentStepIndex, fireTransition, getCurrentMarking,
  } = usePetriStore();

  const marking = getCurrentMarking();

  return (
    <div className="flex flex-col h-full">
      {/* ── Marquage courant ── */}
      <div className={cx("p-3 border-b", isDarkMode ? "border-white/5" : "border-slate-200")}>
        <h3 className={cx("text-[10px] font-bold uppercase tracking-widest mb-2", isDarkMode ? "text-slate-500" : "text-slate-400")}>
          Marquage courant M
        </h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {places.map((p) => {
            const n = marking[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center justify-between text-[11px]">
                <span className={cx("truncate", isDarkMode ? "text-slate-400" : "text-slate-500")}>{p.label}</span>
                <span className={cx(
                  "font-mono font-bold tabular-nums px-1.5 rounded",
                  n > 0
                    ? isDarkMode ? "text-indigo-300 bg-indigo-500/10" : "text-indigo-700 bg-indigo-50"
                    : isDarkMode ? "text-slate-600" : "text-slate-300"
                )}>
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Conflit en attente ── */}
      {pendingConflict && (
        <div className={cx(
          "m-3 p-3 rounded-xl border animate-in fade-in duration-200",
          isDarkMode ? "bg-amber-500/10 border-amber-500/25" : "bg-amber-50 border-amber-200"
        )}>
          <p className={cx("text-[11px] font-semibold mb-2 flex items-center gap-1.5", isDarkMode ? "text-amber-300" : "text-amber-700")}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Conflit : {pendingConflict.length} transitions franchissables
          </p>
          <div className="flex flex-col gap-1.5">
            {pendingConflict.map((tid) => {
              const t = transitions.find((tr) => tr.id === tid);
              return (
                <button
                  key={tid}
                  onClick={() => fireTransition(tid)}
                  className={cx(
                    "text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors",
                    isDarkMode ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-200" : "bg-white hover:bg-amber-100 text-amber-800 border border-amber-200"
                  )}
                >
                  Franchir « {t?.label ?? tid} »
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Historique ── */}
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className={cx("text-[10px] font-bold uppercase tracking-widest px-1 mb-1.5", isDarkMode ? "text-slate-500" : "text-slate-400")}>
          Historique
        </h3>
        <div className="flex flex-col gap-1">
          {history.map((step, i) => {
            const isCurrent = i === currentStepIndex;
            const isPast = i < currentStepIndex;
            const t = step.firedTransition ? transitions.find((tr) => tr.id === step.firedTransition) : null;
            return (
              <button
                key={i}
                onClick={() => setCurrentStepIndex(i)}
                className={cx(
                  "text-left px-2.5 py-2 rounded-xl border transition-all duration-150 group",
                  isCurrent
                    ? isDarkMode ? "bg-indigo-600/20 border-indigo-500/40" : "bg-indigo-50 border-indigo-200"
                    : isDarkMode ? "bg-white/[0.02] border-white/5 hover:bg-white/5" : "bg-white border-slate-100 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cx(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0",
                    isCurrent ? "bg-indigo-600 text-white" : isPast ? "bg-emerald-400/80 text-white" : isDarkMode ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"
                  )}>
                    {i}
                  </span>
                  <span className={cx("text-[11px] font-medium leading-tight", isDarkMode ? "text-slate-200" : "text-slate-700")}>
                    {step.description}
                  </span>
                </div>
                {step.wasConflict && (
                  <span className={cx("ml-7 text-[9px] font-semibold uppercase tracking-wide", isDarkMode ? "text-amber-400" : "text-amber-600")}>
                    ⚠ conflit résolu
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
