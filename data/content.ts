import { useLanguage } from '@/context/LanguageContext';
import type { Language } from '@/i18n';
import type { PageData } from '@/types';

import zhDose from './zh/dose.json';
import zhCardiac from './zh/cardiac.json';
import zhDual from './zh/dual-energy.json';
import zhRecon from './zh/reconstruction.json';
import zhQuestions from './zh/questions.json';
import enDose from './en/dose.json';
import enCardiac from './en/cardiac.json';
import enDual from './en/dual-energy.json';
import enRecon from './en/reconstruction.json';
import enQuestions from './en/questions.json';

/**
 * Bilingual page content. Each page has one JSON file per language under
 * data/zh/ and data/en/, keyed by the same stable ids (section `id`,
 * question `id`). `scripts/check-i18n.mjs` verifies the two trees have the
 * same ids, option counts and answer indices.
 */

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizData {
  title: string;
  description: string;
  questions: QuizQuestion[];
}

export interface ContentMap {
  dose: PageData;
  cardiac: PageData;
  dualEnergy: PageData;
  reconstruction: PageData;
  questions: QuizData;
}

export type ContentPage = keyof ContentMap;

const content: Record<Language, ContentMap> = {
  zh: {
    dose: zhDose as PageData,
    cardiac: zhCardiac as PageData,
    dualEnergy: zhDual as PageData,
    reconstruction: zhRecon as PageData,
    questions: zhQuestions as QuizData,
  },
  en: {
    dose: enDose as PageData,
    cardiac: enCardiac as PageData,
    dualEnergy: enDual as PageData,
    reconstruction: enRecon as PageData,
    questions: enQuestions as QuizData,
  },
};

export function getContent<P extends ContentPage>(language: Language, page: P): ContentMap[P] {
  return content[language][page];
}

/** React hook: content of `page` in the currently selected language. */
export function useContent<P extends ContentPage>(page: P): ContentMap[P] {
  const { language } = useLanguage();
  return getContent(language, page);
}
