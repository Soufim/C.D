import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import type { Locale } from '@cdms/contracts';

const saved = (() => {
  try {
    return localStorage.getItem('cdms.locale');
  } catch {
    return null;
  }
})();

export const initialLocale: Locale = saved === 'en' ? 'en' : 'ar';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: initialLocale,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switches UI language and document direction (RTL for Arabic). */
export function applyLocale(locale: Locale) {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  try {
    localStorage.setItem('cdms.locale', locale);
  } catch {
    /* storage unavailable */
  }
}

export default i18n;
