import path from 'node:path';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '@cdms/contracts';

const startsWith = (buf: Buffer, sig: number[]) => sig.every((b, i) => buf[i] === b);

/** Content sniffing — the declared MIME type and extension are never trusted alone. */
function contentMatches(mime: string, buf: Buffer): boolean {
  switch (mime) {
    case 'application/pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'image/png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'text/csv':
    case 'text/plain':
      return !buf.includes(0) && Buffer.from(buf.toString('utf8'), 'utf8').equals(buf);
    default:
      // OOXML (docx/xlsx/pptx) are ZIP containers.
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
  }
}

export interface ValidatedFile {
  mimeType: string;
  safeName: string;
}

/** Validates an upload: size, extension allow-list, extension↔MIME consistency and magic bytes. */
export function validateUpload(originalName: string, buf: Buffer): ValidatedFile | string {
  if (!buf.length) return 'File is empty';
  if (buf.length > MAX_UPLOAD_BYTES) return 'File is too large';
  const ext = path.extname(originalName).toLowerCase();
  const entry = Object.entries(ALLOWED_UPLOAD_TYPES).find(([, exts]) =>
    (exts as readonly string[]).includes(ext),
  );
  if (!entry) return `File type ${ext || '(none)'} is not allowed`;
  const [mimeType] = entry;
  if (!contentMatches(mimeType, buf)) return 'File content does not match its extension';
  // Strip path components and control characters; keep Arabic/Latin letters.
  const safeName =
    path
      .basename(originalName)
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
      .slice(0, 200) || `file${ext}`;
  return { mimeType, safeName };
}
