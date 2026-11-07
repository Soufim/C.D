import { describe, expect, it } from 'vitest';
import { diff, likePattern } from './util';
import { validateUpload } from '../modules/files/file-validation';
import { csvSafe } from '../modules/import-export/columns';

describe('util', () => {
  it('escapes LIKE wildcards', () => {
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
  it('diffs and masks sensitive fields', () => {
    const d = diff(
      { a: 1, passwordHash: 'x', updatedAt: 1 },
      { a: 2, passwordHash: 'y', updatedAt: 2 },
    );
    expect(d).toEqual({ a: { from: 1, to: 2 }, passwordHash: { from: '***', to: '***' } });
  });
});

describe('upload validation', () => {
  it('accepts a real PDF header and rejects disguised content', () => {
    expect(validateUpload('a.pdf', Buffer.from('%PDF-1.7 ...'))).toMatchObject({
      mimeType: 'application/pdf',
    });
    expect(typeof validateUpload('a.pdf', Buffer.from('MZ...'))).toBe('string');
    expect(typeof validateUpload('a.exe', Buffer.from('MZ...'))).toBe('string');
    expect(typeof validateUpload('a.txt', Buffer.from([0x00, 0x01]))).toBe('string');
  });
  it('strips path components from names', () => {
    const r = validateUpload('../../etc/passwd.txt', Buffer.from('hello'));
    expect(r).toMatchObject({ safeName: 'passwd.txt' });
  });
});

describe('csv export', () => {
  it('prefixes formula-like cells', () => {
    expect(csvSafe('=1+1')).toBe("'=1+1");
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvSafe('normal')).toBe('normal');
  });
});
