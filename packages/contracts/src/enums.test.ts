import { describe, expect, it } from 'vitest';
import { availableActions, curriculumSchema, templateSchema } from './index';

describe('workflow', () => {
  it('only allows submit/archive from draft', () => {
    expect(availableActions('draft').sort()).toEqual(['archive', 'submit']);
  });
  it('allows approve/return from in_review', () => {
    expect(availableActions('in_review').sort()).toEqual(['approve', 'return']);
  });
});

describe('schemas', () => {
  it('rejects invalid codes', () => {
    expect(curriculumSchema.safeParse({ code: 'bad code', titleEn: 'x', titleAr: 'س' }).success).toBe(false);
  });
  it('rejects duplicate template section keys', () => {
    const r = templateSchema.safeParse({
      code: 'T1', nameEn: 'T', nameAr: 'ت', kind: 'curriculum',
      sections: [
        { key: 'a', titleEn: 'A', titleAr: 'أ' },
        { key: 'a', titleEn: 'B', titleAr: 'ب' },
      ],
    });
    expect(r.success).toBe(false);
  });
});
