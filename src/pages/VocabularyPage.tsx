import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageShell } from "../components/PageShell";
import { glossaryData } from "../lib/data";
import {
  addWordToReview, canCountKnownClick, getDueReviewWordIds, getKnownClicksMap,
  getMasteredWordIds, getReviewWordIds, getReviewedTodayCount, getWordDueAt,
  getWordStatusMap, isWordNew, markWordKnown, markWordRepeat,
  removeWordFromReview, resetVocabularyState, wasKnownToday,
} from "../lib/vocabularyStatus";
import type { GlossaryCategory } from "../types/glossary";
import { getUILang, t } from "../lib/i18n";

type Tab = "all" | "review" | "mastered";
type WordState = "new" | "review" | "known-today" | "mastered";

function getWordState(wordId: string, reviewIds: string[], masteredIds: string[]): WordState {
  if (masteredIds.includes(wordId)) return "mastered";
  if (wasKnownToday(wordId)) return "known-today";
  if (reviewIds.includes(wordId)) return "review";
  return "new";
}

const STATE_STYLES: Record<WordState, { border: string; glow: string }> = {
  new:           { border: "rgba(100, 160, 255, 0.30)", glow: "rgba(100,160,255,0.06)" },
  review:        { border: "rgba(100, 160, 255, 0.30)", glow: "rgba(100,160,255,0.06)" },
  "known-today": { border: "rgba(255, 195, 60, 0.55)",  glow: "rgba(255,195,60,0.12)"  },
  mastered:      { border: "rgba(100, 230, 170, 0.45)", glow: "rgba(100,230,170,0.08)" },
};

function ProgressDots({ count, mastered }: { count: number; mastered: boolean }) {
  const lang = getUILang();
  const total = 4;
  const filled = Math.min(count, total);
  return (
    <div className="vocab-dots" title={mastered ? t("vocab.dots.mastered", lang) : `${filled} / ${total}`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={i < filled ? "vocab-dot vocab-dot--active" : "vocab-dot"} aria-hidden="true" />
      ))}
      {mastered && <span className="vocab-check" aria-label={t("vocab.dots.mastered", lang)}>\u2713</span>}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const lang = getUILang();
  const messages: Record<Tab, { title: string; sub: string }> = {
    all:      { title: t("vocab.empty.all.t", lang), sub: t("vocab.empty.all.s", lang) },
    review:   { title: t("vocab.empty.rev.t", lang), sub: t("vocab.empty.rev.s", lang) },
    mastered: { title: t("vocab.empty.mas.t", lang), sub: t("vocab.empty.mas.s", lang) },
  };
  const { title, sub } = messages[tab];
  return (
    <div className="vocab-empty">
      <p className="vocab-empty-icon">{"📭"}</p>
      <p className="vocab-empty-title">{title}</p>
      <p className="vocab-empty-sub">{sub}</p>
    </div>
  );
}

