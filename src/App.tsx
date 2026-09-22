import { useState, useEffect } from "react";
import PresentationPage from "./pages/PresentationPage";
import PetriPage from "./pages/PetriPage";

type View = "presentation" | "demo";

const STORAGE_KEY = "rdp-view";

/**
 * Vue initiale : priorité au paramètre d'URL (?view=demo — deep-link
 * partageable vers le simulateur), sinon la dernière vue de la session,
 * sinon la présentation (porte d'entrée du sujet principal).
 */
function initialView(): View {
  try {
    const param = new URLSearchParams(window.location.search).get("view");
    if (param === "demo") return "demo";
    if (param === "presentation") return "presentation";
    return sessionStorage.getItem(STORAGE_KEY) === "demo" ? "demo" : "presentation";
  } catch {
    return "presentation";
  }
}

export default function App() {
  const [view, setView] = useState<View>(initialView);

  // Mémorise la vue pendant la session (rechargement = même page), mais
  // repart toujours sur la présentation à l'ouverture d'un nouvel onglet :
  // la présentation EST la porte d'entrée du sujet principal.
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, view); } catch { /* ignore */ }
  }, [view]);

  if (view === "presentation") {
    return <PresentationPage onEnterDemo={() => setView("demo")} />;
  }
  return <PetriPage onBackToPresentation={() => setView("presentation")} />;
}
