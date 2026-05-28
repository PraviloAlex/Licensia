export type GlossaryCategory = "prioridad" | "infraestructura" | "maniobra" | "seguridad" | "via";

export type GlossaryLevel = "basic" | "medium" | "advanced";

export type GlossaryEntry = {
  id: string;
  term_es: string;
  translation_ru: string;
  simpleExplanation_ru: string;
  officialMeaning_es: string;
  example_es: string;
  example_ru: string;
  category: GlossaryCategory;
  level: GlossaryLevel;
  relatedQuestionTopics: string[];
  source: {
    name: string;
    page: number;
    verified: boolean;
  };
};
