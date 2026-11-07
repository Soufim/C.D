import { useTranslation } from 'react-i18next';

/**
 * Locale-aware formatting. Arabic UI uses Arabic-Indic digits only where the user prefers;
 * we default to Latin digits (ar-EG-u-nu-latn) because codes, hours and identifiers mix with
 * Latin text — a deliberate, documented choice (docs/design-system.md#numbers).
 */
const tag = (lng: string) => (lng === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

export function useFormat() {
  const { i18n } = useTranslation();
  const locale = tag(i18n.language);
  return {
    locale,
    date: (v: string | Date | null | undefined) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(v)) : '—'),
    dateTime: (v: string | Date | null | undefined) => (v ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—'),
    relative: (v: string | Date) => {
      const diff = (new Date(v).getTime() - Date.now()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
      const abs = Math.abs(diff);
      if (abs < 60) return rtf.format(Math.round(diff), 'second');
      if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
      if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
      return rtf.format(Math.round(diff / 86400), 'day');
    },
    number: (v: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(v),
    bytes: (v: number) => {
      const u = ['B', 'KB', 'MB', 'GB'];
      let i = 0;
      let n = v;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n)} ${u[i]}`;
    },
  };
}

/** Picks the field for the current UI language with fallback to the other language. */
export function useBilingual() {
  const { i18n } = useTranslation();
  const ar = i18n.language === 'ar';
  return {
    isAr: ar,
    /** pick(record, 'title') → record.titleAr / record.titleEn */
    pick: (rec: object | null | undefined, base: string): string => {
      if (!rec) return '';
      const r = rec as Record<string, unknown>;
      const primary = r[`${base}${ar ? 'Ar' : 'En'}`] as string | null | undefined;
      const other = r[`${base}${ar ? 'En' : 'Ar'}`] as string | null | undefined;
      return primary || other || '';
    },
    /** Picks between two literal strings. */
    t2: (en: string | null | undefined, arText: string | null | undefined) => (ar ? arText || en : en || arText) ?? '',
  };
}
