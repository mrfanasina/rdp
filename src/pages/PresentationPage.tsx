// pages/PresentationPage.tsx
// ─────────────────────────────────────────────────────────────────────────
// Page de PRÉSENTATION du sujet principal : « Gestion des transactions
// chez un agent Mobile Money » (RdP coloré/temporisé avec arcs inhibiteurs).
//
// Rôle :
//  • présenter le sujet (contexte, ressources, paliers, alerte préventive) ;
//  • montrer le RdP interactif en fond (version dépliée, déjà simulable) ;
//  • permettre de lancer la démo complète (PetriPage) sur ce réseau.
//
// L'ancien sujet (carrefour) reste accessible : la page de présentation
// propose aussi la démo « Carrefour » en secondaire, et PetriPage garde un
// sélecteur de réseau à tout moment.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { usePetriStore } from "../store/petriStore";
import PetriCanvas from "../components/petri/PetriCanvas";
import { PETRI_NETS } from "../constants/petriConstants";

/** Remonte `true` quand l'élément entre dans le viewport (une seule fois). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, visible };
}

/** Bloc de contenu révélé au scroll (fondu + translation). */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${className} reveal ${visible ? "reveal-visible" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface PresentationPageProps {
  onEnterDemo: () => void;
}

export default function PresentationPage({ onEnterDemo }: PresentationPageProps) {
  const loadPreset = usePetriStore((s) => s.loadPreset);
  const loadNet = usePetriStore((s) => s.loadNet);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [networkMode, setNetworkMode] = useState<"main" | "demo">("main");
  const isDark = theme === "dark";

  // Charge le réseau Mobile Money (sujet principal) au montage.
  useEffect(() => {
    loadPreset("mobile-money");
  }, [loadPreset]);

  const openDemo = (mode: "main" | "demo") => {
    loadPreset(mode === "main" ? "mobile-money" : "carrefour");
    onEnterDemo();
  };

  const switchNetwork = (mode: "main" | "demo") => {
    setNetworkMode(mode);
    const net = mode === "main" ? PETRI_NETS["mobile-money"] : PETRI_NETS.carrefour;
    loadNet(net);
  };

  const surface = isDark
    ? "bg-slate-950 text-slate-100 selection:bg-emerald-500/30"
    : "bg-slate-50 text-slate-900 selection:bg-emerald-200";
  const card = isDark
    ? "bg-white/[0.04] border-white/10"
    : "bg-white border-slate-200 shadow-sm";
  const kicker = "text-[11px] font-bold uppercase tracking-[0.25em]";
  const chip = `px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
    isDark ? "border-white/10 bg-white/5 text-slate-300" : "border-slate-200 bg-slate-100 text-slate-600"
  }`;

  return (
    <div className={`min-h-screen w-full overflow-y-auto font-sans transition-colors duration-500 ${surface}`}>
      {/* ── Fond ambiant ─────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className={`absolute top-[-25%] left-[-15%] w-[60vw] h-[60vw] rounded-full blur-[160px] transition-colors duration-700 ${isDark ? "bg-emerald-500/10" : "bg-emerald-300/30"}`} />
        <div className={`absolute bottom-[-20%] right-[-15%] w-[50vw] h-[50vw] rounded-full blur-[160px] transition-colors duration-700 ${isDark ? "bg-indigo-500/10" : "bg-indigo-300/25"}`} />
        <div className={`absolute top-[30%] right-[10%] w-[24vw] h-[24vw] rounded-full blur-[120px] ${isDark ? "bg-fuchsia-500/6" : "bg-fuchsia-200/40"} petri-float-slow`} />
      </div>

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-500 ${isDark ? "border-white/5 bg-slate-950/70" : "border-slate-200/70 bg-white/70"}`}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-400 to-emerald-600 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 text-sm font-black">₥</div>
            <div className="flex flex-col leading-none">
              <span className="text-[11px] font-bold tracking-widest uppercase">Projet RdP</span>
              <span className="text-[10px] text-emerald-500 font-medium">Agent Mobile Money</span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all active:scale-95 ${
                isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-200 hover:bg-slate-100 text-slate-600"
              }`}
            >
              {isDark ? "☀ Clair" : "☾ Sombre"}
            </button>
            <button
              onClick={() => openDemo("main")}
              className="px-4 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              Ouvrir la démo →
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Reveal>
              <p className={`${kicker} text-emerald-500 mb-4`}>Sujet principal · Réseaux de Petri</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-4xl md:text-5xl font-black leading-[1.05] tracking-tight">
                Gestion des transactions chez un{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  agent Mobile Money
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className={`mt-6 text-sm leading-relaxed max-w-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Dépôts, retraits et transferts autour d'un guichet unique, avec deux ressources
                antagonistes — la <strong className={isDark ? "text-slate-200" : "text-slate-800"}>caisse (cash)</strong> et le{" "}
                <strong className={isDark ? "text-slate-200" : "text-slate-800"}>solde électronique (e-value)</strong> — gérées
                en deux paliers pour déclencher une alerte <em>préventive</em> avant la rupture, et un réapprovisionnement
                en parallèle du service client.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className={chip}>RdP coloré</span>
                <span className={chip}>Temporisé (T1 · T5 · T11)</span>
                <span className={chip}>Arcs inhibiteurs</span>
                <span className={chip}>Dépliage par couleurs</span>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openDemo("main")}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/25 transition-all active:scale-95 petri-pulse-cta"
                >
                  ▶ Simuler le réseau Mobile Money
                </button>
                <button
                  onClick={() => openDemo("demo")}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                  title="L'ancien sujet, conservé comme démonstration"
                >
                  Démo : Carrefour à feux (ancien sujet)
                </button>
              </div>
            </Reveal>
          </div>

          {/* Carte réseau : aperçu du modèle déplié, déjà interactif */}
          <Reveal delay={200}>
            <div className={`relative rounded-3xl border overflow-hidden backdrop-blur-sm transition-colors duration-500 ${card}`}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b text-[10px] font-bold uppercase tracking-widest ${isDark ? "border-white/5 text-slate-400" : "border-slate-200 text-slate-500"}`}>
                <span>Aperçu du réseau (déplié, interactif)</span>
                <div className="flex gap-1">
                  {(["main", "demo"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchNetwork(m)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${
                        networkMode === m
                          ? "bg-emerald-600 text-white"
                          : isDark ? "bg-white/5 text-slate-400 hover:text-slate-200" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m === "main" ? "Mobile Money" : "Carrefour"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[380px]">
                <PetriCanvas />
              </div>
              <div className={`px-4 py-2 border-t text-[10px] leading-relaxed ${isDark ? "border-white/5 text-slate-500" : "border-slate-200 text-slate-400"}`}>
                Les arcs <span className="text-fuchsia-500 font-semibold">⊙ (cercle)</span> sont des{" "}
                <strong>arcs inhibiteurs</strong> : la place source doit être vide pour tirer la transition —
                c'est ce qui matérialise les gardes « palier Normale = 0 » du sujet.
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── LE PROBLÈME ─────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-emerald-500 mb-3`}>Le problème</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-10">Trois opérations, deux ressources opposées</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "↓", name: "Dépôt", effect: "e-value −1 → cash +1", color: "text-emerald-400" },
              { icon: "↑", name: "Retrait", effect: "cash −1 → e-value +1", color: "text-sky-400" },
              { icon: "⇄", name: "Transfert", effect: "aucun effet direct (commission)", color: "text-amber-400" },
            ].map((op, i) => (
              <Reveal key={op.name} delay={i * 120}>
                <div className={`h-full rounded-2xl border p-6 transition-colors duration-500 ${card}`}>
                  <div className={`text-2xl mb-3 ${op.color}`}>{op.icon}</div>
                  <h3 className="text-sm font-bold mb-1">{op.name}</h3>
                  <p className={`text-[11px] font-mono leading-relaxed ${isDark ? "text-slate-400" : "text-slate-500"}`}>{op.effect}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={360}>
            <div className={`mt-4 rounded-2xl border p-6 text-[12px] leading-relaxed transition-colors duration-500 ${card}`}>
              <strong className="text-emerald-500">Un seul guichet</strong> (P2 AgentLibre = 1) traite les clients
              séquentiellement. Chaque transaction attend une <strong>confirmation PIN par SMS</strong> avec un délai
              limite de 30 s : les transitions de validation (T6/T7/T8) sont en{" "}
              <strong>compétition</strong> avec le timeout T5 — la confirmation reçue à temps n'est pas une transition
              dédiée, c'est un tir plus rapide que le timeout.
            </div>
          </Reveal>
        </section>

        {/* ── MÉCANIQUE CLÉ ───────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-emerald-500 mb-3`}>La mécanique clé</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-10">Paliers Normale / Réserve & alerte préventive</h2>
          </Reveal>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
            <Reveal>
              <ol className={`relative border-l-2 space-y-8 pl-6 ${isDark ? "border-white/10" : "border-slate-200"}`}>
                {[
                  { t: "Palier Normale consommé en priorité", d: "T6a/T7a tirent sur le palier normal : les clients sont servis normalement." },
                  { t: "Normale = 0 → alerte (T9a/T9b)", d: "Trois arcs inhibiteurs : Normale vide, pas d'alerte déjà active, pas de réappro en cours. L'alerte est unique et non redondante (changelog v3, maintenu en v4).", hl: true },
                  { t: "La Réserve prend le relais (T6b/T7b)", d: "Arc inhibiteur sur le palier Normale : on ne puise dans la réserve QUE si le normal est épuisé — les clients continuent d'être servis." },
                  { t: "Réapprovisionnement en parallèle (T10/T11)", d: "L'alerte devient un réappro en cours ; à la fin (d_reappro), K jetons rechargent le palier Normale. Le service n'a jamais cessé." },
                ].map((s, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[31px] w-3.5 h-3.5 rounded-full border-2 ${s.hl ? "bg-amber-400 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.7)]" : isDark ? "bg-slate-800 border-emerald-500" : "bg-white border-emerald-500"}`} />
                    <h4 className={`text-[13px] font-bold mb-1 ${s.hl ? "text-amber-400" : ""}`}>{i + 1}. {s.t}</h4>
                    <p className={`text-[11.5px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>{s.d}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal delay={150}>
              <div className={`rounded-2xl border p-6 transition-colors duration-500 ${card}`}>
                <h4 className={`${kicker} mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Pourquoi des arcs inhibiteurs ?</h4>
                <p className={`text-[12px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Une garde « palier Normale = 0 » est un <strong>test structurel</strong> : on veut savoir si la place
                  est vide, sans y consommer de jeton. Un test « &lt; 1 » par poids d'arc ne peut pas l'exprimer —
                  l'arc inhibiteur (⊙) si. C'est le choix du sujet (§9) : <strong>TINA</strong> les supporte nativement ;
                  <strong> CPN Tools</strong> demanderait une place complémentaire ou une garde ML (contournements à
                  documenter dans le rapport).
                </p>
                <div className={`mt-4 pt-4 border-t text-[11px] leading-relaxed ${isDark ? "border-white/5 text-slate-500" : "border-slate-200 text-slate-500"}`}>
                  Dans le simulateur : double-cliquez un arc pour basculer direct ↔ inhibiteur, ou cochez
                  « Arc inhibiteur » lors de la création (mode arc, touche A).
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── ANALYSE VISEE ───────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-emerald-500 mb-3`}>Analyse visée (§7 du sujet)</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-10">Ce que le modèle doit prouver</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { n: "01", t: "Absence de deadlock", d: "Peut-on atteindre cash = 0 ET e-value = 0 avec des clients en attente et aucun réappro en cours ? T9a/T9b/T10/T11 doivent l'empêcher par construction." },
              { n: "02", t: "Bornage en deux temps", d: "Places de fonctionnement (AgentLibre, TransactionEnCours…) bornées par construction ; places de journal (Validee/Echouee) non bornées — assumé, tant que T1 peut se redéclencher." },
              { n: "03", t: "Invariant de place", d: "Cash(N) + Cash(R) + Elec(N) + Elec(R) constant à travers T6/T7 (transferts internes), n'augmente qu'à travers T11 (injection externe)." },
              { n: "04", t: "Vivacité de l'agent", d: "AgentLibre revient-il toujours, quel que soit le scénario de consommation des paliers ? (T5/T9c/T9d libèrent toujours l'agent, même en échec.)" },
            ].map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className={`h-full rounded-2xl border p-6 transition-colors duration-500 ${card}`}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-2xl font-black text-emerald-500/70 font-mono">{c.n}</span>
                    <h3 className="text-sm font-bold">{c.t}</h3>
                  </div>
                  <p className={`text-[11.5px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── CTA FINAL ───────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <Reveal>
            <div className={`rounded-3xl border p-10 text-center transition-colors duration-500 ${card}`}>
              <h2 className="text-2xl font-black tracking-tight mb-2">Prêt à explorer le réseau ?</h2>
              <p className={`text-[12px] mb-8 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Simulateur interactif : franchissement au clic, conflits, historique navigable, matrice d'incidence, énoncé intégré.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => openDemo("main")}
                  className="px-6 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/25 transition-all active:scale-95"
                >
                  ▶ Sujet principal — Mobile Money
                </button>
                <button
                  onClick={() => openDemo("demo")}
                  className={`px-6 py-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  Démo — Carrefour (ancien sujet)
                </button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={`relative z-10 border-t py-6 text-center text-[10px] ${isDark ? "border-white/5 text-slate-600" : "border-slate-200 text-slate-400"}`}>
        Projet Réseaux de Petri — RdP coloré & temporisé avec arcs inhibiteurs · Sujet principal : Agent Mobile Money (v4)
      </footer>
    </div>
  );
}
