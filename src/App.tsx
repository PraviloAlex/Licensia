import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, useState } from "react";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const PracticePage = lazy(() => import("./pages/PracticePage").then((module) => ({ default: module.PracticePage })));
const VocabularyPage = lazy(() => import("./pages/VocabularyPage").then((module) => ({ default: module.VocabularyPage })));
const PracticalExamPage = lazy(() => import("./pages/PracticalExamPage").then((module) => ({ default: module.PracticalExamPage })));
const ProgressPage = lazy(() => import("./pages/ProgressPage").then((module) => ({ default: module.ProgressPage })));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage").then((module) => ({ default: module.OnboardingPage })));
const SignsPage = lazy(() => import("./pages/SignsPage").then((module) => ({ default: module.SignsPage })));
const LegalPage = lazy(() => import("./pages/LegalPage").then((module) => ({ default: module.LegalPage })));
const SourcesPage = lazy(() => import("./pages/SourcesPage").then((module) => ({ default: module.SourcesPage })));
const EditorPage = lazy(() => import("./pages/EditorPage").then((module) => ({ default: module.EditorPage })));

const ONBOARDING_KEY = "licencia_ar_onboarding_done";

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const [done] = useState(() =>
    typeof window !== "undefined" && window.localStorage.getItem(ONBOARDING_KEY) === "1"
  );
  return done ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

export default function App() {
  return (
    <Suspense fallback={null}>
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
        <Route path="/editor" element={<EditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
