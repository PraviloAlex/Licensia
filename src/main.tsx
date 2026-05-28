import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { resetVocabularyState } from "./lib/vocabularyStatus";
import { getFontSizePref, applyFontSizePref } from "./lib/fontSizePref";

// Apply font size class before first render
if (typeof window !== "undefined") { applyFontSizePref(getFontSizePref()); }
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
