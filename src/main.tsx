import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { resetVocabularyState } from "./lib/vocabularyStatus";
import { getFontSizePref, applyFontSizePref } from "./lib/fontSizePref";
import { startTrialIfNeeded } from "./lib/entitlement";

// Apply font size class before first render
if (typeof window !== "undefined") { applyFontSizePref(getFontSizePref()); }

// Start the 7-day trial clock on first launch (idempotent; no payment involved).
if (typeof window !== "undefined") { startTrialIfNeeded(); }
import "./styles.css";

if (typeof window !== "undefined") {
  (window as Window & { licenciaDebug?: { resetVocabulary: () => void } }).licenciaDebug = {
    resetVocabulary: () => {
      resetVocabularyState();
      window.location.reload();
    },
  };
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
