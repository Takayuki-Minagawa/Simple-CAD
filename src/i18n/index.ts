import { create } from 'zustand';
import type { Locale, Translations } from './types';
import { ja } from './ja';
import { en } from './en';

export type { Locale, Translations };

const dictionaries: Record<Locale, Translations> = { ja, en };

interface I18nState {
  locale: Locale;
  t: Translations;
  setLocale: (locale: Locale) => void;
}

export const useI18n = create<I18nState>()((set) => ({
  locale: 'ja',
  t: dictionaries.ja,
  setLocale: (locale) =>
    set({
      locale,
      t: dictionaries[locale],
    }),
}));