export function VocabularyPage() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "mastered" ? "mastered"
    : searchParams.get("tab") === "all" ? "all" : "review";

  const lang = getUILang();

  const categoryOptions: Array<{ label: string; value: "all" | GlossaryCategory }> = [
    { label: t("vocab.cat.all", lang), value: "all" },
    { label: "prioridad",      value: "prioridad"      },
    { label: "infraestructura",value: "infraestructura"},
    { label: "maniobra",       value: "maniobra"       },
    { label: "seguridad",      value: "seguridad"      },
    { label: "via",            value: "via"            },
  ];

  const [statusMap,          setStatusMap]          = useState(getWordStatusMap);
  const [reviewIds,          setReviewIds]          = useState(getReviewWordIds);
  const [masteredIds,        setMasteredIds]        = useState(getMasteredWordIds);
  const [clicksMap,          setClicksMap]          = useState(getKnownClicksMap);
  const [query,              setQuery]              = useState("");
  const [category,           setCategory]          = useState<"all" | GlossaryCategory>("all");
  const [tab,                setTab]               = useState<Tab>(initialTab);
  const [justAddedIds,       setJustAddedIds]       = useState<Set<string>>(new Set());
  const [reviewedTodayCount, setReviewedTodayCount] = useState(getReviewedTodayCount);
  const [cooldownIds,        setCooldownIds]        = useState<Set<string>>(new Set());
  const [toast,              setToast]             = useState<{ wordId: string; clicks: number; term: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inQueueCount  = reviewIds.filter((id) => !masteredIds.includes(id)).length;
  const masteredCount = masteredIds.length;
  const totalAdded    = inQueueCount + masteredCount;
  const dueCount      = useMemo(() => getDueReviewWordIds().length, [reviewIds, masteredIds]);
  const now = Date.now();

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = glossaryData.filter((word) => {
      const categoryOk = category === "all" || word.category === category;
      const queryOk = q.length === 0 ||
        word.term_es.toLowerCase().includes(q) ||
        word.translation_ru.toLowerCase().includes(q) ||
        word.simpleExplanation_ru.toLowerCase().includes(q);
      const inReview   = reviewIds.includes(word.id) && !masteredIds.includes(word.id);
      const inMastered = masteredIds.includes(word.id);
      const tabOk = tab === "all" || (tab === "review" ? inReview : inMastered);
      return categoryOk && queryOk && tabOk;
    });
    if (tab === "review") {
      filtered.sort((a, b) => {
        const aDueAt = getWordDueAt(a.id), bDueAt = getWordDueAt(b.id);
        const aDue = aDueAt <= now, bDue = bDueAt <= now;
        if (aDue && bDue)   return aDueAt - bDueAt;
        if (!aDue && !bDue) return aDueAt - bDueAt;
        return aDue ? -1 : 1;
      });
    }
    return filtered;
  }, [query, category, tab, reviewIds, masteredIds]);

  function refreshDerivedState() {
    setReviewIds(getReviewWordIds());
    setMasteredIds(getMasteredWordIds());
    setStatusMap(getWordStatusMap());
  }

  function handleKnown(wordId: string) {
    const next = markWordKnown(wordId);
    const newClicksMap = getKnownClicksMap();
    setStatusMap(next.statusMap);
    setReviewIds(next.reviewIds);
    setMasteredIds(getMasteredWordIds());
    setClicksMap(newClicksMap);
    setReviewedTodayCount(getReviewedTodayCount());
    if (next.counted) {
      const clicks = newClicksMap[wordId] ?? 1;
      const word = glossaryData.find((w) => w.id === wordId);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ wordId, clicks, term: word?.term_es ?? "" });
      toastTimerRef.current = setTimeout(() => setToast(null), 4500);
    } else {
      setCooldownIds((prev) => { const n = new Set(prev); n.add(wordId); return n; });
      setTimeout(() => {
        setCooldownIds((prev) => { const n = new Set(prev); n.delete(wordId); return n; });
      }, 2000);
    }
  }

  function handleRepeat(wordId: string) {
    const next = markWordRepeat(wordId);
    setStatusMap(next.statusMap);
    setReviewIds(next.reviewIds);
    setMasteredIds(getMasteredWordIds());
    setClicksMap(getKnownClicksMap());
    setReviewedTodayCount(getReviewedTodayCount());
  }

  function handleToggleReview(wordId: string) {
    const alreadyIn = reviewIds.includes(wordId) && !masteredIds.includes(wordId);
    if (alreadyIn) {
      const next = removeWordFromReview(wordId);
      setReviewIds(next);
      setMasteredIds(getMasteredWordIds());
      setStatusMap(getWordStatusMap());
    } else {
      addWordToReview(wordId);
      refreshDerivedState();
      setJustAddedIds((prev) => {
        const next = new Set(prev);
        next.add(wordId);
        setTimeout(() => {
          setJustAddedIds((p) => { const n = new Set(p); n.delete(wordId); return n; });
        }, 2800);
        return next;
      });
    }
  }

  return (
    <PageShell title={t("vocab.title", lang)}>

      <section className="tabs-row">
        <button type="button" className={tab === "review"   ? "tab-btn active" : "tab-btn"} onClick={() => setTab("review")}>
          {t("vocab.tab.review", lang)}<span className="tab-count-badge">{inQueueCount}</span>
        </button>
        <button type="button" className={tab === "mastered" ? "tab-btn active" : "tab-btn"} onClick={() => setTab("mastered")}>
          {t("vocab.tab.mastered", lang)}<span className="tab-count-badge">{masteredCount}</span>
        </button>
        <button type="button" className={tab === "all"      ? "tab-btn active" : "tab-btn"} onClick={() => setTab("all")}>
          {t("vocab.tab.all", lang)}<span className="tab-count-badge">{glossaryData.length}</span>
        </button>
      </section>

      <div className="vocab-stats-grid">
        <div className="vocab-stat-card">
          <span className="vocab-stat-label">{t("vocab.stat.added",   lang)}</span>
          <span className="vocab-stat-val vocab-stat-val--white">{totalAdded}</span>
        </div>
        <div className="vocab-stat-card">
          <span className="vocab-stat-label">{t("vocab.stat.queue",   lang)}</span>
          <span className="vocab-stat-val vocab-stat-val--blue">{dueCount}</span>
        </div>
        <div className="vocab-stat-card">
          <span className="vocab-stat-label">{t("vocab.stat.mastered",lang)}</span>
          <span className="vocab-stat-val vocab-stat-val--green">{masteredCount}</span>
        </div>
        <div className="vocab-stat-card">
          <span className="vocab-stat-label">{t("vocab.stat.today",   lang)}</span>
          <span className="vocab-stat-val vocab-stat-val--gold">{reviewedTodayCount}</span>
        </div>
      </div>

      <section className="filters glass">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={t("vocab.search", lang)} className="search-input" />
        <select value={category}
          onChange={(e) => setCategory(e.target.value as "all" | GlossaryCategory)}
          className="category-select">
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </section>

      {(window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <button type="button"
            onClick={() => {
              if (confirm("Reset vocabulary?")) {
                resetVocabularyState();
                ["licencia_ar_known_clicks","licencia_ar_known_last_counted",
                 "licencia_ar_review_added_at","licencia_ar_reviewed_today"]
                  .forEach((k) => localStorage.removeItem(k));
                setReviewIds([]); setMasteredIds([]); setClicksMap({});
                setStatusMap({}); setReviewedTodayCount(0); setToast(null);
              }
            }}
            style={{
              background:"rgba(255,60,60,0.08)",border:"1px solid rgba(255,60,60,0.25)",
              color:"rgba(255,120,120,0.7)",borderRadius:8,padding:"5px 14px",
              fontSize:"0.75rem",cursor:"pointer",fontFamily:"inherit",
            }}
          >\u26A0 DEV: reset vocab</button>
        </div>
      )}

      {filteredWords.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="flashcards">
          {filteredWords.map((word) => {
            const knownCount = clicksMap[word.id] ?? 0;
            const mastered   = masteredIds.includes(word.id);
            const wordNew    = isWordNew(word.id);
            const wordState  = getWordState(word.id, reviewIds, masteredIds);
            const stateStyle = STATE_STYLES[wordState];
            const inReview   = reviewIds.includes(word.id);
            const justAdded  = justAddedIds.has(word.id);
            const onCooldown = cooldownIds.has(word.id);
            const canCount   = canCountKnownClick(word.id);
            return (
              <article key={word.id}
                className={`flashcard-v2 glass vocab-state-${wordState}`}
                style={{ borderColor: stateStyle.border, boxShadow: `0 0 0 1px ${stateStyle.border}, inset 0 0 40px ${stateStyle.glow}` }}
              >
                <div className="vocab-card-header">
                  <span className="vocab-meta">
                    {wordNew && <span className="vocab-new-badge">NEW</span>}
                  </span>
                  <ProgressDots count={knownCount} mastered={mastered} />
                </div>
                <h2 className="vocab-term">{word.term_es}</h2>
                <p className="vocab-translation">{word.translation_ru}</p>
                <p className="vocab-definition">{word.simpleExplanation_ru}</p>
                <div className="vocab-example-block">
                  <p className="vocab-example-es">{word.example_es}</p>
                  <p className="vocab-example-ru">{word.example_ru}</p>
                </div>
                <div className="vocab-actions">
                  <button type="button"
                    className={`vocab-btn vocab-btn--know${onCooldown ? " vocab-btn--cooldown" : ""}${!canCount && !onCooldown ? " vocab-btn--used" : ""}`}
                    onClick={() => handleKnown(word.id)}
                    title={!canCount ? t("vocab.tip.cooldown", lang) : undefined}
                  >
                    {onCooldown ? t("vocab.btn.knowDone", lang) : t("vocab.btn.know", lang)}
                  </button>
                  <button type="button" className="vocab-btn vocab-btn--repeat" onClick={() => handleRepeat(word.id)}>
                    {t("vocab.btn.repeat", lang)}
                  </button>
                </div>
                <button type="button"
                  className={`vocab-review-btn${inReview ? " vocab-review-btn--active" : ""}${justAdded ? " vocab-review-btn--pulse" : ""}`}
                  onClick={() => handleToggleReview(word.id)}
                >
                  {inReview ? t("vocab.btn.inReview", lang) : t("vocab.btn.add", lang)}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="vocab-toast" role="status" aria-live="polite">
          <div className="vocab-toast-inner">
            <span className="vocab-toast-badge">{toast.clicks}/4</span>
            <div className="vocab-toast-body">
              <span className="vocab-toast-term">{toast.term}</span>
              <span className="vocab-toast-text">
                {toast.clicks >= 4 ? t("vocab.toast.mastered", lang) : t("vocab.toast.counted", lang)}
              </span>
            </div>
            <button type="button" className="vocab-toast-close"
              onClick={() => { setToast(null); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }}
              aria-label={t("pv2.modal.close", lang)}
            >\u00D7</button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
