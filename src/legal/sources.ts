export type LegalSource = {
  id: string;
  title: string;
  organization: string;
  url?: string;
  verified?: boolean;
  descriptionRu: string;
  descriptionEs: string;
};

export const LEGAL_SOURCES: LegalSource[] = [
  {
    id: "gcba-study-material",
    title: "Material de estudio para el examen teórico",
    organization: "Gobierno de la Ciudad de Buenos Aires",
    descriptionRu: "Официальные материалы для подготовки к теоретическому экзамену.",
    descriptionEs: "Materiales oficiales para preparar el examen teórico.",
  },
  {
    id: "gcba-license-process",
    title: "Otorgamiento de Licencia de Conducir",
    organization: "Buenos Aires Ciudad",
    descriptionRu: "Официальная информация о процедуре, требованиях и этапах получения водительской лицензии.",
    descriptionEs: "Información oficial sobre el trámite, requisitos y etapas para obtener la licencia de conducir.",
  },
  {
    id: "gcba-vehicle-manual",
    title: "Manual de conducción vehicular",
    organization: "Buenos Aires Ciudad",
    descriptionRu: "Учебный материал для категорий транспортных средств с четырьмя колёсами.",
    descriptionEs: "Manual de estudio para categorías de vehículos de cuatro ruedas.",
  },
  {
    id: "gcba-motorcycle-manual",
    title: "Manual de conducción motovehicular",
    organization: "Buenos Aires Ciudad",
    descriptionRu: "Учебный материал для подготовки к категориям мото.",
    descriptionEs: "Manual de estudio para preparación de categorías de moto.",
  },
];
