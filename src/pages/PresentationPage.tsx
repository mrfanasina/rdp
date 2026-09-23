// pages/PresentationPage.tsx
// ─────────────────────────────────────────────────────────────────────────
// Page de PRÉSENTATION du sujet principal : « Centre de tri de colis avec
// contrôle qualité » (RdP coloré/temporisé, boucle de reprise bornée).
//
// Rôle :
//  • présenter le sujet (machine unique, contrôle qualité, compteur K) ;
//  • montrer le RdP interactif en fond (version dépliée, déjà simulable) ;
//  • permettre de lancer la démo complète (PetriPage) sur ce réseau.
//
// Le deuxième sujet (« Station de recharge VE ») et les anciens sujets
// restent accessibles : la page de présentation les propose dans l'aperçu
// et dans les CTA, et PetriPage garde un sélecteur de réseau à tout moment.
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
  // Réseau affiché dans l'aperçu : sujet principal, deuxième sujet ou
  // ancien sujet (conservé en démo).
  const [networkMode, setNetworkMode] = useState<"main" | "station" | "demo">("main");
  const isDark = theme === "dark";

  // Charge le réseau Centre de tri (sujet principal) au montage.
  useEffect(() => {
    loadPreset("centre-tri");
  }, [loadPreset]);

  // Slug du preset chargé selon le mode d'aperçu (sujets principaux et
  // anciens sujets, tous conservés dans PETRI_NETS).
  const NET_BY_MODE = {
    main: "centre-tri",
    station: "station-recharge",
    demo: "mobile-money",
  } as const;

  const openDemo = (mode: keyof typeof NET_BY_MODE) => {
    loadPreset(NET_BY_MODE[mode]);
    onEnterDemo();
  };

  const switchNetwork = (mode: keyof typeof NET_BY_MODE) => {
    setNetworkMode(mode);
    loadNet(PETRI_NETS[NET_BY_MODE[mode]]);
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
              <span className="text-[10px] text-emerald-500 font-medium">Centre de tri de colis</span>
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
                Centre de tri de colis avec{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  contrôle qualité
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className={`mt-6 text-sm leading-relaxed max-w-lg ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                Une seule machine de tri automatique, un contrôle qualité après chaque passage : un colis
                conforme est <strong className={isDark ? "text-slate-200" : "text-slate-800"}>expédié</strong>, un colis
                non conforme <strong className={isDark ? "text-slate-200" : "text-slate-800"}>retourne en file</strong> —
                mais au plus K = 3 fois. Au-delà, il est rejeté pour traitement manuel. La couleur de chaque jeton
                colis est son nombre d'essais e ∈ {"{0..K}"}, et la boucle de reprise garantit qu'aucun colis ne
                boucle à l'infini.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className={chip}>RdP coloré (couleur = essai e)</span>
                <span className={chip}>Temporisé (T1 · T3)</span>
                <span className={chip}>Boucle de reprise bornée (K = 3)</span>
                <span className={chip}>Dépliage par couleurs</span>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => openDemo("main")}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/25 transition-all active:scale-95 petri-pulse-cta"
                >
                  ▶ Simuler le réseau Centre de tri
                </button>
                <button
                  onClick={() => openDemo("station")}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                  title="Le deuxième sujet : N points de charge partagés, rapide/standard, abandons"
                >
                  ▶ Station de recharge VE (2ᵉ sujet)
                </button>
                <button
                  onClick={() => openDemo("demo")}
                  className={`px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                  title="L'ancien sujet, conservé comme démonstration"
                >
                  Ancien sujet : Mobile Money
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
                  {(["main", "station", "demo"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => switchNetwork(m)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${
                        networkMode === m
                          ? "bg-emerald-600 text-white"
                          : isDark ? "bg-white/5 text-slate-400 hover:text-slate-200" : "bg-slate-100 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {m === "main" ? "Centre de tri" : m === "station" ? "Station VE" : "Mobile Money"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[380px]">
                <PetriCanvas />
              </div>
              <div className={`px-4 py-2 border-t text-[10px] leading-relaxed ${isDark ? "border-white/5 text-slate-500" : "border-slate-200 text-slate-400"}`}>
                {networkMode === "main" && (
                  <>
                    Structure du cours : <strong>P1..P6 · T1..T6</strong>. La couleur « essai e » est matérialisée par le
                    compteur <strong>P7 (K = 3)</strong> : T5 consomme un crédit (e &lt; K) et T6 exige P7 vide via un
                    arc <span className="text-fuchsia-500 font-semibold">⊙ inhibiteur</span> (e = K). La machine
                    garantit <strong>P2 + P3 = 1</strong> en permanence.
                  </>
                )}
                {networkMode === "station" && (
                  <>
                    Structure du cours : <strong>P1..P5 · T1..T4</strong>, N = 6 points de charge partagés. Invariant de
                    capacité <strong>P1 + P3 = N</strong> ; T2 (branchement, immédiate) et T4 (abandon, temporisée) sont
                    en <strong>compétition</strong> sur la file P2 ; T3 libère le point — sa durée dépend de la couleur
                    (Rapide ≈ 20 min, Standard ≈ 2 h).
                  </>
                )}
                {networkMode === "demo" && (
                  <>
                    Les arcs <span className="text-fuchsia-500 font-semibold">⊙ (cercle)</span> sont des{" "}
                    <strong>arcs inhibiteurs</strong> : la place source doit être vide pour tirer la transition —
                    c'est ce qui matérialise les gardes « palier Normale = 0 » du sujet.
                  </>
                )}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── LE PROBLÈME ─────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-emerald-500 mb-3`}>Le problème</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-10">Une machine, un contrôle, un compteur d'essais</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "⚙", name: "Machine unique", effect: "P2 MachineLibre = 1 · invariant P2 + P3 = 1", color: "text-emerald-400" },
              { icon: "✓", name: "Contrôle qualité", effect: "conforme → P5 Expedie · non conforme → retri", color: "text-sky-400" },
              { icon: "↻", name: "Reprise bornée", effect: "e croît à chaque échec · rejet à e = K", color: "text-amber-400" },
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
              <strong className="text-emerald-500">Un seul colis à la fois</strong> dans le pipeline machine + contrôle
              (conséquence de l'invariant <strong>P2 + P3 = 1</strong>). Après le tri, T4/T5/T6 sont en{" "}
              <strong>conflit</strong> sur le jeton de P4(e) — le résultat du contrôle départage T4 (conforme) de
              T5/T6 (non conforme), et la valeur de e départage T5 (e &lt; K) de T6 (e = K).
            </div>
          </Reveal>
        </section>

        {/* ── MÉCANIQUE CLÉ ───────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-emerald-500 mb-3`}>La mécanique clé</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-10">Boucle de reprise bornée par le compteur d'essais</h2>
          </Reveal>
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
            <Reveal>
              <ol className={`relative border-l-2 space-y-8 pl-6 ${isDark ? "border-white/10" : "border-slate-200"}`}>
                {[
                  { t: "Arrivée et premier essai (e = 0)", d: "T1 place un colis dans P1 (stock fini P8 : quand il est vide, plus aucune arrivée — la simulation peut se terminer) ; T2 l'engage dès que P2 MachineLibre est disponible." },
                  { t: "Tri, puis verdict qualité", d: "T3 rend la machine (invariant préservé) et dépose le colis dans P4. T4 expédie si conforme ; T5 retrié si non conforme — conflit rejoué au clic.", hl: true },
                  { t: "Retour en file : e croît strictement", d: "T5 consomme un crédit du compteur P7 (K = 3) : chaque reprise augmente strictement le nombre d'essais — exactement la récurrence du sujet." },
                  { t: "Rejet définitif à e = K", d: "T6 a un arc inhibiteur depuis P7 (⊙) : elle ne peut tirer que lorsque le compteur est VIDE — après K échecs, le colis part dans P6. Aucune boucle infinie n'est possible." },
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
                <h4 className={`${kicker} mb-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Pourquoi P7 et P8 ?</h4>
                <p className={`text-[12px] leading-relaxed ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                  Le sujet est un RdP <strong>coloré</strong> (couleur = nombre d'essais e) ; le simulateur manipule un
                  RdP ordinaire. La couleur est donc matérialisée par deux conventions clairement documentées : le
                  compteur <strong>P7</strong> (e = K − jetons(P7)) avec l'arc inhibiteur ⊙ pour la garde « e = K », et
                  le stock fini <strong>P8</strong> qui rend la terminaison <strong>démontrable en simulation</strong> —
                  T1 étant une transition source dans le sujet, elle resterait sinon toujours franchissable.
                </p>
                <div className={`mt-4 pt-4 border-t text-[11px] leading-relaxed ${isDark ? "border-white/5 text-slate-500" : "border-slate-200 text-slate-500"}`}>
                  Délais du sujet : T1 (arrivées, temporisée), T3 (passage machine ≈ 5 s, temporisée) — T2, T4, T5,
                  T6 sont immédiates.
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
              { n: "01", t: "Invariant de place", d: "P2 MachineLibre + P3 EnTri = 1 en permanence : T2(e) déplace le jeton de P2 vers P3(e), T3(e) fait l'inverse — aucune autre transition ne touche ces places." },
              { n: "02", t: "Bornage", d: "P3(e) et P4(e) bornées à 1 par construction (capacité), conséquence directe de l'invariant : un seul colis à la fois dans le pipeline machine + contrôle." },
              { n: "03", t: "Terminaison garantie", d: "Tout colis finit dans P5 Expedie ou P6 Rejete : par récurrence sur e, T5 fait croître e strictement et e ≤ K ⇒ T6 obligatoire au plus tard après K échecs — aucune boucle infinie." },
              { n: "04", t: "Vivacité de T2", d: "La machine revient-elle systématiquement à l'état libre après chaque cycle ? Oui : T3(e) rend toujours P2, quel que soit le verdict du contrôle." },
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

        {/* ── DEUXIÈME SUJET ─────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <Reveal>
            <p className={`${kicker} text-sky-500 mb-3`}>Deuxième sujet</p>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">Station de recharge pour véhicules électriques</h2>
            <p className={`text-sm leading-relaxed max-w-3xl mb-10 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              N = 6 points de charge identiques partagés entre des véhicules Rapides (charge ≈ 20 min) et Standards
              (charge ≈ 2 h). Un véhicule qui attend trop longtemps abandonne (≈ 15 min). La structure du cours est
              conservée : <strong>P1..P5 · T1..T4</strong>, la couleur ne change que le délai de T3.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { n: "01", t: "Invariant de capacité", d: "PointsLibres + EnCharge = N en permanence : T2 déplace un jeton de P1 vers P3, T3 fait l'inverse — T1 et T4 n'y touchent jamais." },
              { n: "02", t: "Compétition servir / abandonner", d: "Sur chaque jeton de P2 : T2 (immédiate) branche le véhicule si un point est libre, T4 (temporisée ≈ 15 min) le fait partir — rejouable au clic dans le simulateur." },
              { n: "03", t: "Délais dépendant de la couleur", d: "T3 libère le point après ≈ 20 min (Rapide) ou ≈ 2 h (Standard) : la même structure de réseau produit deux durées de charge selon la couleur du jeton." },
              { n: "04", t: "Absence de famine (à discuter)", d: "FIFO simple, pas de priorité entre couleurs : les Standards peuvent-ils attendre indéfiniment derrière des Rapides ? Propriété §7.4, à réexaminer si une priorité est ajoutée." },
            ].map((c, i) => (
              <Reveal key={c.n} delay={i * 100}>
                <div className={`h-full rounded-2xl border p-6 transition-colors duration-500 ${card}`}>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-2xl font-black text-sky-500/70 font-mono">{c.n}</span>
                    <h3 className="text-sm font-bold">{c.t}</h3>
                  </div>
                  <p className={`text-[11.5px] leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}>{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => openDemo("station")}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-600/25 transition-all active:scale-95"
              >
                ▶ Simuler la station de recharge
              </button>
              <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Énoncé complet intégré dans la légende du simulateur (touche L) — marquage initial : P1 = 6 points libres.
              </span>
            </div>
          </Reveal>
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
                  ▶ Sujet principal — Centre de tri
                </button>
                <button
                  onClick={() => openDemo("demo")}
                  className={`px-6 py-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDark ? "border-white/10 hover:bg-white/5 text-slate-300" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  Ancien sujet — Mobile Money
                </button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={`relative z-10 border-t py-6 text-center text-[10px] ${isDark ? "border-white/5 text-slate-600" : "border-slate-200 text-slate-400"}`}>
        Projet Réseaux de Petri — RdP coloré & temporisé · Sujet principal : Centre de tri de colis avec contrôle qualité
      </footer>
    </div>
  );
}
