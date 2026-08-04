// components/petri/AddPetriNodeForm.tsx
import { useState } from "react";
import type { PetriPlace, PetriTransition } from "../../types/petri";

function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(" "); }

interface Props {
  onAddPlace: (p: PetriPlace, tokens: number) => void;
  onAddTransition: (t: PetriTransition) => void;
  theme: "dark" | "light";
  onClose: () => void;
}

export default function AddPetriNodeForm({ onAddPlace, onAddTransition, theme, onClose }: Props) {
  const isDark = theme === "dark";
  const [kind, setKind] = useState<"place" | "transition">("place");
  const [label, setLabel] = useState("");
  const [tokens, setTokens] = useState("0");

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const x = 400 + (Math.random() - 0.5) * 120;
    const y = 300 + (Math.random() - 0.5) * 120;
    if (kind === "place") {
      onAddPlace({ id: `p_${Date.now()}`, label: trimmed, x, y }, Math.max(0, parseInt(tokens, 10) || 0));
    } else {
      onAddTransition({ id: `t_${Date.now()}`, label: trimmed, x, y });
    }
    onClose();
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cx(
        "w-full max-w-sm rounded-2xl border shadow-2xl p-5 animate-in zoom-in-95 duration-150",
        isDark ? "bg-slate-900 border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-900"
      )}
    >
      <h3 className="text-sm font-bold mb-4">Ajouter au réseau</h3>

      <div className={cx("flex p-0.5 rounded-lg border mb-4", isDark ? "bg-slate-950/50 border-white/5" : "bg-slate-100 border-slate-200")}>
        {(["place", "transition"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cx(
              "flex-1 py-1.5 rounded-md text-[11px] font-medium uppercase tracking-wide transition-all",
              kind === k
                ? "bg-indigo-600 text-white shadow-sm"
                : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {k === "place" ? "Place ○" : "Transition ▮"}
          </button>
        ))}
      </div>

      <label className={cx("block text-[10px] font-bold uppercase tracking-wider mb-1", isDark ? "text-slate-500" : "text-slate-400")}>
        Libellé
      </label>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
        placeholder={kind === "place" ? "ex. Barrière fermée" : "ex. Ouvrir"}
        className={cx(
          "w-full px-3 py-2 rounded-lg text-sm border outline-none mb-3",
          isDark ? "bg-slate-950/60 border-white/10 text-slate-100 placeholder:text-slate-600" : "bg-slate-50 border-slate-200 placeholder:text-slate-400"
        )}
      />

      {kind === "place" && (
        <>
          <label className={cx("block text-[10px] font-bold uppercase tracking-wider mb-1", isDark ? "text-slate-500" : "text-slate-400")}>
            Jetons initiaux
          </label>
          <input
            type="number" min={0} step={1} value={tokens}
            onChange={(e) => setTokens(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            className={cx(
              "w-24 px-3 py-2 rounded-lg text-sm border outline-none mb-3 font-mono",
              isDark ? "bg-slate-950/60 border-white/10 text-slate-100" : "bg-slate-50 border-slate-200"
            )}
          />
        </>
      )}

      <div className="flex gap-2 mt-3">
        <button onClick={onClose} className={cx("flex-1 py-2 rounded-lg text-xs font-medium", isDark ? "bg-white/5 hover:bg-white/10 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-700")}>
          Annuler
        </button>
        <button
          onClick={submit}
          disabled={!label.trim()}
          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:pointer-events-none"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}
