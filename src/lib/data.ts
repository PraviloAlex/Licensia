import verifiedQuestions from "../data/questions.verified.json";
import glossary from "../data/glossary.json";
import practicalExam from "../data/practicalExam.json";

import type { VerifiedQuestion } from "../types/question";
import type { GlossaryEntry } from "../types/glossary";
import type { PracticalExamItem } from "../types/practicalExam";

// Do not use generated questions in production. Only verified exact-source questions are allowed.
const allVerifiedQuestions = verifiedQuestions as VerifiedQuestion[];

export const questionsData = allVerifiedQuestions.filter(
  (q) => q.isExactOriginal === true && q.source?.verified === true,
);

export const glossaryData = glossary as GlossaryEntry[];
export const practicalExamData = practicalExam as PracticalExamItem[];
