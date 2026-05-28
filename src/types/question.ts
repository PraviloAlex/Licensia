export type QuestionOption = {
  id: string;
  text_es: string;
  text_ru: string;
};

export type QuestionImage = {
  src: string;
  alt_es: string;
  alt_ru: string;
  sourceUrl?: string;
};

export type QuestionSource = {
  name: string;
  url: string;
  page: number | null;
  collectedAt: string;
  verified: boolean;
};

export type VerifiedQuestion = {
  id: string;
  source: QuestionSource;
  region: string;
  licenseCategory: string;
  topic: string;
  subtopic?: string;
  question_es: string;
  question_ru: string;
  image: QuestionImage | null;
  options: QuestionOption[];
  correctOptionId: string;
  explanation_ru: string;
  memoryHint_ru: string;
  glossaryIds: string[];
  isExactOriginal: boolean;
};
