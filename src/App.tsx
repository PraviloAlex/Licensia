import { Navigate, Route, Routes } from "react-router-dom";
import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { PracticePage } from "./pages/PracticePage";
import { VocabularyPage } from "./pages/VocabularyPage";
import { PracticalExamPage } from "./pages/PracticalExamPage";
import { ProgressPage } from "./pages/ProgressPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { SignsPage } from "./pages/SignsPage";
import { LegalPage } from "./pages/LegalPage";
import { SourcesPage } from "./pages/SourcesPage";

const ONBOARDING_KEY = "licencia_ar_onboarding_done";

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const [done] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(ONBOARDING_KEY) === "1"
  );
  return done ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/" element={<RequireOnboarding><HomePage /></RequireOnboarding>} />
      <Route path="/practice" element={<PracticePage />} />
      <Route path="/vocabulary" element={<VocabularyPage />} />
      <Route path="/practical-exam" element={<PracticalExamPage />} />
      <Route path="/progress" element={<ProgressPage />} />
      <Route path="/signs" element={<SignsPage />} />
      <Route path="/legal" element={<LegalPage />} />
      <Route path="/sources" element={<SourcesPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
