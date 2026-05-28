export type PracticalExamItem = {
  id: string;
  stage: "pre_check" | "driving" | "parking";
  title_es: string;
  title_ru: string;
  whatExaminerChecks_ru: string;
  commonMistake_ru: string;
  correctAction_ru: string;
  source: string;
};
