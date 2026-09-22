import { useState, useEffect, useRef } from "react";
import PetriCanvas from "../components/petri/PetriCanvas";
import PetriStepsPanel from "../components/petri/PetriStepsPanel";
import PetriControls from "../components/petri/PetriControls";
import PetriEditor from "../components/petri/PetriEditor";
import PetriLegend from "../components/petri/PetriLegend";
import PetriIncidenceMatrix from "../components/petri/PetriIncidenceMatrix";
import AddPetriNodeForm from "../components/petri/AddPetriNodeForm";
import { usePetriStore } from "../store/petriStore";
import { PETRI_NETS } from "../constants/petriConstants";

interface PetriPageProps {
  /** Retour à la page de présentation (sujet principal). */
  onBackToPresentation: () => void;
}

// Le volet gauche n'affiche plus qu'un seul contenu à la fois : l'éditeur
// JSON, la légende pédagogique (énoncé du projet + "P1 : ...", "T1 : ...")
// ou la matrice d'incidence (Pre / Post / W). `null` = volet fermé.
type LeftPanel = "json" | "legend" | "matrix" | null;

export default function PetriPage({ onBackToPresentation }: PetriPageProps) {
  const {
    places,
    transitions,
    arcs,
    initialMarking,
    statement,
    setStatement,
    error,
    clearError,
    activePreset,
    loadPreset,
    loadNet,
    addPlace,
    addTransition,
    currentStepIndex,
  } = usePetriStore();

  // États d'interface utilisateur (UI)
  const [leftPanel, setLeftPanel] = useState<LeftPanel>(null);
  const [addArcMode, setAddArcMode] = useState(false);
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const togglePanel = (panel: Exclude<LeftPanel, null>) =>
    setLeftPanel((prev) => (prev === panel ? null : panel));

  // UX : Désactiver le mode arc si on ouvre le formulaire d'ajout
  useEffect(() => {
    if (showAddNodeForm) setAddArcMode(false);
  }, [showAddNodeForm]);

  // Changement de réseau prédéfini depuis le sélecteur du header.
  const handleSwitchPreset = (slug: keyof typeof PETRI_NETS) => {
    loadPreset(slug);
  };

  // UX : Empêcher la page de se quitter sans confirmation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      switch (e.key.toLowerCase()) {
        case "n":
          e.preventDefault();
          setShowAddNodeForm(true);
          break;
        case "a":
          e.preventDefault();
          setAddArcMode((prev) => !prev);
          break;
        case "m":
          e.preventDefault();
          setIsDarkMode((prev) => !prev);
          break;
        case "l":
          e.preventDefault();
          togglePanel("legend");
          break;
        case "i":
          e.preventDefault();
          togglePanel("matrix");
          break;
        case "escape":
          setAddArcMode(false);
          setShowAddNodeForm(false);
          setShowHelpModal(false);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // --- IMPORT / EXPORT ---
  // `data.places`/`data.transitions` transportent déjà le champ optionnel
  // `description` s'il est présent (aucun traitement spécial requis : c'est
  // juste un champ de plus sur l'objet JSON). `data.statement` (énoncé du
  // projet) est traité de la même façon : un champ texte libre optionnel,
  // relu tel quel à l'import et réécrit tel quel à l'export — voir la
  // section "Format JSON" du README pour le schéma complet.
  const processNetFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (!Array.isArray(data.places) || !Array.isArray(data.transitions) || !Array.isArray(data.arcs)) {
          throw new Error("Format de fichier invalide structurellement.");
        }
        // Un seul point d'entrée : loadNet normalise le marquage, remplace
        // le réseau et réinitialise la simulation.
        loadNet({
          places: data.places,
          transitions: data.transitions,
          arcs: data.arcs,
          initialMarking: data.initialMarking ?? {},
          statement: typeof data.statement === "string" ? data.statement : "",
        });
      } catch (err) {
        alert("Fichier JSON invalide pour ce réseau de Petri.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processNetFile(file);
    event.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFile(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingFile(false);
    processNetFile(e.dataTransfer.files?.[0]);
  };

  const handleExportJSON = () => {
    const netData = {
      metadata: { version: "1.0", timestamp: new Date().toISOString(), kind: "rdp" },
      // Énoncé / explication du projet modélisé par ce réseau — affiché en
      // tête du panneau Légende côté UI (voir <PetriLegend statement=…>
      // plus bas) et documenté dans le README (section "Format JSON").
      statement: statement || "",
      places: places || [],
      transitions: transitions || [],
      arcs: arcs || [],
      initialMarking: initialMarking || {},
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(netData, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `rdp-${activePreset}-${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const placeCount = places?.length || 0;
  const transitionCount = transitions?.length || 0;

  const panelTitle =
    leftPanel === "json" ? "Éditeur JSON" : leftPanel === "legend" ? "Légende" : leftPanel === "matrix" ? "Matrice d'incidence" : "";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`h-screen w-screen flex flex-col font-sans overflow-hidden relative select-none transition-colors duration-300 ${
        isDarkMode ? "bg-slate-950 text-slate-100 selection:bg-indigo-500/30" : "bg-slate-50 text-slate-900 selection:bg-indigo-100"
      }`}
    >
      {/* Flou interactif lors du drag & drop d'un fichier */}
      {isDraggingFile && (
        <div className="absolute inset-0 bg-indigo-600/10 backdrop-blur-md border-4 border-dashed border-indigo-500 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-2xl mb-4 shadow-xl shadow-indigo-500/20 animate-bounce">📥</div>
          <h2 className="text-lg font-bold tracking-wide uppercase text-indigo-400">Déposez votre fichier ici</h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">Relâchez pour charger un réseau de Petri (.json)</p>
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleImportJSON} accept=".json" className="hidden" />

      {/* Arrière-plan ambiant */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className={`absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[140px] transition-colors duration-700 ${isDarkMode ? "bg-indigo-500/10" : "bg-indigo-500/5"}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full blur-[140px] transition-colors duration-700 ${isDarkMode ? "bg-emerald-500/5" : "bg-emerald-500/4"}`} />
      </div>

      {/* --- HEADER --- */}
      <header className={`h-14 px-6 flex justify-between items-center sticky top-0 z-30 backdrop-blur-md transition-all duration-300 border-b ${
        isDarkMode ? "border-white/5 bg-slate-900/40 shadow-sm shadow-black/10" : "border-slate-200/60 bg-white/60 shadow-sm shadow-slate-100"
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPresentation}
            title="Retour à la page de présentation"
            className="w-8 h-8 bg-gradient-to-tr from-emerald-400 to-emerald-500 rounded-lg flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/10 transform hover:scale-105 transition-transform duration-200"
          >
            <span className="font-black text-sm">₥</span>
          </button>
          <div className="flex flex-col">
            <h1 className={`text-[11px] font-bold tracking-widest uppercase ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              Réseau de Petri
            </h1>
            <p className="text-[10px] text-emerald-500 font-medium tracking-wide">
              {activePreset === "mobile-money" ? "Agent Mobile Money (sujet principal)" : "Carrefour à feux tricolores (démo)"}
            </p>
          </div>

          {/* Sélecteur de réseau prédéfini : le sujet principal (Mobile Money)
              et l'ancien sujet (Carrefour, conservé en démo) restent
              interchangeables à tout moment. */}
          <select
            value={activePreset}
            onChange={(e) => handleSwitchPreset(e.target.value as keyof typeof PETRI_NETS)}
            title="Changer de réseau prédéfini"
            className={`ml-2 px-2 py-1 rounded-lg text-[10px] font-medium border outline-none cursor-pointer transition-colors ${
              isDarkMode ? "bg-slate-950/50 border-white/10 text-slate-300" : "bg-white border-slate-200 text-slate-600"
            }`}
          >
            {Object.entries(PETRI_NETS).map(([slug, net]) => (
              <option key={slug} value={slug}>
                {net.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-3 py-1 rounded-lg text-[10px] font-mono border ${isDarkMode ? "bg-slate-950/50 border-white/5 text-slate-400" : "bg-slate-200/50 border-slate-200 text-slate-500"}`}>
            Étape <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{currentStepIndex}</span>
          </div>

          <div className={`w-px h-5 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Changer de thème"
            className={`p-1.5 rounded-lg border transition-all duration-200 active:scale-90 ${
              isDarkMode ? "bg-slate-950/40 border-white/10 text-amber-400 hover:bg-slate-800" : "bg-white border-slate-200 text-indigo-600 hover:bg-slate-100 shadow-sm"
            }`}
          >
            {isDarkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V21M4.22 4.22l1.58 1.58m12.42 12.42l1.58 1.58M3 12h2.25m13.5 0H21M4.22 19.78l1.58-1.58M17.66 6.34l1.58-1.58M12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowHelpModal(true)}
            className={`p-1.5 rounded text-lg font-medium transition-colors ${isDarkMode ? "text-slate-400 hover:text-slate-200 hover:bg-white/5" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"}`}
            title="Raccourcis et Aide"
          >
            ?
          </button>
        </div>
      </header>

      {/* Notification d'erreur */}
      {error && (
        <div className="absolute top-16 right-6 z-50 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-xs font-semibold text-red-400 shadow-xl backdrop-blur-md flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          {error}
          <button onClick={clearError} className="ml-1 text-red-300 hover:text-red-100">×</button>
        </div>
      )}

      {/* --- MAIN --- */}
      <main className="flex flex-1 overflow-hidden relative z-10">
        {/* Volet gauche : éditeur JSON / légende / matrice d'incidence (un seul à la fois) */}
        {leftPanel && (
          <div className={`w-80 h-full border-r backdrop-blur-sm transition-all duration-300 animate-in slide-in-from-left duration-300 z-20 flex flex-col ${
            isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-white/40"
          }`}>
            <div className={`px-4 py-3 border-b flex justify-between items-center flex-shrink-0 ${isDarkMode ? "border-white/5" : "border-slate-200"}`}>
              <h2 className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                {panelTitle}
              </h2>
              <button
                onClick={() => setLeftPanel(null)}
                aria-label="Fermer le volet"
                className={`w-5 h-5 rounded flex items-center justify-center text-sm ${isDarkMode ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-400"}`}
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {leftPanel === "json" && <PetriEditor isDarkMode={isDarkMode} />}
              {/* `statement` (énoncé du projet) est affiché en tête du
                  panneau Légende, avant le détail P1…/T1… — voir la
                  note d'intégration dans le README ("Format JSON" /
                  "Énoncé du projet") si PetriLegend ne gère pas encore
                  cette prop. */}
              {leftPanel === "legend" && <PetriLegend isDarkMode={isDarkMode} statement={statement} onStatementChange={setStatement} />}
              {leftPanel === "matrix" && <PetriIncidenceMatrix isDarkMode={isDarkMode} />}
            </div>
          </div>
        )}

        {/* Zone centrale : le canevas */}
        <div className={`flex-1 relative transition-colors duration-300 overflow-hidden ${
          isDarkMode ? "bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] bg-slate-950/20" : "bg-[radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] bg-slate-50/20"
        } [background-size:28px_28px]`}>

          {/* Dock flottant */}
          <div className={`absolute top-6 left-6 z-30 flex flex-col gap-1.5 p-1.5 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-300 ${
            isDarkMode ? "bg-slate-900/80 border-white/10 shadow-black/50" : "bg-white/90 border-slate-200 shadow-slate-300/60"
          }`}>
            {/* Ajouter place/transition */}
            <button
              onClick={() => setShowAddNodeForm(true)}
              title="Ajouter une place / une transition (N)"
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                isDarkMode ? "hover:bg-white/10 text-slate-200" : "hover:bg-slate-100 text-slate-700"
              }`}
            >
              <span className="text-lg font-light">＋</span>
            </button>

            {/* Mode arc */}
            <button
              onClick={() => setAddArcMode(!addArcMode)}
              title={addArcMode ? "Quitter le mode arc (A)" : "Tracer un arc (A)"}
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 border ${
                addArcMode ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-inner" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </button>

            {/* Toggle éditeur JSON */}
            <button
              onClick={() => togglePanel("json")}
              title={leftPanel === "json" ? "Fermer l'éditeur JSON" : "Ouvrir l'éditeur JSON"}
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                leftPanel === "json" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
              </svg>
            </button>

            {/* Toggle légende pédagogique (énoncé du projet + "P1 : ...", "T1 : ...") */}
            <button
              onClick={() => togglePanel("legend")}
              title={leftPanel === "legend" ? "Fermer la légende (L)" : "Afficher la légende (L)"}
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                leftPanel === "legend" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </button>

            {/* Toggle matrice d'incidence (Pre / Post / W) */}
            <button
              onClick={() => togglePanel("matrix")}
              title={leftPanel === "matrix" ? "Fermer la matrice d'incidence (I)" : "Afficher la matrice d'incidence (I)"}
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                leftPanel === "matrix" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5v15H3.75v-15zM3.75 9h16.5M3.75 15h16.5M9 4.5v15" />
              </svg>
            </button>

            <div className={`h-px w-6 mx-auto ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />

            {/* Importer */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Importer un réseau (.json) ou glisser-déposer"
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 ${
                isDarkMode ? "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10" : "text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>

            {/* Exporter */}
            <button
              onClick={handleExportJSON}
              disabled={placeCount === 0}
              title={placeCount === 0 ? "Le réseau est vide" : "Exporter le réseau (.json)"}
              className={`w-10 h-10 rounded-xl text-xs font-medium flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                isDarkMode ? "text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10" : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5l2 2h3a2 2 0 012 2v11a2 2 0 01-2 2z" />
              </svg>
            </button>
          </div>

          {/* Bandeau mode arc */}
          {addArcMode && (
            <div className="absolute top-6 left-24 z-30 px-4 py-2.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 backdrop-blur-md shadow-lg text-[11px] font-medium text-emerald-400 flex items-center gap-2.5 animate-in fade-in slide-in-from-left-3 duration-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Cliquez une <strong>place</strong> puis une <strong>transition</strong> (ou l'inverse) pour tracer un arc.</span>
              <button onClick={() => setAddArcMode(false)} className="ml-2 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                Quitter (Echap)
              </button>
            </div>
          )}

          {/* Statistiques */}
          <div className={`absolute bottom-20 left-6 z-30 px-3 py-2 rounded-xl text-[10px] font-mono border backdrop-blur-md flex gap-4 ${
            isDarkMode ? "bg-slate-950/60 border-white/5 text-slate-400" : "bg-white/70 border-slate-200 text-slate-500"
          }`}>
            <div>PLACES: <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{placeCount}</span></div>
            <div className={`w-px h-3 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />
            <div>TRANSITIONS: <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{transitionCount}</span></div>
            <div className={`w-px h-3 ${isDarkMode ? "bg-white/10" : "bg-slate-200"}`} />
            <div>ARCS: <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{arcs?.length || 0}</span></div>
          </div>

          {/* Empty state */}
          {placeCount === 0 && transitionCount === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl mb-4 border border-emerald-500/20">○</div>
              <h3 className="text-xs font-bold uppercase tracking-wider mb-1">Réseau vide</h3>
              <p className={`text-[11px] max-w-xs mb-4 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
                Glissez-déposez un fichier JSON ou créez une place / une transition.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowAddNodeForm(true)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium rounded-lg shadow-sm transition-all active:scale-95">
                  Créer le premier élément
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium rounded-lg shadow-sm transition-all active:scale-95">
                  Importer JSON
                </button>
              </div>
            </div>
          )}

          <PetriCanvas addArcMode={addArcMode} />

          {/* Barre de contrôle (bas, centrée) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className={`border p-2 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2 transition-all ${
              isDarkMode ? "bg-slate-950/90 border-white/10 shadow-black/80" : "border-slate-200 bg-white/40 shadow-slate-300"
            }`}>
              <PetriControls />
            </div>
          </div>
        </div>

        {/* Volet latéral droit : historique */}
        <aside className={`w-90 border-l backdrop-blur-sm flex flex-col transition-colors duration-300 z-20 ${
          isDarkMode ? "border-white/5 bg-slate-900/20" : "border-slate-200 bg-white/30"
        }`}>
          <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? "border-white/5 bg-slate-900/40" : "border-slate-200 bg-slate-100/40"}`}>
            <h2 className={`text-xs font-bold tracking-wider uppercase flex items-center gap-2 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              Franchissement
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <PetriStepsPanel isDarkMode={isDarkMode} />
          </div>
        </aside>
      </main>

      {/* Modal d'ajout */}
      {showAddNodeForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onClick={() => setShowAddNodeForm(false)}>
          <AddPetriNodeForm
            onAddPlace={(p) => { addPlace(p); setShowAddNodeForm(false); }}
            onAddTransition={(t) => { addTransition(t); setShowAddNodeForm(false); }}
            theme={isDarkMode ? "dark" : "light"}
            onClose={() => setShowAddNodeForm(false)}
          />
        </div>
      )}

      {/* Modal d'aide */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className={`w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl ${
            isDarkMode ? "bg-slate-900 border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className={`flex items-center justify-between px-5 pt-5 pb-3 border-b ${isDarkMode ? "border-white/5" : "border-slate-100"}`}>
              <div>
                <h3 className="text-sm font-bold text-emerald-500">Aide — Réseau de Petri</h3>
                <p className={`text-[11px] mt-0.5 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Simulateur du carrefour à feux tricolores</p>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                aria-label="Fermer"
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${isDarkMode ? "hover:bg-white/10 text-slate-400" : "hover:bg-slate-100 text-slate-400"}`}
              >×</button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5 text-xs">
              <section>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Simuler</h4>
                <ul className={`space-y-1.5 leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li><strong>Franchir une transition</strong> : cliquer directement une transition en vert (franchissable) sur le schéma.</li>
                  <li><strong>Conflit</strong> (ambre, pulse) : plusieurs transitions sont franchissables sous le même marquage — cliquez celle que vous voulez déclencher (sur le schéma ou dans le panneau de droite).</li>
                  <li>Les commandes de lecture (bas de l'écran) permettent Play/Pause, étape suivante/précédente, début/fin, vitesse.</li>
                  <li>En mode <strong>Lecture (Play)</strong>, les conflits sont résolus au hasard pour ne jamais bloquer l'animation.</li>
                </ul>
              </section>

              <section>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Comprendre le réseau (comme en cours)</h4>
                <ul className={`space-y-1.5 leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li><strong>Légende</strong> (icône livre du dock, ou <kbd className="px-1 rounded bg-slate-500/20">L</kbd>) : affiche d'abord l'énoncé du projet, puis "P1 : ...", "T1 : ..." — la description de chaque place/transition, comme sous les schémas des slides.</li>
                  <li><strong>Matrice d'incidence</strong> (icône grille du dock, ou <kbd className="px-1 rounded bg-slate-500/20">I</kbd>) : affiche Pre, Post et W = Post − Pre, la définition algébrique vue en cours.</li>
                </ul>
              </section>

              <section>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Éditer le réseau</h4>
                <ul className={`space-y-1.5 leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li><strong>Glisser</strong> une place ou une transition pour la repositionner.</li>
                  <li><strong>Créer un arc</strong> : mode arc (bouton ou touche <kbd className="px-1 rounded bg-slate-500/20">A</kbd>), cliquer une place puis une transition (ou l'inverse). Un arc ne peut jamais relier deux places ou deux transitions entre elles.</li>
                  <li><strong>Modifier un poids d'arc</strong> : cliquer son étiquette, taper la valeur, <kbd className="px-1 rounded bg-slate-500/20">Entrée</kbd>.</li>
                  <li><strong>Éditer le marquage initial</strong> : à l'étape 0, cliquer les jetons d'une place.</li>
                  <li><strong>Ajouter</strong> : bouton "＋" ou touche <kbd className="px-1 rounded bg-slate-500/20">N</kbd>. <strong>Supprimer</strong> : clic droit → Supprimer, ou sélection + <kbd className="px-1 rounded bg-slate-500/20">Suppr</kbd>.</li>
                  <li><strong>Éditeur JSON</strong> : icône lignes du dock, pour éditer places/transitions/arcs en texte (y compris le champ <code className="px-1 rounded bg-slate-500/20">description</code>).</li>
                  <li><strong>Énoncé du projet</strong> : modifiable directement dans le panneau Légende ; il est inclus dans le fichier exporté (champ <code className="px-1 rounded bg-slate-500/20">statement</code>).</li>
                </ul>
              </section>

              <section>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Vue &amp; import/export</h4>
                <ul className={`space-y-1.5 leading-relaxed ${isDarkMode ? "text-slate-300" : "text-slate-600"}`}>
                  <li><strong>Zoom</strong> : molette. <strong>Déplacer la vue</strong> : clic molette ou <kbd className="px-1 rounded bg-slate-500/20">Alt</kbd> + glisser.</li>
                  <li><strong>Réorganiser</strong> : bouton dédié ou touche <kbd className="px-1 rounded bg-slate-500/20">G</kbd>.</li>
                  <li><strong>Importer/Exporter</strong> : boutons du dock, ou glisser-déposer un <code className="px-1 rounded bg-slate-500/20">.json</code> n'importe où. L'énoncé et les descriptions sont inclus dans le fichier exporté et relus à l'import.</li>
                </ul>
              </section>

              <section>
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Raccourcis clavier</h4>
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between"><span className="text-slate-400">Ajouter place/transition</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">N</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Mode Arc</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">A</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Légende</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">L</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Matrice d'incidence</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">I</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Réorganiser</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">G</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Play / Pause</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">Espace</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Basculer le thème</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">M</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Supprimer la sélection</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">Suppr</kbd></div>
                  <div className="flex justify-between"><span className="text-slate-400">Annuler / Quitter</span><kbd className="px-1.5 py-0.5 rounded bg-slate-500/20 border border-slate-500/30">Echap</kbd></div>
                </div>
              </section>
            </div>

            <div className={`p-4 border-t ${isDarkMode ? "border-white/5" : "border-slate-100"}`}>
              <button onClick={() => setShowHelpModal(false)} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-xl transition-colors">
                Compris !
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
