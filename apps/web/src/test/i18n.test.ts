import { describe, expect, it } from 'vitest';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );

describe('translations', () => {
  it('Arabic and English define exactly the same keys', () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it('have no empty strings', () => {
    const empty = (o: object): string[] =>
      keys(o).filter(
        (k) => k.split('.').reduce<unknown>((a, x) => (a as Record<string, unknown>)[x], o) === '',
      );
    expect(empty(en)).toEqual([]);
    expect(empty(ar)).toEqual([]);
  });
});
